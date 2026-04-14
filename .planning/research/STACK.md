# Stack Research — Folhário

**Domain:** Plant identification + care-guide + reminder PWA (pt-BR, Brazilian beginners)
**Researched:** 2026-04-14
**Mode:** Validation (PRD §2 has already locked choices — this file confirms versions, flags gotchas, closes gaps)
**Overall Confidence:** HIGH on web/framework layer; HIGH on Supabase + Drizzle; MEDIUM on Inngest `sleepUntil` tier boundary; MEDIUM-HIGH on Stripe Pix recurring; HIGH on PWA iOS push realities

---

## TL;DR for Roadmap Consumers

1. **Every PRD §2 choice is endorsed** — the stack is coherent and battle-tested for this shape of product.
2. **Four flags** that need roadmap attention, in priority order:
   - **F1. Stripe Pix recurring (Pix Automático)** — supported but has a mandatory 3-day pre-debit notification window that changes the subscription state machine (`processing` status before `succeeded`). Card-only fallback is safer for MVP.
   - **F2. Inngest free tier cap on `step.sleepUntil` is exactly 7 days** — the PRD's 7-day deletion grace is right at the edge. Any Paid Hobby tier or higher buys headroom to a year. Budget Hobby plan in from day one.
   - **F3. PWA on iOS Safari has two load-bearing constraints** the PRD glosses over: (a) push only works after Add-to-Home-Screen, never in a browser tab; (b) subscription quietly disappears if the user doesn't open the PWA — there is no server-side signal, pruning is 100% reactive via 410/404 on send, which the PRD does handle.
   - **F4. Next.js version drift** — PRD says "Next.js App Router," but as of 2026-04-14 the latest is **16.2.3**. Start on 16.x, not 15.x — 15.x works but is now one major behind and Turbopack/source-map behavior differs.
3. **Plant.id is the right primary identification provider** — verified: Plant.id beats GPT-4 on top-1 plant ID by ~5x (12% vs 58% error). OpenAI-compat stays as fallback per PRD.
4. **Supabase branch DBs per PR are cheap** — Micro compute is ~$0.0134/hr per branch. Single PR lifecycle (<24h) ≈ $0.32. At low PR volume this is sub-$10/month.

---

## Recommended Stack (with April 2026 pinned versions)

### Core Framework & Runtime

| Technology | Version (2026-04) | Purpose | Why / Notes |
|------------|-------------------|---------|-------------|
| Next.js | **16.2.3** | App Router, Route Handlers for `/api/v1`, PWA shell | Latest stable. Turbopack is default build system in 15.5+; source maps upload post-build. React 19 is mandatory in App Router (Pages Router retains React 18 back-compat but Folhário is App Router only). |
| React | **19.2.5** | UI | Locked by Next 16. App Router uses React 19 Server Components + actions. |
| TypeScript | **5.7.x** | Type safety | No surprises. `strict: true`, `noUncheckedIndexedAccess: true` recommended for a DDD codebase. |
| Node.js | **20 LTS or 22 LTS** | Runtime on Vercel + CI | Vercel Functions run 20/22. Pin in `.nvmrc`. Do NOT use 18; `web-push` crypto paths have quirks on 18. |

**Confidence: HIGH** — verified against live npm registry 2026-04-14.

### PWA Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@serwist/next` | **9.5.7** | Service worker + precache + runtime strategies wired into Next.js build | **next-pwa is abandoned.** Serwist is the community/official successor and is listed in Next.js's own PWA guide. Built on Workbox primitives but Next-aware. |
| `serwist` (core) | **9.5.x** | Core SW runtime library | Installed together with `@serwist/next`. |
| `web-push` | **3.6.7** | VAPID-signed push dispatch from server | Node-only. Called from Inngest `notifications/send-push`. 410/404 handling is the PRD's self-healing mechanism. |

**Confidence: HIGH**

