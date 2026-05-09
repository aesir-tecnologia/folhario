# Deploy Pipeline

Folhário deploys from GitHub Actions. Vercel git integration is disabled; all deploys go through `.github/workflows/`:

- `ci.yml`
- `deploy-preview.yml`
- `deploy-production.yml`
- `deploy-preview-cleanup.yml`

---

## Flow

```text
pull_request → CI → Deploy Preview → upsert PR comment
pull_request closed → Cleanup Preview Deploys
push to main → CI → Deploy Production (approval gate) → Sentry release → Inngest sync
```

Deploys run only after CI passes.

---

## Shared

- Ubuntu, Node 22, Corepack pnpm (`pnpm@9.15.5`), `pnpm install --frozen-lockfile`, pnpm store cached on `pnpm-lock.yaml`.
- Vercel CLI invoked via `pnpm dlx vercel@latest`.
- Required workflow secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Runtime app secrets live in Vercel env vars, not GitHub secrets. Expected keys: `DATABASE_URL`, `DATABASE_POOL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IDENTIFICATION_PROVIDER_MODE`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

---

## CI — `.github/workflows/ci.yml`

- Triggers: pull requests, pushes to `main`.
- Concurrency: `ci-${{ github.ref }}`, cancel in-progress.
- Service: `postgres:17-alpine` (`folhario_test`).
- Steps: lint → `next typegen` → typecheck → unit → `db:setup` → integration → build.
- Uses stub env values; `RESEND_API_KEY=ci-build-placeholder` for production-mode build validation.

---

## Preview Deploy — `.github/workflows/deploy-preview.yml`

- Trigger: runs after CI succeeds on a non-`main` branch.
- Guards: skipped unless the CI run was for a PR with a populated `pull_requests[0]` (excludes fork PRs and branch-only pushes).
- Permissions: `contents: read`, `pull-requests: write`.
- Concurrency: `deploy-preview-pr-<number>`, cancel in-progress.
- Steps:
  1. Checkout the PR head SHA.
  2. `vercel pull --environment=preview`.
  3. Parse `.vercel/.env.preview.local` into `$GITHUB_ENV` (simple `KEY=value` lines only).
  4. `pnpm db:setup` (= `db:migrate && db:seed && db:check-rls && db:check-seeds`) against the shared preview Supabase DB.
  5. `vercel build`.
  6. `vercel deploy --prebuilt --meta githubPrNumber=<n> --meta githubCommitSha=<sha>`.
  7. Upsert PR comment marked `<!-- folhario-preview-deploy -->` with URL + SHA.

GitHub reads this workflow's definition from `main`, so PR-side edits to it don't take effect until merged. Concurrent PRs share one preview DB; only per-PR deploys are serialized.

---

## Production Deploy — `.github/workflows/deploy-production.yml`

- Trigger: runs after CI succeeds on `main`.
- Permissions: `contents: read`.
- Environment: `production` (approval gate before any step).
- Concurrency: `deploy-production`, no cancel (avoids racing migrations).
- Steps:
  1. Checkout the `main` head SHA.
  2. Advisory grep of SQL migrations for `DROP`, `ALTER TABLE ... DROP COLUMN`, `TRUNCATE`. Warning only, never blocks.
  3. `pnpm db:migrate` with `DATABASE_URL=DATABASE_POOL_URL=PROD_DATABASE_MIGRATION_URL` (Supabase session pooler; both vars set because env validation requires both).
  4. `vercel pull --environment=production`.
  5. `vercel build --prod`.
  6. `vercel deploy --prebuilt --prod`.
  7. Sentry release: `releases new` → `sourcemaps upload .vercel/output --url-prefix '~/_next'` → `releases set-commits --auto` → `releases finalize`. Release tag = `${{ github.sha }}`.
  8. Inngest sync: `curl -fsSL -X PUT https://folhario.vercel.app/api/inngest`. Stable alias is used because generated deploy URLs may return 401.

Confidence comes from CI on `main`, successful build/deploy, Sentry upload, and Inngest sync — there is no post-deploy smoke.

---

