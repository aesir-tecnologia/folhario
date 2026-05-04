# Phase 6: Identification Flow & Cost Controls — Research

**Researched:** 2026-05-04
**Domain:** Multi-provider AI identification routing, atomic cost accounting, circuit breaker, LGPD consent gating, multi-photo PWA flow.
**Confidence:** HIGH (provider APIs verified via official docs; all internal patterns from locked CONTEXT.md decisions and existing Phase 1–5 code anchors).

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `IdentificationProvider` TypeScript interface at `src/contexts/identification/domain/provider.ts`. Method: `identify(input: {photos: Array<{buffer: Buffer, contentType: string}>, userId: string}): Promise<IdentificationProviderResult>`. Result type: `{results: Array<{speciesName: string, scientificName: string, confidence: number, providerSpeciesId: string}>, provider: string, model: string, latencyMs: number}`. Confidence is a float 0–1; filtered by `ProviderBudget.min_confidence` (default 0.30) before returning to the client.
- **D-02:** Concrete providers at `src/contexts/identification/infrastructure/providers/`. `PlantIdProvider` (primary) + `OpenAICompatProvider` (fallback). Each provider is constructed with its API key from server-env. Prompts + config (model name, endpoint URL) versioned with the app deploy (not DB-tunable) per IDENT-19. Provider implementations are stateless — state (budget, breaker) lives in DB.
- **D-03:** Router class at `src/contexts/identification/application/identification-router.ts`. Execution order: (1) check circuit breaker for primary → if open, skip to fallback; (2) check budget ceiling for primary → if at ceiling, skip to fallback; (3) dispatch primary — track wall-clock start; (4) on primary failure/timeout, check remaining budget (≥10s required) → if ok dispatch fallback; (5) if fallback also fails or <10s remaining → short-circuit `provider_unavailable`. Router receives remaining wall-clock time from the route handler. Router does NOT call `NextResponse` — returns typed result.
- **D-04:** Cap check via COUNT on `identifications` table — no new table. Daily window: UTC day boundary. Period window: derived from user's Subscription row. Cap limits from `identificationLimits` table (already seeded). COST-10: `IdentificationLimit` rows read with a 30s in-memory TTL cache per process.
- **D-05:** PostgreSQL advisory lock per user to serialize concurrent identification requests (COST-09). At the start of the identification use-case, acquire `pg_try_advisory_xact_lock(hashtext(user_id))`. If lock cannot be acquired immediately → return `cap_hit` 429.
- **D-06:** `ProviderUsageCounter` atomic UPSERT runs AFTER provider call succeeds. Pattern: `INSERT ... ON CONFLICT (provider, purpose, utc_date) DO UPDATE SET ...`. Cost from `ProviderBudget.cost_per_request_cents` (new column this phase).
- **D-07:** New `provider_circuit_breakers` table. Schema: `provider VARCHAR(64) PK`, `state VARCHAR(16) DEFAULT 'closed' CHECK (state IN ('closed','open','half_open'))`, `consecutive_failures INT DEFAULT 0`, `opened_at TIMESTAMPTZ`, `last_failure_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ DEFAULT NOW()`. No RLS. Initial migration seeds one row per provider.
- **D-08:** Breaker thresholds: opens after 5 consecutive failures within 10 minutes; cooldown 60s before half-open; closes on first success in half-open. Read at each router dispatch (no cache). Failure for breaker = timeout / `invalid_response` / 5xx / network error. `cost_ceiling_reached` does NOT increment failure counter.
- **D-09:** Backend check: `ConsentLog` must have a row for `purpose='identification_third_party'` before any provider dispatch. The identification use-case calls `iamConsentRepository.hasActiveConsent(userId, 'identification_third_party')` at step 0 (before cap check). Missing → `consent_required` 403.
- **D-10:** Granting consent: `POST /api/v1/iam/consents` body `{purpose: 'identification_third_party'}`. Inserts ConsentLog with `legal_basis='consent'`, `source='identify_screen'`, `policy_version` = currently active policy version id. Returns `{consent_version: string}`.
- **D-11:** `Identification.consentVersion` = `policy_versions.version` STRING (e.g. `"1.0"`) active at request time. NOT the UUID `policy_version_id`.
- **D-12:** Single-page flow: `/identify` → results inline. State machine: `idle` → `picking` → `uploading` → `identifying` → `results` (or `zero_results` or `error`). All states client-side conditional rendering.
- **D-13:** Static capture guide visible in `idle` and `picking` states. Four guide thumbnails 2×2. Lucide icons + Plus Jakarta Sans 12 w500 Calm Slate. NOT visible during `identifying`/`results`.
- **D-14:** Multi-photo: 1–5 photos per identification. Camera button: `<input type="file" accept="image/*" capture="environment" multiple>`. Gallery button: `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`. Client-side compression ≤1MB + EXIF/GPS strip via `exifr`. GPS-bearing photos rejected by server defense in depth (IDENT-16).
- **D-15:** Loading state: skeleton shimmer + progress text. AbortController with 48s timeout (2s overhead under 50s wall-clock). On AbortError → `status=failed, failure_reason=timeout`.
- **D-16:** Results: confidence ladder with 3 visual states. high ≥70%, medium 40–69%, low threshold–39%. Cards ordered desc by confidence. Zero-results: "Não conseguimos identificar esta planta" + retake + manual link.
- **D-17:** Result selection → bottom sheet → plant creation. `<ModalSheet>` opens with: pre-filled name input, optional location combobox, optional acquisition_date, "Adicionar à minha estante" CTA, "Não é nenhuma delas" secondary text link.
- **D-18:** `POST /api/v1/identifications/{id}/confirm` body `{speciesId, name, nickname?, location?, acquisitionDate?}`. Backend: single `withUnitOfWork` TX — `createPlant(tx, {source:'identification', speciesId, ...})`, UPDATE identifications SET plant_id, commit. After TX: fire `identification.succeeded` Inngest event. Returns `{plantId}` → client redirects.
- **D-19:** Manual correction: `POST /api/v1/identifications/{id}/correct` body `{manualCorrection}`. Stores `manual_correction`. Species resolution: `SELECT id FROM species WHERE LOWER(name) = LOWER($correction) OR LOWER(scientific_name) = LOWER($correction) LIMIT 1`. No match → `species_id = null`, flag in Sentry.
- **D-20:** Two history surfaces. (a) Per-plant: `/catalog/{plantId}/identifications`. (b) Global: `/identify/history`. Both use same `GET /api/v1/identifications` endpoint with optional `?plantId=` filter.
- **D-21:** `GET /api/v1/identifications` cursor-paginated, user-scoped. Response `{items, nextCursor?, total_count?}`. Page size 20. Cursor encodes `{created_at, id}` desc. Photo thumbnails 24h signed URLs.
- **D-22:** Re-associate link (IDENT-08): for history items where `plantId` is null and `status='success'`, show "Associar à planta" CTA → opens result-selection sheet pre-loaded.
- **D-23:** Operator alert Resend email when provider counter reaches 80% of daily ceiling (COST-04). After each successful UPSERT, check `estimated_cost_cents / daily_cost_cap_cents >= alert_threshold_pct / 100` AND `last_alerted_at < UTC_today`. Threshold crossed → emit `provider.ceiling_reached` Inngest event. New Inngest function `identification/notify-ceiling` consumes it → Resend operator email. Add `last_alerted_at DATE` column to `provider_budgets`. Debounce one alert per UTC day per provider per purpose.
- **D-24:** Offline identification blocked with clear message (IDENT-20). `useOnlineStatus()` check. Capture guide remains visible. Identify CTA hidden. No queue.
- **D-25:** Read-only paywall modal (IDENT-21). `useSubscription()` check. When `readOnly: true`, identify CTA opens Radix Dialog (NOT bottom sheet) with copy "Reative sua assinatura..." + "Ver assinatura" CTA → `/settings/subscription`.
- **D-26:** PostHog events: `identification_started` (server-side, on row create — `{provider, photo_count}`), `identification_completed` (`{provider, model, status, failure_reason?, result_count, latency_ms, above_threshold}`), `identification_consent_granted` (`{source: 'identify_screen'}`), `plant_added` already wired.

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

### Deferred Ideas (OUT OF SCOPE)

