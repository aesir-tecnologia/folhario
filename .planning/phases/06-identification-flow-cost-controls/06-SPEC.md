# Phase 6: Identification Flow & Cost Controls — Specification

**Created:** 2026-05-10
**Ambiguity score:** 0.11 (gate: ≤ 0.20)
**Requirements:** 35 locked

## Goal

A verified, trial-active user opens the Identify screen, snaps or picks 1–N photos, accepts the first-time LGPD Art. 33 third-party transfer consent, and within the 50s function budget receives ≤3 honest top-3 results with confidence-ladder UI, selects one, and lands in their catalog with a Plant linked to a Species — while the platform enforces per-user caps, per-provider daily ceilings, atomic counters, and a circuit breaker so a runaway provider can never blow the $5/day budget.

## Background

Phases 1–5 are complete (62/78 plans, 79%). The data layer (Phase 2) already shipped Drizzle schemas + RLS for `Identification`, `IdentificationLimit`, `ProviderBudget`, `ProviderUsageCounter`, `ConsentLog`, and storage buckets `plant-photos`/`plant-thumbnails`. Phase 4 shipped IAM + auth + the consent infrastructure (ConsentLog rows, policy versioning). Phase 5 shipped the `Meu Jardim` catalog with manual plant creation, photo journal, and `create-plant.ts:101-121` already exposes a schema branch ready for an identification caller.

What does NOT exist yet:
- `src/contexts/identification/` is scaffolded with `domain/schemas.ts` (38 lines), `domain/events.ts` (52 lines), `infrastructure/db/schema.ts` (139 lines), and an empty `inngest/functions.ts` (3 lines). All other folders (`api/`, `application/`, `infrastructure/` beyond db schema) are `.gitkeep` placeholders.
- No `/api/v1/identifications` route handler exists.
- No `IdentificationProvider` adapter, no Plant.id connector, no OpenAI-compat connector.
- No router, no circuit breaker, no per-user cap check, no per-provider ceiling enforcement, no atomic counter increment, no 80% operator alert.
- No Identify screen, no capture guide, no confidence-ladder UI, no first-time consent modal, no identification-history screen, no manual-correction UI.
- `Identification.plant_id` FK wiring from a successful identification → newly created Plant linked to Species is not yet wired into `create-plant.ts`'s identification branch.

This phase builds the full vertical slice from UI capture → consent → cap check → router → provider call → response filtering → persistence → Plant+Species creation, plus the cost-control plumbing that protects the $5/day per-provider budget.

## Requirements

### Identification flow (IDENT)

1. **IDENT-01 — Successful identification end-to-end**: `POST /v1/identifications` returns ≤3 results above `min_confidence` ordered desc; persists `Identification status=success` with provider/model/latency/consent_version/photo_urls; emits `identification.succeeded`.
   - Current: No route handler, no provider adapter, no persistence path
   - Target: Route + use-case + adapter chain produces a successful identification for an authed, consented, trialing/active, below-cap user
   - Acceptance: Integration test — authed test user with consent + capacity → POST returns ≤3 results, Identification row persisted with all fields populated, `identification.succeeded` event emitted to Inngest

2. **IDENT-02 — First-time LGPD consent modal**: First identification ever without `identification_third_party` consent triggers the LGPD consent modal disclosing Plant.id + OpenAI-compat providers and Art. 33 transfer; no provider call until granted.
   - Current: No consent modal UI; ConsentLog persistence exists from Phase 4
   - Target: Identify screen detects missing consent → shows modal listing both providers + Art. 33 disclosure → grant writes ConsentLog → unlocks identification
   - Acceptance: E2E — user without `identification_third_party` consent hits Identify, sees modal listing both provider names + Art. 33 international transfer, granting persists ConsentLog row and proceeds; denying or closing returns user to home with no provider call

3. **IDENT-03 — Consent revoked or never granted**: `consent_required` 403; no provider call; no Identification row.
   - Current: No consent-gate logic on identification path
   - Target: Use-case checks active consent before any provider work; failure short-circuits with `consent_required`
   - Acceptance: Integration — user with revoked consent → POST returns 403 `consent_required`, zero rows in `Identification`, zero provider HTTP calls in test recorder

