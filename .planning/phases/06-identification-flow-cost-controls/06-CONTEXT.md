# Phase 6: Identification Flow & Cost Controls - Context

**Gathered:** 2026-05-05 (--auto mode)
**Status:** Ready for planning
**Source:** Regenerated from the roadmap, prior phase contexts, current code scout, todo cross-reference, and the previous tracked Phase 6 context read from `HEAD` because the working tree currently has the phase directory deleted.

<domain>
## Phase Boundary

A verified, trial-active user opens the Identify screen, snaps or picks 1-5 photos, accepts the first-time LGPD Art. 33 third-party transfer consent, and, within the 50s function budget, receives no more than 3 honest top results with confidence-ladder UI. The user selects a result and lands in the catalog with a Plant linked to Species and to the Identification history row.

The same phase owns the cost-control architecture needed before any provider call can happen: per-user caps, per-provider daily ceilings, atomic usage counters, circuit breakers, fallover from Plant.id to an OpenAI-compatible vision provider, and operator alerting at 80% of the provider ceiling.

**Explicitly not in scope for Phase 6:**
- Care-guide rendering after identification — Phase 7 consumes `identification.succeeded`.
- Toxicity badge composition — Phase 7.
- Reminders on plant profile — Phase 8.
- Offline mutation queue — Phase 9. Identification is blocked offline; it is not queued.
- Real Stripe read-only state — Phase 10. Phase 6 consumes the Phase 5 `useSubscription()` stub.
- LGPD export/deletion flows and consent-management settings — Phase 11.
- Push permission — Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Provider Adapter Interface & Router

- **D-01:** Define `IdentificationProvider` at `src/contexts/identification/domain/provider.ts`. Method shape: `identify(input: { photos: Array<{ buffer: Buffer; contentType: string }>; userId: string }): Promise<IdentificationProviderResult>`. Provider results normalize to `{ results: Array<{ speciesName; scientificName; confidence; providerSpeciesId }>; provider; model; latencyMs }`, with confidence as `0..1`.
- **D-02:** Concrete providers live under `src/contexts/identification/infrastructure/providers/`: `PlantIdProvider` primary, `OpenAICompatProvider` fallback, and `StubProvider` for `IDENTIFICATION_PROVIDER_MODE=stub`. Provider implementations are stateless; budget, breaker, and cap state lives in DB.
- **D-03:** Add an `IdentificationRouter` use-case service at `src/contexts/identification/application/identification-router.ts`. Dispatch order: check breaker, check budget ceiling, call primary, fall over only if at least 10s remain, otherwise short-circuit to `provider_unavailable`. The router returns typed domain results; route handlers map to HTTP.
- **D-04:** Provider prompts/model configuration are app-deploy versioned, not DB-tunable. Runtime DB tuning is reserved for budgets, caps, thresholds, and breaker state.

### Per-User Caps, Provider Budgets & Counters

- **D-05:** Per-user cap checks use COUNTs against `identifications`, not a new aggregate table. Trial windows derive from `Subscription.trial_start_date..trial_end_date`; paid windows derive from `current_period_start..current_period_end`; daily windows use UTC day boundaries.
- **D-06:** Read `IdentificationLimit` and `ProviderBudget` with a 30s in-process TTL cache so operator DB updates take effect shortly without redeploy.
- **D-07:** Serialize concurrent identification attempts per user with `pg_try_advisory_xact_lock(hashtext(user_id))` inside the `withUnitOfWork` transaction. If the lock cannot be acquired immediately, return `cap_hit` 429 with no provider call.
- **D-08:** Provider ceiling check happens before provider dispatch. `ProviderUsageCounter` increments happen only after a successful provider call using atomic `INSERT ... ON CONFLICT DO UPDATE`.
- **D-09:** Add `cost_per_request_cents` to `provider_budgets`. Seed values: Plant.id identification = 2 cents/request; OpenAI-compatible identification = 3 cents/request. Operators can update these rows directly.
- **D-10:** Add `last_alerted_at DATE` to `provider_budgets`. When usage crosses `alert_threshold_pct` (default 80%) and the provider/purpose has not alerted today, emit `provider.ceiling_reached`; `identification/notify-ceiling` sends the Resend operator email.