- Care guide rendering after identification — Phase 7
- Toxicity badge on identification results page — Phase 7
- Re-identification from plant profile — post-MVP backlog
- Batch identification / multi-plant session — post-MVP
- Species search / browse without a photo — Phase 7 or post-MVP
- Provider cost analytics dashboard — Phase 13

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| IDENT-01 | Authed/consented user → ≤3 results above min_confidence; persists Identification; emits `identification.succeeded` | Plant.id `result.classification.suggestions[].probability` shape verified; OpenAI structured outputs via `zodResponseFormat` verified; `identification.succeeded` event already defined in `src/contexts/identification/domain/events.ts` (lines 18–27) |
| IDENT-02 | First identification without consent → LGPD modal disclosing Plant.id + OpenAI-compat | UI flow specified in 06-UI-SPEC.md state 2; consent persistence pattern from existing `consent-logs.ts` repository |
| IDENT-03 | Consent revoked or never granted → `consent_required` 403; no provider call | `ErrorCode.ConsentRequired` already in registry (`src/shared/config/errors.ts:11`, HTTP 403) |
| IDENT-04 | Backend filters below `ProviderBudget.min_confidence` (seed 0.30); max 3 results | `providerBudgets.minConfidence` numeric(3,2) column already exists (`schema.ts:104`); router post-filter step |
| IDENT-05 | Zero results above threshold → "could not identify" + retake; row persisted with raw results | `Identification.results jsonb NOT NULL` (`schema.ts:48`); UI state 8 (zero-results) |
| IDENT-06 | User selects + confirms → Plant created linked to Species, name pre-filled, `Identification.plant_id` FK set | `createPlant(tx, {source:'identification', speciesId, ...})` already implemented in `src/contexts/catalog/application/create-plant.ts:296-315` (outer-tx path) |
| IDENT-07 | Manual correction stored in `manual_correction`; Species resolved by name match else null + flagged | `manualCorrection: text` column already exists (`schema.ts:50`); D-19 case-insensitive name resolution |
| IDENT-08 | History lists success + timeout + provider_unavailable with status + failure_reason; re-associate link | Schema supports both columns; cursor pagination pattern from `consent-logs.ts:32-74` (`{createdAt, id}` cursor) |
| IDENT-09 | Trial over daily (5) or period (75) cap → `cap_hit` 429 with reset time | `identificationLimits` seed: tier='trial' dailyCap=5 periodCap=75; `ErrorCode.CapHit` 429 already in registry |
| IDENT-10 | Active over daily (15) or period (200) cap → `cap_hit` 429 | `identificationLimits` seed: tier='paid' dailyCap=15 periodCap=200 |
| IDENT-11 | Primary at cost ceiling, fallback available → router skips primary, dispatches fallback | D-03 router execution order step 2 |
| IDENT-12 | All providers exhausted → `provider_unavailable` 503; row persisted `status=failed` with internal failure_reason | `ErrorCode.ProviderUnavailable` 503; failure reasons from event payload type (`events.ts:29-34`) |
| IDENT-13 | Provider timeout → `timeout` 504; row persisted `failure_reason=timeout` | `ErrorCode.Timeout` 504; AbortController wraps fetch (D-15) |
| IDENT-14 | Navigate away mid-request → completes server-side, row persisted; no in-flight UI restored | Server completes regardless of client disconnect (Vercel function lifecycle) |
| IDENT-15 | Malformed/empty provider response → `failure_reason=invalid_response`, breaker counter increments, fallover | Zod parse on provider response; D-08 breaker increment trigger |
| IDENT-16 | EXIF GPS photos rejected as `validation_failed`; client strip primary defense | `rejectGpsMetadata` already implemented in `src/shared/images/server-validate.ts:45-66`; client uses `exifr.gps()` then re-encodes via `browser-image-compression` |
| IDENT-17 | Accepts 1..N photos with static capture guide visible | `<input multiple>` per D-14; capture guide per D-13 |
| IDENT-18 | Vercel function budget total 50s, per-call 30s, fallover requires ≥10s remaining | `export const maxDuration = 60` in route handler; AbortController per provider call; router timing math (D-03) |
| IDENT-19 | `IdentificationProvider` adapter interface; backend chooses active provider; prompts/config versioned with deploy | D-01/D-02 — env-keyed providers; constants module not DB |
| IDENT-20 | Offline blocked with clear message | `useOnlineStatus()` already imported in placeholder (`_identify-placeholder.tsx:6`); existing pattern |
| IDENT-21 | Read-only mode shows paywall modal on identify attempt | `useSubscription()` stub from Phase 5; Radix Dialog from existing `@radix-ui/react-dialog` 1.1.15 |
| COST-01 | trial: 5/day + 75/period; window = trial_start..trial_end | `identificationLimits` seed (Phase 2) |
| COST-02 | paid: 15/day + 200/period; window = current_period_start..current_period_end | `identificationLimits` seed (Phase 2) |
| COST-03 | Cap check BEFORE counter increment; over-cap requests never reach a provider | Use-case execution order step 4 (D-04, D-06) |
| COST-04 | 80% of `daily_cost_cap_cents` → operator alert via Resend | D-23 — `last_alerted_at DATE` debounce + Inngest `notifyCeiling` |
| COST-05 | At ceiling → provider unavailable rest of UTC day; router skips; fallover engaged | D-03 step 2 |
| COST-06 | Per-provider ceilings keyed `(provider, purpose)`; care_guide budget independent | `provider_budgets` UNIQUE INDEX `(provider, purpose)` already exists (`schema.ts:112`) |
| COST-07 | Only `provider_unavailable` surfaces; internal reasons persisted but never returned | `errorResponse()` already maps `cost_ceiling_reached` + `breaker_open` → `provider_unavailable` (`errors.ts:69`) |
| COST-08 | Circuit breaker per provider: opens after N failures, half-open after cooldown, close on success | D-07/D-08 — new `provider_circuit_breakers` table |
| COST-09 | Two concurrent same-provider requests → atomic counter increments, no lost writes | D-05 advisory lock + D-06 ON CONFLICT UPSERT |
| COST-10 | Operator updates to `IdentificationLimit` or `ProviderBudget` take effect on next request past TTL; no redeploy | 30s in-memory TTL cache (D-04) |
| LGPD-09 | Successful identification captures `consent_version` of policy active at request time | D-11 — read `policy_versions.version` (string) at request time, store in `Identification.consentVersion` varchar(32) |
| UI-06 | Identify screen — picker, capture guide, loading, results, no-results, cap-hit, provider-unavailable, offline, read-only paywall, consent modal | 06-UI-SPEC.md state machine (13 states) — composed primitives ConfidenceLadder, CaptureGuide, PhotoStrip, IdentificationResultCard, AiProvenanceChip, CapHitChip |
| UI-12 | Identification history screen with thumbnails, results, status; detail with re-associate | 06-UI-SPEC.md `/identify/history` + `/catalog/{plantId}/identifications`; `IdentificationHistoryItem` primitive |
| UI-15 | Confidence ladder: 3 states with redundant signals (bar, segments, percentage, SR label) | 06-UI-SPEC.md `ConfidenceLadder` primitive — 4 redundant cues spec |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

These directives MUST be honored by every plan in this phase:

| Constraint | Source | Implication for Phase 6 |
|---|---|---|
| Next.js 16 App Router + React 19 + TS strict | Tech stack | Route handlers under `/api/v1`; client components in `(app)/identify/*` |
| Drizzle ORM inside repositories ONLY | Tech stack | NO Drizzle in `route.ts` — handlers call use-cases that call repositories |
| `postgres-js` driver with `{prepare: false}` | Tech stack | All DB clients already share this; new repositories inherit |
| Inngest for ALL async work; no raw cron, no BullMQ | Tech stack | Operator ceiling alert = `notifyCeiling` Inngest function (event-triggered, NOT cron); D-23 debounce via `last_alerted_at DATE` column, NOT `step.sleepUntil` |
| Vercel deploys via GitHub Actions ONLY | Tech stack | No code change in Phase 6, but `IDENTIFICATION_PROVIDER_MODE` env var must be wired in `.env.example`/Vercel/CI |
| pt-BR only at launch | Locale | All copy via `next-intl`; `messages/pt-BR.json` extends `identify.*` namespace per UI-SPEC §Copywriting Contract |
| Mobile-first PWA, tablet-width centered | Platform | All identify states fit single-column mobile layout; bottom-nav present in 11/13 states |
| WCAG 2.1 AA = ship blocker | Accessibility | ConfidenceLadder uses 4 redundant cues; LGPD modal `role="alertdialog"`; per UI-SPEC §Verification Gates axe coverage |
| LGPD Art. 33 consent before first upload | Compliance | D-09/D-10 backend check before any provider dispatch |
| Vercel function budget 50s total, 30s per call, ≥10s for fallover | Performance | `export const maxDuration = 60` (Vercel default 10s on Hobby; needs Pro tier); router threads `requestStartMs` through dispatch chain |
| Images compressed client ≤1MB + EXIF/GPS strip | Performance | `browser-image-compression` 2.0.2 + `exifr` 7.1.3 — both already in package.json |
| Per-provider $5/day cost ceiling enforced atomically | Budget | `providerBudgets.dailyCostCapCents=500` seed; UPSERT `provider_usage_counters` after success |
| 80% threshold → Resend operator email; debounced once per UTC day | Budget | D-23 — `last_alerted_at DATE` column + Inngest `notifyCeiling` |
| Trial: 5/day + 75/period; paid: 15/day + 200/period | Budget | `identificationLimits` seed (Phase 2 already done) |
| Closed error registry — no ad-hoc codes | Error codes | `cost_ceiling_reached` + `breaker_open` are INTERNAL_ONLY; `errorResponse()` automatically maps to `provider_unavailable` 503 (`errors.ts:27-30, 69`) |
| Sentry: `Sentry.setUser({id})` ONLY — never email; PII scrubbed | Observability | Phase 1 D-22 already scrubs `photo_url` + drops request bodies on `/api/v1/identifications/*` — Phase 6 MUST preserve |
| PostHog server-side via `posthog-node` for Inngest events | Observability | All Phase 6 PostHog events fire server-side — no client-side identification PostHog |
| Timestamps ISO-8601 UTC with `Z` | Data | `provider_usage_counters.utc_date` is `DATE` (UTC day boundary); `last_alerted_at DATE` (compares against `CURRENT_DATE`) |
| Per-IP throttle ONLY on public auth endpoints — `rate_limited` is the ONLY 429 reserved for that | Security | `cap_hit` 429 is per-user — different code, different semantics; do NOT confuse |
| RLS on all user-owned tables; service-role server-side only | Security | `identifications` already has `identifications_owner_all` policy (migration `0001_phase_02_rls_policies.sql:230-231`); new `provider_circuit_breakers` table = NO RLS (operator/service-role only, like `provider_usage_counters` per Phase 2 plan); `withUnitOfWork` sets `SET LOCAL ROLE authenticated` |

---

## Summary

Phase 6 is the most complex MVP phase: it ships the entire AI identification pipeline including a two-provider router with circuit breaker, atomic cost accounting under concurrent load, LGPD consent gating, multi-photo PWA capture, confidence-ladder UX, identification history, and the operator-alert pipeline. The phase consumes Plant.id v3 (primary, classical CV — returns calibrated `probability`) with OpenAI-compatible vision (fallback, vision LLM — needs structured-output JSON Schema enforcement to keep response shape stable).

The single biggest correctness risk is the cost ceiling: a runaway provider call rate must not blow $5/day. Defense in depth = (1) advisory lock per user before any provider dispatch (D-05), (2) cap-check + ceiling-check BEFORE provider call, never after (D-03/D-06), (3) atomic UPSERT on `provider_usage_counters` AFTER successful call (D-06), (4) circuit breaker tracking consecutive failures (D-07/D-08), (5) 80% alert via debounced Inngest event (D-23). All five layers are required; missing any one creates a real-money runaway risk.

**Primary recommendation:** Build the router (D-03) as a stateless function that takes `requestStartMs: number` from the route handler and threads remaining budget through every provider dispatch via `AbortController` with a per-call timeout = `min(30s, budgetRemaining - 2s overhead)`. The router does not own time; the route handler does. This makes the router unit-testable with a fake clock.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Photo capture (camera/gallery file picker) | Browser/Client | — | `<input type="file" capture="environment">` is browser-native; cannot be server |
| Client-side image compression + EXIF/GPS strip | Browser/Client | — | `browser-image-compression` + `exifr` run in WebWorker / main thread; reduces upload bandwidth and protects user GPS before transit |
| Multi-photo upload (multipart) | Browser/Client → API | — | Browser uploads `FormData`; API parses via `request.formData()` (existing pattern in `plants/route.ts:55-61`) |
| LGPD consent capture | Frontend Server (Next.js client) → API | DB (consent_logs) | Modal renders client-side; on accept, POST to `/api/v1/iam/consents` (server-only inserts ConsentLog row) |
| Provider HTTP dispatch (Plant.id, OpenAI-compat) | API/Backend | — | Provider API keys are server-only; provider calls require Node `fetch` with timeout via `AbortController` |
| Cost ceiling enforcement | API/Backend | DB | Atomic UPSERT on `provider_usage_counters` is the source of truth |
| Circuit breaker state | API/Backend | DB | `provider_circuit_breakers` table read at each dispatch |
| Per-user advisory lock | DB | API | `pg_try_advisory_xact_lock` is a pure-DB primitive; called from inside the use-case TX |
| Identification history list | API/Backend | Browser/Client | Cursor-paginated GET; client renders with TanStack Query |
| Result selection → Plant create | API/Backend (single TX) | Browser/Client | `createPlant(tx, {source:'identification'})` + UPDATE identifications in one `withUnitOfWork` |
| Operator ceiling alert | Inngest function | Resend (external) | `notifyCeiling` consumes `provider.ceiling_reached` event → Resend; lives in `src/contexts/identification/inngest/functions.ts` |
| `identification.succeeded` → care-guide trigger | Inngest event bus | Phase 7 (handler) | Phase 6 emits; Phase 7 implements `care-guide/augment` handler |
| Service worker handling of `/api/v1/identifications/*` | Browser SW | — | Already routed to NetworkOnly via existing Serwist registerCapture pattern (`src/app/sw.ts:109`); no Phase 6 SW change needed |