4. **IDENT-04 — Backend confidence threshold filter**: Backend filters results below `ProviderBudget.min_confidence` (seed 0.30); only above-threshold results returned, max 3.
   - Current: No filter logic; `min_confidence` column seeded but unused
   - Target: After provider response, drop entries below `min_confidence`, sort desc, slice top 3
   - Acceptance: Unit test — given a stub provider returning 5 results (0.85, 0.50, 0.40, 0.25, 0.10) and `min_confidence=0.30`, response includes exactly 3 entries (0.85, 0.50, 0.40) ordered desc

5. **IDENT-05 — Zero-results state**: Zero results above threshold → "could not identify" UI + retake guidance; Identification row persisted with raw provider results for history.
   - Current: No UI state; no persistence path
   - Target: Empty filtered set → response shape signals zero-results; row persisted with raw payload + `status=success`; UI renders retake guidance
   - Acceptance: Integration — provider stub returns only sub-threshold results → response is empty top-3 with explicit zero-results shape, Identification row exists with raw provider data, UI renders "could not identify" copy

6. **IDENT-06 — Result selection creates linked Plant**: User selects a result and confirms → Plant created linked to Species, name pre-filled, `Identification.plant_id` FK set.
   - Current: `create-plant.ts:101-121` has the schema branch; no caller from identification flow
   - Target: Selection submit calls plant creation with `species_id` + identification reference; FK wired both directions
   - Acceptance: E2E — user identifies, selects result 1, lands on Plant profile with name + Species link; querying Identification row shows `plant_id` set to the new Plant

7. **IDENT-07 — Manual correction**: Manual correction stored in `manual_correction`; Species resolved by name match if possible, else null + flagged.
   - Current: No manual-correction input
   - Target: Manual-entry path on Identify screen → stores user-typed name in `Identification.manual_correction`; Species lookup by exact (case-insensitive) name match → set `species_id` if found, else null and flag Species `flag_reason=missing_care_guide`
   - Acceptance: Integration — manual correction "Monstera deliciosa" with matching Species → species_id set; "Planta inventada" with no match → species_id null + Species flag row created with `flag_reason=missing_care_guide`

8. **IDENT-08 — Identification history**: History lists success + timeout + provider_unavailable attempts with `status` + `failure_reason`; success shows results + selection; re-associate-with-catalog link available.
   - Current: No history screen
   - Target: `/historico` (or equivalent) lists per-user Identifications with thumbnails, status, top result/manual correction, re-associate CTA
   - Acceptance: E2E — user with mixed history (1 success, 1 timeout, 1 provider_unavailable) sees all three rows with correct status + failure_reason; re-associate link from a success row navigates to catalog selection

9. **IDENT-09 — Trial cap hit**: Trialing user over daily cap (5) or period cap (75) → `cap_hit` 429 with reset time; no provider call; no counter increment; UI shows manual-entry link, no retry button.
   - Current: No cap check
   - Target: Cap check executes BEFORE counter increment; over-cap returns `cap_hit` 429 with `Retry-After`/reset metadata; UI replaces retry CTA with manual-entry link
   - Acceptance: Integration — trial user with 5 daily ID rows → 6th POST returns 429 `cap_hit`, no new Identification row, no provider HTTP call, response carries reset time

10. **IDENT-10 — Paid cap hit**: Active user over daily cap (15) or period cap (200 per billing period) → `cap_hit` 429.
    - Current: No cap check
    - Target: Same as IDENT-09 with paid-tier numbers
    - Acceptance: Integration — paid user with 15 daily IDs → 16th POST returns 429 `cap_hit`

11. **IDENT-11 — Cost-ceiling fallover**: Primary provider at cost ceiling, fallback available → router skips primary, logs `cost_ceiling_reached`, dispatches fallback, client gets success.
    - Current: No router, no ceiling check
    - Target: Router consults `ProviderUsageCounter` vs `ProviderBudget.daily_cost_cap_cents` before each call; if primary at ceiling, skip and try next provider; persist `failure_reason=cost_ceiling_reached` only if all providers exhausted
    - Acceptance: Integration — Plant.id usage at $5/day → POST returns success via OpenAI-compat fallback, Identification row shows `provider=openai-compat` and Plant.id is not called

