# Deploy Pipeline

Folhário deploys exclusively from GitHub Actions. Vercel git integration is **disabled** — Vercel never triggers its own builds. Three workflows cover the full lifecycle: preview per PR, production on merge to main, and cleanup on PR close.

---

## Pipeline Overview

```
PR open/push
  └─ CI (ci.yml) ─────────────────────────────────────────────► pass
       └─ deploy-preview.yml (workflow_run) ─────────────────────────►
            ├─ pnpm install + vercel pull (preview env)
            ├─ pnpm db:setup → shared preview Supabase project
            ├─ vercel build
            ├─ vercel deploy --prebuilt --meta githubPrNumber={N}
            ├─ Playwright smoke → preview URL
            └─ Upsert PR comment (URL + SHA)

PR closed (merged or abandoned)
  └─ deploy-preview-cleanup.yml ──────────────────────────────────────►
       └─ vercel list --meta githubPrNumber={N} → vercel remove

push to main
  └─ CI (ci.yml) ─────────────────────────────────────────────► pass
       └─ deploy-production.yml (workflow_run) ──────────────────────►
            ├─ environment: production gate (required reviewers)
            ├─ pnpm install + vercel pull (production env)
            ├─ Destructive-SQL soft warning to step summary
            ├─ pnpm db:migrate → production DB
            ├─ vercel build + vercel deploy --prebuilt --prod
            ├─ Playwright smoke → folhario.vercel.app
            ├─ sentry-cli: create release + upload source maps
            └─ POST /api/inngest (Inngest function sync)
```

---

## Workflows

### 1. `deploy-preview.yml`

**Trigger:** `workflow_run` on `CI` workflow, `types: [completed]`, on any branch except `main`.
Exits early if `github.event.workflow_run.conclusion != 'success'`.

> **Note:** `workflow_run` always executes the workflow file from the **default branch** (`main`). Changes to `deploy-preview.yml` in a PR do not take effect until the PR is merged.
> **Fork PRs:** `github.event.workflow_run.pull_requests[0]` is empty for forks. Preview deploys are not supported for fork PRs.

**Concurrency:** group `deploy-preview-${{ github.event.workflow_run.pull_requests[0].number }}`, `cancel-in-progress: true`.
The latest push to a PR wins; the older run is cancelled immediately.

**Steps:**

1. **Install dependencies** — `pnpm install --frozen-lockfile` (pnpm store cached by lockfile hash, same pattern as `ci.yml`).
2. **DB setup** — `pnpm db:setup` using `DATABASE_URL` from the shared preview Supabase project (injected via `vercel pull` below — preview environment variables in Vercel). Runs migrate + seed + check-rls + check-seeds. The last PR to deploy wins; Drizzle won't re-apply already-applied migrations.
   - ⚠️ **Shared DB tradeoff:** Two PRs deploying simultaneously could race the `db:setup` step. Acceptable for a small team. If it becomes an issue, add a global `concurrency: deploy-preview, cancel-in-progress: false` to serialize all preview deploys.
3. **Vercel build**
   - `vercel pull --yes --environment=preview --token=$VERCEL_TOKEN` — fetches preview env vars from Vercel (including `DATABASE_URL`/`DATABASE_POOL_URL` for the shared preview project); `NEXT_PUBLIC_*` values will be the real preview values, not localhost CI stubs.
   - `vercel build --token=$VERCEL_TOKEN`
   - `vercel deploy --prebuilt --meta githubPrNumber=${{ github.event.workflow_run.pull_requests[0].number }} --meta githubCommitSha=${{ github.event.workflow_run.head_sha }} --token=$VERCEL_TOKEN`
   - Capture the returned preview URL.
4. **Playwright smoke** — `pnpm test:e2e:smoke` with `PLAYWRIGHT_TEST_BASE_URL` set to the preview URL.
5. **PR comment** — upsert a comment on the PR identified by the HTML marker `<!-- folhario-preview-deploy -->`. Content: preview URL + commit SHA. If smoke failed, include a failure note. Uses `actions/github-script`.