### Circuit Breaker

- **D-11:** Add `provider_circuit_breakers` table owned by the Identification context. Columns: `provider`, `state`, `consecutive_failures`, `opened_at`, `last_failure_at`, `updated_at`, plus `in_flight_at` to enforce one half-open probe at a time.
- **D-12:** Breaker opens after 5 consecutive failures within 10 minutes, transitions to half-open after 60s cooldown, admits only one half-open in-flight probe, closes on success, and reopens on failure. Timeout, invalid provider response, provider HTTP 5xx, and network errors count as failures. Cost-ceiling skips do not.

### LGPD Consent & Version Tracking

- **D-13:** `ConsentLog` must have active `purpose='identification_third_party'` consent before cap checks, budget checks, or provider dispatch. Missing/revoked consent returns `consent_required` 403 with no Identification row and no provider call.
- **D-14:** Grant consent through `POST /api/v1/iam/consents` with `{ purpose: 'identification_third_party' }`. Insert `legal_basis='consent'`, `source='identify_screen'`, and the current policy version. Return `{ consent_version }`.
- **D-15:** `Identification.consentVersion` stores the active `policy_versions.version` string, not the policy-version UUID. Successful identification rows always capture this string.
- **D-16:** The LGPD modal is contextual on the Identify screen, not part of signup. Signup records T&C/privacy acceptance only; third-party provider transfer consent waits until first identify.

### Identify Screen UX

- **D-17:** Replace the placeholder at `src/app/(app)/identify/page.tsx` with a single-route client state machine: `idle`, `picking`, `photos-selected`, `uploading`, `identifying`, `results`, `zero-results`, `cap-hit`, `provider-unavailable`, `timeout`, `offline`, `consent-modal`, and `read-only-paywall`.
- **D-18:** Multi-photo selection accepts 1-5 photos. Camera uses `<input type="file" accept="image/*" capture="environment" multiple>`; gallery uses `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`. No live `getUserMedia` camera stream in MVP.
- **D-19:** Current `next.config.ts` sets `Permissions-Policy: camera=()`. Because D-18 uses native file input capture rather than `getUserMedia`, planning must verify mobile behavior. If the header blocks capture on target browsers, update the policy narrowly to allow same-origin camera capture without enabling third-party frames.
- **D-20:** Client-side compression and EXIF/GPS stripping happen before upload. Server still calls `rejectOversizeBuffer` and `rejectGpsMetadata` on every identification photo before storage or provider dispatch.
- **D-21:** Loading states use skeleton shimmer plus progress text, not circular spinners. Upload copy: "Enviando fotos..."; identification copy: "Identificando sua planta...". Route-level timeout uses roughly 48s, leaving 2s response overhead inside the 50s budget.
- **D-22:** Results render inline on `/identify`, ordered by descending confidence and capped at 3. Use a `ConfidenceLadder` with redundant cues: bar, segment ticks, numeric percent with at most 1 decimal, and screen-reader label. Tiers: high >=70%, medium 40-69%, low threshold-39%.

### Result Selection, Plant Creation & History

- **D-23:** Tapping a result opens a `ModalSheet` with prefilled plant name, optional nickname/location/acquisition date, and CTA "Adicionar à minha estante". Submit calls `POST /api/v1/identifications/{id}/confirm`.
- **D-24:** Confirm endpoint runs one transaction: call Phase 5 `createPlant({ source: 'identification', speciesId, ... })`, update `identifications.plant_id`, persist selected result, then after commit emit `identification.succeeded` with `{ identificationId, userId, plantId, provider, model, selectedSpeciesId, latencyMs, succeededAt }`.
- **D-25:** Manual correction endpoint `POST /api/v1/identifications/{id}/correct` stores `manual_correction`, attempts exact normalized species-name/scientific-name match, and otherwise leaves `species_id` null while preserving the user-entered correction for operator review.
- **D-26:** Ship two history surfaces using the same paginated endpoint: global `/identify/history` and per-plant `/catalog/{plantId}/identifications`. History includes success, timeout, provider-unavailable, and cap-hit attempts; rows with `plantId = null` and successful results expose "Associar à planta".
- **D-27:** `GET /api/v1/identifications` is cursor-paginated by `{ created_at, id }` descending, default page size 20, optional `?plantId=`, and returns 24h signed thumbnail URLs for the first photo.

