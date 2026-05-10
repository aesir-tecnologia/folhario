# Phase 6: Identification Flow & Cost Controls - Context

**Gathered:** 2026-05-10 (power mode)
**Status:** 32/32 answered (Q-05 = Custom with chat-more nuance preserved as binding refinement)
**Source:** Synthesized from `.planning/phases/06-identification-flow-cost-controls/06-QUESTIONS.json`

<domain>
## Phase Boundary

A verified, trial-active user opens the Identify screen, snaps or picks 1..N photos, accepts the first-time LGPD Art. 33 third-party transfer consent, and within the 50s function budget receives ≤3 honest top-3 results with confidence-ladder UI, selects one, and lands in their catalog with a Plant linked to a Species — while the platform enforces per-user caps, per-provider daily ceilings, atomic counters, and a circuit breaker so a runaway provider can never blow the $5/day budget.

This phase ships:
- `POST /v1/identifications` route + use-case + persistence chain (1..N photos multipart)
- `IdentificationProvider` adapter interface + Plant.id + OpenAI-compat connectors
- Router with priority ordering, cost-ceiling skip, circuit breaker, fallover with ≥10s remaining-budget guard
- Per-user cap check (trial 5/75, paid 15/200) BEFORE counter increment or provider call
- Atomic per-provider counter increments scoped to `(provider, purpose=identification)`
- 80% operator alert email via Resend (one-shot per provider per UTC day)
- DB-driven hot-reload of `IdentificationLimit` + `ProviderBudget` via in-memory TTL cache
- LGPD `identification_third_party` first-time consent modal + `consent_version` stamping
- Identify screen with all 9 states (picker, loading, results, no-results, cap reached, provider_unavailable, offline, paywall, first-time consent)
- Confidence-ladder shared component
- Identification history screen + detail view + re-associate-with-catalog action
- Result selection → Plant linked to Species via `create-plant.ts:101-121` branch
- Manual-correction path with Species name match + flag-on-miss

**Explicitly NOT in scope (per SPEC.md Boundaries):**
- CareGuide rendering or augmentation — Phase 7 (CARE-01..10)
- Reminders creation prompts on the new Plant — Phase 8 (REM-*)
- Subscription state machine — Phase 12 (SUB-*); Phase 6 only reads `Subscription.status` for the read-only paywall gate
- Push notifications — Phase 13 (NOTIF-03..06)
- LGPD deletion grace + export — Phase 11 (LGPD-01..08, 11..14)
- Operator dashboard — DB-only configuration

</domain>

<spec_lock>

## Requirements (locked via SPEC.md)

**35 requirements are locked.** See `06-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `06-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- `POST /v1/identifications` route handler + use-case + persistence chain (1..N photos multipart, EXIF/GPS server-side guard, response shape with top-3 + failure_reason mapping)
- `IdentificationProvider` adapter interface + Plant.id connector + OpenAI-compat connector
- Router with provider ordering, cost-ceiling skip, circuit breaker, fallover with ≥10s remaining-budget guard
- Per-user cap check (trial 5/75, paid 15/200) BEFORE any counter increment or provider call
- Atomic per-provider counter increments scoped to `(provider, purpose=identification)`
- 80% operator alert email via Resend (one-shot per provider per day)
- DB-driven hot-reload of `IdentificationLimit` + `ProviderBudget` via in-memory TTL cache
- LGPD `identification_third_party` first-time consent modal + ConsentLog write + `consent_version` stamping on every Identification row
- Identify screen with all 9 states
- Confidence-ladder component (UI-15)
- Identification history screen + detail view + re-associate-with-catalog action (UI-12)
- Result selection → Plant created linked to Species via `create-plant.ts:101-121` branch with `Identification.plant_id` FK
- Manual-correction path with Species name match + flag-on-miss
- Internal-only failure_reason persistence with closed-registry public-code mapping
- pt-BR copy for all literal strings

**Out of scope (from SPEC.md):**
- CareGuide rendering, augmentation, or "Gerado por IA" chip — Phase 7
- Reminders creation prompts — Phase 8
- Subscription-status mutations — Phase 12 (Phase 6 only reads `Subscription.status`)
- Push notifications — Phase 13
- LGPD deletion grace, export — Phase 11
- v2 features (multi-photo per session, identification quotas per Species)
- Operator dashboard for budget tuning — DB-only configuration

</spec_lock>

<decisions>
## Implementation Decisions