12. **IDENT-12 — All providers exhausted**: All providers exhausted → `provider_unavailable` 503; Identification row persisted `status=failed` with most specific internal `failure_reason`; internal reason never leaks to client; photo retained in IndexedDB while on screen.
    - Current: No fallover or persistence-on-failure path
    - Target: Both providers unavailable → 503 with public code `provider_unavailable`; row written with internal `failure_reason` (`cost_ceiling_reached` / `breaker_open` / `timeout` / `invalid_response`)
    - Acceptance: Integration — Plant.id at ceiling AND OpenAI-compat breaker open → POST returns 503 `provider_unavailable`, Identification row has `status=failed` + internal failure_reason field set, response body contains no internal reason

13. **IDENT-13 — Provider timeout**: Provider call exceeds backend timeout → `timeout` 504; row persisted `status=failed`, `failure_reason=timeout`; visible in history.
    - Current: No timeout enforcement
    - Target: Per-call cap 30s; on timeout, log + persist + continue fallover sequence per IDENT-18
    - Acceptance: Integration — provider stub sleeps 35s → POST returns 504 `timeout`, Identification row persisted with `failure_reason=timeout`

14. **IDENT-14 — Mid-request navigation**: User navigates away mid-request → request completes server-side, row persisted; no in-flight UI restored on return.
    - Current: No persistence semantics defined
    - Target: Server-side processing decoupled from UI lifecycle; row writes regardless of client connection state; no resume-on-return mechanism
    - Acceptance: E2E — user starts identification, closes tab; checking history 1 minute later shows the row with final status

15. **IDENT-15 — Malformed/empty provider response**: `failure_reason=invalid_response`, breaker counter incremented, fallover to next provider.
    - Current: No response validation, no breaker
    - Target: Provider adapter validates response shape; invalid → persist failure_reason, increment breaker, try next provider
    - Acceptance: Integration — Plant.id stub returns `{}` → row's failure_reason=invalid_response, breaker counter++, OpenAI-compat called

16. **IDENT-16 — GPS-tagged photo rejection**: Photos with EXIF GPS tags are rejected by the server as `validation_failed`; client-side strip is the primary defense.
    - Current: Phase 2 image pipeline strips EXIF/GPS client-side; no server-side guard
    - Target: Server inspects uploaded photo metadata; presence of any GPS EXIF tag → `validation_failed`, no provider call, no Identification row
    - Acceptance: Integration — direct upload of a GPS-tagged JPEG bypassing client → server returns `validation_failed`, no row, no provider HTTP call

17. **IDENT-17 — 1..N photo capture with guide**: Identification accepts 1..N photos (camera/gallery multipart) with static capture guide visible (leaf + flower + whole plant + "Mais fotos melhoram a precisão").
    - Current: No Identify screen; photo upload exists in catalog flow only
    - Target: Identify screen renders capture guide always-visible above picker; multipart accepts 1..N photos
    - Acceptance: E2E — Identify screen shows literal guide copy + 3 illustration slots; uploading 1, 3, and 7 photos all succeed

18. **IDENT-18 — Vercel function budget**: Total wall-clock 50s, per-call cap 30s, fallover requires ≥10s remaining budget else short-circuit `provider_unavailable`.
    - Current: No budget bookkeeping
    - Target: Use-case tracks elapsed wall-clock; before each provider call, abort with `provider_unavailable` if remaining < 10s
    - Acceptance: Integration — primary takes 28s then fails → if remaining < 10s, fallover skipped and 503 returned with internal `provider_unavailable_budget_exhausted` reason

19. **IDENT-19 — Adapter interface + connectors**: `IdentificationProvider` adapter interface with Plant.id + OpenAI-compat connectors; backend chooses active provider, not client; prompts + config versioned with app deploy.
    - Current: No adapter, no connectors
    - Target: Single TypeScript interface + 2 implementations; router uses `ProviderBudget.priority` ordering; no client header selects provider
    - Acceptance: Code review — adapter interface lives in `src/shared/adapters/identification-provider.ts`; both connectors implement it; router unit-tested with mock implementations swappable

20. **IDENT-20 — Offline blocked**: Offline identification blocked with clear "Identificação requer conexão à internet." message.
    - Current: No offline detection on Identify
    - Target: Identify screen reads `navigator.onLine` (or service-worker-aware signal) and short-circuits with literal copy
    - Acceptance: E2E — Playwright sets offline → Identify CTA disabled or screen shows literal pt-BR copy; no network call attempted

