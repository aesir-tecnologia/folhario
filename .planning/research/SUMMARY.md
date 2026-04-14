# Research Summary: Folhário

**Project:** Folhário — pt-BR plant identification + care-guide + reminder PWA
**Researched:** 2026-04-14
**Confidence:** HIGH overall — every PRD §2/§3 choice is endorsed; gaps are decisional, not architectural

## Executive Summary

Folhário sits in a well-mapped product category (PictureThis, Planta, Greg, PlantIn, PlantNet) but differentiates through ethics rather than features: honest AI provenance, no freemium, no data hostage, WCAG-grade redundant toxicity signals, single daily push, and a hand-curated pt-BR care-guide corpus. Research validates that the PRD-locked stack (Next.js 16 App Router on Vercel, Supabase Postgres + Auth + Storage, Drizzle in repos only, Inngest for all async, Stripe for billing, Resend + React Email, Sentry + PostHog EU, web-push + VAPID, Plant.id primary with OpenAI-compat fallback) is coherent and battle-tested. The DDD-lite seven-context layout (IAM, Catalog, Species & Care, Identification, Reminders, Billing, Notifications) is sound; the main risks are disciplinary (context leakage through shared tables, cross-context repo imports, route handlers growing past thin-adapter rule), not structural.

The expert recommendation is to ship the PRD as written but to resolve four decisional gaps before requirements lock and to budget two paid platform tiers from day one (Supabase Pro at $25/mo for branch DBs, Inngest Hobby for `step.sleepUntil` headroom past the 7-day free-tier ceiling). The biggest risks are Brazil-specific compliance gaps the PRD silently inherits — NFS-e fiscal receipts (Stripe does not issue them), Pix Automático's 3-day pre-debit window (which the subscription state machine doesn't model), and DPO appointment + privacy policy publication. The biggest product-shape risk is the absent disease-diagnosis decision: every competitor ships it, the PRD silently omits it, and "minha planta tem manchas" will be in the support inbox in week 1 unless the omission is explicit and rationalized.

Build order is well-constrained: Foundation → IAM → (Billing ‖ Catalog ‖ Species & Care) → Identification → Reminders → Notifications → Hardening. The curated care-guide corpus is a parallel founder-owned content track running throughout and is a hard launch blocker.

## Pre-Launch Blockers

| Blocker | Owner | Why it blocks launch |
|---|---|---|
| Pricing TBD (single monthly tier in BRL) | Founder | Stripe price object cannot be created; trial→paid cannot be tested; NFS-e amounts unknown |
| NFS-e issuance path (3rd-party vs manual vs on-request) | Founder + accounting | Stripe does NOT issue Brazilian fiscal receipts; legally required for B2C service charges in most municipalities. PRD §24 launch blocker. |
| DPO (Encarregado) appointed + contact published | Founder | LGPD Art. 41 requirement; must be on privacy policy page before first identification |
| Privacy policy + ToS published in pt-BR | Founder + legal | Per-purpose consent (Art. 33) requires the policy to exist and be linkable |
| ≥200 curated pt-BR care guides shipped | Founder | Without the curated corpus, first 200 users see "no care guide" because runtime augmentation is async. PRD §24 launch blocker. |
| Supabase Pro plan ($25/mo) | Founder | Branch DBs per PR (PRD §20) require Pro tier; Free-tier branches are unreliable for the integration-test gate |
| Inngest Hobby plan | Founder | `step.sleepUntil` Free is capped at exactly 7 days — the LGPD deletion grace is exactly 7 days, leaving zero headroom. Hobby buys 1 year. |
| Plant.id account + paid credit balance | Founder | Trial credits won't survive QA + early users |
| Stripe live mode + Pix enablement | Founder | Pix Automático requires Brazilian entity verification; lead time can be days to weeks |
| Resend domain verification | Founder | Required before production transactional email |
| VAPID keypair generated + persisted | Engineering | Web Push subscriptions are bound to the VAPID public key; rotation invalidates every existing subscription |

## Decisions Needed Before Requirements Phase