## Preview Cleanup — `.github/workflows/deploy-preview-cleanup.yml`

- Trigger: `pull_request` `closed`.
- Permissions: `contents: read`.
- Concurrency: `cleanup-pr-<number>`, cancel in-progress.
- Step: `vercel list --meta githubPrNumber=<n> --json | jq -r '.[].url'` then `vercel remove <url> --yes` per URL.

The shared preview DB is not cleaned. The job assumes `pnpm` exists on the runner; it does not run `actions/checkout`, `corepack enable`, or `actions/setup-node`.

---

## GitHub Secrets

| Secret                        | Used by                      | Purpose                                    |
| ----------------------------- | ---------------------------- | ------------------------------------------ |
| `VERCEL_TOKEN`                | preview, production, cleanup | Vercel CLI auth                            |
| `VERCEL_ORG_ID`               | preview, production, cleanup | Vercel project linking                     |
| `VERCEL_PROJECT_ID`           | preview, production, cleanup | Vercel project linking                     |
| `PROD_DATABASE_MIGRATION_URL` | production                   | Supabase session-pooler URL for migrations |
| `SENTRY_AUTH_TOKEN`           | production                   | Sentry release/source-map upload           |
| `SENTRY_ORG`                  | production                   | Sentry org slug                            |
| `SENTRY_PROJECT`              | production                   | Sentry project slug                        |
| `SENTRY_DSN_CI`               | CI                           | Build-time Sentry DSN                      |
| `POSTHOG_KEY_CI`              | CI                           | Build-time PostHog key                     |

---

## Supabase Connection Model

- App runtime (Vercel env): `DATABASE_URL`, `DATABASE_POOL_URL` — Supavisor transaction pooler, compatible with `postgres-js`.
- Production migrations (GitHub secret): `PROD_DATABASE_MIGRATION_URL` — session pooler. Workflow sets both `DATABASE_URL` and `DATABASE_POOL_URL` to this value for the migration step.
- Preview migrations: pulled from Vercel preview env. No separate migration URL.

---

## First-Time Setup

**Vercel**

- [ ] Create/link project, disable git integration.
- [ ] Save `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` to GitHub secrets.
- [ ] Configure preview and production env vars.
- [ ] Confirm production alias `https://folhario.vercel.app` (or update `deploy-production.yml`).

**GitHub**

- [ ] Create `production` environment with required reviewers.
- [ ] Add all secrets from the table above.

**Supabase**

- [ ] Create production and shared preview projects.
- [ ] Add DB/runtime values to Vercel preview and production env.
- [ ] Add session-pooler URL as `PROD_DATABASE_MIGRATION_URL` in GitHub secrets.

**Sentry / PostHog**

- [ ] `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_DSN_CI`, `POSTHOG_KEY_CI` in GitHub secrets.
- [ ] `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (currently `https://us.i.posthog.com`) in Vercel envs.

### Local Vercel Linking

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link
cat .vercel/project.json
```

```bash
printf '%s' '<orgId>'     | gh secret set VERCEL_ORG_ID     --repo aesir-tecnologia/folhario
printf '%s' '<projectId>' | gh secret set VERCEL_PROJECT_ID --repo aesir-tecnologia/folhario
printf '%s' '<token>'     | gh secret set VERCEL_TOKEN      --repo aesir-tecnologia/folhario
```

---

## Rollback

**App only:**

```bash
pnpm dlx vercel@latest promote <deployment-url-or-id> --token="$VERCEL_TOKEN"
```

**With DB changes:** Drizzle migrations are forward-only. Open a PR that reverts code and adds a corrective forward migration; merge to `main` and let the production workflow run.

---

## Notes

- Deploy workflows always execute the version of the YAML that lives on `main`. PR changes to them take effect only after merge.
- Fork PRs are skipped (no `pull_requests[0]`).
- CI builds use stub env and are not deployed; deploy workflows always rebuild.
- Inngest sync URL `https://folhario.vercel.app/api/inngest` is hardcoded — update if the production domain changes.
- Preview cleanup matches deployments by `githubPrNumber` metadata; keep the meta key in sync if it ever changes.