21. **IDENT-21 — Read-only paywall**: Read-only catalog mode shows paywall modal on identify attempt: "Reative sua assinatura para identificar novas plantas."
    - Current: No subscription-status gate
    - Target: User with `Subscription.status not in {trialing,active}` attempting identify → modal with literal copy + reactivate CTA
    - Acceptance: E2E — test user in `expired` status → tap Identify shows modal with literal pt-BR copy, no provider call

### Cost controls (COST)

22. **COST-01 — Trial limits**: `IdentificationLimit` returns `daily_cap=5`, `period_cap=75` for tier `trial`; window = `[trial_start_date, trial_end_date]`.
    - Current: Phase 2 schema seeded with `IdentificationLimit` rows but no use-case reads them
    - Target: Cap-check use-case loads tier+window from `IdentificationLimit` and queries Identification counts in window
    - Acceptance: Unit test — trial user with `trial_start_date=D-3, trial_end_date=D+11` and 4 IDs in window → cap-check passes; with 5 IDs → daily fails; with 75 across window → period fails

23. **COST-02 — Paid limits**: `IdentificationLimit` returns `daily_cap=15`, `period_cap=200` for tier `paid`; window = `[current_period_start, current_period_end]`.
    - Current: As COST-01
    - Target: Paid tier reads its row + uses billing-period window
    - Acceptance: Unit test — paid user with `current_period_start=D-15, current_period_end=D+15` and 14 daily IDs → passes; 15 → daily fails; 200 in period → period fails

24. **COST-03 — Cap check before counter/provider**: Cap check executes BEFORE any `ProviderUsageCounter` increment or provider call; over-cap requests never reach a provider.
    - Current: No cap check
    - Target: Use-case ordering: cap check → consent check → counter increment + provider call (atomic)
    - Acceptance: Integration — over-cap user → zero changes to `ProviderUsageCounter` rows, zero provider HTTP calls in recorder

25. **COST-04 — 80% operator alert**: Provider counter reaching 80% of `daily_cost_cap_cents` dispatches an operator alert email via Resend.
    - Current: No alerting
    - Target: After each successful counter increment, if new total ≥ 80% of ceiling AND prior < 80%, emit `notifications/email.requested` with `template=provider-cost-80pct`
    - Acceptance: Integration — Plant.id usage crosses 80% with one identification → exactly one Resend email queued; second identification at 81% does not duplicate the alert

26. **COST-05 — Daily ceiling unavailability**: Provider counter at daily ceiling → provider marked unavailable rest of UTC day; router skips it; fallover engaged.
    - Current: No ceiling enforcement
    - Target: Counter at ≥ ceiling → router excludes provider until next UTC midnight; fallover order continues
    - Acceptance: Integration — Plant.id at $5.00/$5.00 → next request goes to OpenAI-compat without attempting Plant.id HTTP call

27. **COST-06 — Independent (provider, purpose) budgets**: Per-provider ceilings keyed `(provider, purpose)` — `identification` and `care_guide` are independent budgets/counters; care_guide exhaustion never affects identification.
    - Current: Schema supports the composite key; no enforcement code
    - Target: Router scopes counter reads/writes to `(provider, purpose=identification)`; Phase 7 will scope its own to `purpose=care_guide`
    - Acceptance: Integration — exhaust care_guide budget for OpenAI-compat → identification request still routed to that provider successfully

28. **COST-07 — Internal-only failure reasons**: Only `provider_unavailable` surfaces to clients; internal reasons (`cost_ceiling_reached`, `breaker_open`) persisted in `Identification.failure_reason` but never returned.
    - Current: No mapping layer
    - Target: Use-case maps internal reasons → public error codes per the closed registry in PRD §5
    - Acceptance: Snapshot test of HTTP response bodies for each internal-failure path → no body contains literal strings `cost_ceiling_reached` or `breaker_open`

29. **COST-08 — Circuit breaker**: Circuit breaker per provider: opens after N consecutive failures within window, half-open after cooldown, close on success; trips logged with `breaker_open`.
    - Current: No breaker
    - Target: Per-provider in-memory + DB-persisted breaker state; configurable N + cooldown via `ProviderBudget` columns or constants; trips emit log + persist `failure_reason=breaker_open` on the triggering request
    - Acceptance: Unit test — N consecutive provider failures → breaker opens, next request skips provider; after cooldown, half-open allows one probe; success on probe closes breaker