### Database & Data Access

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `drizzle-orm` | **0.45.2** | SQL-generator ORM inside repositories only | Type-safe, zero-runtime-overhead. Schema-first, migrations explicit. `prepare: false` MANDATORY with Supavisor txn pooler. |
| `drizzle-kit` | **0.31.10** | Migrations CLI | Generates + applies SQL migrations. Run from GitHub Actions against Supabase branch DB per PRD §20. |
| `postgres` (postgres-js) | **3.4.9** | Postgres driver | The driver Drizzle's Supabase docs use. MUST be constructed with `postgres(url, { prepare: false })` when talking to Supavisor in txn mode — otherwise prepared statements break under connection reuse. |
| Supabase Postgres | managed | Primary DB | Per PRD. RLS as defense in depth (repositories still service-role at runtime; RLS stops the bleeding if service role leaks). |
| `@supabase/supabase-js` | **2.103.0** | Auth + Storage client (NOT data access) | Data access is Drizzle only. Supabase JS is used inside `auth-adapter` and `storage-adapter` per PRD bounded-context layout. |

**Confidence: HIGH.** See Version Compatibility section for the `prepare: false` trap.

### Async / Jobs / Cron

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `inngest` (SDK) | **4.2.1** | Events, cron, durable steps, `step.sleepUntil` | Per PRD. Used for all async: `care-guide/augment`, `iam/process-deletion` (7d sleep), `iam/generate-export`, `billing/process-webhook`, `reminders/dispatch`, `notifications/send-push`, `notifications/send-email`. |

**Tier gotcha (F2):** `step.sleepUntil` on the Inngest **Free plan is capped at 7 days** (Hobby and Pro go up to 1 year). The PRD's LGPD deletion grace is exactly 7 days. That is the knife edge — any clock skew, any retry, or any attempt to extend the grace window will exceed the free-tier ceiling. **Recommendation:** budget the paid Hobby plan from day one. Inngest free tier is also capped at 50k executions/month which Folhário won't strain, but the sleep ceiling is the constraint.