### Adapter & Connector Layout

- **D-01 (Q-01):** **`IdentificationProvider` interface = `identify()` + `estimateCost(input)` + static `providerId` / `model` / `costPerCallCents`.** Per-call dynamic cost via `estimateCost(input)` (OpenAI-compat depends on photo count + token estimate). Router consults `estimateCost()` before each call to feed the atomic preflight reservation (D-05). Smallest surface that supports accurate budget tracking. Mirrors `StorageAdapter` shape; interface lives at `src/shared/adapters/identification-provider.ts` (locked by IDENT-19).

- **D-02 (Q-02):** **Hybrid layout — interface in `src/shared/adapters/identification-provider.ts`, implementations under `src/contexts/identification/infrastructure/providers/plant-id.ts` + `openai-compat.ts`.** Mirrors interface-vs-impl boundary at the directory level. Interface is locked by IDENT-19 to live in shared; connectors are bounded-context infrastructure (matching Phase 4 D-17 resend-adapter pattern).

- **D-03 (Q-03):** **Connector returns `{ canonical: NormalizedResult, raw: unknown }`.** Use-case persists `raw` into `Identification.results` jsonb (preserves audit trail per D-06 schema), uses `canonical` for filtering / sorting / UI. `NormalizedResult` shape: `{ results: Array<{ scientificName, commonName, confidence, raw }> }`. Type lives in `src/contexts/identification/domain/`. Belt + braces: filter on canonical, audit on raw.

### Router & Provider Selection

- **D-04 (Q-04):** **Add `priority INT NOT NULL DEFAULT 100` column to `provider_budgets` via Drizzle migration.** Lower number = higher priority. Plant.id seeded `priority=10`, OpenAI-compat seeded `priority=20`. Router queries `WHERE purpose='identification' AND is_active ORDER BY priority`. Operator-tunable per CLAUDE.md hot-reload constraint (cache TTL per D-15). Aligns IDENT-19 SPEC text with schema.

- **D-05 (Q-05, Custom):** **Atomic preflight reservation pattern.** In one short transaction, conditionally increment/reserve `estimated_cost_cents` only when `current estimated_cost_cents + estimatedCost <= daily_cost_cap_cents`. Commit, then call provider OUTSIDE the transaction (no Postgres lock held during 30s HTTP latency). If reservation cannot be made, mark/skip provider for the rest of the UTC day and try next provider. Preserves COST-09 atomic ceiling enforcement without holding a TX during provider HTTP latency. SQL: single `INSERT ... ON CONFLICT DO UPDATE SET estimated_cost_cents = estimated_cost_cents + EXCLUDED.estimated_cost_cents WHERE provider_usage_counters.estimated_cost_cents + EXCLUDED.estimated_cost_cents <= (SELECT daily_cost_cap_cents FROM provider_budgets WHERE ...)` (or equivalent CTE) — exactly one row touched, exactly one comparison, atomic.

- **D-06 (Q-06):** **AbortController + computed `remainingMs()` via `Date.now()`.** Outer 50s `AbortController` for total wall-clock cancellation propagation through connector → fetch. Per-call 30s child controller. PLUS `const start = Date.now(); function remainingMs() { return TOTAL_BUDGET_MS - (Date.now() - start); }` for the ≥10s fallover guard decision. The signal handles "stop the in-flight call"; `Date.now()` handles "should we even start the next call". Both are needed and serve different purposes.

- **D-07 (Q-07):** **One Identification row per user request.** `failure_reason` = most-specific internal reason from the LAST attempt (or first if all timed out). Per-attempt traces go into Sentry breadcrumbs / PostHog event properties for ops, NOT into the user-visible row. History screen shows one row per request. Matches IDENT-08 wording. No schema migration; no parent-child rows.

### Circuit Breaker

- **D-08 (Q-08):** **Hybrid — module-level `Map<provider, BreakerState>` cache fronting a new `provider_breaker_states` DB table.** Migration: `provider_breaker_states (provider PK, state enum, opened_at, last_failure_at, consecutive_failures, half_open_probe_at)`. On miss, read DB; on state change, write DB + invalidate cache. Cache TTL matches budget cache (D-15). Saves a read on warm Lambda. Eventual consistency between Lambda instances during state flips is acceptable (a few wasted calls before caches expire). Survives cold starts via DB.