30. **COST-09 — Atomic concurrent counter increments**: Two concurrent identification requests to the same provider → `ProviderUsageCounter` increments serialized atomically; no lost writes.
    - Current: No atomic increment
    - Target: Use Postgres `INSERT ... ON CONFLICT ... DO UPDATE SET count = counter.count + EXCLUDED.count` (or equivalent) inside the request transaction
    - Acceptance: Integration — concurrent requests (Promise.all of 10 POSTs) → counter row reflects exactly 10 increments, not less

31. **COST-10 — Hot-reload of caps + budgets**: Operator updates to `IdentificationLimit` or `ProviderBudget` in DB take effect on next request past in-memory cache TTL; no redeploy.
    - Current: No caching layer
    - Target: Cap + budget lookups cached in-memory with bounded TTL (e.g., 60s); cache miss reloads from DB
    - Acceptance: Integration — change `IdentificationLimit.daily_cap` from 5 to 6 in DB → after TTL elapses, next request observes new cap

### LGPD

32. **LGPD-09 — Consent version captured per identification**: Successful identification captures `consent_version` of the policy active at request time.
    - Current: ConsentLog persists policy_version; identification doesn't read it
    - Target: Use-case reads active `consent_version` for `identification_third_party` from Phase 4's consent infra and stamps it on the Identification row
    - Acceptance: Integration — user grants consent at policy v3 → Identification row's `consent_version=3`; later policy bump to v4 + re-grant → next ID row's `consent_version=4`

### UI

33. **UI-06 — Identify screen with all states**: Picker with capture guide, loading, results (top 3 cards), no-results, cap reached, provider unavailable, offline, read-only paywall, first-time consent modal.
    - Current: No Identify screen
    - Target: One Identify route that handles all listed states; loading uses Phase 3 skeletal shimmer with 300ms threshold + 120ms fade; reduced-motion fallback per UI-20
    - Acceptance: E2E + visual review — each of the 9 states (picker idle, capture guide visible, loading, top-3 results, zero-results, cap reached, provider_unavailable, offline, read-only paywall, first-time consent) renders correctly; UI checker passes

34. **UI-12 — Identification history screen**: Per-user list with thumbnails, results, selected/manual/failed status; detail view with re-associate action.
    - Current: No history screen
    - Target: List view + detail view per UI-12; status badge + failure_reason text where applicable
    - Acceptance: E2E — user with mixed history sees grouped/sorted list; detail of a success shows full top-3 + selection; re-associate flow links Identification → existing or new Plant

35. **UI-15 — Confidence ladder**: 3 states (high ≥70%, medium 40–69%, low threshold–39%) with redundant signals (bar, segments, percentage, SR label).
    - Current: No confidence component
    - Target: Reusable component rendering bar + segments + percentage + SR label per state; never color alone (per accessibility constraint)
    - Acceptance: Visual + a11y review — each state renders all 4 signals; SR audit confirms label is read; manual-color-blocked test confirms info conveyed without color

## Boundaries

**In scope:**

- `POST /v1/identifications` route handler + use-case + persistence chain (1..N photos multipart, EXIF/GPS server-side guard, response shape with top-3 + failure_reason mapping)
- `IdentificationProvider` adapter interface + Plant.id connector + OpenAI-compat connector
- Router with provider ordering, cost-ceiling skip, circuit breaker, fallover with ≥10s remaining-budget guard
- Per-user cap check (trial 5/75, paid 15/200) BEFORE any counter increment or provider call
- Atomic per-provider counter increments scoped to `(provider, purpose=identification)`
- 80% operator alert email via Resend (one-shot per provider per day)
- DB-driven hot-reload of `IdentificationLimit` + `ProviderBudget` via in-memory TTL cache
- LGPD `identification_third_party` first-time consent modal + ConsentLog write + `consent_version` stamping on every Identification row
- Identify screen with all 9 states (picker, loading, results, no-results, cap reached, provider_unavailable, offline, paywall, first-time consent)
- Confidence-ladder component (UI-15) used by results state
- Identification history screen + detail view + re-associate-with-catalog action (UI-12)
- Result selection → Plant created linked to Species via `create-plant.ts:101-121` branch with `Identification.plant_id` FK set both directions
- Manual-correction path with Species name match + flag-on-miss
- Internal-only failure_reason persistence with closed-registry public-code mapping (`cost_ceiling_reached` / `breaker_open` / `invalid_response` / `timeout` never leak)
- pt-BR copy for all literal strings (capture guide, offline, paywall, retake guidance, cap reached, error states)