### Offline, Read-Only & Telemetry

- **D-28:** Offline identify is blocked with "Identificação requer conexão à internet." The capture guide remains visible; identify CTAs are hidden; no offline queue or retry queue exists in this phase.
- **D-29:** Read-only mode reads the Phase 5 `useSubscription()` stub. If `readOnly`, tapping camera/gallery opens a Radix Dialog paywall with "Reative sua assinatura para identificar novas plantas." and CTA to `/settings/subscription`. History remains viewable.
- **D-30:** Server-side PostHog only. Events: `identification_started`, `identification_completed`, `identification_consent_granted`, and existing `plant_added` with `source='identification'`. Never send species names, photo URLs, or raw provider payloads to PostHog.
- **D-31:** Preserve Phase 1 Sentry posture: `Sentry.setUser({ id })` only, `photo_url` scrubbed, and request bodies dropped for `/api/v1/identifications/*`.

### Folded Todos

Auto mode folded every todo match with score >= 0.4. Treat these as planning inputs, not scope expansion:

- **Fix gsd-sdk phase-plan-index wave misreport** (`.planning/todos/pending/2026-04-27-fix-gsd-sdk-phase-plan-index-wave-misreport.md`) — tooling risk for a many-wave Phase 6 plan; verify generated wave numbering before execution.
- **Replace vite-tsconfig-paths plugin with native Vite resolve.tsconfigPaths** (`.planning/todos/pending/2026-04-27-replace-vite-tsconfig-paths-plugin-with-native-vite-resolve-tsconfigpaths.md`) — tooling cleanup; do not block Phase 6 unless test config churn becomes necessary.
- **Add dev-mode service-worker unregister to prevent stale-cache papercut** (`.planning/todos/pending/2026-04-29-add-dev-mode-service-worker-unregister-to-prevent-stale-cache-papercut.md`) — relevant because identification routes must never be stale-cached.
- **Generate visual-snapshot baselines for chromium-darwin** (`.planning/todos/pending/2026-04-29-generate-visual-snapshot-baselines-for-chromium-darwin.md`) — Phase 6 adds substantial visual-state coverage; plan should account for baseline generation/verification.
- **Investigate offline + axe + bottom-nav E2E failure cluster** (`.planning/todos/pending/2026-04-29-investigate-offline-axe-bottom-nav-e2e-failures-cluster.md`) — relevant to Phase 6 offline state and axe gates.
- **Run the full Playwright E2E suite in CI** (`.planning/todos/pending/2026-05-02-run-full-e2e-suite-in-ci.md`) — Phase 6 has heavy E2E/visual coverage; CI scope matters before phase verification.

### Agent Discretion

The planner/researcher may decide exact Tailwind compositions, file splits, provider timeout values within the 30s per-call cap, exact Plant.id/OpenAI-compatible request shape after current docs are checked, exact stub provider fixtures, provider cost seed refinements, and final pt-BR copy polish within the copy contracts above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + scope