- **D-09 (Q-09):** **Moderate thresholds — N=5 consecutive failures within 5min → open; cooldown 120s; half-open allows 1 probe.** Balanced default for MVP traffic (~50–500 IDs/day). Not so aggressive that flaky networks flap; not so conservative that bad providers bleed budget. Constants live in `src/contexts/identification/config.ts` for easy operator tuning if needed.

- **D-10 (Q-10):** **Provider faults only count toward the breaker — timeouts + 5xx + invalid_response.** User-input failures (`validation_failed`, GPS reject) and 4xx (provider rejecting malformed image as 400) do NOT count. Cleanest signal — a 4xx says "this image is bad", not "this provider is down". Aligns with IDENT-15 (invalid_response increments breaker), IDENT-13 (timeout), and IDENT-12 (provider_unavailable).

### Counter & Cap Check

- **D-11 (Q-11):** **`INSERT ... ON CONFLICT (provider, purpose, utc_date) DO UPDATE SET request_count = request_count + 1, estimated_cost_cents = estimated_cost_cents + EXCLUDED.estimated_cost_cents`.** Single statement, atomic, no explicit lock. Postgres serializes the conflict-update path automatically. Standard pattern; matches SPEC §COST-09 wording and the COST-09 acceptance test (10 concurrent POSTs → exactly 10 increments). Same statement form is used by D-05's atomic preflight reservation (with the additional ceiling guard in the WHERE clause).

- **D-12 (Q-12):** **Domain service `check-cap(userId)` returning `{allowed, reason, resetAt}` at `src/contexts/identification/domain/check-cap.ts`.** Delegates to repository helpers (`countIdentificationsInWindow(userId, from, to)` for daily + period windows). Use-case calls a single function and gets a verdict. Window math: trial = `[trial_start_date, trial_end_date]`, paid = `[current_period_start, current_period_end]`; daily window = current UTC date for both. Repository helpers are the only Drizzle consumers (PRD §17 D-17). Highest abstraction for the busiest hot path of this phase.

- **D-13 (Q-13):** **Three transactions: `Cap → Consent → TX{counter inc + Identification row write status='in_progress'} → Provider call → TX{update row to success/failed}`.** Schema migration: add `'in_progress'` to the `identification_status` enum (currently only `success`/`failed`). Pre-write the row with `status='in_progress'` alongside the counter increment so if the provider call crashes mid-flight, the row exists for the reconciler to mark `failed`. Best balance: counter atomicity + recoverable orphan rows + no 30s TX holding Postgres locks.

### Hot-Reload Cache

- **D-14 (Q-14):** **Module-level `Map<string, {value, expiresAt}>` per Lambda instance.** No infra dependency (Vercel KV / Upstash out of CLAUDE.md tech stack). Each warm Lambda has its own copy → up to `{N_lambdas * TTL}` delay before all see new values; acceptable per COST-10 (operator changes "take effect on next request past TTL"). Caches `IdentificationLimit` rows + `ProviderBudget` rows.

- **D-15 (Q-15):** **TTL = `CACHE_BUDGET_TTL_SECONDS` env var, default 60s.** Operator can dial to 0 (effectively no cache) for emergency provider disable without redeploy of business code. Bounded staleness for normal tuning; instant override for incident response. Same TTL governs the breaker cache (D-08).

### Consent Modal UX & Wiring

- **D-16 (Q-16):** **Gate at Identify CTA tap (before camera/picker opens).** Tapping the camera button on `/identify` checks consent first. If missing → modal. User decides before taking a photo. Cleanest mental model: the user is committing to identification, not just exploring the screen. Avoids the bait-and-switch feel of post-capture gating (option b) and is less aggressive than blocking the entire screen (option c).

- **D-17 (Q-17):** **Real names — "Plant.id (Kindwise) e provedor compatível com OpenAI".** Maximum LGPD Art. 33 transparency. Names are public anyway. Vendor swap WILL require copy update + re-consent (`policy_version` bump), and that's the correct LGPD posture. No "or equivalent successors" escape clause — clunky read-aloud copy and weaker on transparency.

- **D-18 (Q-18):** **Reuse existing `/api/v1/iam/consent` endpoint** with `purpose='identification_third_party'`. Modal calls the existing consent endpoint; ConsentLog row written with the active `policy_version` per Phase 4. Zero new endpoints. Consent logic stays in one place across all `purpose` values. `src/contexts/iam/application/record-consent.ts` already recognizes the purpose.

### Identify Screen & Capture UX