---

## Standard Stack

### Core (already in package.json — versions verified `npm view` 2026-05-04)

| Library | Installed | Latest | Purpose | Why Standard |
|---|---|---|---|---|
| `inngest` | ^4.2.4 | (verify w/ `npm view`) | Event-driven `notifyCeiling` function consuming `provider.ceiling_reached` | Project-locked durable execution platform; event-driven pattern is built-in via `triggers: [{event: ...}]` [VERIFIED: Context7 /inngest/inngest-js] |
| `@radix-ui/react-dialog` | 1.1.15 | 1.1.15 | Read-only paywall modal (D-25 — Radix Dialog NOT bottom sheet) | Already used by Phase 5 Lightbox; preserves consistent dismissibility semantics; current latest version [VERIFIED: npm registry] |
| `@sentry/nextjs` | 10.48.0 | 10.51.0 | Error capture; `Sentry.setUser({id})` only | Project-locked; minor version drift OK; PII scrubbing already configured for `/api/v1/identifications/*` [VERIFIED: npm registry] |
| `posthog-node` | 5.29.7 | 5.33.0 | Server-side PostHog capture for `identification_started`/`_completed`/`_consent_granted` | Project-locked server-side capture pattern; minor drift OK [VERIFIED: npm registry] |
| `resend` | ^6.12.2 | 6.12.2 | Operator ceiling alert email (D-23) | Already integrated in `notifications/send-email`; reuse the same Inngest function pattern [VERIFIED: npm registry] |
| `exifr` | 7.1.3 | 7.1.3 | Server-side `rejectGpsMetadata` (already implemented); client-side `exifr.gps()` GPS detection before re-encode | Project pinned; current latest [VERIFIED: npm registry; CITED: Context7 /mikekovarik/exifr] |
| `browser-image-compression` | 2.0.2 | 2.0.2 | Client-side compression to ≤1MB + EXIF strip on re-encode | Already in package.json; re-encoding to JPEG/WebP automatically strips most EXIF including GPS — combined with `exifr.gps()` pre-check yields defense in depth [VERIFIED: npm registry] |
| `motion` | 12.38.0 | 12.38.0 | Confidence-ladder bar fill animation; result card 60ms cascade reveal (per UI-SPEC) | Phase 3 motion contract; current latest [VERIFIED: npm registry] |
| `sonner` | 2.0.7 | 2.0.7 | Toast for failure cases (e.g., result-sheet submit failure per UI-SPEC) | Phase 3 toast primitive; current latest [VERIFIED: npm registry] |

### New Dependencies (NONE required for Phase 6)

All required libraries are already in `package.json`. Phase 6 uses Node's native `fetch` (Node 22) with `AbortController` for provider calls — no HTTP client library needed.

### External APIs (server-side only)

| Provider | Purpose | Endpoint | Auth | Confidence field |
|---|---|---|---|---|
| Plant.id v3 (Kindwise) | Primary identification | `POST https://api.plant.id/v3/identification` | Header `Api-Key: <key>` | `result.classification.suggestions[].probability` (float 0–1) [CITED: github.com/flowerchecker/Plant-id-API README] |
| OpenAI-compatible vision | Fallback identification | `POST {OPENAI_BASE_URL}/v1/chat/completions` (model TBD per Claude's discretion — recommended `gpt-4o-2024-08-06` or newer for `response_format: json_schema` strict mode) | Header `Authorization: Bearer <key>` | Synthesized confidence from JSON schema field `confidence: number` (0–1) — see Risks below: vision LLMs are NOT calibrated [CITED: Context7 /openai/openai-node `Structured Outputs with Zod`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `AbortController` for 48s timeout | `Promise.race([providerCall, timeoutPromise])` | `AbortController` actually cancels the underlying fetch (releases socket); `Promise.race` leaks the in-flight request. Recommend `AbortController` per CLAUDE's discretion D-discretion list |
| Plant.id v3 endpoint | Plant.id v2 | v3 is current Kindwise API; v2 is deprecated. v3 supports multi-image, better confidence scoring [CITED: kindwise.com] |
| Vision model (OpenAI-compat fallback) | Claude Sonnet 4.6 / GPT-4o / open-source vLLM | `response_format: { type: "json_schema", json_schema: {strict: true, ...} }` is a feature of OpenAI Chat Completions API; OpenAI-COMPATIBLE servers (Anthropic via Vercel AI Gateway, vLLM, OpenRouter) inconsistently support strict-mode. **Recommendation:** seed with `gpt-4o-2024-08-06` (verified strict-mode support); document the model in env config so swap is one-line. [CITED: Context7 /openai/openai-node] |

**Installation:** No new dependencies required. Verify versions match installed:
```bash
pnpm install --frozen-lockfile
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ BROWSER (PWA) — /identify route, single-page state machine         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  idle → picking → photos-selected → uploading → identifying│   │
│  │                                            ↓                │   │
│  │   [results | zero_results | cap-hit | provider-unavailable]│   │
│  └────────────────────────────────────────────────────────────┘   │
│  Photo pipeline: file picker → exifr.gps() pre-check →             │
│  browser-image-compression (≤1MB, re-encode strips EXIF) →         │
│  multipart FormData                                                 │
└────────────────────────┬─────────────────────────────────────────┘
                         │ multipart POST + Idempotency-Key
                         │ (Service Worker: NetworkOnly per existing Serwist config)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ NEXT.JS API ROUTE — /api/v1/identifications POST                  │
│  export const runtime = "nodejs"                                   │
│  export const maxDuration = 60  // requires Vercel Pro             │
│  ① requireVerifiedUser() → must be verified+consented (LGPD gate) │
│  ② parse multipart, run rejectOversizeBuffer + rejectGpsMetadata   │
│     on EACH photo (defense in depth — IDENT-16)                    │
│  ③ withIdempotency wrap (Idempotency-Key required)                 │
│  ④ identify() use-case call                                        │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ USE-CASE: identify(input, deps) — withUnitOfWork(userId, async tx)│
│  Step 0: ConsentLog check → consent_required 403 if missing       │
│  Step 1: pg_try_advisory_xact_lock(hashtext(userId)) — if locked  │
│          → cap_hit 429                                             │
│  Step 2: cap COUNT vs IdentificationLimit (cached 30s) →          │
│          cap_hit 429 if at/over                                    │
│  Step 3: resolve current policy_version.version (cached 30s)      │
│  Step 4: identificationRouter.dispatch({                          │
│            photos, userId, requestStartMs })                       │
│  Step 5: INSERT identifications row (status, results, etc.)       │
│  Step 6: post-commit (outside TX): atomic UPSERT on               │
│          provider_usage_counters; if crosses 80% AND              │
│          last_alerted_at < CURRENT_DATE → Inngest send             │
│          provider.ceiling_reached + UPDATE last_alerted_at         │
│  Step 7: PostHog identification_completed; return result          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ ROUTER: identificationRouter.dispatch()                           │
│  for each provider in [primary, fallback]:                         │
│    ① breaker.read(provider) — open? skip                           │
│    ② budget.read(provider, 'identification') — at ceiling? skip    │
│    ③ remaining = 50000 - (Date.now() - requestStartMs)             │
│       if remaining < 10000 (10s) → break, return provider_unavailable│
│    ④ timeoutMs = min(30000, remaining - 2000)                     │
│       call provider.identify(...) with AbortController             │
│    ⑤ on success: filter results below min_confidence; return      │
│    ⑥ on failure: breaker.recordFailure(provider); continue        │
│  if loop exhausted: return {ok:false, code:'provider_unavailable',│
│    failureReason: <most-specific-internal-reason>}                 │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼ (event after TX commit)
┌──────────────────────────────────────────────────────────────────┐
│ INNGEST                                                            │
│  identification/notify-ceiling (NEW Phase 6 — D-23)                │
│    triggers: [{event: "provider.ceiling_reached"}]                 │
│    step.run("send-resend-email", ...)                             │
│  care-guide/augment (Phase 7 — Phase 6 emits trigger event only)  │
│    triggers: [{event: "identification.succeeded"}]                 │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/contexts/identification/
├── domain/
│   ├── events.ts              # EXISTS — event names + payload types
│   ├── schemas.ts             # EXISTS — drizzle-zod scaffolding
│   └── provider.ts            # NEW — IdentificationProvider interface
├── application/
│   ├── identify.ts            # NEW — main use-case
│   ├── confirm-identification.ts  # NEW — D-18
│   ├── correct-identification.ts  # NEW — D-19
│   ├── list-identifications.ts    # NEW — D-21
│   └── identification-router.ts   # NEW — D-03
├── infrastructure/
│   ├── db/
│   │   ├── schema.ts                      # EXISTS — extend with cost_per_request_cents + last_alerted_at + circuit_breakers
│   │   ├── identifications.ts             # NEW — repository
│   │   ├── provider-budgets.ts            # NEW — repository
│   │   ├── provider-usage-counters.ts     # NEW — atomicUpsert
│   │   ├── circuit-breakers.ts            # NEW — repository
│   │   └── identification-limits.ts       # NEW — TTL-cached repository
│   └── providers/
│       ├── plant-id-provider.ts          # NEW
│       ├── openai-compat-provider.ts     # NEW
│       └── stub-provider.ts              # NEW — IDENTIFICATION_PROVIDER_MODE=stub
├── api/
│   └── snake-case.ts            # NEW — IdentificationHistoryItem snake_case shaper
├── inngest/
│   └── functions.ts             # EXISTS — replace [] with [notifyCeiling]
└── queries/
    └── index.ts                 # NEW — identificationKeys.* TanStack factory

src/app/api/v1/
├── identifications/
│   ├── route.ts                                # NEW — POST + GET
│   ├── [identificationId]/confirm/route.ts     # NEW — POST D-18
│   └── [identificationId]/correct/route.ts     # NEW — POST D-19
└── iam/consents/route.ts                       # NEW — POST D-10

src/app/(app)/identify/
├── page.tsx                          # REPLACE placeholder
├── _identify-placeholder.tsx         # DELETE
├── _identify-flow.tsx                # NEW — state machine client component
├── _capture-guide.tsx                # NEW
├── _photo-strip.tsx                  # NEW
├── _result-card.tsx                  # NEW
├── _result-sheet.tsx                 # NEW
├── _consent-modal.tsx                # NEW
├── _paywall-dialog.tsx               # NEW (Radix Dialog)
└── history/page.tsx                  # NEW — global history

src/app/(app)/catalog/[plantId]/
└── identifications/page.tsx          # NEW — per-plant history

src/shared/ui/
├── confidence-ladder.tsx             # NEW
├── ai-provenance-chip.tsx            # NEW
├── cap-hit-chip.tsx                  # NEW
└── identification-history-item.tsx   # NEW
```

### Pattern 1: Provider adapter interface (D-01)

**What:** Stateless TypeScript interface with one method, returning a closed-shape result.
**When to use:** Every concrete provider implements it; router only knows the interface.
**Example:**
```typescript
// src/contexts/identification/domain/provider.ts
export interface IdentificationProviderResult {
  results: Array<{
    speciesName: string;
    scientificName: string;
    confidence: number;        // 0..1, normalized
    providerSpeciesId: string; // provider's internal id (Plant.id name, OpenAI generated)
  }>;
  provider: string;            // 'plant_id' | 'openai_compat' | 'stub'
  model: string;               // e.g. 'plantnet-v3' | 'gpt-4o-2024-08-06'
  latencyMs: number;
}

export interface IdentificationProvider {
  readonly name: string;
  readonly model: string;
  identify(input: {
    photos: ReadonlyArray<{ buffer: Buffer; contentType: string }>;
    userId: string;
    signal: AbortSignal;        // for timeout enforcement
  }): Promise<IdentificationProviderResult>;
}
```

### Pattern 2: Plant.id v3 provider implementation

**What:** Adapter that calls Plant.id v3, normalizes confidence, maps errors.
**When:** Primary provider in router execution order.
**Example:**
```typescript
// src/contexts/identification/infrastructure/providers/plant-id-provider.ts
// Source: github.com/flowerchecker/Plant-id-API README [CITED]
const PLANT_ID_ENDPOINT = "https://api.plant.id/v3/identification";

export function createPlantIdProvider(apiKey: string): IdentificationProvider {
  return {
    name: "plant_id",
    model: "plantnet-v3",
    async identify({ photos, signal }) {
      const start = Date.now();
      // Plant.id v3: array of base64 strings, no data: URI prefix.
      const images = photos.map((p) => p.buffer.toString("base64"));
      const response = await fetch(
        `${PLANT_ID_ENDPOINT}?details=common_names`,
        {
          method: "POST",
          headers: {
            "Api-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ images }),
          signal,  // AbortController-driven timeout
        }
      );
      if (!response.ok) {
        throw new Error(`plant_id ${response.status}`);
      }
      const json = await response.json();
      // Validate via Zod — IDENT-15 invalid_response trigger
      const parsed = plantIdResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new InvalidProviderResponseError("plant_id schema mismatch");
      }
      const suggestions = parsed.data.result.classification.suggestions;
      return {
        results: suggestions.slice(0, 3).map((s) => ({
          speciesName: s.details?.common_names?.[0] ?? s.name,
          scientificName: s.name,
          confidence: s.probability,  // already 0..1
          providerSpeciesId: s.name,
        })),
        provider: "plant_id",
        model: "plantnet-v3",
        latencyMs: Date.now() - start,
      };
    },
  };
}
```

### Pattern 3: OpenAI-compat provider with structured outputs

**What:** Adapter calling Chat Completions with JSON Schema strict-mode for type-safe parse.
**When:** Fallback after primary fails or breaker is open.
**Example:**
```typescript
// src/contexts/identification/infrastructure/providers/openai-compat-provider.ts
// Source: Context7 /openai/openai-node "Structured Outputs with Zod" [CITED]
import { z } from "zod";

const VisionResponseSchema = z.object({
  results: z.array(z.object({
    speciesName: z.string(),
    scientificName: z.string(),
    confidence: z.number().min(0).max(1),
  })).max(3),
});

const SYSTEM_PROMPT =
  "Você é um botânico identificando plantas. Retorne até 3 espécies candidatas " +
  "em ordem decrescente de confiança. NUNCA invente nomes — se não souber, " +
  "retorne array vazio. Confiança é sua estimativa subjetiva 0..1; calibre " +
  "conservadoramente — vision LLMs tendem a superconfiar.";

export function createOpenAICompatProvider(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;  // recommended seed: 'gpt-4o-2024-08-06'
}): IdentificationProvider {
  return {
    name: "openai_compat",
    model: opts.model,
    async identify({ photos, signal }) {
      const start = Date.now();
      const imageContent = photos.map((p) => ({
        type: "image_url" as const,
        image_url: { url: `data:${p.contentType};base64,${p.buffer.toString("base64")}` },
      }));
      const response = await fetch(`${opts.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: [
              { type: "text", text: "Identifique:" },
              ...imageContent,
            ]},
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "vision_identification",
              strict: true,
              schema: zodToJsonSchema(VisionResponseSchema),
            },
          },
        }),
        signal,
      });
      if (!response.ok) throw new Error(`openai_compat ${response.status}`);
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new InvalidProviderResponseError("openai_compat empty content");
      }
      const parsed = VisionResponseSchema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        throw new InvalidProviderResponseError("openai_compat schema mismatch");
      }
      return {
        results: parsed.data.results.map((r) => ({
          speciesName: r.speciesName,
          scientificName: r.scientificName,
          confidence: r.confidence,
          providerSpeciesId: r.scientificName,
        })),
        provider: "openai_compat",
        model: opts.model,
        latencyMs: Date.now() - start,
      };
    },
  };
}
```

### Pattern 4: Per-user advisory lock (D-05, COST-09)

**What:** Two-arg `pg_try_advisory_xact_lock(namespace_int, hashtext(user_id))`. Two-arg form isolates the namespace from any future use of advisory locks elsewhere in the codebase.
**When:** First step inside the identification use-case TX, before cap check.
**Example:**
```typescript
// src/contexts/identification/application/identify.ts
import { sql } from "drizzle-orm";