- `.planning/PROJECT.md` — Core value, stack constraints, launch blockers, and key provider/cost-control decisions.
- `.planning/REQUIREMENTS.md` — Phase 6 requirements: IDENT-01..21, COST-01..10, LGPD-09, UI-06, UI-12, UI-15.
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, dependencies, and current planned wave breakdown.
- `docs/CAVE-PRD.md` §1 — Honest AI, no fake confidence, first-value under 2 minutes.
- `docs/CAVE-PRD.md` §3 — Bounded contexts and events: `identification.succeeded`, `identification.failed`, `provider.ceiling_reached`.
- `docs/CAVE-PRD.md` §4 — Identification, IdentificationLimit, ProviderBudget, and ProviderUsageCounter data model.
- `docs/CAVE-PRD.md` §5 — Closed error-code registry and internal-only masking.
- `docs/CAVE-PRD.md` §6 — Identification provider routing, confidence filtering, budgets, breakers, and timing budget.
- `docs/CAVE-PRD.md` §11 — Image compression, EXIF/GPS stripping, and server rejection.
- `docs/CAVE-PRD.md` §13 — LGPD Art. 33 consent and consent-version tracking.
- `docs/CAVE-PRD.md` §16 — Identify and identification-history screens.
- `docs/CAVE-PRD.md` §17 — Design system, confidence ladder, capture button, result-card geometry, motion, and banned patterns.
- `docs/CAVE-PRD.md` §20 — PostHog taxonomy and environment variables.
- `docs/CAVE-PRD.md` §21 — Security posture and PII scrubbing.
- `docs/CAVE-PRD.md` §23 — AC-ID, AC-COST, and AC-LGPD acceptance criteria.

### Prior phase decisions

- `.planning/phases/01-foundation/01-CONTEXT.md` — Error registry, Sentry/PostHog privacy posture, Serwist/Next constraints, `IDENTIFICATION_PROVIDER_MODE` stub guard.
- `.planning/phases/02-data-layer/02-CONTEXT.md` — Per-context schema ownership, seeded identification tables, repositories-only Drizzle, RLS, idempotency, cursor pagination, storage and image-validation patterns.
- `.planning/phases/03-design-system-app-shell/03-CONTEXT.md` — Paper Cream/Night Cream tokens, bottom nav, ModalSheet, skeletons, EmptyState, CaptureButton, `useOnlineStatus`, reduced-motion rules.
- `.planning/phases/04-iam-auth-verification-consent/04-CONTEXT.md` — `requireVerifiedUser()`, ConsentLog signup boundaries, Inngest registry pattern, Settings placeholder routes.
- `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` — `createPlant` identification branch, Combobox, Lightbox, query factory, photo signing, offline cache, `useSubscription()` stub, authed Playwright fixture.

### Current code anchors

- `src/contexts/identification/infrastructure/db/schema.ts` — Existing `identifications`, `identification_limits`, `provider_budgets`, and `provider_usage_counters`; Phase 6 extends here.
- `src/contexts/identification/domain/events.ts` — Existing event names and payloads for identification success/failure/provider ceiling.
- `src/contexts/identification/inngest/functions.ts` — Placeholder `identificationFunctions`; Phase 6 replaces with `notifyCeiling`.
- `src/contexts/catalog/application/create-plant.ts` — Existing `source: 'identification'` branch and outer-transaction path.
- `src/shared/images/server-validate.ts` — `rejectOversizeBuffer` and `rejectGpsMetadata`.
- `src/shared/config/errors.ts` — Closed error registry and internal-only `cost_ceiling_reached`/`breaker_open` masking.
- `src/shared/db/unit-of-work.ts` — Transaction + RLS GUC boundary where advisory lock should run.
- `src/contexts/iam/infrastructure/db/consent-logs.ts` — ConsentLog repository pattern and cursor pagination reference.
- `src/app/(app)/identify/page.tsx` and `src/app/(app)/identify/_identify-placeholder.tsx` — Current placeholder surface to replace.
- `src/shared/inngest/registry.ts` — Per-context function registry already imports `identificationFunctions`.
- `next.config.ts` — Serwist disabled in development and current `Permissions-Policy: camera=()` header to verify against native capture.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `createPlant` already supports `source: 'identification'` and accepts an outer `tx`, which is the right seam for confirm-identification.
- `rejectOversizeBuffer` and `rejectGpsMetadata` already implement the server-side image defense-in-depth path required by IDENT-16.
- `withUnitOfWork` already provides a transaction and RLS GUC binding; Phase 6 should add the advisory lock inside this boundary.
- `ModalSheet`, `Combobox`, `ScientificName`, `CaptureButton`, `Skeleton`, `InlineError`, `ReadOnlyBanner`, and `useOnlineStatus` are already available from earlier phases.
- `identificationFunctions` is intentionally empty and ready for this phase to add `notifyCeiling`.
- `ErrorCode.CapHit`, `ErrorCode.ProviderUnavailable`, `ErrorCode.ConsentRequired`, and `ErrorCode.Timeout` already exist; internal-only provider reasons already mask to `provider_unavailable`.