| Decision | Options | Why it matters | Recommendation |
|---|---|---|---|
| Disease diagnosis (in or out for v1?) | (a) Ship MVP via extended `IdentificationProvider`; (b) Defer post-launch with explicit out-of-scope rationale; (c) Partial ship as "photo of problem → augmented LLM diagnosis with disclaimer" | Every competitor ships it; Brazilian beginners googling "manchas na minha costela" expect it. Implicit decision = week-1 feature request. | **(b) Defer with explicit rationale** — protects scope discipline and the <2-min promise; document in PROJECT.md Out of Scope before requirements lock |
| Pix Automático vs one-time Pix | (a) Pix Automático with mandate flow + 3-day pre-debit window; (b) One-time Pix per renewal (manual user action) | Pix Automático adds a `processing` state the PRD subscription state machine doesn't model (3–7 days), requires CPF capture, and conflicts with the 4-retries-over-7-days dunning model. One-time Pix breaks "set and forget." | **Card-only billing for MVP, Pix Automático in v1.1** — ship faster, validate price first, then extend the state machine |
| Email-verification resend rate limit | (a) Public-auth-throttle covers it; (b) Dedicated narrow throttle (e.g., 3/hour per email + 10/hour per IP) | PRD §16 mentions resend-verification but throttle §5 only covers login + signup. Without a limit, attacker (or buggy client) can flood Resend → quota exhaustion | **(b) 3/hour per email + 10/hour per IP**, return 429 with retry-after, never reveal whether the email exists |
| Contextual help inside consent + push modals | (a) None (PRD bans forced tours, period); (b) Inline "saiba mais" expansion within modals only, never standalone tours | LGPD consent + push prompts often need "why is this asking?" explanation. Inline expansion is different from forced onboarding tours. | **(b) Inline expansion inside modals only**; document the boundary so it's not litigated as tour creep |
| Supabase Auth email path | (a) SMTP-via-Resend; (b) Disable Supabase confirmation emails entirely and dispatch via React Email custom token flow | PRD commits to React Email for transactional mail but is silent on whether Supabase Auth's built-in flow is used or bypassed | **(b) Custom token flow with React Email** — voice consistency matters for the brand; Supabase templates are generic |
| Vision-LLM confidence calibration | (a) Force self-reported 0..1 confidence in the JSON schema; (b) Drop the `min_confidence=0.30` filter for OpenAI-compat fallback | Plant.id returns calibrated 0..1 scores; OpenAI-compat does NOT. The 0.30 filter is meaningless for fallback unless schema forces self-report | **(a) Force self-reported confidence in schema** AND label visibly differently from Plant.id ("confiança estimada pela IA") |

## Key Findings

### Recommended Stack (validated, version-pinned 2026-04)

The PRD §2 stack is endorsed in full. All versions verified against live npm registry on 2026-04-14. See `.planning/research/STACK.md` for the complete pinned-version table.

**Core technologies:**
- **Next.js 16.2.3 + React 19.2.5 + TS 5.7** — App Router with Route Handlers under `/api/v1`; do NOT start on 15.x
- **Node 20 or 22 LTS** — never 18 (`web-push` crypto path quirks)
- **`@serwist/next` 9.5.7** — `next-pwa` is abandoned; Serwist is the official Next.js PWA recommendation
- **Drizzle 0.45.2 + `postgres` 3.4.9** — MUST be `postgres(url, { prepare: false })` against Supavisor txn pooler or prepared statements break under connection reuse (silent corruption). Foundation-phase invariant.
- **Supabase JS 2.103.0** — auth + storage adapters only; data access is Drizzle exclusively
- **Inngest SDK 4.2.1** — `step.sleepUntil` Free tier capped at 7 days; budget Hobby plan from day one
- **`stripe` 22.0.1** — Pix Automático available but creates a `processing` subscription state the PRD doesn't model; recommend card-only for MVP
- **Plant.id v3** primary (12% top-1 error vs GPT-4 58% per Kindwise benchmark) + **OpenAI-compat fallback** (Claude Sonnet 4.6 or GPT-4o, ~$0.005–$0.015 per ID)
- **`next-intl` 4.9.1** — day-one i18n layer per PRD non-negotiable; pt-BR only ships
- **Vitest 4.1.4 + Playwright 1.59.1** + real-Postgres integration via Supabase branch DBs per PR
- **Sentry `@sentry/nextjs` 10.48.0 + PostHog EU** — Sentry needs heavy `beforeSend` PII scrub; never pass `email` to `setUser`

### Expected Features

The PRD covers every category table-stake (photo identification, catalog, care guides, watering reminders, push delivery, photo journal, toxicity warnings, account+auth, subscription billing, offline browsing, identification history, manual entry, room organization, password reset, multi-device sync). See `.planning/research/FEATURES.md` for the full competitive matrix.