const IDENT_LOCK_NAMESPACE = 6_000_000_06;  // arbitrary 32-bit int — Phase 6 owner

await withUnitOfWork(userId, async (tx) => {
  // hashtext returns int4; two-arg form gives namespaced key
  const lockResult = await tx.execute<{ pg_try_advisory_xact_lock: boolean }>(
    sql`SELECT pg_try_advisory_xact_lock(${IDENT_LOCK_NAMESPACE}, hashtext(${userId})) AS pg_try_advisory_xact_lock`
  );
  const acquired = lockResult[0]?.pg_try_advisory_xact_lock === true;
  if (!acquired) {
    return { ok: false, code: ErrorCode.CapHit, reason: "concurrent identification rejected" };
  }
  // ... cap check + provider dispatch ...
});
// Lock auto-released on TX commit/rollback (xact variant)
```

### Pattern 5: Atomic counter UPSERT (D-06, COST-09)

**What:** `INSERT ... ON CONFLICT ... DO UPDATE` increments counter atomically without a SELECT-then-UPDATE race.
**When:** AFTER provider returns success, AFTER `Identification` row inserted, BEFORE checking 80% threshold.
**Example:**
```typescript
// src/contexts/identification/infrastructure/db/provider-usage-counters.ts
export async function atomicUpsertAndCheck(
  db: DbClient,
  input: {
    provider: string;
    purpose: "identification" | "care_guide";
    utcDate: string;          // 'YYYY-MM-DD'
    costCents: number;
  }
): Promise<{ newTotalCents: number; requestCount: number }> {
  const rows = await db.execute<{ estimated_cost_cents: number; request_count: number }>(sql`
    INSERT INTO provider_usage_counters (provider, purpose, utc_date, request_count, estimated_cost_cents, last_updated)
    VALUES (${input.provider}, ${input.purpose}, ${input.utcDate}, 1, ${input.costCents}, NOW())
    ON CONFLICT (provider, purpose, utc_date) DO UPDATE
      SET estimated_cost_cents = provider_usage_counters.estimated_cost_cents + EXCLUDED.estimated_cost_cents,
          request_count = provider_usage_counters.request_count + 1,
          last_updated = NOW()
    RETURNING estimated_cost_cents, request_count
  `);
  if (!rows[0]) throw new Error("upsert returned no row");
  return {
    newTotalCents: rows[0].estimated_cost_cents,
    requestCount: rows[0].request_count,
  };
}
```

### Pattern 6: Inngest event-triggered ceiling alert (D-23)

**What:** Inngest function consuming `provider.ceiling_reached`, dispatching Resend email. NOT cron-driven; NOT `step.sleepUntil`-debounced — debouncing is via the `last_alerted_at DATE` column at the EMITTER side.
**When:** New function added to `identificationFunctions` array; registry already imports.
**Example:**
```typescript
// src/contexts/identification/inngest/functions.ts
// Source: Context7 /inngest/inngest-js "Define Inngest Functions" [CITED]
import { inngest } from "@shared/inngest/client";
import { Resend } from "resend";

const notifyCeiling = inngest.createFunction(
  { id: "identification-notify-ceiling" },
  { event: "provider.ceiling_reached" },
  async ({ event, step }) => {
    const { provider, purpose, utcDate, estimatedCostCents, capCents } = event.data;
    await step.run("send-operator-email", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      await resend.emails.send({
        from: "alerts@folhar.io",
        to: process.env.OPERATOR_ALERT_EMAIL!,
        subject: `[Folhário] ${provider} ${purpose} at 80%+ daily ceiling — ${utcDate}`,
        html: `<p>Provider <strong>${provider}</strong> (${purpose}) reached ` +
              `${(estimatedCostCents / capCents * 100).toFixed(1)}% of daily ceiling on ${utcDate}.</p>` +
              `<p>${estimatedCostCents}/${capCents} cents.</p>`,
      });
    });
  }
);