**GH secrets used:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_DSN_CI`, `POSTHOG_KEY_CI`

**Preview DB credentials** are stored in Vercel's **preview** environment variables (`DATABASE_URL`, `DATABASE_POOL_URL`) and injected via `vercel pull`. They are not GH secrets.

---

### 2. `deploy-production.yml`

**Trigger:** `workflow_run` on `CI` workflow, `types: [completed]`, `branches: [main]`.
Exits early if `github.event.workflow_run.conclusion != 'success'`.

**Concurrency:** group `deploy-production`, `cancel-in-progress: false` (serialized — prevents a second deploy from racing a migration mid-flight).

> **Note:** Same `workflow_run` caveats apply as in `deploy-preview.yml` — workflow file is always from `main`; fork handling not applicable for production.

**Steps:**

1. **environment: production gate** — GitHub environment with required reviewers configured in repo settings. The workflow pauses here; a reviewer approves before any migration or deploy runs.
2. **Install dependencies** — `pnpm install --frozen-lockfile`.
3. **Destructive migration check** — grep migration files for `DROP`, `ALTER TABLE.*DROP COLUMN`, `TRUNCATE`. Write a warning to `$GITHUB_STEP_SUMMARY` if found. This is a soft warning — the human at the environment gate makes the final call.
4. **Production DB migration** — `pnpm db:migrate` with production `DATABASE_URL` (direct URL from GH secret, not pooler — migrations require DDL transactions; do not use the pooler URL from `vercel pull`).
5. **Vercel build + deploy**
   - `vercel pull --yes --environment=production --token=$VERCEL_TOKEN` — fetches production env vars; `NEXT_PUBLIC_*` values will be the real production values.
   - `vercel build --token=$VERCEL_TOKEN`
   - `vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN`
6. **Playwright smoke** — `pnpm test:e2e:smoke` with `PLAYWRIGHT_TEST_BASE_URL=https://folhario.vercel.app`. Confirms production edge config, headers, and PWA manifest.
7. **Sentry release**
   - `sentry-cli releases new ${{ github.sha }}`
   - `sentry-cli releases files ${{ github.sha }} upload-sourcemaps .next/`
   - `sentry-cli releases finalize ${{ github.sha }}`
8. **Inngest sync** — `curl -X POST https://folhario.vercel.app/api/inngest`. Triggers Inngest to re-register functions from the new deploy.