**Out of scope:**

- CareGuide rendering, augmentation, or "Gerado por IA" chip — Phase 7 owns CARE-01..10 and the `purpose=care_guide` budget consumer; Phase 6 only ensures the `(provider, purpose=identification)` budget is independent
- Reminders creation prompts on the new Plant — Phase 8 owns REM-*
- Subscription-status mutations (Phase 12 owns SUB-*); Phase 6 only reads `Subscription.status` for the read-only-paywall gate (UI-21 already lives in Phase 12 plumbing per project STATE)
- Push notifications — Phase 13 owns NOTIF-03..06; Phase 6 emails only the operator 80% alert via the existing `notifications/email.requested` event from Phase 4
- LGPD deletion grace, export — Phases 11 owns LGPD-01..08, 11–14
- Additional v2 features (multi-photo identification per session, identification quotas per Species, etc.)
- Operator dashboard for budget tuning — DB-only configuration via `IdentificationLimit` + `ProviderBudget` rows

## Constraints

- **Vercel function budget**: total wall-clock ≤ 50s, per-call provider timeout ≤ 30s, fallover requires ≥10s remaining budget else short-circuit `provider_unavailable` (CLAUDE.md performance constraint)
- **Image upload**: client compressed to ≤1MB, EXIF/GPS stripped client-side; server rejects any GPS-bearing upload as `validation_failed` (defense in depth — CLAUDE.md performance + INFRA-19)
- **Per-provider daily ceiling**: USD 5/day each for Plant.id and OpenAI-compat by default (DB-configurable); 80% trips operator email (CLAUDE.md budget constraint)
- **Consent**: `identification_third_party` consent is mandatory before any provider call; revocation surfaces as `consent_required` 403 (CLAUDE.md compliance)
- **Error code registry**: PRD §5 closed registry only — `cost_ceiling_reached` and `breaker_open` are INTERNAL-only and surface as `provider_unavailable` to clients (CLAUDE.md error codes)
- **Async work**: All cron, durable retries, and operator-alert email dispatch via Inngest — no raw cron, no BullMQ (CLAUDE.md tech stack)
- **Adapter pattern**: All Plant.id + OpenAI-compat calls go through the `IdentificationProvider` interface — no SDK calls in route handlers, use-cases, or repositories (PRD §6 + CLAUDE.md tech stack adapter discipline)
- **Database access**: Drizzle ORM inside repositories only; `postgres-js` driver with `{ prepare: false }` mandatory for Supavisor txn pooler (CLAUDE.md tech stack)
- **Locale**: pt-BR only — every literal in capture guide, error states, modals, history; `next-intl` mandatory; `date-fns-tz` for any user-local times in history (CLAUDE.md locale)
- **A11y**: WCAG 2.1 AA — confidence-ladder uses redundant signals (bar + segments + percentage + SR label), color never sole cue; toxicity badge constraints surface in Phase 7, not here (CLAUDE.md accessibility)
- **Observability**: Sentry release=git SHA, no email PII; PostHog event taxonomy includes `identification_started`, `identification_succeeded`, `identification_cap_hit` (per OBS-03 — wired in this phase for those three events) (CLAUDE.md observability)

## Acceptance Criteria