export const identificationFunctions = [notifyCeiling];
```

### Anti-Patterns to Avoid

- **NEVER call `provider.identify()` outside an `AbortController` chain.** A hung fetch holds the Vercel function open until `maxDuration`, billing the full envelope. Use `AbortController` with the per-call timeout.
- **NEVER read `provider_circuit_breakers` from a TTL cache.** D-08 explicitly: read fresh at each dispatch. Cache would mask a flapping breaker.
- **NEVER increment `provider_usage_counters` BEFORE the provider call.** That's the cap-vs-counter inversion bug — over-cap requests must never affect cost accounting.
- **NEVER store `policy_version_id` (UUID) in `Identification.consentVersion`.** D-11 stores `policy_versions.version` STRING (`"1.0"`). Schema is `varchar(32)`.
- **NEVER use one-arg `pg_try_advisory_xact_lock(hashtext(user_id))` long-term.** A future caller using `hashtext` for a different domain could collide. Use the two-arg form `(namespace_int, key_int)` from Phase 6 onward.
- **NEVER expose `cost_ceiling_reached` or `breaker_open` in the response body.** `errorResponse()` in `errors.ts:69` automatically maps them to `provider_unavailable`. Trust the helper; don't construct response shapes manually.
- **NEVER fire `Sentry.setUser({ email })`.** CLAUDE.md banned. `{ id }` only. PII scrubbing on `/api/v1/identifications/*` is already configured (Phase 1 D-22) — preserve.
- **NEVER add a retry button on the cap-hit state.** AC-ID-009 explicit ban. Manual entry text link only.
- **NEVER show provider names to end users in production.** History UI gates provider tag on dev/staging only (06-UI-SPEC.md `IdentificationHistoryItem` provider tag).
- **NEVER use raw `fetch()` from a route handler without `runtime = "nodejs"`.** Edge runtime would ban `Buffer` (used for photo upload). Match the existing `src/app/api/v1/plants/route.ts:22` pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Per-user request serialization | Redis lock / in-process mutex / table-lock pattern | `pg_try_advisory_xact_lock(namespace, hashtext(user_id))` (D-05) | TX-scoped advisory locks auto-release on commit/rollback. No external service. No deadlock window. Built into Postgres. |
| Atomic cost counter increment | SELECT-then-UPDATE / CTE with FOR UPDATE | `INSERT ... ON CONFLICT ... DO UPDATE SET counter = counter + EXCLUDED.counter` (D-06) | Postgres handles concurrent UPSERT atomically; SELECT-then-UPDATE has a TOCTOU window even inside a TX without explicit FOR UPDATE. |
| Idempotency on POST mutations | Custom dedup table | `withIdempotency` from `src/shared/api/idempotency.ts` (Phase 2 D-37) | Already handles claim-on-conflict, hash mismatch → 409, replay-safe semantics. Same pattern as `plants/route.ts`. |
| Image GPS strip on server | Custom EXIF parser | `exifr.gps()` already wired in `src/shared/images/server-validate.ts:45` | Defense in depth; primary strip is client-side via `browser-image-compression` re-encode. |
| Image compression in browser | Canvas-based custom resizer | `browser-image-compression` 2.0.2 (already installed) | Handles HEIC, EXIF orientation, target size, automatic re-encode (which strips EXIF). |
| Multipart parsing in route handler | Custom parser | `request.formData()` Web standard (existing pattern) | Built into Web Fetch API; same pattern as `src/app/api/v1/plants/route.ts:55-61`. |
| Cursor pagination | Offset-based / fabricated cursor encoding | `decodeSortCursor` + `{created_at, id}` opaque pattern (Phase 2 D-36) | Already implemented; same shape as `consent-logs.ts:32-74`. |
| Operator alert debounce | `step.sleepUntil(tomorrow)` durable sleep | `last_alerted_at DATE` column + `WHERE last_alerted_at < CURRENT_DATE` (D-23) | Sleep would create one durable function per provider per day = wasted Inngest steps. Date-column check is one comparison. |
| Provider response validation | Manual property checks | `zodResponseFormat` for OpenAI structured outputs + Zod schema for Plant.id response (Pattern 2/3) | Schema-mismatch is the IDENT-15 trigger; Zod gives a clean error path. |
| 24h signed URL generation | Custom Supabase signing | Phase 5 helper `getSignedUrl` (already used for plant photos) | Same 24h pattern; D-21 confirms reuse. |

**Key insight:** Phase 6 has zero new infrastructure dependencies. Every "hard" problem (concurrent counter, atomic UPSERT, advisory lock, idempotency, image validation, signed URLs) has a Postgres-native or already-installed solution. Resist the temptation to introduce Redis or a queue.

---

## Common Pitfalls

### Pitfall 1: Vercel Hobby tier `maxDuration` default

**What goes wrong:** Plan ships `export const maxDuration = 60` but deploys to Vercel Hobby (10s default). Identification times out at 10s with no clear error.
**Why it happens:** Hobby tier limits function duration to 10s regardless of `maxDuration`. Pro is required for >10s.
**How to avoid:** Phase 6 plan MUST verify Vercel Pro tier is provisioned before deploy. Document in `.planning/STATE.md` as a deployment prerequisite. The `maxDuration = 60` directive is required syntactically but only takes effect on Pro/Enterprise.
**Warning signs:** All identifications fail with timeout in production but pass in local/preview.

### Pitfall 2: `hashtext()` collision domain confusion

**What goes wrong:** Future code uses `pg_try_advisory_xact_lock(hashtext('order_processing'))` for a different domain. Identification + order-processing locks now share namespace and false-collide.
**Why it happens:** `hashtext` returns int4 (~4B values); collision risk is low for any single domain but compounds across domains.
**How to avoid:** Always use the two-arg form `pg_try_advisory_xact_lock(namespace, key)`. Phase 6 owns namespace `6_000_000_06` (mnemonic: phase-major-minor). Document this in a constants module (`src/contexts/identification/domain/locks.ts`).
**Warning signs:** Concurrent unrelated user actions occasionally serialize unexpectedly; integration tests are flaky.

### Pitfall 3: Vision LLM confidence is NOT calibrated

**What goes wrong:** OpenAI-compat returns `confidence: 0.95` for a guess that's wrong; user trusts the high-confidence-ladder green bar.
**Why it happens:** Vision LLMs aren't trained with calibrated probability outputs. Their "confidence" is a generative artifact, not a posterior.
**How to avoid:** (1) System prompt explicitly asks for conservative calibration ("vision LLMs tendem a superconfiar"); (2) `Identification` row records `provider` so post-launch analysis can adjust min_confidence per provider; (3) deferred to ID-v2-02 (LLM-aware calibration). For MVP, document in PRD § honest-AI: "We forward the model's stated confidence; we don't fabricate calibration."
**Warning signs:** Manual correction rate (D-19) higher for openai_compat than plant_id by >2x.

### Pitfall 4: Counter increment running BEFORE provider call

**What goes wrong:** Plan implements "increment counter, call provider, on failure decrement counter" — race-prone, and a crashed function leaves the counter stuck high.
**Why it happens:** Engineer reasoning that the counter "reserves" budget.
**How to avoid:** D-06 ordering is explicit: increment AFTER provider success. Cap check is by `provider_budgets.dailyCostCapCents` vs `provider_usage_counters.estimatedCostCents` BEFORE the call. Worst case: a successful call that the counter UPSERT never sees = under-counting (acceptable; bounded by failed UPSERT rate).
**Warning signs:** Counters drift higher than actual provider invoices; ceiling alerts fire while real spend is below ceiling.

### Pitfall 5: Service worker caching identification responses

**What goes wrong:** Service worker serves a stale 503 from a previous failed identification, user sees `provider_unavailable` even when network is fine.
**Why it happens:** Default Serwist cache strategies cache GETs by default; a misconfigured POST handler could create transient cache entries.
**How to avoid:** Service worker `src/app/sw.ts:109` already routes `/api/*` to `NetworkOnly`. Phase 6 plan MUST verify the new `/api/v1/identifications/*` and `/api/v1/iam/consents` paths fall under this rule (they will — `startsWith("/api/")` matches). Add Playwright assertion: after a failed identification, the next attempt must hit the network.
**Warning signs:** Users report "stuck" error states that don't recover even after waiting.

### Pitfall 6: LGPD modal triggered on consent_required loop

**What goes wrong:** User has revoked consent (LGPD-08); identify request returns `consent_required` 403; client re-shows the LGPD modal; user accepts; backend inserts new ConsentLog with `legal_basis='consent'`; flow proceeds. But the previous revocation row is still in the DB — `hasActiveConsent` query must use latest grant timestamp.
**Why it happens:** ConsentLog is append-only (audit log), so "active consent" = most recent row's grant/revocation status.
**How to avoid:** `iamConsentRepository.hasActiveConsent(userId, purpose)` query: `SELECT ... ORDER BY granted_at DESC LIMIT 1` and check the latest row's status. Phase 11 ships full revocation tracking; Phase 6 read-side is "exists a granted_at row newer than any revocation row OR no revocation row exists."
**Warning signs:** User who revoked consent still able to identify, OR user who re-granted still blocked.

### Pitfall 7: 50s wall-clock with cold-start latency

**What goes wrong:** First identification of a cold function uses 5-8s on Node startup + Drizzle init; only 42s left for two providers + 2s overhead = barely fits.
**Why it happens:** Vercel Node.js cold starts; first DB connection through Supavisor.
**How to avoid:** (1) Set `runtime = "nodejs"` (not edge — edge can't run sharp/exifr anyway); (2) keep DB client `db` as a module-level singleton (already done in `src/shared/db/client.ts`); (3) cap PRIMARY provider timeout at `min(30s, remaining - 12s)` to leave fallback budget even on cold start; (4) document in OBS-03 / OBS-04 that "first identification of cold function" is an excluded p99 metric.
**Warning signs:** p99 identification latency spikes correlate with low traffic / scheduled traffic gaps.

### Pitfall 8: `consent_version` stored as UUID instead of version string

**What goes wrong:** Plan reads `policy_versions.id` (UUID) and stores it in `Identification.consentVersion varchar(32)`. UUIDs are 36 chars → truncation OR storing as string-of-uuid loses queryability.
**Why it happens:** `policy_versions` has both `id` (UUID PK) and `version` (string like `"1.0"`).
**How to avoid:** D-11 explicit: `Identification.consentVersion = policy_versions.version` (the STRING). Repository helper: `getCurrentPolicyVersionString(documentType)` returns the string. Schema column `varchar(32)` confirms — UUIDs would not fit.
**Warning signs:** Migration succeeds but values look like UUIDs; LGPD audit query "show all identifications under privacy policy v1.0" returns nothing.

---

## Code Examples

### POST /api/v1/identifications route shape (synthesized from existing `plants/route.ts` pattern)

```typescript
// src/app/api/v1/identifications/route.ts
// Source: existing pattern from src/app/api/v1/plants/route.ts [CITED: codebase]
import * as Sentry from "@sentry/nextjs";
import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { computeMultipartRequestHash } from "@shared/api/idempotency-hash";
import { rejectGpsMetadata, rejectOversizeBuffer } from "@shared/images/server-validate";
import { identify } from "@contexts/identification/application/identify";

export const runtime = "nodejs";
export const maxDuration = 60;  // Vercel Pro required

export async function POST(request: Request): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return errorResponse(auth.code,
      auth.code === ErrorCode.EmailUnverified
        ? "Verifique seu email para continuar."
        : "Sessão inválida.");
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return errorResponse(ErrorCode.ValidationFailed, "Cabeçalho Idempotency-Key obrigatório.");
  }

  const requestStartMs = Date.now();
  const hashResult = await computeMultipartRequestHash(request);
  if (!hashResult.ok) return errorResponse(hashResult.code, hashResult.reason);

  let formData: FormData;
  try { formData = await request.formData(); }
  catch (e) {
    return errorResponse(ErrorCode.ValidationFailed,
      `multipart parse failed: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // Extract photos (1..5)
  const photoFiles = formData.getAll("photos").filter((v): v is File => v instanceof File);
  if (photoFiles.length === 0) {
    return errorResponse(ErrorCode.ValidationFailed, "Pelo menos uma foto é obrigatória.");
  }
  if (photoFiles.length > 5) {
    return errorResponse(ErrorCode.ValidationFailed, "Máximo de 5 fotos por identificação.");
  }

  const photos: Array<{ buffer: Buffer; contentType: string }> = [];
  for (const file of photoFiles) {
    const buf = Buffer.from(await file.arrayBuffer());
    const sizeCheck = rejectOversizeBuffer(buf);
    if (!sizeCheck.ok) return errorResponse(sizeCheck.code, sizeCheck.reason);
    const gpsCheck = await rejectGpsMetadata(buf);
    if (!gpsCheck.ok) return errorResponse(gpsCheck.code, gpsCheck.reason);
    photos.push({ buffer: buf, contentType: file.type });
  }

  const result = await withIdempotency(
    { userId: auth.user.id, key: idempotencyKey, requestHash: hashResult.hash },
    async (tx) => {
      const usecase = await identify({
        userId: auth.user.id,
        photos,
        requestStartMs,
      }, { tx });
      if (!usecase.ok) {
        return {
          status: usecase.code === ErrorCode.CapHit ? 429 :
                  usecase.code === ErrorCode.ConsentRequired ? 403 :
                  usecase.code === ErrorCode.Timeout ? 504 :
                  usecase.code === ErrorCode.ProviderUnavailable ? 503 : 500,
          body: { error: { code: usecase.code, message: usecase.reason } },
        };
      }
      return { status: 201, body: usecase.body };
    }
  );

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
}
```

### Router with budget threading

```typescript
// src/contexts/identification/application/identification-router.ts
const TOTAL_BUDGET_MS = 50_000;
const PER_CALL_CAP_MS = 30_000;
const FALLOVER_MIN_REMAINING_MS = 10_000;
const TIMING_OVERHEAD_MS = 2_000;

export type RouterResult =
  | { ok: true; result: IdentificationProviderResult }
  | { ok: false; failureReason: IdentificationFailureReason; provider: string };

export async function dispatchIdentification(
  deps: { providers: IdentificationProvider[]; budgetRepo; breakerRepo; tx },
  input: { userId: string; photos: Photos; requestStartMs: number }
): Promise<RouterResult> {
  let lastFailureReason: IdentificationFailureReason | null = null;
  let lastProvider = "";

  for (const provider of deps.providers) {
    lastProvider = provider.name;

    // ① Breaker check (D-08: read fresh, no cache)
    const breaker = await deps.breakerRepo.findByProvider(provider.name);
    if (breaker?.state === "open") {
      // Consider half-open transition if cooldown elapsed
      if (breaker.openedAt && Date.now() - new Date(breaker.openedAt).getTime() > 60_000) {
        await deps.breakerRepo.transitionToHalfOpen(provider.name);
      } else {
        lastFailureReason = "breaker_open";
        continue;
      }
    }

    // ② Budget check
    const budget = await deps.budgetRepo.findByProviderAndPurpose(provider.name, "identification");
    const today = new Date().toISOString().slice(0, 10);
    const counter = await deps.budgetRepo.findCounter(provider.name, "identification", today);
    if (counter && counter.estimatedCostCents >= budget.dailyCostCapCents) {
      lastFailureReason = "cost_ceiling_reached";
      continue;
    }

    // ③ Time budget check
    const elapsed = Date.now() - input.requestStartMs;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining < FALLOVER_MIN_REMAINING_MS) {
      lastFailureReason = "provider_unavailable";
      break;
    }

    // ④ Per-call timeout
    const timeoutMs = Math.min(PER_CALL_CAP_MS, remaining - TIMING_OVERHEAD_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await provider.identify({
        photos: input.photos,
        userId: input.userId,
        signal: controller.signal,
      });
      clearTimeout(timer);
      // ⑤ Filter below min_confidence; cap at 3
      const filtered = result.results
        .filter((r) => r.confidence >= Number(budget.minConfidence ?? 0.30))
        .slice(0, 3);
      // Breaker: success in half-open → close
      await deps.breakerRepo.recordSuccess(provider.name);
      return { ok: true, result: { ...result, results: filtered } };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      const isInvalid = err instanceof InvalidProviderResponseError;
      lastFailureReason = isTimeout ? "timeout" : isInvalid ? "invalid_response" : "provider_unavailable";
      await deps.breakerRepo.recordFailure(provider.name);
      // Continue to next provider
    }
  }

  return {
    ok: false,
    failureReason: lastFailureReason ?? "provider_unavailable",
    provider: lastProvider,
  };
}
```

### Client-side photo prep

```typescript
// src/app/(app)/identify/_photo-prep.ts (client-only)
// Source: combined exifr 7.1.3 + browser-image-compression 2.0.2 [CITED: Context7 /mikekovarik/exifr]
import imageCompression from "browser-image-compression";
import * as exifr from "exifr";

export async function preparePhoto(file: File): Promise<Blob> {
  // Pre-check GPS for telemetry — re-encode below strips it anyway
  try {
    const gps = await exifr.gps(file);
    if (gps?.latitude !== undefined) {
      // Toast: "Removemos a localização das suas fotos antes de enviar."
      toast.info(t("identify.toast.gpsRejected"));
    }
  } catch { /* ignore parse errors — re-encode handles it */ }

  // Compress + re-encode (re-encoding to JPEG strips EXIF including GPS)
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });
  return compressed;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Plant.id v2 single-image identification | Plant.id v3 multi-image with `details=common_names` query param | 2024 (Kindwise migration) | Phase 6 uses v3 only |