**Retry semantics worth knowing for the roadmap:**
- Steps retry automatically (default 4 retries, exponential backoff) on throw.
- A sleeping step does NOT count against concurrency while asleep.
- On wake, the step re-hydrates the function state from the event payload — so `grace_period_ends_at` must be embedded in the event payload, not fetched from DB at wake time (otherwise a raced `DataDeletionRequest.status=cancelled` write wouldn't be seen reliably). PRD §13 implies this correctly but it's worth calling out.

**Confidence: MEDIUM-HIGH** (sleep ceiling verified via Inngest docs + changelogs; Hobby-tier exact pricing not fetched live).

### Auth & Storage (via Adapters)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Auth | managed | Email+password, Google OAuth, email verification, password reset tokens | Behind `AuthAdapter` per PRD. JWT verified in Next middleware. Password-reset-token hashing + single-use + 1h expiry per PRD §12 is Supabase-native (`supabase.auth.resetPasswordForEmail` + `exchangeCodeForSession`). |
| Supabase Storage | managed | `plant-photos`, `plant-thumbnails`, `data-exports` private buckets, signed URLs | Behind `StorageAdapter` per PRD. Signed URL TTL: 1h for photos, 24h for data exports (recommended). |

**pt-BR email templates:** Supabase Auth's built-in email templates are configurable via dashboard or `config.toml`. **But** the PRD's Resend-based transactional flow implies **bypassing** Supabase Auth's built-in email sender and routing via `auth.email.smtp` custom SMTP pointed at Resend, OR — cleaner — disabling Supabase's confirmation emails and using `admin.inviteUserByEmail` / custom tokens dispatched through React Email templates. The PRD is ambiguous here. **Roadmap flag:** Phase planning for Auth should explicitly decide SMTP-via-Resend vs. custom-token flow.

**Confidence: HIGH on mechanics, MEDIUM on which email path the PRD wants.**

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | **6.11.0** | Transactional email API | Per PRD. Domain verification required before production. Sandbox domain for dev/preview. |
| `@react-email/components` | **1.0.12** | Email template components (JSX → MJML-safe HTML) | Per PRD. `react-email dev` local preview at :3000 collides with `next dev`; use `npx react-email dev --port 3001`. |

**Confidence: HIGH**

### Observability

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@sentry/nextjs` | **10.48.0** | Errors + tracing + source maps | Per PRD. **Turbopack source-map gotcha:** requires `@sentry/nextjs@10.13.0+` AND `next@15.4.1+` for Turbopack builds (both satisfied). Source maps upload POST-build when Turbopack is used (not during). |
| `posthog-js` | **1.368.0** (client) | Product analytics, EU cloud | Per PRD. Set `POSTHOG_HOST=https://eu.posthog.com`. LGPD-compliant EU data residency. Use `posthog-node` server-side for Inngest-emitted events. |
| `posthog-node` | (latest) | Server-side events | Needed for events emitted from Inngest functions (signup completion, trial transitions). |

**PII scrubbing for Sentry** (PRD §13 — load-bearing):
- Use `beforeSend` + `beforeBreadcrumb` to strip `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`.
- Drop entire request body on `/api/v1/identifications/*` routes (photos = PII).
- `user.email` MUST NOT be captured by `Sentry.setUser()`. Use `user.id` only.

**Confidence: HIGH**

### Payments

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` (Node SDK) | **22.0.1** | Billing provider behind `BillingProvider` adapter | Per PRD. Webhook signature verification via `stripe.webhooks.constructEvent(rawBody, sig, secret)`. |
| `@stripe/stripe-js` | (latest) | Client-side Checkout/Elements | For card flow. |

**Pix recurring (F1) — reality check:**
- **Pix Automático** (Brazilian Central Bank's recurring-payments extension) launched June 2025. Stripe integrated it and it is **available in 2026**.
- **Flow:** Customer authorizes a mandate in their bank app during initial enrollment (like SEPA mandate flow in EU). Subsequent charges require a **3-day pre-debit notification window** mandated by Brazilian banking regulation. This means `PaymentIntent` sits in `processing` for 3 days, then transitions to `succeeded` — can take **up to 7 days** with retries.
- **Consequence for Folhário subscription state machine (PRD §12):** The `trialing → active` transition on first charge is NOT instant for Pix users. The machine must tolerate a `trialing → processing → active` path, OR simply leave the user in `trialing` an extra 3–7 days past `trial_end_date` until the first successful Pix debit. The PRD's current state machine does not model `processing`.
- **Test mode:** Supported. Fake CPF `000.000.000-00`. Fake bank-app via "Simulate scanning" button on Stripe's hosted test page. Test emails `succeed_immediately@domain` / `expire_immediately@domain` short-circuit the 3-day wait.
- **CPF/CNPJ:** Mandatory at mandate creation. Folhário's signup form currently does NOT collect CPF — the PRD should add it OR collect it at the Pix checkout step only.
- **IOF tax:** Brazilian consumer tax applies to each transaction. Stripe handles the calculation but the user-visible receipt will show it.
- **NFS-e gap:** The PRD does not mention Brazilian tax-receipt generation (NFS-e — Nota Fiscal de Serviço eletrônica). For a paid SaaS sold to Brazilian consumers, NFS-e issuance is a legal requirement for most municipalities. **Stripe does NOT issue NFS-e.** Options: (a) manual emission via municipal portal for MVP volume; (b) integrate a fiscal gateway (NFE.io, eNotas, Omie, Enotas) post-MVP. **Roadmap flag:** call this out as a compliance blocker for going-live with paid Brazilian customers. This is the single biggest Brazil-specific gap in the PRD.

**Webhook events to subscribe:** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing` (needed for Pix!). PRD §12 does not enumerate which events trigger the `billing.webhook.received` Inngest event; roadmap Phase planning for Billing should nail this list.

**Confidence: MEDIUM-HIGH** — verified Pix Automático availability via Stripe docs; NFS-e gap is common Brazilian-SaaS knowledge.

### Identification Providers

| Provider | Pricing | Rate / Limits | Notes |
|----------|---------|---------------|-------|
| **Plant.id v3** (Kindwise) | €0.01–€0.05 per credit, **1 credit = 1 successful identification** (€10 for 1,000 up to €50 for 1,000 depending on volume tier) | Prepaid credits, no free tier beyond ~100 trial credits. No hard per-second rate limit published; bursts over 10 req/s may be throttled. | **Primary identifier.** Kindwise's own published benchmark: Plant.id 12% top-1 error vs. GPT-4 58%. 4% top-3 vs. GPT-4 36%. For beginner plant-parent UX this gap is load-bearing — GPT-class vision alone would destroy the <2-min promise on accuracy. |
| **OpenAI-compatible vision** | Model-dependent | Standard OpenAI rate limits | **Fallback only.** GPT-4o @ $2.50/$10 per M tokens (input/output); Claude Sonnet 4.6 @ $3/$15; Claude Haiku 4.5 @ $1/$5. A single plant identification with one 512×512 image lands around $0.005–$0.015 depending on model + verbosity. |

**For Folhário specifically:**
- Default routing: Plant.id primary, OpenAI-compat (use Claude Sonnet 4.6 or GPT-4o) fallback.
- PRD's per-provider $5/day cap is generous for trial-scale volume: €0.05/ID × Plant.id = ~100 IDs/day headroom; ~300–500/day on OpenAI fallback depending on model.
- The `min_confidence = 0.30` seed from PRD §6 is sensible for Plant.id (which returns calibrated 0..1 scores) but **vision-LLM "confidence" is not calibrated** — you'll need to define what confidence means for the LLM provider (e.g., ask for a self-reported 0..1 value in the JSON schema, or drop the confidence filter for LLM provider entirely and always return top-3). Roadmap flag.

**Confidence: HIGH on pricing and accuracy gap; HIGH on the confidence-calibration pitfall.**

### Brazilian Locale / Timezone Handling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next-intl` | **4.9.1** | i18n routing, message catalogs, date/time/number formatting | Day-one per PRD "i18n layer from day one" non-negotiable. Even with pt-BR only, use `next-intl` so string extraction and ICU message format are enforced. Supports App Router Server Components natively. |
| `date-fns-tz` | (latest 3.x) | `formatInTimeZone` for server-side rendering of user-local times | Preferred over vanilla `Intl.DateTimeFormat` when rendering inside Server Components that don't have client tz yet. Use with `User.timezone` read from DB. |
| `Intl.DateTimeFormat(...).resolvedOptions().timeZone` | browser built-in | Capture tz at signup | Per PRD §12. No library needed. |

**Locale conventions:**
- `lang="pt-BR"` on `<html>` is mandatory for screen readers (WCAG ship blocker).
- Default locale in `next-intl` config: `pt-BR`.
- Default timezone fallback: `America/Sao_Paulo` (server-side default when user is unauthenticated).
- Date format: `dd/MM/yyyy` (e.g., `14/04/2026`). Avoid US `MM/dd/yyyy` everywhere.
- Time format: 24h (e.g., `09:00`). Never 12h AM/PM.
- Number format: decimal comma, thousands separator dot (e.g., `R$ 29,90`).
- Currency: `BRL`, symbol `R$`, space after symbol (`R$ 29,90` not `R$29.90`).
- `Intl.DateTimeFormat('pt-BR', { timeZone: user.timezone })` handles this automatically — do NOT hand-roll format strings.

**Hydration trap:** Server renders dates in its own tz (UTC), client hydrates in user's tz → mismatch warning. Mitigations: (1) pass `timeZone` through `next-intl`'s `getRequestConfig`, (2) suppress hydration warnings on the specific date components only if you must render them client-side, (3) prefer server-formatted strings embedded in HTML.

**Confidence: HIGH**

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | **4.1.4** | Unit + integration test runner | Per PRD. Real Postgres for integration — NO DB mocking. Use `pg:16` service container in GitHub Actions CI. |
| `@playwright/test` | **1.59.1** | E2E against Vercel preview URL | Per PRD. Preview URL returned by `vercel deploy --prebuilt` is passed to Playwright via env var. |
| `@testcontainers/postgresql` | optional | Local integration-test DB bring-up | Alternative to `supabase start` for lighter-weight local integration runs. |

**Confidence: HIGH**

### Validation

| Library | Version | Purpose |
|---------|---------|---------|
| `zod` | **4.3.6** | Route-handler body/query validation, DTO schemas | Standard choice. Drizzle has first-class Zod integration (`drizzle-zod`) for schema → Zod conversion. |
| `drizzle-zod` | (latest) | Auto-generate Zod schemas from Drizzle tables | Keeps DB and validation in sync without manual duplication. |

---

## Installation (recommended)

```bash
# Framework core
npm install next@16.2.3 react@19.2.5 react-dom@19.2.5
npm install -D typescript@5.7 @types/node@22 @types/react@19 @types/react-dom@19

# PWA
npm install @serwist/next@9.5.7 serwist@9.5.7 web-push@3.6.7
npm install -D @types/web-push

# Data access
npm install drizzle-orm@0.45.2 postgres@3.4.9
npm install -D drizzle-kit@0.31.10

# Supabase (auth + storage only — NOT data access)
npm install @supabase/supabase-js@2.103.0 @supabase/ssr

# Async jobs
npm install inngest@4.2.1

# Email
npm install resend@6.11.0 @react-email/components@1.0.12
npm install -D react-email

# Observability
npm install @sentry/nextjs@10.48.0 posthog-js@1.368.0 posthog-node

# Payments
npm install stripe@22.0.1 @stripe/stripe-js

# i18n + tz
npm install next-intl@4.9.1 date-fns@4 date-fns-tz@3

# Validation
npm install zod@4.3.6 drizzle-zod

# Testing (dev)
npm install -D vitest@4.1.4 @vitest/ui @playwright/test@1.59.1
```

---

## Alternatives Considered

| Recommended | Alternative | When Alternative Would Be Better |
|-------------|-------------|----------------------------------|
| Serwist (`@serwist/next`) | `next-pwa` | **Never.** `next-pwa` is unmaintained (last release >18 months). Don't use. |
| Serwist | Hand-rolled SW + manifest | If you need absolute control and your SW is <200 lines. Folhário's offline queue + push + precache crosses that line. |
| Drizzle ORM | Prisma | If team strongly prefers Prisma's generator + Prisma Studio. **Tradeoff:** Prisma's query engine adds 10–30 MB cold-start weight on Vercel Functions and has weaker Supabase Supavisor compatibility. Drizzle is faster cold-start and SQL-transparent. |
| Drizzle ORM | Kysely | If you want pure query-builder with zero schema DSL. Kysely is arguably cleaner for read-heavy code but lacks Drizzle's migration story. |
| postgres-js driver | `pg` (node-postgres) | `pg` works with Supavisor in session mode. PRD mandates **transaction** mode (txn pooler) so `postgres-js` + `prepare: false` is the right pair. |
| Inngest | Trigger.dev | Very close competitor. Trigger.dev v3 has more aggressive self-host story. Inngest wins on (a) mature durable sleep, (b) first-class Vercel integration, (c) simpler mental model. PRD choice stands. |
| Inngest | Vercel Cron + DB polling | Would re-invent durable sleep poorly. Don't. |
| Resend | SendGrid / Postmark / SES | All work. Resend has the best React Email DX, which the PRD explicitly values. |
| PostHog EU | Mixpanel / Amplitude | PostHog EU is LGPD-clean, self-host-capable, and has session replay. The other two route through US. EU residency is the clincher for LGPD minimization. |
| Stripe | Pagar.me / Mercado Pago / Iugu | **Strongly consider Pagar.me or Mercado Pago if NFS-e issuance matters for your municipality.** They have native Brazilian fiscal integration that Stripe lacks. The PRD's `BillingProvider` adapter explicitly allows this swap — good design. For MVP launch, Stripe is fine IF you issue NFS-e manually for low volume. |
| Plant.id | PlantNet API only | PlantNet is free but has weaker accuracy on domestic/ornamental plants (its corpus is wild-flora-biased). Keep PlantNet as a tertiary fallback if cost blows up. |
| Plant.id | Pl@ntNet + vision LLM only | Kindwise's own benchmark: GPT-4 class vision is 5x worse on top-1. This is the defensible reason Plant.id is primary. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-pwa` | Unmaintained since ~2024; does not support Next 15+ App Router reliably; no Turbopack story. | `@serwist/next` |
| Prisma (for Folhário) | Cold-start weight on Vercel + Supavisor-pooler friction + duplication of schema truth | Drizzle ORM |
| Drizzle + `{ prepare: true }` on Supavisor txn pooler | Prepared statements across pooled connections = random `prepared statement "sN" already exists` errors | ALWAYS `prepare: false` on the postgres-js client |
| `pg` driver + transaction-mode pooler | Same prepared-statement issue + more moving parts | `postgres` (postgres-js) + `prepare: false` |
| Raw cron / `setInterval` for the 7-day deletion grace | Fragile across deploys, restarts, and retries | `inngest.step.sleepUntil(grace_period_ends_at)` |
| BullMQ / Redis queues | Extra infra for MVP scale; PRD explicitly forbids | Inngest |
| Supabase Auth's built-in email sender (in production) | Lower deliverability, no React Email templating, poor pt-BR branding | Resend + React Email via Supabase SMTP config OR custom token flow |
| Client-side Stripe secret key exposure | Obvious. | `STRIPE_SECRET_KEY` in server-only env; client uses `@stripe/stripe-js` with publishable key |
| `Sentry.setUser({ email })` | Leaks PII into Sentry, violates PRD §13 scrubbing rule | `Sentry.setUser({ id })` only |
| `date-fns` without `date-fns-tz` | Produces server-tz-local strings, hydration mismatch on user-local render | `date-fns-tz` `formatInTimeZone` |
| Vercel Git Integration | PRD explicitly disables. Two pipelines = split brain. | GitHub Actions only, `vercel deploy --prebuilt` |

---

## Version Compatibility Matrix

| Package A | Constraint | Notes |
|-----------|------------|-------|
| `next@16.x` | requires `react@19.x`, Node 20+ | App Router is 19-only. |
| `@sentry/nextjs@10.13+` | requires `next@15.4.1+` for Turbopack source maps | Satisfied at 16.2.3. Turbopack source maps upload **after** build completes, not during. Configure `SENTRY_AUTH_TOKEN` in GH Actions. |
| `drizzle-orm` + `postgres-js` + Supavisor txn pooler | MANDATORY `postgres(url, { prepare: false })` | Silent data corruption / random errors otherwise. Put this constant in a shared `db/client.ts` so it's impossible to bypass. |
| `@serwist/next@9.x` | requires Next 14+, App Router compatible | Verified in Next.js's own PWA guide. |
| `inngest@4.x` | Next App Router `serve()` handler at `/api/inngest/route.ts` | Free tier `step.sleepUntil` cap = **7 days**. Upgrade to Hobby for headroom on the LGPD grace period. |
| `web-push@3.6.x` | Node 18+ (use 20 or 22) | Has a long-standing quirk on Node 18 with EC crypto curves; 20+ is clean. |
| `next-intl@4.x` | Next 14+, App Router | Use `getRequestConfig` with user timezone read from session. |
| `stripe@22.x` | Node 18+ | Pix Automático support is available via standard `paymentIntents` + `mandates` API. |

---

## Known Pitfalls (feeds PITFALLS.md)

These are the load-bearing "don't learn this the hard way" items for the roadmap.

1. **Drizzle + Supavisor prepared-statement landmine** — `prepare: false` or random production outages. HIGH severity.
2. **Inngest `sleepUntil` free-tier 7-day ceiling** — PRD's LGPD grace is AT the ceiling. Upgrade to Hobby. HIGH severity.
3. **Stripe Pix 3-day pre-debit wait** — state machine needs a `processing` state for Pix users. MEDIUM severity.
4. **NFS-e issuance** — Stripe does not emit Brazilian fiscal receipts. Manual for MVP, automate via Enotas/NFE.io later. HIGH severity (legal).
5. **iOS Safari PWA push** — only works post-Add-to-Home-Screen. Never in a tab. EU users on iOS run PWAs in Safari tabs (EU DMA fallout) = no push for EU — but Folhário is pt-BR so BR users get push, EU-diaspora users don't. MEDIUM severity.
6. **iOS PushSubscription silent decay** — Apple prunes subscriptions of inactive users. The PRD's 410/404-on-send pruning handles this correctly; just make sure the `notifications/send-push` Inngest function actually deletes the `PushSubscription` row in the SAME step on 410/404, per PRD §15. HIGH severity if missed.
7. **Hydration mismatch on dates** — Server tz vs. user tz. Use `next-intl` + `date-fns-tz` server-side. MEDIUM severity.
8. **React Email `react-email dev` port collision** with `next dev` (both default to 3000). Always `--port 3001`. LOW severity but annoying.
9. **Sentry + Turbopack source maps upload post-build** — if CI aborts between `vercel build` and source-map upload, errors are unreadable. Ensure `deploy-production.yml` uploads source maps AFTER `vercel deploy --prod` succeeds, not before. MEDIUM severity.
10. **Vision-LLM confidence is uncalibrated** — the `min_confidence = 0.30` filter is meaningless for OpenAI-compat results unless you define a JSON schema that forces a self-reported confidence, or drop the filter for that provider. MEDIUM severity (affects result quality).
11. **CPF/CNPJ collection** — Pix Automático mandate setup requires CPF/CNPJ. PRD signup form does not collect it. Collect at Pix checkout step only (keeps signup short). MEDIUM severity.
12. **Supabase branch DB create/destroy latency** — `supabase branches create` can take 30–90s. Build this into the `deploy-preview.yml` timing expectation so the PR feedback loop doesn't feel broken. LOW severity.

---

## CI/CD Stack Addendum (PRD §20)

| Tool | Purpose | Notes |
|------|---------|-------|
| `vercel` CLI | `vercel pull` / `vercel build` / `vercel deploy --prebuilt` | Mandatory since Git Integration is OFF. Pin via `npm i -g vercel@latest` in workflow or use `amondnet/vercel-action`. |
| `supabase` CLI | `supabase branches create/delete`, `supabase db push` | For migrations + branch DB per PR. Use `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`. |
| `inngest-cli` | `npx inngest-cli dev` locally; prod sync via `inngest-cli deploy` | Function sync happens in `deploy-production.yml`. |
| `getsentry/action-release@v3` | Sentry release creation + source map upload | Improved sourcemaps support in v3. |
| `stripe` CLI | Local webhook forwarding only: `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe` | Not needed in CI. |
| GitHub Actions service container | `postgres:16-alpine` for integration tests | PRD mandates real Postgres. Seed with Drizzle migrations before running `vitest run`. |

**Supabase branch DB cost (F3 sized):** Micro compute = **$0.01344/hr** per branch. A PR open for 24 hours = $0.32. 20 PRs/month × 24h avg = ~$6.45/month. Negligible at low PR volume; linear in long-lived PRs. To cap risk, `deploy-preview-cleanup.yml` on PR close is mandatory (already in PRD §20). Branching requires the **Pro plan** ($25/month) — free tier does NOT include branching. Factor $25/mo into operational baseline.

---

## Sources

- **Next.js PWA guide (App Router)** — https://nextjs.org/docs/app/guides/progressive-web-apps — confirms Serwist as recommended path (HIGH)
- **Serwist `@serwist/next` getting started** — https://serwist.pages.dev/docs/next/getting-started (HIGH)
- **Next.js releases / upgrade guide** — https://nextjs.org/docs/app/guides/upgrading/version-16 — current latest 16.2.3 (HIGH)
- **Drizzle ORM + Supabase connect guide** — https://orm.drizzle.team/docs/connect-supabase — documents `prepare: false` requirement (HIGH)
- **Supabase Supavisor FAQ** — https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI (HIGH)
- **Supabase Drizzle tutorial** — https://supabase.com/docs/guides/database/drizzle (HIGH)
- **Inngest usage limits** — https://www.inngest.com/docs/usage-limits/inngest — free-tier `sleepUntil` 7-day cap (HIGH)
- **Inngest `step.sleepUntil` reference** — https://www.inngest.com/docs/reference/functions/step-sleep-until (HIGH)
- **Inngest sleeps feature doc** — https://www.inngest.com/docs/features/inngest-functions/steps-workflows/sleeps (HIGH)
- **Stripe Pix docs** — https://docs.stripe.com/payments/pix (HIGH)
- **Stripe Pix recurring (Pix Automático)** — https://docs.stripe.com/payments/pix/accept-a-recurring-payment (HIGH)
- **Stripe Pix changelog (2025-04-30)** — https://docs.stripe.com/changelog/basil/2025-04-30/add_pix_to_payment_method_configuration (MEDIUM)
- **Brazilian Central Bank — Pix Automático launch (June 2025)** — secondary via Fintech News (MEDIUM)
- **Kindwise Plant.id pricing + FAQ** — https://www.kindwise.com/faq + https://web.plant.id/pricing/ (HIGH on per-credit pricing, MEDIUM on exact volume tiers)
- **Kindwise: Plant.id vs GPT-4 benchmark** — https://www.kindwise.com/post/the-plant-identification-battle-gpt-4-vs-plant-id (MEDIUM — vendor's own benchmark, but directionally correct)
- **LLM pricing comparison (2026)** — https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude + https://www.tldl.io/resources/llm-api-pricing-2026 (MEDIUM)
- **Resend + Next.js App Router guide** — https://resend.com/docs/send-with-nextjs (HIGH)
- **Sentry Next.js manual setup + source maps** — https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/ (HIGH)
- **Sentry Release GitHub Action v3** — https://github.com/marketplace/actions/sentry-release (HIGH)
- **Apple Developer: sending web push notifications** — https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers (HIGH on iOS 16.4+ requirement)
- **MagicBell: iOS PWA limitations 2026** — https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide (MEDIUM — confirms subscription decay, EU tab fallback)
- **web-push npm package** — https://www.npmjs.com/package/web-push + https://github.com/web-push-libs/web-push (HIGH)
- **next-intl date formatting** — https://next-intl.dev/docs/usage/dates-times + https://next-intl.dev/blog/date-formatting-nextjs (HIGH)
- **Supabase pricing / branching cost** — https://supabase.com/docs/guides/platform/manage-your-usage/branching (HIGH on $0.01344/hr Micro compute)
- **Supabase pricing 2026 (Pro required for branching)** — https://supabase.com/pricing (HIGH)
- **Live npm registry versions fetched 2026-04-14** — `next@16.2.3`, `react@19.2.5`, `drizzle-orm@0.45.2`, `@serwist/next@9.5.7`, `web-push@3.6.7`, `@sentry/nextjs@10.48.0`, `inngest@4.2.1`, `resend@6.11.0`, `@react-email/components@1.0.12`, `posthog-js@1.368.0`, `stripe@22.0.1`, `next-intl@4.9.1`, `postgres@3.4.9`, `@playwright/test@1.59.1`, `vitest@4.1.4`, `@supabase/supabase-js@2.103.0`, `drizzle-kit@0.31.10`, `zod@4.3.6` (HIGH)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Framework (Next/React/TS/Serwist) | HIGH | Verified against live npm + official Next.js guides |
| Data layer (Drizzle/postgres-js/Supabase) | HIGH | `prepare: false` requirement is documented canonically; verified version numbers live |
| Inngest + sleepUntil semantics | MEDIUM-HIGH | Free-tier 7-day cap is explicit in docs; Hobby-tier exact price not fetched live |
| Stripe + Pix Automático | MEDIUM-HIGH | Verified via Stripe docs; NFS-e is well-known Brazilian SaaS gap; 3-day wait confirmed |
| Plant.id + OpenAI-compat | HIGH on Plant.id pricing/accuracy, HIGH on LLM pricing; MEDIUM on "confidence calibration" pitfall (inferred from domain knowledge) |
| iOS push reality | HIGH | Apple dev forum + multiple secondary sources align |
| pt-BR locale + next-intl | HIGH | next-intl docs are canonical |
| Testing stack | HIGH | Vitest + Playwright are uncontroversial |
| CI/CD tooling | HIGH | Vercel CLI + Supabase CLI + GitHub Actions are the standard triple |

---

*Stack research for: Folhário plant-identification PWA (pt-BR, Brazilian beginners)*
*Researched: 2026-04-14*
*Next action for orchestrator: feed these flags into PITFALLS.md and FEATURES.md dimension researchers.*
