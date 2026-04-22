# Phase 1 Wave 0 — Operator Provisioning Checklist (D-27)

Check each box as you complete the step. Reply "done" to the executor when every box is ticked.

## Local environment
- [ ] `nvm install 22 && nvm use 22` (Node 22 LTS active)
- [ ] `node -v` prints `v22.x.x`
- [ ] `corepack enable && corepack prepare pnpm@9 --activate`
- [ ] `pnpm -v` prints `9.x.x`

## Sentry
- [ ] Project created at sentry.io (platform: Next.js)
- [ ] DSN captured -> repo secret `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Org slug -> repo secret `SENTRY_ORG`
- [ ] Project slug -> repo secret `SENTRY_PROJECT`
- [ ] Auth token (scopes: project:read, project:releases, org:read) -> repo secret `SENTRY_AUTH_TOKEN`

## PostHog US
- [ ] Project created at **us.posthog.com** (NOT eu.posthog.com) — per OBS-02: US cloud chosen for lower latency from Brazil; LGPD Art. 33 international transfer basis documented via PostHog SCCs
- [ ] Project API key -> repo secret `NEXT_PUBLIC_POSTHOG_KEY`
- [ ] Host value `https://us.i.posthog.com` -> repo secret `NEXT_PUBLIC_POSTHOG_HOST`

## Supabase (with branching)
- [ ] Project created at supabase.com
- [ ] Branching ENABLED (Project Settings -> Branching)
- [ ] Access token -> repo secret `SUPABASE_ACCESS_TOKEN`
- [ ] Project ref -> repo secret `SUPABASE_PROJECT_REF`
- [ ] Direct (session mode) URL -> repo secret `DATABASE_URL`
- [ ] Pooler (transaction mode) URL -> repo secret `DATABASE_POOL_URL`
- [ ] API URL -> repo secret `NEXT_PUBLIC_SUPABASE_URL`
- [ ] anon key -> repo secret `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] service_role key -> repo secret `SUPABASE_SERVICE_ROLE_KEY` (NEVER prefix with NEXT_PUBLIC_)

## Vercel (git integration OFF)
- [ ] Project created at vercel.com (framework: Next.js)
- [ ] **Git integration DISCONNECTED** in Project Settings -> Git (D-27, INFRA-11, SC-3e)
- [ ] Screenshot of "no git repository connected" state saved somewhere
- [ ] Build command overridden to `pnpm build`
- [ ] Deploy token -> repo secret `VERCEL_TOKEN`
- [ ] Team ID -> repo secret `VERCEL_ORG_ID`
- [ ] Project ID -> repo secret `VERCEL_PROJECT_ID`

## Inngest
- [ ] App 'folhario' created at inngest.com
- [ ] Event key -> repo secret `INNGEST_EVENT_KEY`
- [ ] Signing key -> repo secret `INNGEST_SIGNING_KEY`

## Resolved?
Reply "done" to the executor. Wave 1 begins.