| OpenAI vision via prompt instructions for JSON | OpenAI structured outputs `response_format: { type: "json_schema", strict: true }` | 2024-08-06 model release | Eliminates JSON parse failures; required for IDENT-15 reliability |
| In-process rate limiting via `rate-limiter-flexible` | Postgres advisory locks per-user + atomic UPSERT counters | Project locked (CLAUDE.md banned external rate limiters) | No Redis dependency; auto-released on TX boundary |
| `step.sleepUntil(tomorrow)` for daily debounce | `last_alerted_at DATE` column compared to `CURRENT_DATE` | Phase 6 D-23 explicit | One DB column vs N durable Inngest steps per day |

**Deprecated/outdated:**
- Plant.id v2 endpoint `https://api.plant.id/v2/identify` — DO NOT USE. v3 is current.
- Tool calls / function calling for structured identification output (older OpenAI pattern) — `response_format: json_schema` strict-mode is the current way.

---

## Runtime State Inventory

**N/A — greenfield phase.** Phase 6 introduces new functionality; no rename, refactor, or migration of existing strings or stored data is planned. The two schema additions (`provider_budgets.cost_per_request_cents`, `provider_budgets.last_alerted_at`, new `provider_circuit_breakers` table) are pure additions to a context whose existing schema was created in Phase 2 with no production data yet (preview/staging only).

**Schema-additive items requiring migration thought:**

| Item | Migration | Default for Existing Rows |
|---|---|---|
| `provider_budgets.cost_per_request_cents INT NOT NULL DEFAULT 2` | Single ALTER TABLE | DEFAULT 2 (matches Plan plant_id seed); planner should override per-provider via UPDATE in same migration |
| `provider_budgets.last_alerted_at DATE` (nullable) | Single ALTER TABLE | NULL (D-23 — first alert always fires) |
| `provider_circuit_breakers` (new table) | CREATE TABLE + INSERT seeds for 'plant_id' and 'openai_compat' both `state='closed'` | n/a |

---

## Environment Availability

External dependencies are runtime API keys, not local tools. Probed at research time via `printenv`:

| Dependency | Required By | Available locally | Version | Fallback |
|---|---|---|---|---|
| `PLANT_ID_API_KEY` | PlantIdProvider | ✗ (none in dev shell) | — | `IDENTIFICATION_PROVIDER_MODE=stub` (already wired Phase 1 D-05) |
| `OPENAI_API_KEY` (or `OPENAI_COMPAT_*`) | OpenAICompatProvider | ✗ (none in dev shell) | — | Same — stub mode |
| `OPENAI_BASE_URL` | OpenAICompatProvider | ✗ (none) | — | Default `https://api.openai.com` |
| `RESEND_API_KEY` | `notifyCeiling` Inngest function | ✗ (none in dev shell — set in Vercel/CI) | — | Inngest function fails in dev; unit-test with stub Resend client |
| `OPERATOR_ALERT_EMAIL` | `notifyCeiling` recipient | ✗ (none in dev shell) | — | Use founder's email per Phase 13 OBS-05 deferral |
| `IDENTIFICATION_PROVIDER_MODE` | Provider router selection | ✓ (Phase 1 D-05 SC-4 — env var contract exists) | `stub` in CI/preview | Production: `real` |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest event dispatch | ✓ (Phase 4 — already wired) | active | none needed |
| Node 22 | Runtime | ✓ | 22.x | none |
| PostgreSQL 17 | Local DB | ✓ (via Supabase) | 17 | none |
| Vercel Pro tier | `maxDuration = 60` | DEPLOYMENT-TIME ONLY | — | **NO FALLBACK — Vercel Hobby caps at 10s.** Plan must verify Pro is provisioned before Phase 6 deploys to staging. |

**Missing dependencies with no fallback:**
- Vercel Pro tier — required for `maxDuration = 60`. If not provisioned, identification fails after 10s every time.

**Missing dependencies with fallback:**
- Plant.id + OpenAI keys: Phase 6 dev/CI uses `IDENTIFICATION_PROVIDER_MODE=stub` so no real provider calls happen — keys are only required for staging/prod.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.4 (unit + integration) + Playwright 1.59.1 (e2e) |
| Config file | `vitest.config.ts` (existing); Playwright in `playwright.config.ts` (existing) |
| Quick run command | `pnpm test:unit` (Vitest, projects=unit + unit-dom) |
| Full suite command | `pnpm test:run` (unit + integration) + `pnpm test:e2e` |

### Phase Requirements → Test Map

