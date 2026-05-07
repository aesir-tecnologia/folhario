# Deploy From Local Repo

This guide describes how to build and deploy Folhário directly from a local checkout to Supabase, Vercel, Sentry, Inngest, and related services for both **preview** and **production** environments.

> Canonical project policy is deploys from GitHub Actions only (`DEPLOY.md`). Use this local flow only when you explicitly choose to bypass CI, for first-time bootstrapping, or for an emergency/operator deploy. Keep Vercel Git integration disabled.

---

## Overview

A successful local deploy does four things:

1. **Supabase is ready** for the target environment:
   - hosted project exists (`preview` shared project and `production` project),
   - database migrations and seeds have run,
   - required private storage buckets exist,
   - auth URLs/providers are configured.
2. **Vercel is ready**:
   - project is linked to this local repo,
   - environment variables are configured separately for `preview` and `production`,
   - app is built with the correct target env and deployed with `--prebuilt`.
3. **Observability/async services are ready**:
   - Sentry DSN is in the app env,
   - production source maps are uploaded to a Sentry release,
   - Inngest functions are synced by POSTing `/api/inngest`,
   - PostHog and Resend keys are configured.
4. **Smoke tests pass** against the deployment URL.

Local deployment shape:

```text
local repo
  ├─ install + lint/typecheck/tests
  ├─ migrate/seed target Supabase project
  ├─ vercel pull target env
  ├─ vercel build (--prod for production)
  ├─ vercel deploy --prebuilt [--prod]
  ├─ Playwright smoke against returned deployment URL
  ├─ Sentry release/source maps (production)
  └─ POST /api/inngest on deployed URL
```

---

## Prerequisites

### Required accounts/projects

Create or confirm these before deploying:

- **Vercel** project for Folhário, with Git integration **disabled**.
- **Supabase** hosted projects:
  - one production project,
  - one shared preview project.
- **Sentry** org/project.
- **PostHog** project, US cloud host: `https://us.i.posthog.com`.
- **Resend** account/API key; production sender domain/address must be verified.
- **Inngest** app/event key/signing key for production. Preview can be blank only if async delivery is intentionally not used there.

### Required local tools

From the repo root:

```bash
# Node must satisfy package.json engines: >=22 <23
node --version

# Enable pnpm from packageManager: pnpm@9.15.5
corepack enable
corepack prepare pnpm@9.15.5 --activate
pnpm --version

# Install dependencies
pnpm install --frozen-lockfile

# Useful CLIs used via pnpm dlx or local node_modules
pnpm dlx vercel@latest --version
./node_modules/.bin/supabase --version
pnpm dlx @sentry/cli@latest --version
```

Optional but useful:

- `psql` for checking Supabase connection strings.
- `gh` for managing GitHub secrets if you also maintain CI deploys.
- Docker only for local Supabase dev; not required for hosted local deploys.

### Local secret handling

Do **not** commit local deploy secrets. Keep them in your shell, 1Password, or an ignored file such as `.env.deploy.local`.

Example local operator file:

```bash
# .env.deploy.local — do not commit
export VERCEL_TOKEN="..."
export VERCEL_ORG_ID="..."
export VERCEL_PROJECT_ID="..."

export PREVIEW_DATABASE_MIGRATION_URL="postgresql://postgres.<preview-ref>:<pw>@aws-N-<region>.pooler.supabase.com:5432/postgres"
export PROD_DATABASE_MIGRATION_URL="postgresql://postgres.<prod-ref>:<pw>@aws-N-<region>.pooler.supabase.com:5432/postgres"

export SENTRY_AUTH_TOKEN="..."
export SENTRY_ORG="..."
export SENTRY_PROJECT="..."
```

Load it when needed:

```bash
set -a
source .env.deploy.local
set +a
```

---

## Environment variables

Configure these in **Vercel → Project → Settings → Environment Variables**, separately for `Preview` and `Production`.