**Differentiators committed in PRD** (mostly ethical positioning, not technical firsts):
- Honest AI: visible top-3 confidence ladder + permanent "Gerado por IA" badge on augmented care guides
- Single paid tier, no freemium, 14/30-day trial
- No data hostage: read-only catalog mode on billing lapse
- WCAG-grade redundant toxicity signals (icon + color + text + striped border + SR alert + haptic)
- Single daily push nudge (never per-reminder), permission deferred to first reminder creation
- Curated ≥200 species pt-BR care-guide corpus (founder-owned, launch blocker)
- LGPD-as-UX (per-purpose consent, Art. 33 disclosure, 7-day deletion grace, per-consent revocation)
- Mobile-first PWA, tablet-width on desktop (one shape, no wide-screen layouts)
- Cost caps enforced BEFORE provider dispatch (DB-driven, atomic counters)

**Table-stakes gap NOT in PRD:** **disease diagnosis** (see Decisions Needed). Light meter, weed classification, account recovery via lost email — all flagged for v1.x.

### Architecture Approach

The PRD §3 seven-context DDD-lite layout is validated as sound. See `.planning/research/ARCHITECTURE.md` for the full context ownership matrix and project structure.

**Major components (bounded contexts):**
1. **IAM** — Owns User, ConsentLog, PartnerStore, DataExportRequest, DataDeletionRequest. Email verification, OAuth, consent, LGPD rights. Highest-frequency dependency.
2. **Catalog** — Owns Plant, PhotoEntry. Reads Species via Species & Care query service. Receives `identification.succeeded` for prefill.
3. **Species & Care** — Owns Species, CareGuide. Triggers runtime augmentation on `flag_reason=missing_care_guide`. Curated corpus loaded here.
4. **Identification** — Owns Identification, ProviderBudget, ProviderUsageCounter, IdentificationLimit. Cap enforcement BEFORE dispatch is the load-bearing invariant.
5. **Reminders** — Owns Reminder, ReminderLog. Validates plant ownership via Catalog query service. Emits `daily_reminder_summary.due`.
6. **Billing** — Owns Subscription, BillingEvent. Webhook = signature verify → BillingEvent insert (UNIQUE event_id) → Inngest enqueue. Heavy work async.
7. **Notifications** — Owns PushSubscription. Write-side only. Consumes events from every other context. Reactive 410/404 pruning.

**Key cross-cutting addition not in PRD:** a dedicated `src/shared/contracts/` directory for cross-context type contracts (event payload shapes + query-service DTOs) that neither context owns. Without this, IAM or Catalog ends up owning types both import.

**Choreography rules:** cross-context communication is async via Inngest events OR sync via thin read-only query services. No repository imports another context's repository (enforce via ESLint import-restriction rule). Foreign keys that cross contexts are advisory. Route handlers are thin: validate → use-case → http-map → Response.

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for the complete catalogue. Top five that most affect roadmap structure:

1. **LGPD Art. 33 consent collapsed into a generic ToS checkbox** — Two distinct ConsentLog records required (ToS+PP at signup on Contract basis; `identification_third_party` at first identification on Consent basis). Never coalesce. Settings revocation must NOT break catalog view.
2. **Per-user identification cap bypassed by concurrent requests (TOCTOU)** — Cap check + counter claim MUST be a single atomic statement (`INSERT ... ON CONFLICT ... WHERE counter + cost <= cap RETURNING *`), not SELECT-then-INSERT. Integration test with two concurrent requests required.
3. **Cap-exceeded path still creates an Identification row** — Cap-hit emits 429, writes NO row, increments NO counter. Track via PostHog or dedicated `CapHitLog` (no FKs).
4. **Stripe webhook processed synchronously** — Three-step handler is mandatory: (1) signature verify, (2) INSERT BillingEvent with UNIQUE event_id, (3) Inngest enqueue. Heavy work in `billing/process-webhook` Inngest function.
5. **NFS-e assumed to be handled by Stripe** — Stripe does NOT issue Brazilian fiscal receipts. Launch blocker until third-party integration, manual SLA, or on-request-only policy is committed.

Other reinforced cross-cutting findings:
- **Supavisor + prepared statements** — `postgres(url, { prepare: false })` or silent corruption. Foundation-phase DB client invariant.
- **iOS PWA push reality** — only works post-Add-to-Home-Screen, never in browser tab; reactive 410/404 pruning is the only fix (PRD §15 has it right).
- **Inngest `step.sleepUntil` 7-day Free ceiling** — exactly equals LGPD deletion grace. Zero headroom. Hobby plan from day one.
- **Vision-LLM confidence is uncalibrated** — `min_confidence=0.30` is meaningless for OpenAI-compat unless schema forces self-report.
- **Hydration drift on locale-formatted dates** — pass `timeZone` through `next-intl`'s `getRequestConfig`.