| REQ ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| IDENT-01 | Authed/consented user → 1..3 results above min_conf, persists row, emits event | integration | `pnpm test:integration -t "identify > success path"` | ❌ Wave 0 |
| IDENT-02 | First-time identify without consent → consent_required → modal | e2e | `pnpm test:e2e identify-consent.spec.ts` | ❌ Wave 0 |
| IDENT-03 | Consent revoked/never granted → 403 consent_required | unit (use-case) | `pnpm test:unit -t "identify > consent gate"` | ❌ Wave 0 |
| IDENT-04 | Filter results below min_confidence; max 3 | unit (router) | `pnpm test:unit -t "identification-router > confidence filter"` | ❌ Wave 0 |
| IDENT-05 | Zero results above threshold → row persisted with empty above-threshold + status=success | integration | `pnpm test:integration -t "identify > zero results"` | ❌ Wave 0 |
| IDENT-06 | Result selection → confirm → Plant created with species_id, plant_id linked | integration | `pnpm test:integration -t "confirm-identification > creates plant"` | ❌ Wave 0 |
| IDENT-07 | Manual correction → species_id resolved or null+flagged | integration | `pnpm test:integration -t "correct-identification > resolves species"` | ❌ Wave 0 |
| IDENT-08 | History lists all statuses; re-associate available | integration | `pnpm test:integration -t "list-identifications > status filter"` | ❌ Wave 0 |
| IDENT-09 | Trial over cap → cap_hit 429 (no provider call) | integration | `pnpm test:integration -t "identify > cap_hit trial"` | ❌ Wave 0 |
| IDENT-10 | Active over cap → cap_hit 429 | integration | `pnpm test:integration -t "identify > cap_hit paid"` | ❌ Wave 0 |
| IDENT-11 | Primary at ceiling → router skips → fallback success | unit (router) | `pnpm test:unit -t "identification-router > fallover on ceiling"` | ❌ Wave 0 |
| IDENT-12 | All providers exhausted → provider_unavailable 503; row failed | integration | `pnpm test:integration -t "identify > all providers exhausted"` | ❌ Wave 0 |
| IDENT-13 | Provider timeout → timeout 504; row failed with failure_reason=timeout | unit (router with fake timers) | `pnpm test:unit -t "identification-router > timeout per-call"` | ❌ Wave 0 |
| IDENT-14 | Navigate away mid-request → server completes, row persists | manual + integration (server doesn't depend on client conn) | `pnpm test:integration -t "identify > completes regardless of client abort"` | ❌ Wave 0 |
| IDENT-15 | Malformed provider response → invalid_response, breaker increment, fallover | unit (provider) | `pnpm test:unit -t "plant-id-provider > schema mismatch"` | ❌ Wave 0 |
| IDENT-16 | EXIF GPS rejected as validation_failed (server defense in depth) | unit | reuses existing `pnpm test:unit -t "rejectGpsMetadata"` | ✅ (existing) |
| IDENT-17 | 1..5 photos accepted, capture guide visible | e2e | `pnpm test:e2e identify-multi-photo.spec.ts` | ❌ Wave 0 |
| IDENT-18 | 50s wall-clock + 30s per-call + 10s remaining check | unit (router with fake clock) | `pnpm test:unit -t "identification-router > 50s budget"` | ❌ Wave 0 |
| IDENT-19 | Provider adapter swap via env (stub mode) | unit | `pnpm test:unit -t "provider-factory > respects IDENTIFICATION_PROVIDER_MODE"` | ❌ Wave 0 |
| IDENT-20 | Offline → identify CTA hidden + clear message | e2e | `pnpm test:e2e identify-offline.spec.ts` (extend existing offline spec) | ✅ (extend existing) |
| IDENT-21 | Read-only mode → paywall Dialog | e2e | `pnpm test:e2e identify-paywall.spec.ts` | ❌ Wave 0 |
| COST-01 | Trial caps 5/day + 75/period; window from trial dates | unit (cap-check) | `pnpm test:unit -t "cap-check > trial window"` | ❌ Wave 0 |
| COST-02 | Paid caps 15/day + 200/period; window from billing period | unit (cap-check) | `pnpm test:unit -t "cap-check > paid window"` | ❌ Wave 0 |
| COST-03 | Cap check before counter increment & provider call | integration | `pnpm test:integration -t "identify > over-cap never reaches provider"` (assert no http stub call) | ❌ Wave 0 |
| COST-04 | 80% threshold → Resend operator email | integration (Inngest fn) | `pnpm test:integration -t "notifyCeiling > sends Resend email"` | ❌ Wave 0 |
| COST-05 | At ceiling → provider unavailable rest of UTC day; fallover engages | unit (router) | `pnpm test:unit -t "identification-router > skip at ceiling"` | ❌ Wave 0 |
| COST-06 | (provider, purpose) keyed; care_guide ceiling exhaustion ≠ identification | integration | `pnpm test:integration -t "provider-budgets > purpose isolation"` | ❌ Wave 0 |
| COST-07 | cost_ceiling_reached + breaker_open → public response = provider_unavailable | unit (errors.ts already covers this) | reuse `pnpm test:unit -t "errorResponse > internal-only"` | ✅ (existing) |
| COST-08 | Breaker N consecutive failures → opens; cooldown → half-open; success → closes | unit (breaker) | `pnpm test:unit -t "circuit-breaker > state transitions"` | ❌ Wave 0 |
| COST-09 | Two concurrent requests → atomic counter; no lost writes | integration (concurrent) | `pnpm test:integration -t "atomic counter > concurrent requests"` | ❌ Wave 0 |
| COST-10 | DB updates to limits/budgets visible after TTL (no redeploy) | unit (cache TTL) | `pnpm test:unit -t "limits-cache > 30s TTL"` | ❌ Wave 0 |
| LGPD-09 | Successful identification captures consent_version (string from policy_versions.version) | integration | `pnpm test:integration -t "identify > consent_version captured"` | ❌ Wave 0 |
| UI-06 | Identify screen 13-state state machine | e2e visual | `pnpm test:e2e identify-states.spec.ts` (Playwright snapshot) | ❌ Wave 0 |
| UI-12 | Identification history screen | e2e | `pnpm test:e2e identify-history.spec.ts` | ❌ Wave 0 |
| UI-15 | Confidence ladder 3 tiers × 4 redundant signals | unit (component) + axe | `pnpm test:unit -t "ConfidenceLadder > tier rendering"` + axe-core | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test:unit` (must pass; runs in <30s on identification context)
- **Per wave merge:** `pnpm test:run` (unit + integration; integration suite ~2min)
- **Phase gate:** Full suite green (`pnpm test:run && pnpm test:e2e`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/identify.integration.test.ts` — covers IDENT-01/05/09/10/12/14, COST-03/06/09, LGPD-09
- [ ] `tests/integration/confirm-identification.integration.test.ts` — covers IDENT-06
- [ ] `tests/integration/correct-identification.integration.test.ts` — covers IDENT-07
- [ ] `tests/integration/list-identifications.integration.test.ts` — covers IDENT-08
- [ ] `tests/integration/notify-ceiling.integration.test.ts` — covers COST-04
- [ ] `tests/unit/identification-router.unit.test.ts` — covers IDENT-04/11/13/18, COST-05/08
- [ ] `tests/unit/cap-check.unit.test.ts` — covers COST-01/02/10
- [ ] `tests/unit/circuit-breaker.unit.test.ts` — covers COST-08
- [ ] `tests/unit/plant-id-provider.unit.test.ts` — covers IDENT-15 (Plant.id schema mismatch)
- [ ] `tests/unit/openai-compat-provider.unit.test.ts` — covers IDENT-15 (OpenAI schema mismatch)
- [ ] `tests/unit/provider-factory.unit.test.ts` — covers IDENT-19
- [ ] `tests/unit/confidence-ladder.unit.test.tsx` — covers UI-15 (3 tiers × 2 themes × 2 motion preferences = 12 axe runs)
- [ ] `tests/e2e/identify-consent.spec.ts` — covers IDENT-02
- [ ] `tests/e2e/identify-multi-photo.spec.ts` — covers IDENT-17
- [ ] `tests/e2e/identify-offline.spec.ts` — extend existing offline spec for IDENT-20
- [ ] `tests/e2e/identify-paywall.spec.ts` — covers IDENT-21
- [ ] `tests/e2e/identify-states.spec.ts` — covers UI-06 (13 baselines × 4 combos = 52 visual snapshots per UI-SPEC §Verification Gates)
- [ ] `tests/e2e/identify-history.spec.ts` — covers UI-12
- [ ] `tests/e2e/fixtures/consented-user.ts` — extends `authedUser` fixture (CONTEXT key-asset 8)
- [ ] HTTP mocks for Plant.id v3 + OpenAI vision (use Vitest `vi.spyOn(global, "fetch")` or `msw`; project does NOT have MSW currently — recommend Vitest spy)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | `requireVerifiedUser()` already implemented; reuse on every `/api/v1/identifications/*` route |
| V3 Session Management | yes | Per-device JWT (Phase 4); JWT decoded by `requireApiUser()` |
| V4 Access Control | yes | RLS policy `identifications_owner_all` (already in `0001_phase_02_rls_policies.sql:230`); `provider_circuit_breakers` and `provider_usage_counters` are service-role only (NO RLS — match existing `provider_usage_counters` Phase 2 pattern); `withUnitOfWork` sets `SET LOCAL ROLE authenticated` so RLS engages |
| V5 Input Validation | yes | Zod schemas at every API boundary (`drizzle-zod` foundation); multipart photo validation via `rejectOversizeBuffer` + `rejectGpsMetadata`; provider response validation via Zod (IDENT-15) |
| V6 Cryptography | yes | `crypto.randomUUID()` for IDs (existing pattern); never hand-roll cryptographic primitives; consent_version is a string identifier, not a cryptographic claim |
| V7 Error Handling | yes | Closed error registry (`src/shared/config/errors.ts`); INTERNAL_ONLY codes (`cost_ceiling_reached`, `breaker_open`) automatically masked to `provider_unavailable` |
| V8 Data Protection | yes | LGPD Art. 33 consent gate (D-09); `Identification.consentVersion` audit trail; PII scrubbing on `/api/v1/identifications/*` (Phase 1 D-22 — preserve); 24h signed URLs for photo thumbnails (D-21) |
| V9 Communications | yes | HSTS + standard security headers in `next.config.ts:39-50` (existing); HTTPS-only fetch to providers |
| V11 Business Logic | yes | Per-user advisory lock prevents concurrent abuse (D-05); cap check before provider dispatch (COST-03); ceiling check before counter increment (D-06) |
| V13 API & Web Service | yes | `Idempotency-Key` required on POST `/api/v1/identifications` (INFRA-22); cursor-based pagination on GET (Phase 2 D-36) |

### Known Threat Patterns for {Next.js + Postgres + Inngest stack}

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Cap evasion via concurrent identification (race) | Tampering / Elevation | `pg_try_advisory_xact_lock` per user (D-05); cap COUNT inside same TX |
| Counter inversion (increment then call) | Repudiation / Tampering | D-06 ordering: provider call → success → UPSERT counter; failed call leaves counter unchanged |
| Provider response tampering / malformed JSON | Tampering | Zod schema validation on every provider response (IDENT-15); `invalid_response` failure path increments breaker |
| Service worker stale-cache identification response | Tampering | Existing Serwist NetworkOnly for `/api/*` (`sw.ts:109`); regression test: post-failure retry hits network |
| GPS-bearing photo upload (privacy leak) | Information Disclosure | Client `browser-image-compression` re-encode strips EXIF; server `rejectGpsMetadata` defense in depth (existing); reject as `validation_failed` 400 |
| Cost-ceiling DoS via single user | Denial of Service | Per-user daily caps (5 trial / 15 paid) STRICTLY before provider call; per-provider $5/day ceiling triggers fallover then `provider_unavailable` |
| Sentry / PostHog PII leak (photo URL, email) | Information Disclosure | Phase 1 D-22 already scrubs `photo_url`; drops request bodies on `/api/v1/identifications/*`; `Sentry.setUser({ id })` only — preserve |
| Provider API key leak via client | Information Disclosure | Server-only env vars; `runtime = "nodejs"` (server-side only); no NEXT_PUBLIC_ prefix |
| LGPD consent bypass | Repudiation | Step 0 `hasActiveConsent()` check before any provider call; ConsentLog row immutable audit (append-only) |
| Idempotency-Key replay with mutated body | Tampering | `withIdempotency` hash-mismatch returns Conflict 409 (existing pattern, T-02-16) |
| Circuit breaker race in half-open transition | Tampering | UPDATE with WHERE clause matching expected state (optimistic concurrency); D-08 read fresh per dispatch — half-open transitions to closed only on first success |

---

## Risks + Open Questions (RESOLVED)

### Risk 1: OpenAI-compat structured output strict-mode model availability

**What we know:** `response_format: { type: "json_schema", strict: true }` requires GPT-4o-2024-08-06 or newer on OpenAI; Anthropic via Vercel AI Gateway supports it but the schema enforcement is "best effort" not strict-spec-compliant; vLLM / OpenRouter inconsistent. [VERIFIED: Context7 /openai/openai-node]
**What's unclear:** Which model + endpoint will operator actually configure for `OPENAI_BASE_URL` + `OPENAI_API_KEY`?
**Recommendation:** Plan ships with `gpt-4o-2024-08-06` as the seeded value in `.env.example`; documents in PRD §20 and Phase 6 STATE that operator can swap via env var; provider implementation falls back to JSON mode (`response_format: { type: "json_object" }`) + Zod parse if strict-mode rejected with a 400 schema error — record as `invalid_response` for that request but keep the provider available.

### Risk 2: Vercel Pro tier requirement for `maxDuration = 60`

**What we know:** Vercel Hobby caps at 10s regardless of `maxDuration` directive; Pro starts at 60s; Enterprise up to 900s. [CITED: vercel.com/docs/functions/configuring-functions/duration]
**What's unclear:** Has the team provisioned Vercel Pro for staging + production, or is this discovered at first deploy?
**Recommendation:** Plan adds a prerequisite to `STATE.md`: "Vercel Pro provisioned and confirmed before phase deploy." First-task gate.

### Risk 3: Plant.id v3 rate limits + error response shape

**What we know:** Plant.id v3 endpoint URL + `Api-Key` header confirmed via README; multi-image POST shape confirmed; `result.classification.suggestions[].probability` confirmed. [CITED: github.com/flowerchecker/Plant-id-API]
**What's unclear:** Exact HTTP status codes for rate-limit / quota / invalid key; rate-limit headers (e.g., `X-RateLimit-Remaining`); per-call latency expectations.
**Recommendation:** Provider implementation maps non-2xx to `invalid_response` initially (triggers breaker increment, fallover); after first staging integration, refine to distinguish 429/401/5xx via Sentry breadcrumbs. Document in PRD: "Plant.id error taxonomy refined post-launch."

### Risk 4: Confidence calibration is provider-dependent

**What we know:** Plant.id `probability` is calibrated against their training distribution; OpenAI vision LLM "confidence" is a generative artifact, not a probability.
**What's unclear:** Should `min_confidence` differ per provider?
**Recommendation:** MVP keeps `provider_budgets.min_confidence` unified at 0.30 across providers; after launch + telemetry (manual_correction rate per provider), add per-provider thresholds. Already deferred as ID-v2-02.

### Risk 5: Service worker registration during dev

**What we know:** CONTEXT folded todo lists "dev-mode service-worker unregister (score 0.6)" — papercut where dev-mode could serve cached responses.
**What's unclear:** Has Phase 5 / Phase 3 fully resolved this?
**Recommendation:** Plan adds a prerequisite verification task: "Verify dev-mode service worker is disabled (`disable: process.env.NODE_ENV === 'development'` in `next.config.ts:18` already does this) and run a smoke test confirming `/api/v1/identifications/*` is not cached in any environment." Sw is already disabled in dev per `next.config.ts:18`.

### Open Question 1: Circuit breaker half-open semantics under concurrent traffic — RESOLVED

**What we know:** D-08 says half-open transitions to closed on first success.
**What's unclear:** If 5 concurrent requests hit a half-open breaker, do all 5 dispatch to the provider, or only the first?
**Recommendation:** Plan implements: half-open admits ONE request via optimistic UPDATE `SET state='in_flight'` with a WHERE state='half_open' guard; concurrent half-open dispatches see state='in_flight' and treat as open (skip to fallback). Add `in_flight` to the state CHECK constraint or use a separate `in_flight_at` timestamp. Confirm pattern with planner.
**RESOLVED:** Implemented via `in_flight_at TIMESTAMPTZ` column added in plan **06-01** (schema migration) and `transitionToHalfOpen` optimistic UPDATE in plan **06-07** (circuit breaker repository). Concurrent half-open dispatches see non-null `in_flight_at` and skip to fallback per D-08.

### Open Question 2: Cost-per-request seed values — RESOLVED

**What we know:** D-06 says `cost_per_request_cents` configurable per `ProviderBudget`; CONTEXT discretion item lists this as Claude's choice.
**What's unclear:** What are reasonable seed values?
**Recommendation:** Seeds: `plant_id` = 2 cents/req (~$0.02 per Plant.id v3 identification — verify pricing at Kindwise pricing page when deploying); `openai_compat` = 3 cents/req (estimated GPT-4o vision token cost ~2k tokens × $0.015/1k input + 200 tokens × $0.06/1k output ≈ $0.04 worst-case rounded down). Document as initial seeds — operator overrides via `UPDATE provider_budgets`.
**RESOLVED:** Plan **06-01** seeds `plant_id` at 2 cents/req and `openai_compat` at 3 cents/req via the schema migration's `cost_per_request_cents INT NOT NULL DEFAULT 2` column. Operator overrides via `UPDATE provider_budgets SET cost_per_request_cents = N WHERE provider = 'X'`.

### Open Question 3: Provider seed `is_active` — DEFERRED

**What we know:** `provider_budgets.is_active boolean DEFAULT true` already exists.
**What's unclear:** Is `is_active=false` a router-skip signal (currently only used by Phase 7 care_guide)?
**Recommendation:** Confirm with planner: yes, router checks `is_active` on each dispatch. If `is_active=false` → skip provider entirely (treat as if breaker open). This gives operators an emergency kill-switch via DB UPDATE.
**DEFERRED:** Not wired into Phase 6 router (06-06). Operator emergency kill-switch is non-blocking for MVP — circuit breaker + ceiling check already provide failure-mode isolation. Tracked as backlog item ID-v2-03 ("operator kill-switch via `provider_budgets.is_active`"). Re-evaluate during post-launch ops review or after first incident requiring manual provider disable.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Plant.id v3 endpoint = `https://api.plant.id/v3/identification` and uses `Api-Key` header | Standard Stack — External APIs | Provider integration fails on first call; integration test catches before deploy |
| A2 | Plant.id v3 error responses use standard HTTP status codes (429/401/5xx) | Risks #3 | Provider error path may need refinement after staging integration |
| A3 | `gpt-4o-2024-08-06` supports strict-mode `response_format: json_schema` for vision inputs | Standard Stack — External APIs | Fallback to non-strict JSON mode in provider impl; covered by Risk #1 mitigation |
| A4 | Vercel Pro tier provides `maxDuration = 60` | Pitfall #1 | Identification cold-times-out at 10s in production; requires deployment-time verification |
| A5 | Existing Serwist NetworkOnly rule covers `/api/v1/identifications/*` (path starts with `/api/`) | Pitfall #5 | Service worker stale-caches POST 503 responses; regression test catches |
| A6 | `IDENTIFICATION_PROVIDER_MODE=stub` env contract from Phase 1 D-05 SC-4 was implemented as expected | Environment Availability | Stub provider may need to be wired into a different switching point than expected; verify `provider-factory.ts` once written |
| A7 | RLS policy `identifications_owner_all` covers SELECT/INSERT/UPDATE/DELETE for owner | Security Domain V4 | Phase 2 plan likely covered all four; verify by re-reading `0001_phase_02_rls_policies.sql:230-231` during planning |
| A8 | `provider_circuit_breakers` table should follow the `provider_usage_counters` no-RLS pattern (service-role only) | D-07 | If RLS were required, the breaker repo would need `withUnitOfWork`; current plan assumes service-role-only |
| A9 | OpenAI vision base64 image_url with `data:` URI prefix is the expected payload shape | Pattern 3 | Provider call rejects with 400; alternative is `image_url.url` as raw URL pointing to a public asset (not viable for private uploads) |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: Context7 /openai/openai-node] — Structured Outputs with Zod, `response_format: { type: "json_schema", strict: true }` pattern, `client.chat.completions.parse()` helper
- [VERIFIED: Context7 /inngest/inngest-js] — `inngest.createFunction` with `triggers: [{event: ...}]` event-driven pattern
- [VERIFIED: Context7 /mikekovarik/exifr] — `exifr.gps()` browser-side GPS extraction; existing pattern in `src/shared/images/server-validate.ts:45`
- [VERIFIED: codebase] — `src/shared/db/unit-of-work.ts:88-103` (advisory lock + RLS host); `src/shared/api/idempotency.ts:109-196` (idempotency wrapper); `src/shared/config/errors.ts:27-69` (closed error registry + INTERNAL_ONLY mapping); `src/shared/images/server-validate.ts:45-66` (GPS rejection); `src/contexts/identification/infrastructure/db/schema.ts` (existing schema); `drizzle/migrations/0001_phase_02_rls_policies.sql:74-77, 230-231, 355` (RLS for identifications + service-role-only counters)
- [VERIFIED: package.json + npm registry 2026-05-04] — All dependency versions confirmed installed; latest versions checked