- **D-19 (Q-19):** **Single batch picker + thumbnails strip.** Camera button → native multi-select picker (or sequence in single capture session). Selected photos render as a horizontal thumbnails strip with `[+]` add-more affordance and `[×]` remove. One "Identificar" button submits all photos in a single multipart POST (per D-26). Familiar mental model; matches Phase 5 D-15's bottom-sheet single-photo flow at the primitive level (but Identify is multi-photo by design per IDENT-17).

- **D-20 (Q-20):** **Single skeleton with brand copy "Identificando…".** Phase 3 D-25 `<Skeleton>` (300ms gate + 120ms fade + reduced-motion fallback) with "Identificando sua planta…" Source Serif 4 headline above. No progress bar, no stage messages, no cancel button. Honest about uncertainty (PRD §17 anti-fake-precision). Up to 30s of skeleton is acceptable; the alternative (multi-stage messages) risks visible stalls and the cancel button creates client/server divergence per IDENT-14.

- **D-21 (Q-21):** **Manual correction available on BOTH zero-results screen AND inline under top-3 results** as a "Não é nenhuma destas?" link. User types species name (e.g. "Monstera deliciosa") → stored in `Identification.manual_correction`; resolved by case-insensitive name match → `species_id` (or null + Species `flag_reason=missing_care_guide` per IDENT-07). Most flexibility — partial-confidence cases (top-3 returned but all wrong) need it as much as zero-results cases.

- **D-22 (Q-22):** **`<ModalSheet>` with literal copy "Reative sua assinatura para identificar novas plantas." + Canopy primary "Reativar assinatura" CTA linking to `/settings/subscription`.** Tap Identify CTA in read-only mode → ModalSheet opens. Phase 5 D-21 hides mutating affordances broadly; Phase 6 surfaces an explicit paywall on Identify only. More attention-grabbing than the inline read-only banner; less heavy-handed than full-page redirect.

### Results & Confidence Ladder

- **D-23 (Q-23):** **`<ConfidenceLadder confidence={0.74} />` at `src/shared/ui/confidence-ladder.tsx`, prop = raw 0..1 number.** Component derives state internally from thresholds (≥0.70 high, 0.40–0.69 medium, threshold–0.39 low) — thresholds also exported as named constants (`CONFIDENCE_THRESHOLDS`). Caller passes raw confidence; component renders bar + segments + percentage + SR label per UI-15. Thresholds change in one place. Phase 7 (care guide) may reuse for augmented-content trust signals — shared placement is correct.