## Implications for Roadmap

### Phase Ordering Signal (build-order dependency graph)

```
Phase 0: Foundation
   └─ Phase 1: IAM (Auth + LGPD foundations)
        ├─ Phase 2a: Billing (depends on User)
        ├─ Phase 2b: Catalog (depends on User; parallel to 2a)
        └─ Phase 2c: Species & Care (independent; parallel)
             └─ Phase 3: Identification (needs User + Consent + Caps + Species ref)
                  └─ Phase 4: Reminders (needs Plants from Catalog)
                       └─ Phase 5: Notifications (needs Reminders + email triggers)
                            └─ Phase 6: Hardening + Launch (NFS-e, observability, content QA)

Parallel track throughout: ≥200 curated pt-BR care guides (founder-owned content)
```

### Phase 0: Foundation
**Rationale:** Every following phase depends on the same cross-cutting invariants being correct from day one. Supavisor + prepared statements wrong = silent corruption; CI without branch DBs = invalidates integration test strategy; route-handler shape wrong = contaminates every context.
**Delivers:** Next.js 16 + React 19 + TS scaffold; `src/contexts/` + `src/shared/` skeleton; Drizzle + `postgres({ prepare: false })` client factory; Supabase project + branch DB strategy; Inngest dev server; `next-intl` pt-BR scaffold; Vitest + Playwright + GitHub Actions CI; Sentry + PostHog wrappers (PII scrub); `src/shared/contracts/` directory; ESLint import-restriction rule; design tokens; PWA shell (`@serwist/next`, manifest, install prompt, app-update toast).
**Avoids:** Supavisor corruption; context leakage; Vercel git integration deploy bugs; Sentry PII leak; locale hydration drift.
**Research flag:** Standard patterns; STACK.md + ARCHITECTURE.md cover everything.

### Phase 1: IAM (Auth + LGPD foundations)
**Rationale:** Email verification gates everything (it starts the <2-min clock). LGPD consent storage gates identification. DataDeletionRequest exercises Inngest `step.sleepUntil`, the only durable-sleep usage — must validate early.
**Delivers:** Email+password signup with verification gate; Google OAuth; password reset; per-device JWT middleware; ConsentLog with separate ToS+PP record (Contract basis) and identification_third_party record (Consent basis); per-consent revocation in Settings; LGPD data export Inngest function; LGPD deletion request with `step.sleepUntil(7d)` cancellation; age-gate ≥13; partner code signup + late-entry; React Email templates (verification, password reset, deletion confirmation); resend-verification rate limit (3/hour per email + 10/hour per IP).
**Uses:** Supabase Auth (custom-token flow), Resend, React Email, Inngest `step.sleepUntil`, Drizzle, RLS.
**Avoids:** ConsentLog coalescing; deletion-grace race (event payload must embed `grace_period_ends_at`); resend-verification flooding.
**Research flag:** Needs deeper research on Supabase Auth email path and ConsentLog versioning semantics.

### Phase 2a: Billing
**Rationale:** Subscription state gates identification + reminders. Webhook idempotency must be in place before any identification. Stripe Pix has lead-time so paperwork starts in parallel.
**Delivers:** Stripe Checkout (card only for MVP); 14/30-day trial; Subscription state machine; webhook handler (signature verify → BillingEvent insert with UNIQUE event_id → Inngest enqueue, <200ms); `billing/process-webhook` Inngest function; `billing/trial-ending` cron at T-2 days; read-only catalog mode flag; cancel path with `current_period_end`; reactivation flow.
**Avoids:** Sync webhook state mutation; missing UNIQUE on event_id; data hostage on lapse; opaque cancel.
**Research flag:** Exact Stripe webhook event subscription list; NFS-e provider comparison.
**Pre-launch dependency:** NFS-e issuance path decision before live mode.