**GH secrets used:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PROD_DATABASE_DIRECT_URL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_DSN_CI`, `POSTHOG_KEY_CI`

**Production DB connection** — step 4 uses `${{ secrets.PROD_DATABASE_DIRECT_URL }}` as `DATABASE_URL`. Do not use `vercel pull` output here — it returns the pooler URL, which does not support DDL transactions required by migrations.

---

### 3. `deploy-preview-cleanup.yml`

**Trigger:** `pull_request`, `types: [closed]` (covers both merged and abandoned PRs).

**Concurrency:** group `cleanup-pr-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`.

**Steps:**

1. **Delete Vercel preview deployment**
   - `vercel list --meta githubPrNumber=${{ github.event.pull_request.number }} --token=$VERCEL_TOKEN` → extract deployment URL(s)
   - `vercel remove <url> --yes --token=$VERCEL_TOKEN` for each result

No Supabase cleanup needed — all PRs share the same preview project; there is no per-PR DB to delete.

**GH secrets used:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

---

## Secrets Inventory

All secrets are stored as GitHub Actions repo secrets (Settings → Secrets and variables → Actions).

| Secret                     | Used by                      | Purpose                                                |
| -------------------------- | ---------------------------- | ------------------------------------------------------ |
| `VERCEL_TOKEN`             | preview, production, cleanup | Vercel CLI authentication                              |
| `VERCEL_ORG_ID`            | preview, production, cleanup | Vercel org scope                                       |
| `VERCEL_PROJECT_ID`        | preview, production, cleanup | Vercel project scope                                   |
| `SENTRY_AUTH_TOKEN`        | production                   | Source map upload via sentry-cli                       |
| `SENTRY_ORG`               | production                   | Sentry org slug                                        |
| `SENTRY_PROJECT`           | production                   | Sentry project slug                                    |
| `SENTRY_DSN_CI`            | preview, production          | Sentry DSN for build-time config                       |
| `POSTHOG_KEY_CI`           | preview, production          | PostHog key for build-time config                      |
| `PROD_DATABASE_DIRECT_URL` | production                   | Direct (non-pooler) Postgres URL for `pnpm db:migrate` |

Runtime app secrets (`DATABASE_URL`, `DATABASE_POOL_URL`, API keys, etc.) are stored in Vercel environment variables — separately configured for `preview` and `production` environments — and injected via `vercel pull`. They are **not** GH secrets.

- **Preview** `DATABASE_URL`/`DATABASE_POOL_URL` → shared preview Supabase project credentials, set in Vercel preview env vars.
- **Production** `DATABASE_URL`/`DATABASE_POOL_URL` → production Supabase project pooler URL, set in Vercel production env vars.
- **`PROD_DATABASE_DIRECT_URL`** is a GH secret (not a Vercel env var) because `pnpm db:migrate` needs a direct connection for DDL, and `vercel pull` only returns the pooler URL.

---

## First-Time Setup Checklist

**Vercel**

- [ ] Create Vercel project for Folhário; confirm git integration is **OFF** in project settings
- [ ] Run `vercel link` locally to obtain `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`; add both as GH secrets
- [ ] Generate a Vercel token (Account Settings → Tokens); add as `VERCEL_TOKEN` GH secret
- [ ] Configure all app runtime env vars in Vercel for both `preview` and `production` environments (DATABASE_URL, DATABASE_POOL_URL, RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST, IDENTIFICATION_PROVIDER_MODE, etc.)

**Supabase**

- [ ] Create a **second** Supabase project (free plan allows 2) as the shared preview environment
- [ ] Set preview project's `DATABASE_URL` and `DATABASE_POOL_URL` as Vercel **preview** environment variables
- [ ] Set production project's `DATABASE_URL` and `DATABASE_POOL_URL` as Vercel **production** environment variables
- [ ] Add production project's direct connection URL as `PROD_DATABASE_DIRECT_URL` GH secret

**GitHub**

- [ ] Create a GitHub Actions environment named `production` (Settings → Environments); add required reviewers
- [ ] Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as GH secrets
- [ ] Add `SENTRY_DSN_CI` and `POSTHOG_KEY_CI` as GH secrets (already present from Phase 1 if CI is passing)

---

## Setup Instructions

### 1. Confirm Vercel git integration is OFF

1. Go to [vercel.com](https://vercel.com) → your `folhario` project → **Settings** → **Git**
2. Under "Git Connection", confirm no repository is connected. If one is connected, disconnect it.
3. Vercel should show no connected repository — all deploys will come from GitHub Actions only.

---

### 2. Run `vercel link` and add Vercel secrets to GitHub

```bash
pnpm add -g vercel
vercel link   # follow prompts; creates .vercel/project.json
cat .vercel/project.json   # copy projectId and orgId
```

```bash
gh secret set VERCEL_ORG_ID --repo aesir-tecnologia/folhario
gh secret set VERCEL_PROJECT_ID --repo aesir-tecnologia/folhario
```

Then generate a token: **vercel.com → Account Settings → Tokens → Create** (scope: your team, no expiry).

```bash
gh secret set VERCEL_TOKEN --repo aesir-tecnologia/folhario
```

---

### 3. Create two Supabase cloud projects

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Create **`folhario-production`** — choose a strong DB password, save it.
3. Create **`folhario-preview`** — separate project, different password.

For **each project**, go to **Settings → Database** and note:

- **Connection string → Transaction pooler** (port `6543`) → this is `DATABASE_URL` / `DATABASE_POOL_URL`
- **Connection string → Direct connection** (port `5432`) → this is the direct URL for migrations

Also note from **Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

Initialize both projects (run locally with each project's direct URL):

```bash
# Production
DATABASE_URL=<prod-direct-url> pnpm db:setup