- **D-24 (Q-24):** **Equal-prominence vertical card stack with caption "Resultados ordenados pelo nível de confiança".** Three result cards stacked vertically, full-width minus padding, equal visual weight. Each card: photo + scientific name (italic, `lang='la'`) + common name + ConfidenceLadder + "Adicionar à minha estante" CTA. Tap-anywhere-on-card → selection sheet (D-25). Honors the "no fake confidence" PRD §17 constraint (no hero treatment that might nudge users away from #2/#3 when the model is unsure) while keeping ranking visible via the ladder.

- **D-25 (Q-25):** **Intermediate confirmation sheet — `<ModalSheet>` with name (editable), location (Combobox from Phase 5 D-08), notes (optional) → "Confirmar".** Tap "Adicionar à minha estante" CTA on a result card → sheet opens with name pre-filled (species common name pt-BR). User reviews / edits / submits → server creates Plant linked to Species + identification photos as cover/journal entries → user lands on `/catalog/{plantId}`. Captures location at creation time (which the one-tap path would lose). One extra step is acceptable for the data-quality gain; still well under the <2-min core value clock.

### Persistence & Storage

- **D-26 (Q-26):** **Single multipart POST `/v1/identifications` with all photos + metadata.** Client sends multipart with N photo parts in one request. Server uploads each (per-photo MIME / size / GPS guard per D-28) inside the use-case BEFORE calling the provider. Atomic; fewer round-trips; no orphan photos if the user abandons. Trade-off — longer single request — is acceptable within the 50s function budget.

- **D-27 (Q-27):** **Store `{bucket}/{key}` refs in `photo_urls TEXT[]`; sign at history-screen read time with 24h TTL.** `photo_urls = ['plant-photos/{userId}/identifications/{idId}/{photoId}.jpg']`. History screen mints signed URLs on render, matching Phase 5 D-20. Reuses the existing `plant-photos` bucket — no new bucket — so selection→Plant creation can reference the same bytes without copy/move. No JSON wrapping; raw bucket/key strings stay simple.

- **D-28 (Q-28):** **New shared helper `validateIdentificationPhotos(photos[])` at `src/shared/images/validate-identification-photos.ts`** wrapping `rejectGpsMetadata` + size + MIME checks for the 1..N batch. Use-case calls once. Keeps the use-case clean of per-photo loops while reusing the existing `rejectGpsMetadata` from `src/shared/images/server-validate.ts` (shipped in Phase 2 D-30 / INFRA-19; already used by `/api/v1/photos/upload` and `create-plant.ts`). Helper is reusable should pre-upload routes ever ship later.

### History, Operator Alert, Tests & Telemetry

- **D-29 (Q-29):** **Cursor pagination matching Phase 2 D-36 + Phase 5 D-12.** Opaque base64 cursor encoding `{created_at, id}`. Page size 50 default, 200 max. Probably overkill for typical user volume (75–200 per period) but stays consistent with the established pattern — one less mental model for downstream surfaces.

- **D-30 (Q-30):** **Add `alert_sent_at TIMESTAMPTZ NULL` column to `provider_usage_counters`** (existing daily counter row, keyed `(provider, purpose, utc_date)`). Cap-check use-case sets `alert_sent_at = NOW()` inside the same TX as the increment that crosses 80%. Email dispatched only if column was NULL at TX entry. Matches COST-04 acceptance ("second identification at 81% does not duplicate the alert"). One DB column, no new table. Resend dispatch via existing `notifications/email.requested` Inngest event (Phase 4).

- **D-31 (Q-31):** **Per-test injected mock connectors via `__setProviderForTests` test seam.** Mirrors Phase 5 D-27 `__setStorageAdapterForTests` pattern. Integration tests inject deterministic mock connectors implementing `IdentificationProvider`. Connector internals (HTTP fetch, retry, JSON shape parsing) NOT exercised by integration tests — separate unit tests in `src/contexts/identification/infrastructure/providers/*.unit.test.ts` cover them. `IDENTIFICATION_PROVIDER_MODE=stub` env (Phase 1 INFRA-26) routes to deterministic stub connectors at runtime; tests bypass mode and inject directly.

- **D-32 (Q-32):** **All three PostHog events server-side via `posthog-node`.** `identification_started` fired in route handler at request entry (after JWT). `identification_succeeded` fired post-TX-commit in use-case. `identification_cap_hit` fired in cap-check use-case before short-circuit. Matches Phase 5 D-28/29 server-only pattern. Privacy-clean (no PII per CLAUDE.md observability — `Sentry.setUser({ id })` only, `posthog.identify(distinct_id)` only). No client-side firing for IDs.

### Claude's Discretion

The agent has discretion on (within the locks above):
- Exact Drizzle column ordering inside the `provider_breaker_states` migration (D-08)
- Sonner toast copy strings for failure paths (initial pt-BR drafts; founder reviews per Phase 4 D-30 pattern)
- Internal field names of the canonical `NormalizedResult` shape (D-03) — kept in `src/contexts/identification/domain/`
- TanStack Query `staleTime` for the identification-history list query (suggested: 30s — short window since fresh attempts land frequently)
- Exact Tailwind class compositions for capture guide visual states (3-illustration row layout)
- Skeleton sub-component variants (single-card vs three-card hint) inside the loading state per D-20
- Connector retry policy on transient 5xx (suggested: zero retry — let the breaker count consecutive failures; D-10 lock)
- File splits inside `src/contexts/identification/{domain,application,infrastructure,api,inngest}/` provided D-01..D-03 contracts and D-08 breaker schema are preserved
- Per-photo size/MIME limits in `validateIdentificationPhotos` helper (suggested: reuse Phase 2 limits in `src/shared/images/limits.ts`)
- PostHog event property shapes per D-32 (privacy-clean — no email, no plant identifiers); coordinate with Phase 5 D-28's `source` field forward-compat (Phase 6 reuses with `'identification'` for `plant_added` from the post-selection Plant create)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 spec + scope

- `.planning/phases/06-identification-flow-cost-controls/06-SPEC.md` — **Locked requirements (35) — MUST read before planning.** Goal, Background, Requirements (IDENT-01..21, COST-01..10, LGPD-09, UI-06/12/15), Boundaries, Constraints, Acceptance Criteria
- `.planning/phases/06-identification-flow-cost-controls/06-QUESTIONS.json` — Source of truth for the implementation decisions captured in `<decisions>` above (32/32 answered)
- `.planning/ROADMAP.md` §Phase 6 — Goal + 5 success criteria + dependency on Phase 5

### Product + project

- `.planning/PROJECT.md` — Core value (<2 min from email verification), constraints, launch blockers
- `.planning/REQUIREMENTS.md` — Phase 6 requirements: IDENT-01..21 + COST-01..10 + LGPD-09 + UI-06, UI-12, UI-15 (35 requirements total)
- `CLAUDE.md` — Tech stack (Next.js 16, Drizzle inside repos only, postgres-js `{ prepare: false }`, Inngest, Vercel, Resend, posthog-node), performance budgets (50s/30s/10s), per-provider $5/day ceilings, error-code closed registry, observability (no email PII), LGPD compliance posture

### PRD sections (Phase 6 surfaces)

- `docs/CAVE-PRD.md` §3 — Bounded contexts (`identification`, `iam`, `notifications` — relevant to consent + operator email)
- `docs/CAVE-PRD.md` §5 — Closed error-code registry (`provider_unavailable`, `timeout`, `cap_hit`, `consent_required`, `validation_failed`, `subscription_required`); internal-only `cost_ceiling_reached` + `breaker_open` mapping
- `docs/CAVE-PRD.md` §6 — Identification flow + adapter pattern + 1..N photos + capture guide
- `docs/CAVE-PRD.md` §10 — LWW (no merge UI); applies to Identification.manual_correction edits if any
- `docs/CAVE-PRD.md` §11 — Image pipeline (client compress ≤1MB, EXIF/GPS strip, server defense in depth)
- `docs/CAVE-PRD.md` §13 — LGPD Art. 33 international transfer disclosure (consent modal copy semantics)
- `docs/CAVE-PRD.md` §16 — Identify screen + history screen + paywall modal copy + 9-state UI requirements
- `docs/CAVE-PRD.md` §17 — Anti-fake-precision (no fabricated confidence, equal-prominence results), motion + reduced-motion, modal close affordance, validate-on-blur, destructive-button hierarchy
- `docs/CAVE-PRD.md` §20 — PostHog event taxonomy (`identification_started`, `identification_succeeded`, `identification_cap_hit`)

### Prior phase decisions Phase 6 builds on

- `.planning/phases/01-foundation/01-CONTEXT.md` — D-21 (PostHog server-side via `posthog-node`); INFRA-26 `IDENTIFICATION_PROVIDER_MODE` env for stub vs real connector routing
- `.planning/phases/02-data-layer/02-CONTEXT.md` — D-30/INFRA-19 (`rejectGpsMetadata` server guard); D-36 (cursor pagination contract); D-37 (`idempotency_keys` table available for POST /v1/identifications); identification + cost-control DB schemas already shipped
- `.planning/phases/03-design-system-app-shell/03-CONTEXT.md` — D-25 (`<Skeleton>` with 300ms gate + 120ms fade + reduced-motion); D-31 (`<ReadOnlyBanner>`); D-33 (axe-core gate); ModalSheet primitive
- `.planning/phases/04-iam-auth-verification-consent/04-CONTEXT.md` — D-17 (resend-adapter at `src/contexts/notifications/infrastructure/`); D-30 (founder reviews pt-BR copy); ConsentLog + `policy_version`; `recordConsent({purpose:'identification_third_party'})` at `src/contexts/iam/application/record-consent.ts`; `/api/v1/iam/consent` endpoint
- `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` — D-08 (`<Combobox>` for location picker reused in selection confirmation sheet); D-15 (`<ModalSheet>` add-flow pattern); D-20 (24h-TTL signed URLs); D-21 (`useSubscription()` stub returning `{readOnly:false}`); D-27 (`__setStorageAdapterForTests` pattern that D-31 mirrors); D-28 (`plant_added` PostHog event with forward-compat `source` field — Phase 6 reuses with `'identification'`)

### Existing code Phase 6 wires into

- `src/contexts/identification/domain/schemas.ts` — Zod schemas (already present)
- `src/contexts/identification/domain/events.ts` — Inngest event types (already present)
- `src/contexts/identification/infrastructure/db/schema.ts` — Drizzle schemas for `Identification`, `IdentificationLimit`, `ProviderBudget`, `ProviderUsageCounter` (already present; D-04, D-08, D-13, D-30 require additions)
- `src/contexts/identification/inngest/functions.ts` — empty file (Phase 6 lands the `notifications/send-email` consumer call for the 80% alert)
- `src/contexts/identification/{api,application,infrastructure beyond db}/` — `.gitkeep` placeholders (Phase 6 lands route, use-cases, providers, repositories)
- `src/shared/adapters/storage.ts` + `src/shared/adapters/supabase-storage.ts` — Adapter pattern precedent (D-01 mirrors shape; D-02 places interface here)
- `src/shared/images/server-validate.ts` — `rejectGpsMetadata` (D-28 wraps it)
- `src/shared/images/limits.ts` — Phase 2 image limits (D-28 reuses)
- `src/contexts/catalog/application/create-plant.ts:101-121` — Identification branch already in place (D-25 wires Phase 6 caller)
- `src/contexts/iam/application/record-consent.ts` — `purpose='identification_third_party'` already recognized (D-18 reuses)
- `src/contexts/iam/api/consent-route.ts` — `/api/v1/iam/consent` route (D-18 reuses)
- `src/contexts/notifications/infrastructure/resend-adapter.ts` — Resend transport (D-30 dispatches via existing `notifications/email.requested` Inngest event)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `<ModalSheet>` (Phase 3 D-31): used for consent modal (D-16/D-17), read-only paywall (D-22), selection confirmation sheet (D-25)
- `<Skeleton>` (Phase 3 D-25): loading state on Identify (D-20) — 300ms gate + 120ms fade + reduced-motion fallback already wired
- `<Combobox>` (Phase 5 D-08): location picker inside the selection confirmation sheet (D-25)
- `<ReadOnlyBanner>` (Phase 3 D-31): visibility unchanged on Identify (D-22 prefers ModalSheet over inline banner replacement)
- `rejectGpsMetadata` (Phase 2 D-30 at `src/shared/images/server-validate.ts`): wrapped by `validateIdentificationPhotos` (D-28)
- Supabase storage `plant-photos` + `plant-thumbnails` buckets (Phase 5): reused for `identifications/{idId}/{photoId}.jpg` keys (D-27)
- `idempotency_keys` table + helper (Phase 2 D-37): available for POST `/v1/identifications` if needed (Claude's discretion)
- `recordConsent({purpose:'identification_third_party'})` (Phase 4): D-18 reuses without endpoint addition
- Resend transport via `notifications/email.requested` Inngest event (Phase 4): D-30 reuses for 80% operator alert
- `posthog-node` server-side helper (Phase 1 D-21): D-32 reuses for all three identification events
- `<ConfidenceLadder>` will live at `src/shared/ui/confidence-ladder.tsx` (D-23) — placement chosen so Phase 7 can reuse for augmented-content trust signals

### Established Patterns

- **Adapter pattern**: `IdentificationProvider` interface in `src/shared/adapters/`, connectors in `src/contexts/identification/infrastructure/providers/` (D-02). Mirrors `StorageAdapter` shape (D-01).
- **Drizzle inside repositories only** (PRD §17 D-17 / CLAUDE.md): D-12's domain service `check-cap` delegates to repository helpers; D-05 atomic preflight reservation lives in a repo helper called from the use-case.
- **Atomic increments via INSERT...ON CONFLICT** (Phase 5 idempotency precedent + COST-09 wording): D-05 + D-11 use the same pattern.
- **Server-side PostHog/Sentry only** (Phase 1 D-21 + Phase 5 D-28/29): D-32 follows.
- **Test seam injection** (`__setStorageAdapterForTests` from Phase 5 D-27): D-31 mirrors with `__setProviderForTests`.
- **24h-TTL signed URLs** (Phase 5 D-20): D-27 reuses for identification photos.
- **Cursor pagination contract** (Phase 2 D-36 + Phase 5 D-12): D-29 reuses for history.
- **Closed error-code registry** (PRD §5 / CLAUDE.md): internal failure_reasons (`cost_ceiling_reached`, `breaker_open`, `invalid_response`, `timeout`) never leak — public mapping per COST-07.
- **Module-level cache + DB persistence** (D-08 breaker mirrors D-14 budget cache): same TTL knob, same cold-start safety net, same eventual-consistency tolerance.

### Integration Points

- `Identification.plant_id` FK ← set by `create-plant.ts:101-121` identification branch when Phase 6's selection confirmation sheet (D-25) submits
- `Species.flag_reason='missing_care_guide'` ← set by manual-correction lookup miss (D-21 + IDENT-07) — Phase 7 augmentation cron consumes these flags
- `notifications/email.requested` Inngest event ← emitted by D-30 for 80% operator alert
- `identification.succeeded` Inngest event ← emitted by use-case post-TX-commit (Phase 7's care-guide augmentation cron consumes for missing-care-guide species)
- `ProviderUsageCounter (provider, purpose='identification', utc_date)` rows ← incremented atomically by D-05 + D-11
- `ProviderBudget priority` column ← Phase 6 migration adds it (D-04); Phase 7 will reuse for `purpose='care_guide'` budgets
- `ConsentLog (purpose='identification_third_party', policy_version=N)` rows ← written by reused `/api/v1/iam/consent` endpoint (D-18)
- `Subscription.status` reads only (Phase 5 D-21 stub): D-22 paywall gate; Phase 12 wires real Stripe state
- `IDENTIFICATION_PROVIDER_MODE` env (Phase 1 INFRA-26): routes to stub vs real connectors at runtime; tests bypass via D-31 injection

</code_context>

<specifics>

## Specific Ideas

- **Q-05 chat-more (binding):** Atomic preflight reservation in one short transaction; provider HTTP call happens AFTER commit, never during the TX. The conditional `WHERE current + estimatedCost <= ceiling` clause is the atomicity guarantee — there is no read-then-write window. If the conditional update affects zero rows → mark/skip provider for the rest of the UTC day, try next provider. This is THE tie-breaker between COST-09's atomic-counter requirement and CLAUDE.md's "no long Postgres TXs across HTTP calls" performance posture.
- **Q-17 LGPD intent (binding):** Real vendor names ("Plant.id (Kindwise)" + "provedor compatível com OpenAI") are non-negotiable. A vendor swap MUST trigger `policy_version` bump and re-consent — that's the LGPD-correct posture, not a friction to engineer around.
- **Q-21 manual-correction surface (binding):** Both surfaces matter — top-3 results screen ("Não é nenhuma destas?" link under the cards) AND zero-results screen (primary CTA). Partial-confidence cases are as common as zero-results cases.
- **Q-25 selection confirmation rationale (binding):** The intermediate sheet's whole purpose is to capture LOCATION at creation time. Without it, the user lands on the plant profile and most never go back to set location → catalog grouping degrades. One extra step is correct.
- **Q-32 PostHog server-side rationale (binding):** No identification events from the client. `identification_started` server-side is acceptable — funnel attribution stays accurate because the route handler fires it BEFORE any cap/consent/provider work. Browsing to `/identify` without submitting does NOT fire the event.

</specifics>

<deferred>

## Deferred Ideas

- **Operator dashboard for budget tuning** — Phase 6 ships DB-only configuration. A future ops phase could surface a privileged UI; not in this milestone's roadmap.
- **`provider_attempts` jsonb audit column** (Q-07 option c) — rejected for Phase 6 (D-07: one row per request, traces in Sentry/PostHog). If the breaker tuning later needs deeper post-hoc analysis, a non-blocking append to the schema is straightforward.
- **Per-attempt history rows** (Q-07 option b: `parent_identification_id`) — rejected for Phase 6 (history complexity, schema churn). Could be revisited if user-facing "show me every attempt" feature is requested.
- **Cancel button on loading state** (Q-20 option c) — rejected for Phase 6 (client/server divergence per IDENT-14). If 30s waits become a UX complaint, a server-side cancellation token + IDENT-14 amendment could re-open the option.
- **Cross-Lambda shared cache** (Q-14 option b: Vercel KV / Upstash Redis) — rejected for Phase 6 (out of CLAUDE.md tech stack, infra cost). Revisit only if Lambda fan-out + cache-staleness becomes an operational pain point.
- **Healthcheck endpoint for breaker probes** (Q-01 option c) — rejected (D-01 keeps surface minimal). Real provider call as the probe is the safest signal.
- **MSW intercept-based connector tests** (Q-31 option b) — partial overlap with D-31's unit-test layer; if integration test coverage gaps surface, MSW could augment without replacing the test seam.
- **Pre-upload `/v1/identifications/photos` route** (Q-26 option b/c) — rejected (D-26: single multipart). If a future "upload while user is still typing notes" optimization is wanted, the helper from D-28 is already extracted.

</deferred>

---

_Phase: 06-identification-flow-cost-controls_
_Context gathered: 2026-05-10_