| Variable                        | Preview                                             | Production                                    | Notes                                                         |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`                  | preview Supabase transaction pooler, port `6543`    | prod Supabase transaction pooler, port `6543` | Runtime app connection. Append `?pgbouncer=true` if missing.  |
| `DATABASE_POOL_URL`             | same as `DATABASE_URL`                              | same as `DATABASE_URL`                        | Runtime code uses this with postgres-js `{ prepare: false }`. |
| `NEXT_PUBLIC_SUPABASE_URL`      | preview project URL                                 | prod project URL                              | `https://<ref>.supabase.co`.                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | preview legacy anon key                             | prod legacy anon key                          | Use legacy JWT key (`eyJ...`) unless code is migrated.        |
| `SUPABASE_SERVICE_ROLE_KEY`     | preview legacy service role key                     | prod legacy service role key                  | Server-only. Never prefix with `NEXT_PUBLIC_`.                |
| `SUPABASE_PROJECT_REF`          | preview ref                                         | prod ref                                      | Optional in schema but useful for ops.                        |
| `SUPABASE_ACCESS_TOKEN`         | Supabase access token if needed                     | Supabase access token if needed               | Optional; do not expose publicly.                             |
| `IDENTIFICATION_PROVIDER_MODE`  | `stub` unless testing real provider                 | `real`                                        | Current schema accepts `stub` or `real`.                      |
| `RESEND_API_KEY`                | real test/sandbox key or `ci-build-placeholder`     | real production key                           | Required for production builds because `NODE_ENV=production`. |
| `RESEND_FROM_ADDRESS`           | default or sandbox sender                           | verified production sender                    | Must be an email address.                                     |
| `INNGEST_EVENT_KEY`             | preview key or blank if intentionally disabled      | production event key                          | Needed for real async delivery.                               |
| `INNGEST_SIGNING_KEY`           | preview key or blank if intentionally disabled      | production signing key                        | Needed for signed Inngest sync/invocation.                    |
| `NEXT_PUBLIC_SENTRY_DSN`        | Sentry DSN                                          | Sentry DSN                                    | Public DSN.                                                   |
| `SENTRY_AUTH_TOKEN`             | usually not needed in Vercel env                    | usually not needed in Vercel env              | Prefer local shell for source-map upload.                     |
| `SENTRY_ORG`                    | optional                                            | optional                                      | Needed at build/upload time if using Sentry plugin uploads.   |
| `SENTRY_PROJECT`                | optional                                            | optional                                      | Needed at build/upload time if using Sentry plugin uploads.   |
| `NEXT_PUBLIC_POSTHOG_KEY`       | PostHog key                                         | PostHog key                                   | Public key.                                                   |
| `NEXT_PUBLIC_POSTHOG_HOST`      | `https://us.i.posthog.com`                          | `https://us.i.posthog.com`                    | Public constant.                                              |
| `ENABLE_TEST_ROUTES`            | `1` only when diagnostics are intentionally enabled | blank                                         | Never enable in production.                                   |

Vercel CLI setup:

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link
cat .vercel/project.json
```

You may add env vars via dashboard or CLI:

```bash
# Example; repeat for each key/environment.
printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | pnpm dlx vercel@latest env add NEXT_PUBLIC_SUPABASE_URL preview --token="$VERCEL_TOKEN"
printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | pnpm dlx vercel@latest env add NEXT_PUBLIC_SUPABASE_URL production --token="$VERCEL_TOKEN"
```

---

## Supabase setup per environment

Do these steps once for **preview** and once for **production**.

### 1. Get connection strings and keys

In Supabase Dashboard → project → **Connect**:

- **Transaction pooler** (`aws-N-<region>.pooler.supabase.com:6543`): use for Vercel `DATABASE_URL` and `DATABASE_POOL_URL`.
- **Session pooler** (`aws-N-<region>.pooler.supabase.com:5432`): use locally for migrations/seeds. Put these in `PREVIEW_DATABASE_MIGRATION_URL` and `PROD_DATABASE_MIGRATION_URL`.
- Avoid relying on the direct `db.<ref>.supabase.co:5432` URL; on many plans/networks it is IPv6-only.

In Supabase Dashboard → **Settings → API**:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Legacy anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Legacy service role key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configure Auth

In Supabase Dashboard → **Authentication → URL Configuration**:

Preview:

- Site URL: the current/stable preview URL if known, or your Vercel preview domain pattern.
- Redirect URLs: include Vercel preview URLs you will use, plus local dev if needed.

Production:

- Site URL: production hostname, for example `https://folhario.vercel.app` or custom domain.
- Redirect URLs: production hostname callback/redirect paths used by the app.