### Phase 2b: Catalog
**Rationale:** Retention anchor. Independent of Billing and Species & Care for write paths so it can run parallel. Reminders depend on Catalog so it must precede Phase 4.
**Delivers:** Plant aggregate (name, nickname, location, acquisition_date, notes, sort); PhotoEntry photo journal; manual plant entry; room/location combined picker; cover photo; inline edit; offline queue (IndexedDB, client-UUID idempotency); multi-device sync via server-timestamp LWW.
**Uses:** Drizzle, Supabase Storage, client-side compression + EXIF strip (server reject), IndexedDB.
**Avoids:** Server holding GPS-bearing photos; offline replay losing idempotency; cross-context repo imports.

### Phase 2c: Species & Care
**Rationale:** Species ref needed by Identification (prefill) and Catalog (name/thumbnail). Care guide display needed by plant profile. Curated corpus loading is independent of code paths.
**Delivers:** Species table + curated import pipeline; CareGuide table with 7-field structure; runtime augmentation Inngest function (`care-guide/augment`) with permanent `source=augmented` badge; `getCareGuide` query service; toxicity-warning component with redundant signals + one-time ack modal.
**Avoids:** Toxicity-as-color-only WCAG fail; augmented guides without badge; LLM augmentation in critical path.
**Pre-launch dependency:** ≥200 curated species (parallel founder content track).

### Phase 3: Identification
**Rationale:** Core value moment. Depends on Auth + Consent + Catalog + Species & Care + Billing being in place. Cost caps must be atomic from first dispatch — naive caps create runaway billing exposure.
**Delivers:** Provider abstraction (Plant.id primary + OpenAI-compat fallback); multi-photo upload with compression + EXIF strip; static capture guide; blocking LGPD consent modal at first identify (Art. 33); top-3 confidence ladder UI; manual entry fallback when providers fail or caps hit; per-user daily + period caps + per-provider USD ceilings via atomic `INSERT ON CONFLICT WHERE counter + cost <= cap RETURNING *`; 80% ceiling alert with latching `alert_80_sent_at` boolean; circuit breaker; identification history; vision-LLM JSON schema with self-reported confidence.
**Avoids:** TOCTOU cap bypass; cap-hit rows polluting table; 80% alert flood or no-alert; uncalibrated LLM confidence; no manual fallback.
**Research flag:** Vision-LLM JSON schema design; Plant.id v3 response → DTO mapping; circuit-breaker thresholds.

### Phase 4: Reminders
**Rationale:** Depends on Plants existing (Phase 2b) and Notifications fan-out (Phase 5). Logically between them.
**Delivers:** Reminder aggregate (water + fertilize, frequency prefilled); `from_scheduled` vs `from_acted` advance rules; in-app done/snooze (1h/3h/tomorrow); overdue visual state (no escalation); `next_due_at` precomputation; daily-summary aggregator (`daily_reminder_summary.due` event); push permission deferred to first reminder save; per-plant + global mute prefs; ReminderLog audit trail.
**Avoids:** Per-reminder push (burns permission); push ask at signup; auto-shaming on overdue.

### Phase 5: Notifications
**Rationale:** Write-side only, consumes events from every other context — must land after them.
**Delivers:** PushSubscription table keyed `(user_id, device_id)`; web-push VAPID dispatch from `notifications/send-push` Inngest function; reactive 410/404 pruning; single daily nudge per user; React Email templates for trial-ending, payment-failed, deletion-confirmation, NFS-e-issued; Resend dispatch from `notifications/send-email`; permission lifecycle UI.
**Avoids:** Push permission burn; iOS PWA push-in-browser-tab attempt; subscription leak; per-reminder push; action buttons inside payload.
**Research flag:** iOS PWA push behavior April 2026; Resend idempotency-key strategy.

### Phase 6: Hardening + Launch
**Rationale:** Compliance gates, content QA, observability tuning happen after the functional surface is complete. NFS-e cannot be validated until Stripe live mode is enabled, which depends on pricing.
**Delivers:** NFS-e issuance flow; operator alert wiring (Resend, idempotent on `(provider, purpose, utc_date)`); Sentry dashboards; PostHog dashboards for first-value metric (signup→verify→identify <2min funnel); scheduled SQL rollups for ID quality; ≥200 curated care guides QA pass; WCAG 2.1 AA audit (ship blocker); privacy policy + ToS publication; DPO contact published; Plant.id paid balance; production VAPID keys; Resend domain verification; production env vars; final E2E pass.
**Avoids:** Going live without NFS-e, DPO, curated corpus, WCAG audit, or production Resend domain.

### Phase Ordering Rationale

