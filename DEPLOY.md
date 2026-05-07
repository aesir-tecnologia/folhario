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

**Trigger:** `workflow_run` on `CI` workflow, `types: [completed]`, `branches-ignore: [main]`.
Job-level guard skips runs that aren't tied to a PR:

```yaml
if: >-
  github.event.workflow_run.conclusion == 'success' &&
  github.event.workflow_run.event == 'pull_request' &&
  github.event.workflow_run.pull_requests[0] != null
```

> **Note:** `workflow_run` always executes the workflow file from the **default branch** (`main`). Changes to `deploy-preview.yml` in a PR do not take effect until the PR is merged. The CI workflow at `.github/workflows/ci.yml` runs on both `pull_request` and `push` to `main`; the `event == 'pull_request'` guard above prevents preview deploys from firing on the `main`-push CI run (which `deploy-production.yml` handles separately).
> **Fork PRs:** `github.event.workflow_run.pull_requests[0]` is empty for forks (and for any branch push not associated with an open PR). The guard above skips both cases. Preview deploys are not supported for fork PRs.

**Concurrency:** group `deploy-preview-pr-${{ github.event.workflow_run.pull_requests[0].number }}`, `cancel-in-progress: true`.
The latest push to a PR wins; the older preview-deploy run is cancelled immediately. (The CI run that triggered the older preview is governed by `ci.yml`'s own concurrency, not this group.)

**Steps:**

1. **Install dependencies** — `pnpm install --frozen-lockfile` (pnpm store cached by lockfile hash, same pattern as `ci.yml`).
2. **Vercel pull (preview)** — `vercel pull --yes --environment=preview --token=$VERCEL_TOKEN`. Writes `.vercel/.env.preview.local`. Then export those values into the shell so subsequent steps (notably `db:setup`) can see `DATABASE_URL`/`DATABASE_POOL_URL`/`NEXT_PUBLIC_*`:

   ```bash
   set -a
   source .vercel/.env.preview.local
   set +a
   ```

   `vercel pull` itself does **not** export env vars to the shell; only `vercel build` reads the file automatically. The explicit `source` step is required for `pnpm db:setup` below.

3. **DB setup** — `pnpm db:setup` against the shared preview Supabase project (`DATABASE_URL` now in the shell from step 2). Runs migrate + seed + check-rls + check-seeds. The last PR to deploy wins; Drizzle won't re-apply already-applied migrations.
   - ⚠️ **Shared DB tradeoff:** Two PRs deploying simultaneously could race the `db:setup` step. Acceptable for a small team. If it becomes an issue, add a global `concurrency: deploy-preview, cancel-in-progress: false` to serialize all preview deploys.
4. **Vercel build + deploy**
   - `vercel build --token=$VERCEL_TOKEN`
   - Capture the deployment URL into a step output:

     ```bash
     URL=$(vercel deploy --prebuilt \
       --meta githubPrNumber=${{ github.event.workflow_run.pull_requests[0].number }} \
       --meta githubCommitSha=${{ github.event.workflow_run.head_sha }} \
       --token=$VERCEL_TOKEN)
     echo "url=$URL" >> "$GITHUB_OUTPUT"
     ```

5. **Playwright smoke** — `pnpm test:e2e:smoke` with `PLAYWRIGHT_TEST_BASE_URL=${{ steps.deploy.outputs.url }}`.
   > **Note:** `test:e2e:smoke` resolves to `playwright test security-headers pwa-smoke legal-links horizontal-scroll-guard`. Confirm these specs are environment-agnostic before pointing them at the real preview URL — they were originally written against the local `db:start` + stub identification setup. Specs that touch `/login` or any auth flow may behave differently against a real Supabase preview project.
6. **PR comment** — upsert a comment on the PR identified by the HTML marker `<!-- folhario-preview-deploy -->`. Content: preview URL + commit SHA. If smoke failed, include a failure note. Uses `actions/github-script`.

**GH secrets used:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_DSN_CI`, `POSTHOG_KEY_CI`

**Preview DB credentials** are stored in Vercel's **preview** environment variables (`DATABASE_URL`, `DATABASE_POOL_URL`) and made available to the workflow by `vercel pull` writing `.vercel/.env.preview.local`, which step 2 then sources into the shell. They are not GH secrets.

---

### 2. `deploy-production.yml`

**Trigger:** `workflow_run` on `CI` workflow, `types: [completed]`, `branches: [main]`.
Job-level guard: `if: github.event.workflow_run.conclusion == 'success'`.

**Job-level gate:** the deploy job declares `environment: production` (a job-level key, not a step). GitHub pauses the _entire job_ before any step runs and requires a reviewer to approve. All steps below execute only after approval.

**Concurrency:** group `deploy-production`, `cancel-in-progress: false` (serialized — prevents a second deploy from racing a migration mid-flight).

> **Note:** Same `workflow_run` caveats apply as in `deploy-preview.yml` — workflow file is always from `main`; fork handling not applicable for production.

**Steps:**

1. **Install dependencies** — `pnpm install --frozen-lockfile`.
2. **Destructive migration check** — grep migration files for `DROP`, `ALTER TABLE.*DROP COLUMN`, `TRUNCATE`. Write a warning to `$GITHUB_STEP_SUMMARY` if found. This is a soft warning — the human at the environment gate (already passed by this point) is also notified by re-running this against the merge commit; the destructive output appears in the summary regardless.
3. **Production DB migration** — `pnpm db:migrate` with `DATABASE_URL=${{ secrets.PROD_DATABASE_MIGRATION_URL }}` (session-pooler URL, port 5432 on `aws-N-<region>.pooler.supabase.com`). The session pooler is used because GitHub Actions runners are IPv4-only by default and Supabase's direct connection is IPv6-only on free tier; the **transaction** pooler at port 6543 is unsafe for migrations because pgbouncer transaction mode breaks session-scoped features the migration runner can rely on, but the **session** pooler at port 5432 has full Postgres semantics. `scripts/migrate.ts` reads `DATABASE_URL` directly. Also set `DATABASE_POOL_URL` to the same URL for this step — `serverEnv` validates both at module import time even if only one is used.
4. **Vercel pull (production)** — `vercel pull --yes --environment=production --token=$VERCEL_TOKEN`. Writes `.vercel/.env.production.local`. `vercel build` will read it automatically; no `source` step required here because no other step in this workflow needs the runtime env in the shell (migrations use the GH secret directly).
5. **Vercel build + deploy**
   - `vercel build --token=$VERCEL_TOKEN`
   - Capture the deployment URL:

     ```bash
     URL=$(vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN)
     echo "url=$URL" >> "$GITHUB_OUTPUT"
     ```

   The `--prod` flag promotes this deployment to the production alias. The alias swap can lag a few seconds; subsequent steps that need the _new_ build should hit `$URL` (the deployment URL), not the production hostname.

6. **Playwright smoke** — `pnpm test:e2e:smoke` with `PLAYWRIGHT_TEST_BASE_URL=${{ steps.deploy.outputs.url }}`. Confirms production edge config, headers, and PWA manifest. Use the deployment URL captured in step 5, not the production alias, to avoid racing the alias swap. **Same environment-agnostic caveat as preview step 5** — confirm the four smoke specs work against a real Supabase production project.
7. **Sentry release** — gated on smoke success (`if: success()`) so a failed deploy does not pollute Sentry releases. Pass org/project via env:

   ```yaml
   env:
     SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
     SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
     SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
   run: |
     sentry-cli releases new "${{ github.sha }}"
     sentry-cli releases files "${{ github.sha }}" upload-sourcemaps .vercel/output --url-prefix '~/_next'
     sentry-cli releases finalize "${{ github.sha }}"
   ```

   > Source-map path: `vercel build --prebuilt` writes to `.vercel/output/`, not `.next/`. Verify the exact location of client-side maps before merging — depending on Turbopack config (`productionBrowserSourceMaps`, `widenClientFileUpload`), maps may live under `.vercel/output/static/_next/` or `.next/static/`. Keep `--url-prefix '~/_next'` so Sentry can match URLs at runtime.

8. **Inngest sync** — `curl -X POST "${{ steps.deploy.outputs.url }}/api/inngest"` against the new deployment URL (not the production alias) so re-registration targets the build that just shipped, even if alias swap is still in flight.

**GH secrets used:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PROD_DATABASE_MIGRATION_URL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_DSN_CI`, `POSTHOG_KEY_CI`

**Production DB connection** — step 3 uses `${{ secrets.PROD_DATABASE_MIGRATION_URL }}` as `DATABASE_URL` (session-pooler URL, port 5432). The transaction-pooler URL from Vercel is the _runtime_ connection (used by the deployed app via `vercel pull` → build-time injection → Vercel runtime injection). It is not used by the deploy workflow's migration step.

---

### 3. `deploy-preview-cleanup.yml`

**Trigger:** `pull_request`, `types: [closed]` (covers both merged and abandoned PRs).

**Concurrency:** group `cleanup-pr-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`.

**Steps:**

1. **Delete Vercel preview deployment(s)** — `vercel list` returns a human-readable table by default; pass `--json` (or use `--meta` + a JSON-aware parser) to extract URLs reliably:

   ```bash
   vercel list \
     --meta githubPrNumber=${{ github.event.pull_request.number }} \
     --token=$VERCEL_TOKEN --json |
     jq -r '.[].url' |
     while read -r u; do
       vercel remove "$u" --yes --token=$VERCEL_TOKEN
     done
   ```

   If `vercel list` does not support `--json` in the installed CLI version, use `vercel inspect` per deployment ID, or pin the CLI version in the workflow.

No Supabase cleanup needed — all PRs share the same preview project; there is no per-PR DB to delete.

**GH secrets used:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

---

## Secrets Inventory

All secrets are stored as GitHub Actions repo secrets (Settings → Secrets and variables → Actions).

| Secret                        | Used by                      | Purpose                                                                                                                                             |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`                | preview, production, cleanup | Vercel CLI authentication                                                                                                                           |
| `VERCEL_ORG_ID`               | preview, production, cleanup | Vercel org scope                                                                                                                                    |
| `VERCEL_PROJECT_ID`           | preview, production, cleanup | Vercel project scope                                                                                                                                |
| `SENTRY_AUTH_TOKEN`           | production                   | Source map upload via sentry-cli                                                                                                                    |
| `SENTRY_ORG`                  | production                   | Sentry org slug                                                                                                                                     |
| `SENTRY_PROJECT`              | production                   | Sentry project slug                                                                                                                                 |
| `SENTRY_DSN_CI`               | preview, production          | Sentry DSN for build-time config                                                                                                                    |
| `POSTHOG_KEY_CI`              | preview, production          | PostHog key for build-time config                                                                                                                   |
| `PROD_DATABASE_MIGRATION_URL` | production                   | Session-pooler Postgres URL (port 5432 on `aws-N-<region>.pooler.supabase.com`) for `pnpm db:migrate` — IPv4-compatible from GitHub Actions runners |

Runtime app secrets (`DATABASE_URL`, `DATABASE_POOL_URL`, API keys, etc.) are stored in Vercel environment variables — separately configured for `preview` and `production` environments. `vercel pull` writes them to `.vercel/.env.<environment>.local`; `vercel build` reads that file automatically. The deploy workflow `source`s the file into the shell only when a non-build step needs the values (currently just preview `db:setup`). On Vercel itself, the runtime injects these env vars into the deployed app. They are **not** GH secrets.

- **Preview** `DATABASE_URL`/`DATABASE_POOL_URL` → shared preview Supabase project credentials, set in Vercel preview env vars. Both point at the Supavisor transaction-mode pooler (port 6543) — the app is the only consumer at runtime, and the pooler is what `postgres-js` with `{ prepare: false }` is configured for.
- **Production** `DATABASE_URL`/`DATABASE_POOL_URL` → production Supabase project pooler URL (port 6543), set in Vercel production env vars. Same rationale as preview.
- **`PROD_DATABASE_MIGRATION_URL`** is a GH secret (not a Vercel env var) because `pnpm db:migrate` needs a non-transaction-pooled connection. The session pooler (port 5432 on `aws-N-<region>.pooler.supabase.com`) is used because it is IPv4-compatible (GitHub Actions runners are IPv4-only by default; Supabase's direct connection is IPv6-only on free tier) and provides full Postgres semantics. The transaction-pooler URL stored in Vercel as `DATABASE_URL` is unsafe for migrations.

---

## First-Time Setup Checklist

**Vercel**

- [ ] Create Vercel project for Folhário; confirm git integration is **OFF** in project settings
- [ ] Claim the production alias (custom domain or `<project>.vercel.app`) and record it — production smoke tests target the deployment URL captured from `vercel deploy --prod`, but external monitoring and the Inngest webhook (if registered with Inngest cloud) need a stable hostname
- [ ] Run `pnpm dlx vercel@latest login` then `pnpm dlx vercel@latest link` locally to obtain `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`; add both as GH secrets
- [ ] Generate a Vercel token (Account Settings → Tokens); add as `VERCEL_TOKEN` GH secret
- [ ] Configure all app runtime env vars in Vercel for both `preview` and `production` environments (DATABASE*URL, DATABASE_POOL_URL, RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST, IDENTIFICATION_PROVIDER_MODE, etc.). `SUPABASE_SERVICE_ROLE_KEY` must NOT be `NEXT_PUBLIC*\*` — it's server-only.

**Supabase**

- [ ] Create a **second** Supabase project as the shared preview environment (free tier currently allows 2 projects per org; verify before assuming)
- [ ] Set preview project's **transaction-pooler** URL (port 6543 on `aws-N-<region>.pooler.supabase.com`) as both `DATABASE_URL` and `DATABASE_POOL_URL` in Vercel **preview** environment variables — append `?pgbouncer=true` if not already present in the copied string. Copy the exact hostname from Supabase dashboard → **Connect** → Direct → Transaction pooler (the `aws-N` cluster prefix varies per project)
- [ ] Set production project's **transaction-pooler** URL (port 6543) as both `DATABASE_URL` and `DATABASE_POOL_URL` in Vercel **production** environment variables — same `?pgbouncer=true` requirement
- [ ] Add production project's **session-pooler** URL (port 5432 on `aws-N-<region>.pooler.supabase.com`) as `PROD_DATABASE_MIGRATION_URL` GH secret — used by `pnpm db:migrate` from CI, never by the runtime app. (Not the IPv6 direct URL — GitHub Actions runners are IPv4-only.)

**GitHub**

- [ ] Create a GitHub Actions environment named `production` (Settings → Environments); add required reviewers
- [ ] Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as GH secrets
- [ ] `SENTRY_DSN_CI` and `POSTHOG_KEY_CI` should already exist from CI setup (`ci.yml` references them at build/smoke time); add them now if missing

---

## Setup Instructions

### 1. Confirm Vercel git integration is OFF

1. Go to [vercel.com](https://vercel.com) → your `folhario` project → **Settings** → **Git**
2. Under "Git Connection", confirm no repository is connected. If one is connected, disconnect it.
3. Vercel should show no connected repository — all deploys will come from GitHub Actions only.

---

### 2. Run `vercel link` and add Vercel secrets to GitHub

```bash
pnpm dlx vercel@latest login   # interactive browser login
pnpm dlx vercel@latest link    # follow prompts; creates .vercel/project.json
cat .vercel/project.json       # copy projectId and orgId
```

Pipe each value via stdin so `gh secret set` doesn't open an editor:

```bash
printf '%s' "<orgId>"     | gh secret set VERCEL_ORG_ID     --repo aesir-tecnologia/folhario
printf '%s' "<projectId>" | gh secret set VERCEL_PROJECT_ID --repo aesir-tecnologia/folhario
```

Then generate a token: **vercel.com → Account Settings → Tokens → Create** (scope: your team, no expiry).

```bash
printf '%s' "<token>" | gh secret set VERCEL_TOKEN --repo aesir-tecnologia/folhario
```

---

### 3. Create two Supabase cloud projects

If you don't have the projects yet, create them at [supabase.com](https://supabase.com) → **New project** first — one for production, one as the shared preview environment.

For each project, open the dashboard's **Connect** dialog (top of any project page) → **Direct** tab. Three connection methods are exposed; copy each connection string verbatim and substitute the password (the password isn't shown in the dashboard — Settings → Database → **Reset database password** if you don't have it saved):

- **Direct connection** (`db.<ref>.supabase.co:5432`) — IPv6-only on free tier. Only useful from a developer machine with IPv6 enabled. **Do not use** as the GH Actions migration secret (runners are IPv4-only).
- **Transaction pooler** (`aws-N-<region>.pooler.supabase.com:6543`) — IPv4-compatible. Use as Vercel `DATABASE_URL` and `DATABASE_POOL_URL`. Append `?pgbouncer=true` if missing.
- **Session pooler** (`aws-N-<region>.pooler.supabase.com:5432`) — IPv4-compatible, full Postgres semantics. Use for migrations: production goes into GH secret `PROD_DATABASE_MIGRATION_URL`; local `pnpm db:setup` from your laptop should also use this.

> The cluster prefix (`aws-0`, `aws-1`, …) varies per project and isn't predictable — copy the actual hostname from the dashboard.

From **Settings → API → Project API keys**:

- **Project URL** (deterministic: `https://<ref>.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** (legacy key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (legacy key) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ server-only; never `NEXT_PUBLIC_*`

> Supabase has rolled out new `sb_publishable_*` / `sb_secret_*` keys. The codebase still uses the legacy JWT format — pick the entries labelled **Legacy anon API key** / **Legacy service_role API key**. The keys can also be fetched non-interactively (legacy keys are returned in full; new secret keys are masked):
>
> ```bash
> ./node_modules/.bin/supabase projects api-keys --project-ref <ref> --output json
> ```

Optionally verify each pooler URL with `psql` before pushing to Vercel — pass the password via `PGPASSWORD` env var rather than embedding in the URL (the latter leaks via `ps`):

```bash
PGPASSWORD='<pw>' psql "postgresql://postgres.<ref>@aws-N-<region>.pooler.supabase.com:6543/postgres" -c 'select 1'
```

> Drop `?pgbouncer=true` for the psql probe — it's a postgres-js / pgbouncer-aware driver hint and libpq rejects it as an unknown URI parameter. Keep it in the value pushed to Vercel.

Bootstrap each project's schema using the **session-pooler** URL:

```bash
DATABASE_URL=<prod-session-pooler-url> DATABASE_POOL_URL=<prod-session-pooler-url> pnpm db:setup
DATABASE_URL=<preview-session-pooler-url> DATABASE_POOL_URL=<preview-session-pooler-url> pnpm db:setup
```

`DATABASE_POOL_URL` is duplicated to the session-pooler URL here because `serverEnv` validates both at module import time. The runtime app on Vercel uses the transaction-pooler URL for both.

---

### 4. Configure Vercel environment variables

Go to **vercel.com → folhario project → Settings → Environment Variables**.

Add each variable and select the correct environment scope (`Preview` or `Production`):

| Variable                        | Scope         | Preview value                                      | Production value                              |
| ------------------------------- | ------------- | -------------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`                  | server-only   | preview transaction-pooler URL (port 6543)         | production transaction-pooler URL (port 6543) |
| `DATABASE_POOL_URL`             | server-only   | same as `DATABASE_URL`                             | same as `DATABASE_URL`                        |
| `NEXT_PUBLIC_SUPABASE_URL`      | public        | preview project URL                                | production project URL                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public        | preview anon key                                   | production anon key                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | server-only ⚠ | preview service_role key                           | production service_role key                   |
| `IDENTIFICATION_PROVIDER_MODE`  | server-only   | `stub`                                             | `real`                                        |
| `RESEND_API_KEY`                | server-only   | `ci-build-placeholder` (or a real Resend test key) | production Resend key                         |
| `RESEND_FROM_ADDRESS`           | server-only   | _(leave blank — defaults to resend.dev)_           | your verified sender address                  |
| `INNGEST_EVENT_KEY`             | server-only   | _(leave blank until Inngest wiring lands)_         | Inngest event key                             |
| `INNGEST_SIGNING_KEY`           | server-only   | _(leave blank until Inngest wiring lands)_         | Inngest signing key                           |
| `NEXT_PUBLIC_SENTRY_DSN`        | public        | your Sentry DSN                                    | your Sentry DSN                               |
| `NEXT_PUBLIC_POSTHOG_KEY`       | public        | your PostHog key                                   | your PostHog key                              |
| `NEXT_PUBLIC_POSTHOG_HOST`      | public        | `https://us.i.posthog.com`                         | `https://us.i.posthog.com`                    |

> `RESEND_API_KEY` cannot be empty in any environment that runs `next build` or `next start` (including preview deploys), because `serverEnv` requires it under `NODE_ENV=production`. Use `ci-build-placeholder` for preview if you don't have a real Resend test key yet — same pattern `ci.yml` uses for unit/integration runs.

---

### 5. Add production migration URL as a GitHub secret

Use the production project's **session-pooler** URL (port 5432 on `aws-N-<region>.pooler.supabase.com`) — IPv4-compatible from GitHub Actions runners and provides full Postgres semantics for migrations. Copy from Supabase dashboard → **Connect** → Direct → Session pooler.

```bash
printf '%s' "<prod-session-pooler-url-port-5432>" |
  gh secret set PROD_DATABASE_MIGRATION_URL --repo aesir-tecnologia/folhario
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
printf '%s' "<auth-token>"   | gh secret set SENTRY_AUTH_TOKEN --repo aesir-tecnologia/folhario
printf '%s' "<org-slug>"     | gh secret set SENTRY_ORG        --repo aesir-tecnologia/folhario
printf '%s' "<project-slug>" | gh secret set SENTRY_PROJECT    --repo aesir-tecnologia/folhario
```

`SENTRY_DSN_CI` and `POSTHOG_KEY_CI` should already exist from CI setup (`ci.yml` references them). Add them now if missing, same `printf | gh secret set` pattern.

---

## Rollback

**Fast rollback (no DB changes):** In Vercel dashboard → Deployments, promote a prior deployment to production. Or via CLI: `vercel promote <deployment-url-or-id> --token=$VERCEL_TOKEN` (add `--scope <team-slug>` if your token has multi-team access). The target deployment must already be in the production target (i.e. originally created with `vercel deploy --prod`).

**Rollback with DB migration:** Revert the commit, push to a new branch, open a PR. The deploy pipeline will apply whatever migrations the revert contains before deploying. **Drizzle does not auto-generate down-migrations** — every destructive migration must ship with a hand-written paired migration that reverses it (added to the same PR or a follow-up). There is no automatic rollback.

---

## Notes

**Supabase free plan — no branch DBs:** REQUIREMENTS.md (INFRA-13) originally specified per-PR Supabase branch DBs. Branching requires a paid plan. The deploy pipeline uses a shared preview Supabase project instead. Per-PR isolation is the upgrade path when budget allows.

**Shared preview DB race condition:** If two PRs deploy simultaneously, `pnpm db:setup` can run concurrently against the shared preview DB. Drizzle migrations are idempotent (won't re-apply), so concurrent runs of identical migrations are safe. Structural conflicts between two PRs' migrations are not protected against — acceptable for a small team. Mitigation if needed: change preview concurrency to a single global group with `cancel-in-progress: false`.

**No build artifact reuse between CI and deploy:** `vercel build` runs `next build` internally and injects `NEXT_PUBLIC_*` values from the Vercel environment at build time. The CI build uses localhost stub values (`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`, etc.) that must not ship to preview or production. Each deploy workflow runs its own full install + `vercel pull` + `vercel build` to get the correct env-specific bundle.

**`vercel pull` shell semantics:** `vercel pull` writes `.vercel/.env.<environment>.local` but does **not** export the values into the calling shell. `vercel build` in the same job reads the file automatically. Any other command that needs those env vars (e.g. `pnpm db:setup` in the preview workflow) must explicitly source the file: `set -a; source .vercel/.env.preview.local; set +a`.

**Production alias vs deployment URL:** `vercel deploy --prod` returns a deployment URL like `<project>-<hash>-<team>.vercel.app` and _also_ swaps the production alias to point at it. The alias swap can lag by a few seconds. Steps that need to talk to the _new_ build (smoke tests, Inngest sync) should use the deployment URL captured from `vercel deploy --prod` stdout, not a hardcoded hostname.

**Direct connection is IPv6-only on Supabase free tier:** `db.<ref>.supabase.co:5432` cannot be reached from IPv4-only networks, including default GitHub Actions runners and many Brazilian residential ISPs. The session pooler (`aws-N-<region>.pooler.supabase.com:5432`) is IPv4-compatible and is what `PROD_DATABASE_MIGRATION_URL` should hold. Local `pnpm db:setup` from a laptop on an IPv4-only network should also use the session pooler. Supabase offers a paid IPv4 add-on that would let direct connections work — not currently planned.

**Preview workflow uses the transaction pooler for migrations:** the deploy-preview workflow runs `pnpm db:setup` (which calls `db:migrate`) using the `DATABASE_URL` from Vercel — the transaction pooler at port 6543. Drizzle's migration runner uses transaction-scoped advisory locks and single-statement-per-file transactions, which **should** work in pgbouncer transaction mode, but this hasn't been validated against a real Supabase project yet. If preview migrations fail, switch the preview workflow to a separate `PREVIEW_DATABASE_MIGRATION_URL` GH secret containing the preview project's session-pooler URL — same pattern as production.

**Supabase pooler hostname format:** `aws-N-<region>.pooler.supabase.com` — the cluster prefix (`aws-0`, `aws-1`, …) varies per project and isn't predictable from the region alone. Always copy the exact hostname from the dashboard's **Connect** dialog.

**Supabase API key naming (legacy vs publishable/secret):** Supabase rolled out new `sb_publishable_*` / `sb_secret_*` keys, but the legacy JWT-format keys (`eyJ…`) are still issued to every project and are what the codebase consumes (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Use the entries explicitly labelled **Legacy anon API key** / **Legacy service_role API key** in the dashboard or in `supabase projects api-keys --output json` output. Migration to the new key system is a separate future task.