If using Google OAuth, configure the provider in Supabase and set:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`

### 3. Create Storage buckets

Hosted Supabase does not automatically read local `supabase/config.toml` bucket definitions, so Drizzle migration `0008_create_storage_buckets.sql` creates/updates these private buckets in each project:

| Bucket             | Public | File size | MIME types                              |
| ------------------ | ------ | --------- | --------------------------------------- |
| `plant-photos`     | false  | 5 MiB     | `image/jpeg`, `image/png`, `image/webp` |
| `plant-thumbnails` | false  | 2 MiB     | `image/jpeg`, `image/png`, `image/webp` |
| `data-exports`     | false  | 100 MiB   | `application/zip`, `application/json`   |

The migration is the source of truth. If you need to repair a project manually, use Dashboard path: Supabase → **Storage → New bucket**, or run this SQL in the Supabase SQL editor:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('plant-photos', 'plant-photos', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('plant-thumbnails', 'plant-thumbnails', false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('data-exports', 'data-exports', false, 104857600, array['application/zip','application/json'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

### 4. Migrate, seed, and validate DB

Use the **session-pooler** URL for local migrations:

```bash
# Preview
DATABASE_URL="$PREVIEW_DATABASE_MIGRATION_URL" \
DATABASE_POOL_URL="$PREVIEW_DATABASE_MIGRATION_URL" \
pnpm db:setup

# Production
DATABASE_URL="$PROD_DATABASE_MIGRATION_URL" \
DATABASE_POOL_URL="$PROD_DATABASE_MIGRATION_URL" \
pnpm db:setup
```

`pnpm db:setup` runs:

```text
pnpm db:migrate
pnpm db:seed
pnpm db:check-rls
pnpm db:check-seeds
```

For production deploys after initial bootstrap, you may run only migrations if seeds are unchanged:

```bash
DATABASE_URL="$PROD_DATABASE_MIGRATION_URL" \
DATABASE_POOL_URL="$PROD_DATABASE_MIGRATION_URL" \
pnpm db:migrate
```

---

## Pre-deploy verification

Run this from a clean working tree before either preview or production deploy:

```bash
git status --short
pnpm lint
pnpm lint:styles
pnpm typecheck
pnpm test:run
```

Optional full local build check using `.env.local`:

```bash
pnpm build
```

---

## Deploy preview from local

Preview deploys are non-production Vercel deployments backed by the shared preview Supabase project.

### 1. Prepare preview database

```bash
DATABASE_URL="$PREVIEW_DATABASE_MIGRATION_URL" \
DATABASE_POOL_URL="$PREVIEW_DATABASE_MIGRATION_URL" \
pnpm db:setup
```

### 2. Pull Vercel preview env

```bash
pnpm dlx vercel@latest pull \
  --yes \
  --environment=preview \
  --token="$VERCEL_TOKEN"
```

This writes `.vercel/.env.preview.local`. `vercel build` reads it automatically.

### 3. Build preview artifact

```bash
pnpm dlx vercel@latest build --token="$VERCEL_TOKEN"
```

### 4. Deploy preview artifact

```bash
PREVIEW_URL=$(pnpm dlx vercel@latest deploy \
  --prebuilt \
  --meta localDeploy=true \
  --meta gitCommitSha="$(git rev-parse HEAD)" \
  --token="$VERCEL_TOKEN")