### Established Patterns

- Route handlers validate and delegate. They must not import Drizzle tables directly.
- Repositories are functional modules under `src/contexts/*/infrastructure/db/`.
- Runtime DB uses `postgres-js` with `{ prepare: false }`; migrations own schema changes.
- User-owned data gets explicit `user_id` filters even with RLS defense in depth.
- Cursor pagination uses opaque JSON/base64-style cursors and stable `(created_at, id)` ordering.
- Mutating endpoints should accept `Idempotency-Key` where applicable.
- Server-side telemetry is preferred for privacy and authority; client PostHog should not be added for identification events.
- Serwist is disabled in development and `/api/*` should remain NetworkOnly.

### Integration Points

- Add provider/domain types under `src/contexts/identification/domain/`.
- Add repositories for identifications, limits, budgets, usage counters, and circuit breakers under `src/contexts/identification/infrastructure/db/`.
- Add providers under `src/contexts/identification/infrastructure/providers/`.
- Add use-cases under `src/contexts/identification/application/`: router, identify, confirm, correct, list.
- Add API routes: `src/app/api/v1/identifications/route.ts`, `src/app/api/v1/identifications/[identificationId]/confirm/route.ts`, `src/app/api/v1/identifications/[identificationId]/correct/route.ts`, and `src/app/api/v1/iam/consents/route.ts`.
- Replace `src/app/(app)/identify/_identify-placeholder.tsx`; add global history and per-plant history pages.
- Extend `messages/pt-BR.json` under `identify.*`.
- Add tests across unit, integration, and Playwright for provider routing, caps, consent, photo validation, confidence ladder, and 13 UI states.

</code_context>

<specifics>
## Specific Ideas

- LGPD modal draft: title "Para identificar, precisamos enviar suas fotos"; CTA "Entendo e aceito"; cancellation remains possible but no scrim dismissal.
- Zero-results copy: "Hmm, não conseguimos identificar desta vez." plus retake guidance and manual-add link.
- Cap-hit UI has no retry button; it shows reset time and manual-entry link only.
- Stub provider returns three familiar houseplants with confidences around 0.85, 0.62, and 0.35.
- Capture guide is a 2x2 grid: leaf close-up, flower if present, whole plant, and text card "Mais fotos melhoram a precisão".
- Multi-photo strip shows 56px thumbnails, remove button, and `n/5` count badge.
- Provider event payload for Phase 7 should include `identificationId`, `userId`, `plantId`, `provider`, `model`, `selectedSpeciesId`, `latencyMs`, and `succeededAt`.

</specifics>

<deferred>
## Deferred Ideas

- Care guide rendering and care-guide augmentation UI — Phase 7.
- Toxicity badge on identification/care surfaces — Phase 7.
- Re-identification from plant profile — post-MVP.
- Batch identification or multi-plant sessions — post-MVP.
- Species search/browse without photo — Phase 7 or post-MVP.
- Provider cost analytics dashboards — Phase 13.
- Operator DB kill-switch via `provider_budgets.is_active=false` as a router skip — defer unless planner decides it is low-risk and needed for ops.

### Reviewed Todos (not folded)

None. Auto mode folded all score >= 0.4 todo matches into the planning inputs above.

</deferred>

---

*Phase: 06-identification-flow-cost-controls*
*Context gathered: 2026-05-05 (--auto mode, all gray areas auto-selected, recommended decisions applied)*