### Secondary (MEDIUM confidence)

- [CITED: github.com/flowerchecker/Plant-id-API README] — Plant.id v3 endpoint URL, `Api-Key` header, request/response shape; rate-limit + error code semantics not in README
- [CITED: vercel.com/docs/functions/configuring-functions/duration] — `maxDuration` tier limits (Hobby 10s, Pro 60s)
- [CITED: kindwise.com] — Plant.id v3 deprecation of v2 endpoint

### Tertiary (LOW confidence)

- Provider per-call latency p50/p95 for Plant.id v3 — no public SLA; estimate 2–5s based on classical CV models. Validate empirically post-deploy via OBS-04 rollups.
- OpenAI GPT-4o vision per-call latency for 1–5 images — estimate 5–15s. Validate empirically.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in package.json, versions verified via `npm view`
- Architecture: HIGH — 26 locked decisions in CONTEXT.md cover every key path; existing Phase 1–5 patterns are the implementation foundation
- Pitfalls: HIGH — Pitfalls 1–5 grounded in existing codebase patterns and project decisions; Pitfall 6 is a documented LGPD revocation path; Pitfalls 7–8 are derived from Phase 1 D-22 + D-11 explicit constraints
- Provider APIs: MEDIUM — Plant.id v3 request/response shape verified; error code taxonomy MEDIUM (only README content; refine post-staging); OpenAI structured outputs HIGH (Context7-confirmed)
- Validation architecture: HIGH — every requirement mapped to a test type and Vitest/Playwright command; gaps explicit

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30 days for stable architecture; provider API endpoints are external and may version — re-verify Plant.id v3 + OpenAI strict-mode model availability if planning is deferred past 2026-06-04)