echo "$PREVIEW_URL"
```

### 5. Smoke test preview

```bash
PLAYWRIGHT_TEST_BASE_URL="$PREVIEW_URL" pnpm test:e2e:smoke
```

### 6. Sync Inngest for preview if configured

Only do this if the preview env has valid Inngest keys and you want preview functions registered:

```bash
curl -fsSL -X POST "$PREVIEW_URL/api/inngest" -o /dev/null
```

---

## Deploy production from local

Production deploys use the production Supabase project and promote the Vercel deployment to the production alias.

### 1. Confirm release metadata

```bash
export RELEASE_SHA="$(git rev-parse HEAD)"
echo "$RELEASE_SHA"
```

Deploy only from the commit you intend to ship.

### 2. Check for destructive migrations

```bash
grep -nE 'DROP\s|ALTER\s+TABLE\s+.*DROP\s+COLUMN|TRUNCATE' drizzle/migrations/*.sql || true
```

If anything appears, confirm data loss is intentional and rollback is planned.

### 3. Migrate production database

Use the production **session-pooler** URL:

```bash
DATABASE_URL="$PROD_DATABASE_MIGRATION_URL" \
DATABASE_POOL_URL="$PROD_DATABASE_MIGRATION_URL" \
pnpm db:migrate
```

If this is the first production bootstrap, run full setup instead:

```bash
DATABASE_URL="$PROD_DATABASE_MIGRATION_URL" \
DATABASE_POOL_URL="$PROD_DATABASE_MIGRATION_URL" \
pnpm db:setup
```

### 4. Pull Vercel production env

```bash
pnpm dlx vercel@latest pull \
  --yes \
  --environment=production \
  --token="$VERCEL_TOKEN"
```

This writes `.vercel/.env.production.local`.

### 5. Build production artifact

```bash
pnpm dlx vercel@latest build --prod --token="$VERCEL_TOKEN"
```

### 6. Deploy production artifact

```bash
PROD_DEPLOY_URL=$(pnpm dlx vercel@latest deploy \
  --prebuilt \
  --prod \
  --token="$VERCEL_TOKEN")

echo "$PROD_DEPLOY_URL"
```

Use this returned deployment URL for immediate validation; the production alias can lag by a few seconds.

### 7. Smoke test production deployment

```bash
PLAYWRIGHT_TEST_BASE_URL="$PROD_DEPLOY_URL" pnpm test:e2e:smoke
```

### 8. Create Sentry release and upload source maps

Run after smoke passes:

```bash
export SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN"
export SENTRY_ORG="$SENTRY_ORG"
export SENTRY_PROJECT="$SENTRY_PROJECT"

pnpm dlx @sentry/cli@latest releases new "$RELEASE_SHA"
pnpm dlx @sentry/cli@latest releases files "$RELEASE_SHA" \
  upload-sourcemaps .vercel/output \
  --url-prefix '~/_next'
pnpm dlx @sentry/cli@latest releases finalize "$RELEASE_SHA"
```

If upload reports no files, inspect source-map locations:

```bash
find .vercel/output .next -name '*.map' | head -50
```

Keep Sentry release equal to the git SHA where possible.

### 9. Sync Inngest functions

```bash
curl -fsSL -X POST "$PROD_DEPLOY_URL/api/inngest" -o /dev/null
```

### 10. Verify production alias

After a short delay, verify the stable production hostname too:

```bash
curl -I https://folhario.vercel.app
# or your custom production domain
```

---

## Post-deploy checks

For both preview and production:

- Open the deployment URL on mobile viewport.
- Confirm legal links render.
- Confirm manifest and service worker are reachable:

```bash
curl -fsSL "$DEPLOY_URL/manifest.webmanifest" >/dev/null
curl -fsSL "$DEPLOY_URL/sw.js" >/dev/null
```

- Confirm security headers:

```bash
curl -I "$DEPLOY_URL" | grep -Ei 'strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy'
```

- Sign up/sign in with a real test account in the target Supabase project.
- Confirm verification/reset emails are delivered or, for preview, that the chosen stub/sandbox behavior is expected.
- Upload a small plant photo and confirm storage writes to the correct Supabase project.
- Check Sentry for release and sourcemap artifacts.
- Check PostHog events arrive.
- Check Inngest dashboard shows functions/events for the target app.

---

## Rollback

### Vercel-only rollback

If no database rollback is needed, promote an older Vercel production deployment:

```bash
pnpm dlx vercel@latest promote <deployment-url-or-id> --token="$VERCEL_TOKEN"
```

Or use Vercel Dashboard → Project → Deployments → select previous deployment → Promote.

### Database rollback

Drizzle does not auto-generate down migrations. If a migration must be reverted:

1. Write a forward migration that restores the prior schema/data behavior.
2. Run it against the affected Supabase project with the session-pooler URL.
3. Deploy app code compatible with that restored schema.

Do not assume promoting an older Vercel deployment is safe after schema changes.

---

## Common failures

- **`RESEND_API_KEY required in production` during build**: set `RESEND_API_KEY` in Vercel for the target env. Preview may use `ci-build-placeholder`; production must use a real key.
- **Migration cannot connect to Supabase**: use the session pooler on port `5432`, not transaction pooler `6543` and not IPv6-only direct URL.
- **Runtime DB errors through Supavisor**: ensure Vercel `DATABASE_POOL_URL` is the transaction pooler and includes `?pgbouncer=true` if needed. Runtime code uses postgres-js with `prepare: false`.
- **Supabase upload fails**: confirm private buckets exist in the hosted project and MIME/file limits match this doc.
- **Auth redirect fails**: add the exact deployment/custom-domain URL in Supabase Auth URL Configuration.
- **Sentry has events but no source context**: source maps were not uploaded from the same build output/release SHA. Re-run the Sentry upload step against `.vercel/output` from the deployed build.
- **Inngest sync fails**: confirm `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` are set in Vercel for that environment and POST the exact deployment URL returned by Vercel.

---

## Quick command summary

Preview:

```bash
DATABASE_URL="$PREVIEW_DATABASE_MIGRATION_URL" DATABASE_POOL_URL="$PREVIEW_DATABASE_MIGRATION_URL" pnpm db:setup
pnpm dlx vercel@latest pull --yes --environment=preview --token="$VERCEL_TOKEN"
pnpm dlx vercel@latest build --token="$VERCEL_TOKEN"
PREVIEW_URL=$(pnpm dlx vercel@latest deploy --prebuilt --token="$VERCEL_TOKEN")
PLAYWRIGHT_TEST_BASE_URL="$PREVIEW_URL" pnpm test:e2e:smoke
curl -fsSL -X POST "$PREVIEW_URL/api/inngest" -o /dev/null || true
```

Production:

```bash
RELEASE_SHA=$(git rev-parse HEAD)
DATABASE_URL="$PROD_DATABASE_MIGRATION_URL" DATABASE_POOL_URL="$PROD_DATABASE_MIGRATION_URL" pnpm db:migrate
pnpm dlx vercel@latest pull --yes --environment=production --token="$VERCEL_TOKEN"
pnpm dlx vercel@latest build --prod --token="$VERCEL_TOKEN"
PROD_DEPLOY_URL=$(pnpm dlx vercel@latest deploy --prebuilt --prod --token="$VERCEL_TOKEN")
PLAYWRIGHT_TEST_BASE_URL="$PROD_DEPLOY_URL" pnpm test:e2e:smoke
pnpm dlx @sentry/cli@latest releases new "$RELEASE_SHA"
pnpm dlx @sentry/cli@latest releases files "$RELEASE_SHA" upload-sourcemaps .vercel/output --url-prefix '~/_next'
pnpm dlx @sentry/cli@latest releases finalize "$RELEASE_SHA"
curl -fsSL -X POST "$PROD_DEPLOY_URL/api/inngest" -o /dev/null
```