- **IAM before everything else** because email verification starts the <2-min clock and ConsentLog gates identification.
- **Billing in parallel with Catalog + Species & Care** because all three depend on User but not on each other's writes — widest parallelizable phase.
- **Identification after the parallel triplet** because it depends on User + Consent (IAM), Cap tier (Billing), Catalog (prefill), and Species ref (Species & Care). It is the convergence point.
- **Reminders after Identification** because reminders are created from a plant which was created from an identification. Matches user's first-session flow.
- **Notifications last** because it consumes events from every context; building it earlier means stubbing six event producers.
- **Curated content track is parallel throughout** — founder-owned content, must NOT delay engineering critical path.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (IAM):** Supabase Auth email-path; LGPD ConsentLog versioning; React Email pt-BR voice spec.
- **Phase 2a (Billing):** Stripe webhook event list; NFS-e provider comparison.
- **Phase 3 (Identification):** Vision-LLM JSON schema; Plant.id v3 response mapping; circuit-breaker semantics.
- **Phase 5 (Notifications):** iOS PWA push behavior April 2026; Resend idempotency-key strategy.

Phases with standard patterns (skip research):
- **Phase 0 (Foundation):** STACK.md + ARCHITECTURE.md cover everything.
- **Phase 2b (Catalog):** Standard CRUD + offline queue.
- **Phase 2c (Species & Care):** Standard import + LLM augmentation.
- **Phase 4 (Reminders):** Standard scheduling + daily-summary fan-out.
- **Phase 6 (Hardening):** Compliance + QA, no architectural research.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Every PRD §2 choice endorsed; versions verified against live npm registry 2026-04-14. Three medium flags: Inngest sleep tier, Stripe Pix Automático integration pattern, Supabase Auth email-path intent |
| Features | HIGH | Competitive set is well-documented; PRD is exhaustive. The disease-diagnosis gap is decisional, not research-blocked |
| Architecture | HIGH | Pattern validation HIGH against ecosystem practice; cross-context read shape MEDIUM (multiple defensible variants); Inngest choreography HIGH |
| Pitfalls | HIGH | Domain-specific rules HIGH (anchored in CAVE-PRD AC); platform gotchas MEDIUM-HIGH (verified vs 2026 docs); Brazilian-market specifics MEDIUM (Pix Automático + NFS-e policy is moving fast) |

**Overall confidence: HIGH.** Research surfaces zero "we should not build this" findings and surfaces the four decisional gaps and ten pre-launch blockers cleanly enough that requirements can resolve them all before phase planning.

### Gaps to Address

- Disease diagnosis decision (recommended: defer with explicit rationale)
- Pix Automático vs card-only for MVP (recommended: card-only, Pix in v1.1)
- NFS-e issuance path
- Pricing in BRL
- DPO appointment + privacy policy publication
- Supabase Auth email path
- Vision-LLM confidence calibration approach
- Capture guide rendering (silhouette overlay vs pre-capture screen)
- Inline contextual help bounded definition
- Email-verification resend rate limit

## Sources

### Primary (HIGH confidence)
- CAVE-PRD §1–§25 (`docs/CAVE-PRD.md`, dated 2026-04-12)
- Next.js 16 / React 19 / Turbopack official docs (verified 2026-04-14)
- Supabase + Supavisor + branch DB official docs
- Drizzle ORM + Drizzle-Kit official docs (`prepare: false` Supavisor invariant)
- Inngest docs (step.sleepUntil tier ceiling, retry semantics)
- Stripe Pix + Pix Automático docs (3-day pre-debit window confirmed)
- Sentry + Next.js + Turbopack source-map docs
- web-push + VAPID + iOS PWA push behavior (Safari 17.4+ Add-to-Home-Screen requirement)
- Kindwise / Plant.id v3 published benchmarks (12% top-1 vs GPT-4 58%)
- next-intl App Router docs

### Secondary (MEDIUM confidence)
- PostHog EU residency + LGPD positioning
- React Email + Resend integration patterns
- Brazilian NFS-e common-knowledge (NFE.io, Omie, eNotas)
- LGPD ANPD enforcement posture 2025–2026
- Competitive feature set (PictureThis, Planta, Greg, PlantIn, PlantNet, Blossom, PlantSnap)

### Tertiary (LOW confidence)
- Exact Inngest Hobby/Pro pricing (tier headroom verified, $/month not pinned live)
- Stripe Pix Automático real-world latency distribution beyond mandated 3-day window
- iOS PWA push subscription decay rate (anecdotal, no published metric)

---

*Synthesized: 2026-04-14 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