- [ ] `POST /v1/identifications` returns ≤3 results above `min_confidence` ordered desc on the happy path; row written with provider/model/latency/consent_version/photo_urls; `identification.succeeded` emitted
- [ ] First identification without `identification_third_party` consent renders the modal disclosing both provider names + Art. 33 transfer; consent denial yields zero provider calls and zero Identification rows
- [ ] Revoked consent → 403 `consent_required`; no provider call; no Identification row
- [ ] Backend filters provider results below `ProviderBudget.min_confidence`; only above-threshold returned, max 3
- [ ] Zero results above threshold → "could not identify" UI + retake guidance; Identification row persisted with raw provider data
- [ ] Result selection creates Plant linked to Species with name pre-filled; `Identification.plant_id` FK set
- [ ] Manual correction stored in `manual_correction`; matched Species sets `species_id`, missed Species sets null + flag row with `flag_reason=missing_care_guide`
- [ ] Identification history lists success + timeout + provider_unavailable rows with status + failure_reason; re-associate-with-catalog link works on success rows
- [ ] Trial user over 5 daily / 75 period → 429 `cap_hit` with reset; no counter increment; no provider call; UI shows manual-entry link, no retry button
- [ ] Active user over 15 daily / 200 per billing period → 429 `cap_hit`
- [ ] Primary provider at ceiling → router skips it, dispatches fallback, client gets success
- [ ] All providers exhausted → 503 `provider_unavailable` with row persisted (`status=failed` + internal `failure_reason`); response body contains no internal reason
- [ ] Provider call exceeding 30s → 504 `timeout` with row persisted (`failure_reason=timeout`)
- [ ] User navigating away mid-request → row persisted server-side; no in-flight UI restored on return
- [ ] Malformed/empty provider response → row's `failure_reason=invalid_response`, breaker counter incremented, fallover to next provider
- [ ] Server rejects EXIF/GPS-tagged photos as `validation_failed`
- [ ] Identify screen accepts 1..N photos with capture guide always visible
- [ ] Fallover with <10s remaining budget short-circuits with `provider_unavailable`
- [ ] `IdentificationProvider` adapter interface + Plant.id + OpenAI-compat connectors implemented; backend chooses provider; client cannot select via header
- [ ] Offline → "Identificação requer conexão à internet." message; no network call attempted
- [ ] Read-only mode → paywall modal "Reative sua assinatura para identificar novas plantas."
- [ ] `IdentificationLimit` returns trial 5/75 and paid 15/200 with correct windows
- [ ] Cap check executes before counter increment and before provider call
- [ ] Counter crossing 80% of ceiling triggers exactly one operator email per provider per day
- [ ] Provider at ceiling → marked unavailable for the rest of the UTC day; fallover engaged
- [ ] `(provider, purpose=identification)` and `(provider, purpose=care_guide)` budgets independent — exhausting one never starves the other
- [ ] Internal-only failure reasons never appear in HTTP response bodies
- [ ] Circuit breaker opens after N consecutive failures, half-opens after cooldown, closes on success
- [ ] Concurrent identifications produce no lost counter writes
- [ ] DB updates to `IdentificationLimit`/`ProviderBudget` take effect on next request past cache TTL
- [ ] `Identification.consent_version` matches the active policy version at request time
- [ ] Identify screen renders all 9 states (picker, loading, results, no-results, cap reached, provider_unavailable, offline, paywall, first-time consent)
- [ ] Identification history screen + detail view + re-associate action ship per UI-12
- [ ] Confidence ladder component renders 3 states with bar + segments + percentage + SR label (UI-15); a11y review passes
- [ ] PostHog `identification_started`, `identification_succeeded`, `identification_cap_hit` events emit with correct properties

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes                                                                 |
| ------------------- | ----- | ----- | ------ | --------------------------------------------------------------------- |
| Goal Clarity        | 0.92  | 0.75  | ✓      | End-to-end user story with concrete budgets/caps/percentages          |
| Boundary Clarity    | 0.85  | 0.70  | ✓      | Clear demarcation vs Phases 5/7/11/12; care_guide budget out of scope |
| Constraint Clarity  | 0.90  | 0.65  | ✓      | All numbers explicit (50s/30s/10s, $5/day, 5/75, 15/200, 0.30, 70/40) |
| Acceptance Criteria | 0.90  | 0.70  | ✓      | 35 falsifiable requirements + 35-line acceptance checklist            |
| **Ambiguity**       | 0.11  | ≤0.20 | ✓      |                                                                       |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
| ----- | ----------- | ---------------- | --------------- |
| —     | —           | `--auto` skipped interview — initial ambiguity 0.11 already below 0.20 gate with all 4 dimensions above their minimums; ROADMAP §6 + REQUIREMENTS IDENT/COST/LGPD/UI sections + CLAUDE.md constraints already specified all 4 dimensions to falsifiable precision | Auto-derived SPEC.md from upstream artifacts; no Socratic clarification required |

---

_Phase: 06-identification-flow-cost-controls_
_Spec created: 2026-05-10_
_Next step: /gsd-discuss-phase 6 — implementation decisions (router internals, breaker thresholds, cache TTL, provider connector layout, etc.)_
