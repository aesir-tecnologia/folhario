# Phase 6: Identification Flow & Cost Controls - Context

**Gathered:** 2026-05-04 (--auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

A verified, trial-active user opens the Identify screen, snaps or picks 1-N photos, accepts the first-time LGPD Art. 33 third-party transfer consent, and — within the 50s function budget — receives ≤3 honest top-3 results with confidence-ladder UI, selects one, and lands in their catalog with a Plant+Species linked; meanwhile the platform enforces per-user caps, per-provider daily ceilings, atomic counters, and a circuit breaker so a runaway provider can never blow the $5/day budget.

**Explicitly NOT in scope for Phase 6:**
- Care guide rendering (Phase 7 — `care_guide.augmented` consumed there; Phase 6 emits `identification.succeeded` which triggers the augment Inngest function, but the care card itself doesn't render yet)
- Toxicity badge composition (Phase 7)
- Reminders on plant profile (Phase 8)
- Offline mutation queue (Phase 9) — identification is blocked offline with a clear message; no queue
- Read-only mode real Stripe state (Phase 10) — Phase 6 extends the Phase 5 `useSubscription()` stub check to gate the paywall modal on identify
- LGPD data export / deletion grace (Phase 11)
- Push permission (Phase 8)

</domain>

<decisions>
## Implementation Decisions

### Provider Adapter Interface & Router

- **D-01:** **`IdentificationProvider` TypeScript interface at `src/contexts/identification/domain/provider.ts`.** Method: `identify(input: {photos: Array<{buffer: Buffer, contentType: string}>, userId: string}): Promise<IdentificationProviderResult>`. Result type: `{results: Array<{speciesName: string, scientificName: string, confidence: number, providerSpeciesId: string}>, provider: string, model: string, latencyMs: number}`. Confidence is a float 0–1; filtered by `ProviderBudget.min_confidence` (default 0.30) before returning to the client.
- **D-02:** **Concrete providers at `src/contexts/identification/infrastructure/providers/`.** `PlantIdProvider` (primary) + `OpenAICompatProvider` (fallback). Each provider is constructed with its API key from server-env. Prompts + config (model name, endpoint URL) versioned with the app deploy (not DB-tunable) per IDENT-19. Provider implementations are stateless — state (budget, breaker) lives in DB.
- **D-03:** **Router class at `src/contexts/identification/application/identification-router.ts`.** Execution order: (1) check circuit breaker for primary → if open, skip to fallback; (2) check budget ceiling for primary → if at ceiling, skip to fallback; (3) dispatch primary — track wall-clock start; (4) on primary failure/timeout, check remaining budget (≥10s required) → if ok dispatch fallback; (5) if fallback also fails or <10s remaining → short-circuit `provider_unavailable`. Router receives remaining wall-clock time from the route handler (pass `Date.now()` at handler entry, subtract elapsed before each provider dispatch). Router does NOT call the route handler's `NextResponse` — it returns a typed result and the route handler maps to HTTP.

### Per-User Cap Tracking

- **D-04:** **Cap check via COUNT on `identifications` table — no new table.** Daily window: UTC day boundary (`DATE(created_at AT TIME ZONE 'UTC')`). Period window: derived from user's `Subscription` row (`trial_start_date..trial_end_date` for trial; `current_period_start..current_period_end` for paid). Both windows computed server-side at request time. Cap limits from `identificationLimits` table (already seeded in Phase 2: trial 5/day + 75/period; paid 15/day + 200/period). COST-10: `IdentificationLimit` rows read with a 30s in-memory TTL cache per process to allow DB tuning without redeploy.
- **D-05:** **PostgreSQL advisory lock per user to serialize concurrent identification requests (COST-09).** At the start of the identification use-case, acquire `pg_try_advisory_xact_lock(hashtext(user_id))`. If lock cannot be acquired immediately → return `cap_hit` 429 (serialization rejection is semantically equivalent to the cap being hit by a concurrent request). Cap COUNT check and `identifications` INSERT both occur within the same TX so concurrent requests are serialized at the user level. This also prevents double-counting on the `ProviderUsageCounter` atomic UPSERT — two concurrent requests from the same user cannot both proceed past the cap check simultaneously.
- **D-06:** **`ProviderUsageCounter` atomic UPSERT runs AFTER provider call succeeds.** Pattern inherited from Phase 2 schema: `INSERT INTO provider_usage_counters (...) ON CONFLICT (provider, purpose, utc_date) DO UPDATE SET estimated_cost_cents = provider_usage_counters.estimated_cost_cents + EXCLUDED.estimated_cost_cents, request_count = provider_usage_counters.request_count + 1, last_updated = NOW()`. Cost estimation: configurable per-request cost in cents from `ProviderBudget` (add a `cost_per_request_cents INT` column in this phase's migration) or fall back to a fixed seed (e.g. 2 cents/req for Plant.id, 3 cents/req for OpenAI-compat). Ceiling check executes BEFORE any provider call per COST-03; counter increment runs in a separate non-transactional call after success.

### Circuit Breaker State

- **D-07:** **New `provider_circuit_breakers` table.** Schema: `provider VARCHAR(64) PK`, `state VARCHAR(16) NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open'))`, `consecutive_failures INT NOT NULL DEFAULT 0`, `opened_at TIMESTAMPTZ`, `last_failure_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. No RLS (service-role only — operator state). Initial migration seeds one row per provider: `('plant_id', 'closed', 0, NULL, NULL)` and `('openai_compat', 'closed', 0, NULL, NULL)`. Naming matches `providerBudgets.provider` values for FK-free lookup by the router.
- **D-08:** **Breaker thresholds: opens after 5 consecutive failures within 10 minutes; cooldown 60s before half-open; closes on first success in half-open.** Read `provider_circuit_breakers` at each router dispatch (single SELECT, no cache — latency acceptable given the identification flow is already network-bound). Write happens synchronously in the same request's DB connection (separate from the identification TX) to update state + counters. A "failure" for breaker purposes = any of: timeout, `invalid_response`, provider HTTP 5xx, or provider network error. A `cost_ceiling_reached` skip does NOT increment the failure counter (budget exhaustion ≠ provider flaking).

### LGPD Consent Check + Version Tracking

- **D-09:** **Backend check: `ConsentLog` must have a row for `purpose='identification_third_party'` before any provider dispatch.** The identification use-case calls `iamConsentRepository.hasActiveConsent(userId, 'identification_third_party')` at step 0 (before cap check). Missing or revoked consent → `consent_required` 403. The frontend detects `error.code === 'consent_required'` on the identification endpoint and renders the LGPD consent modal (not a redirect — the modal overlays the identify screen).
- **D-10:** **Granting consent: `POST /api/v1/iam/consents` body `{purpose: 'identification_third_party'}`.** Inserts a ConsentLog row with `legal_basis='consent'`, `source='identify_screen'`, `policy_version` = currently active policy version id. Returns `{consent_version: string}` (the version string, e.g. `"1.0"`). Client retries the identification immediately after grant. Material-change re-consent (LGPD-10) uses this same endpoint — if `policy_versions.requires_reconsent_for` includes `'identification_third_party'` the backend checks for a ConsentLog newer than the material change date; if absent → `consent_required` 403.
- **D-11:** **`Identification.consentVersion` = `policy_versions.version` string active at request time.** The backend resolves `SELECT version FROM policy_versions WHERE is_current = true` at identification time (same 30s in-process cache as D-04's IdentificationLimit reads). Stored on every Identification row regardless of consent status (consent check gates before we reach the insert, so if we insert, consent was granted).

### Identify Screen UX

- **D-12:** **Single-page flow: `/identify` → results are shown inline (no separate route).** Phase 5 shipped a placeholder at `src/app/(app)/identify/page.tsx` + `_identify-placeholder.tsx`. Phase 6 replaces the placeholder with the real flow. State machine: `idle` → `picking` → `uploading` → `identifying` → `results` (or `zero_results` or `error`). All states managed client-side in a single page with conditional rendering.
- **D-13:** **Static capture guide visible in `idle` and `picking` states.** Four guide thumbnails in a 2×2 grid: leaf close-up, flower, whole plant, multi-shot hint "Mais fotos melhoram a precisão" (last cell is a text card, not an image). Lucide icons for camera + gallery. Plus Jakarta Sans 12 w500 Calm Slate labels under each thumbnail. This guide does NOT appear during `identifying` or `results` states.
- **D-14:** **Multi-photo: 1–5 photos per identification.** Camera button triggers `<input type="file" accept="image/*" capture="environment" multiple>` (or a camera API on supported browsers). Gallery button triggers `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`. After selection, show thumbnails (Phase 5 Lightbox-style) with a remove-X affordance. Client-side compression (≤1MB per photo) + EXIF/GPS strip using `exifr` (already in package.json) before upload. GPS-bearing photos stripped by the client; server defense in depth rejects any that slip through per IDENT-16.
- **D-15:** **Loading state: skeleton shimmer + progress text during `uploading` + `identifying`.** During upload: "Enviando fotos…". During identification: "Identificando sua planta…". Skeleton replaces the capture guide. Timeout budget: route handler sets `AbortController` with 48s timeout (leaving 2s for overhead under the 50s wall-clock budget). On AbortError → store `status=failed, failure_reason=timeout` and show the timeout UI variant.
- **D-16:** **Results: confidence ladder with 3 visual states.** Per UI-15: high ≥70% (Canopy Green bar + full segments + "Alta confiança" SR label), medium 40–69% (amber/goldenrod bar + partial segments + "Confiança média" SR label), low threshold–39% (Calm Slate bar + minimal segments + "Baixa confiança" SR label). Each result card: species name (Plus Jakarta Sans 16 w600 Forest Ink), scientific name (`<i lang="la">` via Phase 5 ScientificName component), confidence bar, confidence percentage (numeric, no fake precision beyond 1 decimal), confidence SR label (visually hidden, read by screen readers). Cards ordered desc by confidence. Zero-results: "Não conseguimos identificar esta planta" + retake button + "Adicionar manualmente" text link.

### Result Selection & Plant Creation

- **D-17:** **Result selection → bottom sheet → plant creation.** User taps a result card → `<ModalSheet>` opens (Phase 5 primitive) with: pre-filled name input (species name as default, editable), optional location combobox (Phase 5 Combobox primitive), optional acquisition_date, "Adicionar à minha estante" CTA (Canopy primary), "Não é nenhuma delas" secondary text link. Submit button triggers `POST /api/v1/identifications/{id}/confirm`.
- **D-18:** **`POST /api/v1/identifications/{id}/confirm` body `{speciesId: string, name: string, nickname?: string, location?: string, acquisitionDate?: string}`.** Backend: single `withUnitOfWork` TX — (1) calls `createPlant(tx, {source:'identification', speciesId, name, ...})` (Phase 5 use-case already handles this branch), (2) `UPDATE identifications SET plant_id = $plantId WHERE id = $identificationId AND user_id = $userId`, (3) commit. After TX: fire `identification.succeeded` Inngest event (carries identificationId, userId, plantId, provider, model, selectedSpeciesId, latencyMs). Route returns `{plantId}` → client redirects to `/catalog/{plantId}`. Error: if identificationId not found or not owned by user → 404.
- **D-19:** **Manual correction (IDENT-07): `POST /api/v1/identifications/{id}/correct` body `{manualCorrection: string}`.** Stores `manual_correction` on the Identification row. Species resolution: `SELECT id FROM species WHERE LOWER(name) = LOWER($correction) OR LOWER(scientific_name) = LOWER($correction) LIMIT 1`. If match found → sets `species_id` on the plant (via `PATCH /api/v1/plants/{plantId}`) + links `Identification.plant_id`. If no match → `species_id = null`, `flag_reason = 'missing_species'` flag noted in Sentry for operator review. No blocking error to the user; the plant creates with `species_id = null` and care card stays hidden.

### Identification History Screen

- **D-20:** **Two history surfaces.** (a) **Per-plant**: `/catalog/{plantId}/identifications` — Phase 5 shipped a placeholder link ("Histórico de Identificação") on plant profile; Phase 6 wires it. (b) **Global**: `/identify/history` — accessible from the Identify tab header or from the identification results page ("Ver histórico"). Both surfaces use the same `GET /api/v1/identifications` endpoint with optional `?plantId=` filter.
- **D-21:** **`GET /api/v1/identifications` — cursor-paginated, user-scoped.** Response: `{items: IdentificationHistoryItem[], nextCursor?: string, total_count?: number}`. `IdentificationHistoryItem` shape: `{id, status, failureReason, provider, model, latencyMs, createdAt, thumbnailUrl (first photo), results (array, present only when status=success), selectedResult, plantId, plantName}`. Page size 20 default. Cursor encodes `{created_at, id}` desc. Photo thumbnails are 24h signed URLs (same pattern as Phase 5 photo journal signed URLs).
- **D-22:** **Re-associate link (IDENT-08).** For history items where `plantId` is null and `status = 'success'`, show "Associar à planta" CTA. Tapping it opens the result selection bottom sheet (D-17) with a pre-selected result (the `selectedResult` from the Identification row, if any) or the full results list if no selection was made. Uses `POST /api/v1/identifications/{id}/confirm` — same endpoint.

### Budget Ceiling Alert

- **D-23:** **Operator alert Resend email when provider counter reaches 80% of daily ceiling (COST-04).** The identification use-case reads `ProviderBudget.alertThresholdPct` (default 80 — already in Phase 2 schema). After each successful `ProviderUsageCounter` UPSERT, check if `estimated_cost_cents / daily_cost_cap_cents >= alert_threshold_pct / 100` AND `last_alerted_at < UTC_today`. If threshold crossed: emit `provider.ceiling_reached` Inngest event (already defined in `IdentificationEvents`). Inngest function `identification/notify-ceiling` (new in this phase) consumes it → dispatches Resend operator alert email. Add `last_alerted_at DATE` column to `provider_budgets` to debounce one alert per UTC day per provider per purpose.

### Offline + Read-Only Mode Gates

- **D-24:** **Offline identification blocked with clear message (IDENT-20).** The Identify page checks `useOnlineStatus()` (Phase 5 Phase 3 hook). When offline: show the `WifiOff` message already implemented in the Phase 5 placeholder ("Identificação requer conexão à internet.") — plus the static capture guide remains visible so users can take notes on what to do when back online. The "Identificar" CTA is hidden. No queue; no retry.
- **D-25:** **Read-only paywall modal (IDENT-21).** The Identify page checks `useSubscription()` stub (Phase 5 D-21). When `readOnly: true`, tapping the identify CTA opens a Radix Dialog modal (not a bottom sheet) with copy "Reative sua assinatura para identificar novas plantas." + "Ver assinatura" CTA linking to `/settings/subscription` (Phase 10 destination; currently shows "Em breve" placeholder).

### Telemetry

- **D-26:** **PostHog events for identification.**
  - `identification_started` — server-side, fires when identification row is first created (status=pending or on request receipt). Properties: `{provider, photo_count: int}`. Privacy-clean — no photo URLs, no species names.
  - `identification_completed` — fires after provider returns. Properties: `{provider, model, status: 'success'|'failed', failure_reason?: string, result_count: int, latency_ms: int, above_threshold: int}`. Never includes species names.
  - `plant_added` already has `source: 'identification'` in Phase 5 D-28 use-case — no changes needed.
  - `identification_consent_granted` — fires when `POST /api/v1/iam/consents` is called for `identification_third_party`. Property: `{source: 'identify_screen'}`.

### Claude's Discretion

- Exact Tailwind class compositions for the confidence ladder bar visual states
- Specific provider timeout values per provider (within the 30s per-call cap from IDENT-18)
- Exact Plant.id API endpoint URL and request shape (sourced from Plant.id v3 docs at research time)
- Exact OpenAI-compat vision endpoint URL, model name, and system prompt content for identification
- `cost_per_request_cents` seed values for Plant.id and OpenAI-compat providers
- Species name matching strategy for manual correction (exact vs normalized-lowercase vs fuzzy)
- Capture guide illustration assets (Lucide plant/leaf icons as placeholders until founder provides branded assets)
- Exact error state copy strings for each failure mode (initial pt-BR drafts; founder reviews)
- Whether to use AbortController or `Promise.race` for the 48s identification timeout
- File splits inside `src/contexts/identification/{domain,application,infrastructure,api,inngest}/`

### Folded Todos

- **dev-mode service-worker unregister (score 0.6)** — Relevant: Phase 6 adds new API routes (`/api/v1/identifications/*`) to the Serwist NetworkOnly list and the identification flow has strict NetworkOnly requirements. The dev-mode unregister papercut could cause stale cache to serve cached 503 responses for identification routes in development. Phase 6 planning should verify this is resolved (or include it as a prerequisite task).
- **Offline + axe + bottom-nav E2E failure cluster (score 0.4)** — Phase 6 includes offline identification gating (IDENT-20); if the existing axe + offline E2E failures remain unresolved, Phase 6 E2E specs may inherit flakiness. Note as a prerequisite investigation item in planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + scope
- `.planning/PROJECT.md` — Core value (<2 min from email verification), constraints (50s wall-clock / 30s per-call / ≥10s remaining for fallover), key decisions (Plant.id primary + OpenAI-compat fallback rationale), launch blockers
- `.planning/REQUIREMENTS.md` — Phase 6 requirements: IDENT-01..21, COST-01..10, LGPD-09, UI-06, UI-12, UI-15 (35 requirements total)
- `.planning/ROADMAP.md` §Phase 6 — Goal + 5 success criteria

### Identification domain (PRD)
- `docs/CAVE-PRD.md` §1 — "Value <2 min" non-negotiable; honest AI (no fake confidence scores, no fabricated names); "Gerado por IA" provenance
- `docs/CAVE-PRD.md` §3 — Bounded contexts table; Identification aggregates; events `identification.succeeded`, `identification.failed`, `provider.ceiling_reached`; Inngest function list (care-guide/augment consumed by Phase 7; identification phase emits the trigger event)
- `docs/CAVE-PRD.md` §4 — Data model: Identification (id, userId, plantId, photoUrls, provider, model, results, selectedResult, manualCorrection, latencyMs, consentVersion, status, failureReason), IdentificationLimit (tier, dailyCap, periodCap), ProviderBudget (provider, purpose, dailyCostCapCents, alertThresholdPct, minConfidence, isActive), ProviderUsageCounter (provider, purpose, utcDate, requestCount, estimatedCostCents)
- `docs/CAVE-PRD.md` §5 — CLOSED error-code registry: `consent_required`, `cap_hit`, `provider_unavailable`, `timeout`, `validation_failed`, `subscription_required`; `cost_ceiling_reached` + `breaker_open` are INTERNAL-only, surface as `provider_unavailable`
- `docs/CAVE-PRD.md` §6 — Identification flow: adapter contract, confidence filter (min_confidence 0.30 seed), results shape (top-3 ordered desc), provider selection (primary Plant.id → fallback OpenAI-compat), per-call 30s cap, total 50s wall-clock, ≥10s required for fallover, per-provider circuit breaker, `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real
- `docs/CAVE-PRD.md` §11 — Image handling: client ≤1MB + EXIF/GPS strip; server GPS defense in depth (`validation_failed`)
- `docs/CAVE-PRD.md` §13 — LGPD: Art. 33 consent required before first identification; `identification_third_party` purpose; material-change re-consent; `consentVersion` capture on every Identification row
- `docs/CAVE-PRD.md` §16 — Screens: Identify screen (picker, capture guide, loading, results, no-results, cap-hit, provider-unavailable, offline, read-only paywall, first-time consent modal); Identification history screen (per-user + per-plant)
- `docs/CAVE-PRD.md` §17 — Design system: confidence ladder (3 states, redundant signals, no fake precision); static capture guide composition; result card geometry; banned patterns; spring-physics motion
- `docs/CAVE-PRD.md` §20 — PostHog event taxonomy (server-side via posthog-node); env vars (`IDENTIFICATION_PROVIDER_MODE`, Plant.id key, OpenAI-compat key)
- `docs/CAVE-PRD.md` §21 — Security: GPS EXIF server rejection; `IDENTIFICATION_PROVIDER_MODE` stub mode for CI; service-role key server-only
- `docs/CAVE-PRD.md` §23 — Acceptance criteria: AC-ID-001..021, AC-COST-001..010, AC-LGPD-009

### Prior phase patterns (locked decisions to honor)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-10/D-11/D-12 closed error registry (cap_hit, provider_unavailable, timeout all already in errors.ts), D-21 PostHog identified_only persons, D-22 Sentry PII scrubbing (photo_url already scrubbed; request bodies dropped on `/api/v1/identifications/*` — MUST preserve)
- `.planning/phases/02-data-layer/02-CONTEXT.md` — D-01 per-context schema ownership, D-13 IdentificationLimit + ProviderBudget seeded (Phase 6 consumes), D-14 runtime DB client `{prepare: false}`, D-16 functional repositories, D-17 NO Drizzle in route handlers, D-19 drizzle-zod refined schemas, D-20/D-21/D-22 RLS strategy, D-27 server proxy upload route, D-30 server GPS rejection BEFORE adapter write, D-36 cursor pagination, D-37 idempotency_keys table (POST /v1/identifications should accept Idempotency-Key)
- `.planning/phases/04-iam-auth-verification-consent/04-CONTEXT.md` — D-21 `requireVerifiedUser()` helper (identification route requires verified + consented user), D-24 ConsentLog × 2 at signup (identification_third_party is NOT done at signup — deferred to first identify), D-17 Inngest per-context function registry (identification context exports identificationFunctions array)
- `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` — D-02 createPlant use-case `source:'identification'` branch with speciesId (READY to use), D-18 TanStack Query factory pattern (Phase 6 adds `identificationKeys.*` to the factory), D-21 `useSubscription()` stub (Phase 6 reads `readOnly` flag for identify gate), D-22/D-23 pending_storage_deletions pattern (NOT needed for Phase 6 — identification photos stored in a different bucket path), D-26 `authedUser` Playwright fixture (Phase 6 E2E reuses + extends with consent fixture), D-28 `plant_added` PostHog event `source:'identification'` (already handled in create-plant.ts)

### Code anchors (existing artifacts Phase 6 builds on)
- `src/contexts/identification/infrastructure/db/schema.ts` — `identifications`, `identificationLimits`, `providerBudgets`, `providerUsageCounters` tables already exist with correct shape. Phase 6 schema work: add `cost_per_request_cents INT NOT NULL DEFAULT 2` to `providerBudgets` + add `last_alerted_at DATE` to `providerBudgets` + new `provider_circuit_breakers` table
- `src/contexts/identification/domain/schemas.ts` — drizzle-zod scaffolding already exists; Phase 6 adds refined Zod schemas for request/response shapes
- `src/contexts/identification/domain/events.ts` — `IdentificationEvents` + payload types already defined (`identification.succeeded`, `identification.failed`, `provider.ceiling_reached`)
- `src/contexts/identification/inngest/functions.ts` — empty `identificationFunctions: never[]` — Phase 6 adds `notifyCeiling` Inngest function
- `src/contexts/catalog/application/create-plant.ts` — `source:'identification'` branch already implemented with `speciesId` field; Phase 6 calls this with `deps.tx` (outer-TX path, D-02/D-18)
- `src/app/(app)/identify/page.tsx` + `_identify-placeholder.tsx` — Phase 6 replaces placeholder with real flow; existing `useOnlineStatus()` import retained
- `src/shared/config/errors.ts` — `cap_hit`, `provider_unavailable`, `consent_required`, `timeout` all in the registry; `cost_ceiling_reached` + `breaker_open` already marked as INTERNAL_ONLY
- `src/shared/images/limits.ts` + `src/shared/images/server-validate.ts` — `rejectGpsMetadata` + `rejectOversizeBuffer` already implemented; Phase 6 identification route handler calls these on each uploaded photo
- `src/shared/inngest/registry.ts` — Phase 6 imports `identificationFunctions` from the identification context and adds to the registry
- `src/shared/inngest/client.ts` — `inngest` client already wired
- `src/contexts/iam/infrastructure/db/consent-logs.ts` — Phase 6 reads from this to check `identification_third_party` consent
- `src/shared/ui/modal-sheet.tsx` (ModalSheet) — Phase 6 reuses for result selection bottom sheet + LGPD consent modal
- `src/shared/typography/scientific-name.tsx` — Phase 6 identification result cards use this for scientific names
- `src/contexts/catalog/queries/index.ts` — Phase 6 adds `identificationKeys.*` factory

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`createPlant` use-case** (`src/contexts/catalog/application/create-plant.ts`) — already handles `source:'identification'` branch with `speciesId`. Phase 6 calls with `deps.tx` for atomic TX with Identification update.
- **`rejectGpsMetadata` + `rejectOversizeBuffer`** (`src/shared/images/server-validate.ts`) — server-side photo validation already implemented; used in Phase 5 plant-create route. Phase 6 identification route uses same helpers on each uploaded photo buffer.
- **`withUnitOfWork`** (`src/shared/db/unit-of-work.ts`) — PostgreSQL advisory lock (`pg_try_advisory_xact_lock`) can be issued inside this function's TX to serialize concurrent user requests (D-05).
- **`ModalSheet`** (Phase 3 `src/shared/ui/modal-sheet.tsx`) — Phase 6 reuses for result selection sheet (D-17) and LGPD consent modal (D-09).
- **`Combobox`** (Phase 5 `src/shared/ui/combobox.tsx`) — Phase 6 result selection sheet includes optional location field using this primitive.
- **`ScientificName`** (Phase 5 `src/shared/typography/scientific-name.tsx`) — Phase 6 result cards render scientific names via this component.
- **`useOnlineStatus`** (Phase 3 `src/shared/online/use-online-status.ts`) — Phase 6 Identify page uses this for offline gate (D-24); already imported in the existing placeholder.
- **`useSubscription()` stub** (Phase 5 `src/contexts/billing/application/use-subscription.ts`) — Phase 6 reads `readOnly` flag for identify paywall gate (D-25).
- **`authedUser` Playwright fixture** (Phase 5 `tests/e2e/fixtures/authed-user.ts`) — Phase 6 extends with a `consentedUser` variant that also inserts a `ConsentLog` row for `identification_third_party`.
- **`InMemoryStorageAdapter`** (Phase 5 `tests/integration/setup.ts`) — Phase 6 integration tests reuse for photo upload test isolation.
- **`identificationLimits` + `providerBudgets` seeded data** (Phase 2) — already in the DB from Phase 2 seed; Phase 6 reads these rows directly.
- **`ErrorCode.CapHit`, `ErrorCode.ProviderUnavailable`, `ErrorCode.ConsentRequired`** (Phase 1 `src/shared/config/errors.ts`) — all in registry; `errorResponse()` helper maps to correct HTTP status automatically.

### Established Patterns

- **No Drizzle in route handlers** (Phase 2 D-17) — Phase 6 `/api/v1/identifications/*` handlers are thin: validate (Zod) → call use-case → map HTTP. Use-cases in `src/contexts/identification/application/`. Repositories in `src/contexts/identification/infrastructure/db/`.
- **Per-context schema ownership** (Phase 2 D-01) — Phase 6 owns schema additions in `src/contexts/identification/infrastructure/db/schema.ts`; new `provider_circuit_breakers` migration owned by identification context.
- **Inngest per-context function registry** (Phase 4 D-17) — Phase 6 fills `identificationFunctions` array in `src/contexts/identification/inngest/functions.ts` with `notifyCeiling` function. `src/shared/inngest/registry.ts` already imports this (currently `never[]`).
- **`IDENTIFICATION_PROVIDER_MODE=stub` env var** (Phase 1 D-05 success criteria) — Phase 6 respects this gate for CI + preview environments. Stub providers return hardcoded results without calling external APIs.
- **Sentry PII scrubbing** (Phase 1 D-22) — `photo_url` already in the scrub list; `request bodies dropped on /api/v1/identifications/*` was specified in Phase 1 SC-4 — Phase 6 MUST preserve this (adds the route pattern to the Sentry breadcrumb filter if not already present).
- **Server-side PostHog capture** (Phase 1 D-21) — Phase 6 identification events fire server-side via `posthog-node`; `Sentry.setUser({ id })` only.
- **24h signed URL pattern** (Phase 5 D-20) — Phase 6 identification history thumbnails use 24h signed URLs for the photo thumbnails.
- **Cursor pagination** (Phase 2 D-36) — Phase 6 `GET /api/v1/identifications` uses the established `{created_at, id}` opaque cursor pattern.
- **Idempotency-Key** (Phase 2 D-37) — `POST /api/v1/identifications` accepts `Idempotency-Key` header; the `idempotency_keys` table is already wired.

### Integration Points

- `src/contexts/identification/infrastructure/db/schema.ts` — migration adds: `cost_per_request_cents INT NOT NULL DEFAULT 2` + `last_alerted_at DATE` to `providerBudgets`; new `provider_circuit_breakers` table
- `src/contexts/identification/infrastructure/db/identifications.ts` — NEW repository: `create`, `findById`, `findByUserId` (cursor), `findByPlantId`, `updatePlantId`, `updateSelectedResult`, `updateManualCorrection`
- `src/contexts/identification/infrastructure/db/provider-budgets.ts` — NEW repository: `findByProviderAndPurpose`, `updateLastAlertedAt`
- `src/contexts/identification/infrastructure/db/provider-usage-counters.ts` — NEW repository: `atomicUpsert`, `findByProviderAndPurposeToday`
- `src/contexts/identification/infrastructure/db/circuit-breakers.ts` — NEW repository: `findByProvider`, `recordSuccess`, `recordFailure`
- `src/contexts/identification/infrastructure/db/identification-limits.ts` — NEW repository: `findByTier` (with 30s in-process cache)
- `src/contexts/identification/domain/provider.ts` — NEW: `IdentificationProvider` interface + result types
- `src/contexts/identification/infrastructure/providers/plant-id-provider.ts` — NEW: Plant.id v3 HTTP adapter
- `src/contexts/identification/infrastructure/providers/openai-compat-provider.ts` — NEW: OpenAI-compat vision adapter
- `src/contexts/identification/infrastructure/providers/stub-provider.ts` — NEW: stub for CI/preview (`IDENTIFICATION_PROVIDER_MODE=stub`)
- `src/contexts/identification/application/identification-router.ts` — NEW: budget + breaker check → primary → fallback → short-circuit
- `src/contexts/identification/application/identify.ts` — NEW: main use-case — advisory lock → consent check → cap check → router dispatch → insert Identification row → counter upsert → PostHog
- `src/contexts/identification/application/confirm-identification.ts` — NEW: select result → createPlant(tx) + update identification.plant_id → emit `identification.succeeded`
- `src/contexts/identification/application/correct-identification.ts` — NEW: store manualCorrection + attempt species name resolution
- `src/contexts/identification/application/list-identifications.ts` — NEW: cursor-paginated list with optional plantId filter + 24h signed photo URLs
- `src/contexts/identification/inngest/functions.ts` — REPLACE `never[]` with `[notifyCeiling]` function (consumes `provider.ceiling_reached` → Resend operator email)
- `src/app/api/v1/identifications/route.ts` — NEW: POST (identify) + GET (list history)
- `src/app/api/v1/identifications/[identificationId]/confirm/route.ts` — NEW: POST (select result + create plant)
- `src/app/api/v1/identifications/[identificationId]/correct/route.ts` — NEW: POST (manual correction)
- `src/app/api/v1/iam/consents/route.ts` — NEW: POST (grant consent for identification_third_party)
- `src/app/(app)/identify/page.tsx` — REPLACE placeholder with real identify flow
- `src/app/(app)/identify/_identify-placeholder.tsx` — DELETE (replaced by real flow)
- `src/app/(app)/identify/history/page.tsx` — NEW: global identification history screen (UI-12)
- `src/app/(app)/catalog/[plantId]/identifications/page.tsx` — NEW: per-plant ID history (wires Phase 5 placeholder link)
- `src/contexts/identification/queries/index.ts` — NEW: TanStack Query factory (`identificationKeys.*`)
- `messages/pt-BR.json` — extend `identify.*` namespace (results, confidence labels, error states, consent modal copy, capture guide labels, history copy)
- `src/shared/inngest/registry.ts` — already imports `identificationFunctions`; Phase 6 fills the array

</code_context>

<specifics>
## Specific Ideas

- **Confidence bar visual:** Source Serif 4 16/20 w500 for species name; Plus Jakarta Sans 13 for confidence percentage. Bar background: Hairline Beige. Fill: Canopy Green (≥70%), custom amber token (40–69%), Calm Slate (below threshold). 5 segment ticks on the bar matching PRD §17 confidence ladder spec.
- **LGPD consent modal copy (initial draft):** Title "Para identificar, precisamos enviar suas fotos". Body "Usamos Plant.id (Kindwise) e modelos de visão compatíveis com OpenAI, ambos fora do Brasil (Art. 33 LGPD). Seus dados são usados apenas para identificar plantas. [Link: Política de privacidade]". CTA: "Entendo e aceito" (Canopy primary), "Cancelar" (text link). Trust Teal "Gerado por IA" chip in modal header.
- **Zero-results state copy:** "Hmm, não conseguimos identificar desta vez." + Calm Slate hint "Tente com mais fotos ou de ângulos diferentes." + two CTAs: "Tentar novamente" (Canopy primary) + "Adicionar manualmente" (text link). No retry count limit.
- **Cap hit 429 UI:** "Você atingiu o limite de identificações de hoje." with a "Próximo limite em {resetTime}" hint (formatted as pt-BR relative time) + "Adicionar manualmente" text link + NO retry button (per AC-ID-009).
- **Capture guide layout:** 2×2 grid of thumbnail-sized cards (64px each). First three: representative plant photos (leaf close-up, flower, whole plant) — Phase 6 uses Lucide icons as placeholders (Leaf, Flower2, TreePine). Fourth cell: text card "Mais fotos melhoram a precisão" (Plus Jakarta Sans 12 Calm Slate).
- **Multi-photo selection UI:** After camera/gallery selection, selected photos appear as a horizontal scroll strip of 56px squares with a red X remove button (Urgent Poppy). "Adicionar mais fotos" secondary button (max 5 total). Count badge "3/5" in top-right of the strip.
- **`identification.succeeded` Inngest event triggers care-guide/augment** (Phase 7 stub-registered) — Phase 6 emits the event; Phase 7 implements the handler. The event schema must match what Phase 7 expects: `{identificationId, userId, plantId, provider, model, selectedSpeciesId, latencyMs, succeededAt}`.
- **Provider stub mode:** When `IDENTIFICATION_PROVIDER_MODE=stub`, `StubProvider` returns: 3 hardcoded results at confidences 0.85, 0.62, 0.35 using well-known Brazilian houseplants (`Monstera deliciosa`, `Epipremnum aureum`, `Sansevieria trifasciata`). Latency simulated with 800ms sleep. Used in CI + preview E2E specs.
- **`consentedUser` Playwright fixture extension:** Based on Phase 5's `authedUser` — additionally inserts a ConsentLog row `{purpose:'identification_third_party', legal_basis:'consent', source:'identify_screen', policy_version: (SELECT id FROM policy_versions WHERE is_current=true)}`. Saves 1 modal interaction per E2E spec that exercises identification.

</specifics>

<deferred>
## Deferred Ideas

### Future-phase deferrals

- **Care guide rendering after identification** — Phase 7. Phase 6 emits `identification.succeeded` with `selectedSpeciesId`; Phase 7 wires care-guide/augment Inngest handler to consume it.
- **Toxicity badge on identification results page** — Phase 7. Result cards in Phase 6 do NOT show toxicity info (species may not have a care guide yet; reading toxicity from a partial record would be misleading).
- **Re-identification from plant profile** ("Identificar novamente" button) — post-MVP backlog. Phase 6 ships identification → catalog flow; re-identification of an existing plant is a separate UX challenge.
- **Batch identification / multi-plant session** — post-MVP. Phase 6 is single-identification-at-a-time per session.
- **Species search / browse** without a photo — Phase 7 or post-MVP. Phase 6 is camera/gallery only.
- **Provider cost analytics dashboard** — Phase 13. Observability rollups.

### Reviewed Todos (not folded)

- **Fix gsd-sdk phase-plan-index wave misreport** (score 0.6) — pure tooling, no impact on Phase 6 identification code.
- **Replace vite-tsconfig-paths plugin with native Vite resolve.tsconfigPaths** (score 0.4) — pure tooling, no impact on Phase 6.

</deferred>

---

_Phase: 06-identification-flow-cost-controls_
_Context gathered: 2026-05-04 (--auto mode, all gray areas auto-selected, recommended decisions applied)_