# Preview
DATABASE_URL=<preview-direct-url> pnpm db:setup
```

---

### 4. Configure Vercel environment variables

Go to **vercel.com → folhario project → Settings → Environment Variables**.

Add each variable and select the correct environment scope (`Preview` or `Production`):

| Variable                        | Preview value                            | Production value                          |
| ------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `DATABASE_URL`                  | preview project transaction-pooler URL   | production project transaction-pooler URL |
| `DATABASE_POOL_URL`             | same as `DATABASE_URL`                   | same as `DATABASE_URL`                    |
| `NEXT_PUBLIC_SUPABASE_URL`      | preview project URL                      | production project URL                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | preview anon key                         | production anon key                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | preview service_role key                 | production service_role key               |
| `IDENTIFICATION_PROVIDER_MODE`  | `stub`                                   | `real`                                    |
| `RESEND_API_KEY`                | _(leave blank or use test key)_          | production Resend key                     |
| `RESEND_FROM_ADDRESS`           | _(leave blank — defaults to resend.dev)_ | your verified sender address              |
| `INNGEST_EVENT_KEY`             | _(leave blank until Phase 4 wired)_      | Inngest event key                         |
| `INNGEST_SIGNING_KEY`           | _(leave blank until Phase 4 wired)_      | Inngest signing key                       |
| `NEXT_PUBLIC_SENTRY_DSN`        | your Sentry DSN                          | your Sentry DSN                           |
| `NEXT_PUBLIC_POSTHOG_KEY`       | your PostHog key                         | your PostHog key                          |
| `NEXT_PUBLIC_POSTHOG_HOST`      | `https://us.i.posthog.com`               | `https://us.i.posthog.com`                |

> `DATABASE_URL` must include `?pgbouncer=true` if using Supavisor transaction mode with `postgres-js`. Confirm the connection string format in the Supabase dashboard — it is already formatted correctly if you copy from "Transaction pooler".

---

### 5. Add production direct URL as a GitHub secret

```bash
gh secret set PROD_DATABASE_DIRECT_URL --repo aesir-tecnologia/folhario
# paste the production direct connection URL (port 5432) when prompted
```

---

### 6. Create GitHub production environment

1. Go to **github.com → aesir-tecnologia/folhario → Settings → Environments → New environment**
2. Name it **`production`**
3. Under "Deployment protection rules", enable **Required reviewers** and add yourself
4. Save

---

### 7. Add remaining GitHub secrets

```bash
gh secret set SENTRY_AUTH_TOKEN --repo aesir-tecnologia/folhario
gh secret set SENTRY_ORG --repo aesir-tecnologia/folhario
gh secret set SENTRY_PROJECT --repo aesir-tecnologia/folhario
```

`SENTRY_DSN_CI` and `POSTHOG_KEY_CI` are already present from Phase 1.

---

## Rollback

**Fast rollback (no DB changes):** In Vercel dashboard → Deployments, promote a prior deployment to production. Or via CLI: `vercel promote <deployment-url> --scope=<org>`.

**Rollback with DB migration:** Revert the commit, push to a new branch, open a PR. The deploy pipeline will apply any down-migrations included in the revert before deploying. There is no automatic migration rollback — ensure every destructive migration ships with a corresponding down-migration.

---

## Notes

**Supabase free plan — no branch DBs:** INFRA-13 in REQUIREMENTS.md originally specified per-PR Supabase branch DBs. Branching requires a paid plan. Phase 12 uses a shared preview Supabase project instead. Per-PR isolation is the upgrade path when budget allows.

**Shared preview DB race condition:** If two PRs deploy simultaneously, `pnpm db:setup` can run concurrently against the shared preview DB. Drizzle migrations are idempotent (won't re-apply), so concurrent runs of identical migrations are safe. Structural conflicts between two PRs' migrations are not protected against — acceptable for a small team. Mitigation if needed: change preview concurrency to a single global group with `cancel-in-progress: false`.

**No build artifact reuse between CI and deploy:** `vercel build` runs `next build` internally and injects `NEXT_PUBLIC_*` values from the Vercel environment at build time. The CI build uses localhost stub values (`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`, etc.) that must not ship to preview or production. Each deploy workflow runs its own full install + `vercel pull` + `vercel build` to get the correct env-specific bundle.
