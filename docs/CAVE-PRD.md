# CAVE-PRD — Folhário MVP

Single source. Merges PRD, ACCEPTANCE-CRITERIA, BEHAVIOR, DATA-MODEL, API-CONTRACT, HIGH-LEVEL-DESIGN, SCREENS, USER-FLOWS, UX-GOALS, ACCESSIBILITY, DESIGN. Caveman tone. Only project-specific facts. Skip what Claude already knows (REST/JWT/JSON/PWA/LGPD basics, WCAG general, snake_case).

Date: 2026-04-12. Locale: pt-BR only. Today southern hemisphere.

---

## 1. Product

Plant ID + care + reminder app for BR beginners. PWA now, native later. All decisions must keep native door open.

Core loop: identify → catalog → care guide → remind. Reminders = retention engine.

Single tier monthly subscription. Stripe (card + Pix). No freemium. Price TBD (blocker).

Trial starts at signup (NOT first identify). Organic = 14 days. Partner code = 30 days.

Voice: knowledgeable friend, not textbook. Simple words. No jargon. No Latin without common name.

### Non-negotiables

1. Value <2 min from email verification (verified → first photo → identified → in catalog). Email verification is required before first identification; the 2-minute clock starts at verification, not signup.
2. Toxicity warnings: icon + colored badge + text. Never buried. Always with disclaimer "Informação gerada por IA — confirme com um veterinário."
3. Honest AI. Show confidence %. AI-generated care guides marked "Gerado por IA".
4. i18n day one. Every string through layer. No hardcoded text. Ships pt-BR only.
5. Never hold data hostage. Read-only catalog mode keeps view access; only blocks identify + reminders + edits.
6. Push permission ONLY on first reminder creation. Never at signup, first visit, first identify.
7. Cap-hit + provider-unavailable always offer manual entry.
8. Mobile-first PWA. Desktop = tablet-width centered, bg fill sides. No wide-screen design.
9. WCAG 2.1 AA = ship blocker.

### Anti-patterns

- No freemium gating.
- No forced onboarding tour.
- No dark patterns on cancel/delete.
- No auto-escalation/shaming on overdue.
- No fake confidence numbers.
- No hiding AI provenance.

---

## 2. Tech Stack

| Layer       | Choice                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| Frontend    | Next.js (App Router) + React + TS, PWA via SW + manifest                           |
| Backend     | Next.js Route Handlers under `/api/v1` (same deploy)                               |
| Data access | Drizzle ORM, queries inside repositories only                                      |
| DB          | Supabase Postgres via Supavisor pooler (transaction mode), RLS as defense in depth |
| Auth        | Supabase Auth behind adapter, JWT verified in middleware                           |
| Storage     | Supabase Storage behind adapter, signed URLs                                       |
| Async       | Inngest (events + cron + durable `step.sleepUntil`)                                |
| Email       | Resend, React Email templates                                                      |
| Errors      | Sentry (Next.js SDK + source maps from CI)                                         |
| Analytics   | PostHog US cloud (LGPD Art. 33 transfer basis via PostHog SCCs)                    |
| Push        | `web-push` + VAPID, dispatched from Inngest                                        |
| Hosting     | Vercel, deploys from GitHub Actions ONLY (git integration disabled)                |
| Testing     | Vitest + Playwright. Real Postgres for integration                                 |

Storage buckets (all private, signed-URL access): `plant-photos`, `plant-thumbnails`, `data-exports`.

Repo layout:

```
src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/
  {domain,application,infrastructure,api,inngest}/
src/shared/{db,events,adapters,config,telemetry}/
```

Route handlers thin: validate → use-case → HTTP map. No Drizzle in handlers.

---

## 3. Bounded Contexts

Each context owns its aggregates. Cross-context = Inngest events for async, thin read-only query services for sync reads.

| Context            | Aggregates                                                                | Emits                                                                                                      | Consumes                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **IAM**            | User, ConsentLog, PartnerStore, DataExportRequest, DataDeletionRequest    | user.signed_up, user.consent_granted/revoked, user.deletion_requested, user.deleted, data_export.requested | subscription.status_changed                                                                                                  |
| **Catalog**        | Plant, PhotoEntry                                                         | plant.created, plant.deleted                                                                               | user.deletion_requested, identification.succeeded                                                                            |
| **Species & Care** | Species, CareGuide                                                        | care_guide.augmented, care_guide.published                                                                 | identification.succeeded                                                                                                     |
| **Identification** | Identification, ProviderBudget, ProviderUsageCounter, IdentificationLimit | identification.succeeded/failed, provider.ceiling_reached                                                  | user.consent_granted                                                                                                         |
| **Reminders**      | Reminder, ReminderLog                                                     | daily_reminder_summary.due, reminder.completed                                                             | plant.created/deleted, subscription.status_changed                                                                           |
| **Billing**        | Subscription, BillingEvent                                                | subscription.status_changed, payment.failed, trial.ending                                                  | user.signed_up                                                                                                               |
| **Notifications**  | PushSubscription                                                          | notification.sent/failed                                                                                   | daily_reminder_summary.due, care_guide.augmented, subscription.status_changed, deletion events, payment.failed, trial.ending |

### Inngest functions (MVP)

- `care-guide/augment` ← identification.succeeded
- `iam/process-deletion` ← user.deletion_requested (uses `step.sleepUntil(grace_period_ends_at)`)
- `iam/generate-export` ← data_export.requested
- `billing/process-webhook` ← billing.webhook.received (idempotent on event_id)
- `billing/trial-ending-notifier` ← daily cron, fires `trial.ending` at T-3d, T-1d
- `reminders/dispatch` ← cron every 5 minutes; advances `next_due_at` and emits `daily_reminder_summary.due` per user once per day at their `notification_time_local` when they have ≥1 reminder due/overdue
- `notifications/send-email` ← any email-trigger event
- `notifications/send-push` ← daily_reminder_summary.due; deletes PushSubscription rows on 410/404 from push service

---

## 4. Data Model

```
User
  id, email, name, locale (default pt-BR)
  timezone (IANA, captured at signup via Intl.DateTimeFormat().resolvedOptions().timeZone, editable)
  notification_time_local (HH:MM, default "09:00", interpreted in User.timezone — applies to ALL reminders)
  trial_source (organic|partner)
  partner_code (nullable)
  age_confirmed_at (proof ≥13)
  email_verified_at TIMESTAMPTZ NULL  -- Set on /auth/verify (email+password) or /auth/oauth-complete (Google OAuth pre-verified per AUTH-03). Never use auth.users.email_confirmed_at for product gating per Phase 4 D-22.
  toxicity_disclaimer_acknowledged_at (nullable, set on first care-guide modal dismiss)
  deletion_requested_at (nullable)
  created_at

Plant (belongs User)
  id, user_id, species_id (nullable), name, nickname, location, acquisition_date, notes, cover_photo_url, created_at

Species (reference, shared)
  id, common_name (localized), scientific_name, reference_image_url
  flag_reason (nullable: missing_care_guide|incomplete_data|user_reported)
  flag_status (nullable: open|resolved)
  identification_count (int, default 0)
  resolved_at, resolved_by (nullable: "augmentation")

CareGuide (belongs Species, versioned, localized)
  id, species_id, locale, version
  source (editorial|imported|augmented)
  watering, light, soil, temperature_min, temperature_max, humidity
  toxicity (safe|toxic_pets|toxic_children|toxic_both)
  toxicity_source_url (nullable, grounding citation)
  difficulty (easy|medium|hard)
  seasonal_tips, compatibility_notes
  updated_at

PhotoEntry (photo journal, belongs Plant)
  id, plant_id, photo_url, thumbnail_url, note, created_at

Identification (history, belongs User)
  id, user_id, plant_id (nullable)
  photo_urls (array — multiple per identification)
  provider, model
  results (JSON array of top-N w/ confidence)
  selected_result (nullable)
  manual_correction (nullable)
  latency_ms
  consent_version (active at request time)
  status (success|failed)  // authoritative enum
  failure_reason (nullable, required when failed; enum: timeout|provider_unavailable|cost_ceiling_reached|breaker_open|invalid_response)
  created_at

Reminder (belongs Plant)
  id, plant_id
  type (watering|fertilization)
  frequency_days
  advance_rule (from_scheduled|from_acted, default from_scheduled)
  next_due_at (UTC, computed at create/advance from User.notification_time_local + User.timezone)
  is_active, created_at

ReminderLog
  id, reminder_id, action (done|snoozed), scheduled_date, acted_at, snooze_until

PartnerStore
  id, name, code (unique), trial_days (default 30), is_active

ConsentLog (belongs User)
  id, user_id
  purpose (identification_third_party|push_notifications|marketing|...)
  legal_basis (consent|contract|legitimate_interest|...)
  policy_version
  granted_at, revoked_at
  source (signup|settings|first_use_prompt)

DataExportRequest
  id, user_id, status (pending|ready|delivered|failed), requested_at, completed_at, download_url (signed, time-limited)

DataDeletionRequest
  id, user_id, requested_at
  grace_period_ends_at (= requested_at + 7d)
  status (pending|cancelled|completed), completed_at

Subscription (belongs User)
  id, user_id, provider, provider_customer_id, provider_subscription_id
  status (trialing|active|past_due|canceled|expired)
  trial_start_date, trial_end_date
  current_period_start, current_period_end
  cancel_at_period_end (bool), created_at, updated_at

BillingEvent
  id, subscription_id (nullable — some events arrive before linkage)
  provider, event_id (UNIQUE — provider id, idempotency key)
  event_type, payload (raw), processed_at, created_at

IdentificationLimit (DB-driven caps)
  id, tier (trial|paid), daily_cap, period_cap, updated_at, updated_by

ProviderBudget (DB-driven config)
  id, provider, purpose (identification|care_guide)
  daily_cost_cap_cents
  alert_threshold_pct (default 80)
  min_confidence (nullable, 0..1, seed 0.30, only meaningful when purpose=identification)
  is_active, updated_at, updated_by
  UNIQUE(provider, purpose)

ProviderUsageCounter (atomic, per UTC date)
  id, provider, purpose, utc_date, request_count, estimated_cost_cents, last_updated
  UNIQUE(provider, purpose, utc_date)

OfflineSyncFailure
  id, user_id, action_type ("photo_upload"|"reminder_done"|"plant_edit"|...)
  payload (original queued action)
  attempts, last_error, last_attempt_at, created_at

PushSubscription (per-device)
  id, user_id, device_id (client-stable id)
  endpoint (push service URL)
  keys (VAPID/auth secret)
  created_at, last_seen_at
```

Plant deletion: cascades PhotoEntry + Reminder rows; storage objects scheduled for delete; `Identification.plant_id` set NULL but row preserved.

---

## 5. API Rules

REST under `/api/v1`. JWT bearer per device, independent revocation.

Public endpoints (no auth): signup, login, OAuth callbacks, Stripe webhook.

Idempotency: mutating endpoints accept `Idempotency-Key`. Offline queue uses each action's client UUID as the key.

Pagination: opaque cursor, `?cursor=&limit=` (default 50, max 200), response carries `next_cursor` (null when exhausted). Clients MUST NOT parse cursors.

Timestamps: ISO-8601 UTC with `Z`. Dates: `YYYY-MM-DD`. ONE exception: `User.notification_time_local` is `HH:MM` interpreted in User.timezone.

Consistency: writes authoritative at server commit; cross-device reads eventually consistent; conflicts = last-write-wins by server timestamp.

### Error code registry (CLOSED — no ad-hoc codes)

| Code                        | HTTP | When                                                                                                      |
| --------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| `unauthenticated`           | 401  | Missing/invalid bearer                                                                                    |
| `token_expired`             | 401  | JWT past exp; client should refresh                                                                       |
| `invalid_credentials`       | 401  | Login mismatch                                                                                            |
| `forbidden`                 | 403  | Authed but not authorized                                                                                 |
| `email_unverified`          | 403  | Authed but email not yet verified; only resend-verification + Settings/account endpoints reachable        |
| `validation_failed`         | 400  | Body/query schema fail                                                                                    |
| `invalid_partner_code`      | 400  | Unknown/inactive partner code (signup or Settings); signup may proceed cleared                            |
| `not_found`                 | 404  | Resource missing or invisible                                                                             |
| `conflict`                  | 409  | Concurrent mod / unique violation                                                                         |
| `consent_required`          | 403  | Activity needs ungranted consent                                                                          |
| `deletion_in_progress`      | 403  | Inside 7-day grace; only reactivation/cancel-deletion/read-only LGPD reachable                            |
| `subscription_required`     | 402  | Endpoint needs active/trialing                                                                            |
| `read_only_mode`            | 402  | Mutation blocked by read-only catalog mode                                                                |
| `cap_hit`                   | 429  | Per-user daily/period identification cap reached                                                          |
| `provider_unavailable`      | 503  | All providers down (cost ceiling/breaker/outage). Only ID-availability code clients see                   |
| `cost_ceiling_reached`      | —    | INTERNAL only. Logged + persisted in `Identification.failure_reason`. Surfaced as `provider_unavailable`  |
| `breaker_open`              | —    | INTERNAL only. Same handling                                                                              |
| `timeout`                   | 504  | Backend timed out waiting for provider                                                                    |
| `webhook_signature_invalid` | 401  | Stripe signature fail. NO BillingEvent written                                                            |
| `rate_limited`              | 429  | Public auth endpoint per-IP throttle tripped (signup/login/OAuth callbacks). Not emitted elsewhere in MVP |
| `internal_error`            | 500  | Unhandled                                                                                                 |

### Rate limiting

App-layer only for authed endpoints (per-user caps + per-provider ceilings + breakers). Public auth endpoints (`POST /auth/signup`, `POST /auth/login`, OAuth callbacks) get a narrow per-IP attempt throttle to blunt credential stuffing / password spray — typed `rate_limited` 429 once tripped (only place the code is emitted in MVP). All other authed endpoints unlimited; mitigation = auth-required-only. Broader edge rate limiting revisitable post-MVP.

---

## 6. Identification

Cloud-only. No on-device model.

### Flow

Inputs: 1..N photos (camera/gallery, multipart). Outputs: top 3 results ordered by confidence (common_name pt-BR, scientific_name, confidence float, thumbnail).

Backend filters results below `ProviderBudget.min_confidence` (seed 0.30). If <1 passes → "could not identify" state with retake guidance. User selects, dismisses to manual entry, or types correction.

### Provider abstraction

```
IdentificationProvider:
  identify(images, options) → IdentificationResult[]

IdentificationResult: { common_name, scientific_name, confidence: 0..1, metadata }
IdentificationOptions: { max_results, language, min_confidence }
```

Backend chooses active provider, not client. Required MVP connectors: **Plant ID** + **OpenAI-compatible** vision (any compat endpoint: OpenAI/Anthropic/local).

Router consults per-provider cost ceiling + breaker BEFORE dispatch. Falls over to next configured provider on unavailability. Logs reason on rejection: `cap_hit`, `breaker_open`, `cost_ceiling_reached`.

Prompts + provider config managed in source, versioned with app deploy.

### Cost controls (backend, before provider call — authoritative)

**Per-user caps** (from `IdentificationLimit`):

| Tier     | Daily | Period                 |
| -------- | ----- | ---------------------- |
| trialing | 5     | 75 per trial window    |
| active   | 15    | 200 per billing period |

Period window:

- trial: `[Subscription.trial_start_date, trial_end_date]`
- paid: `[current_period_start, current_period_end]`

Computed: `count(Identification where user_id=X AND created_at >= window_start)`. Denormalized counter only if perf demands.

Cap-exceeded: typed `cap_hit`, NO provider call, NO `Identification` row written, NO `ProviderUsageCounter` increment. UI shows reset time + manual entry link. No retry button.

**Per-provider global ceiling** (from `ProviderBudget`, keyed `(provider, purpose)`):

| Provider      | Daily cap (default) |
| ------------- | ------------------- |
| Plant ID      | USD 5/day           |
| OpenAI-compat | USD 5/day           |

`ProviderUsageCounter` row keyed `(provider, purpose, utc_date)`. Increment ATOMICALLY before dispatch. Concurrent requests serialize; no lost writes.

`purpose` = `identification` | `care_guide`. INDEPENDENT budgets/counters. Care_guide exhaustion never affects identification.

At ceiling: provider marked unavailable rest of UTC day → fallover → if all exhausted, `provider_unavailable`.

Alert email via Resend at 80% of daily ceiling.

**Circuit breaker** (per provider): trip after N consecutive failures in window, half-open after cooldown, close on success. Defaults left to impl. Trips logged with `breaker_open`.

All caps/ceilings stored in DB, runtime tunable via direct DB writes. No admin UI in MVP. Short in-memory cache acceptable.

### Failure modes

| Scenario                       | Behavior                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All providers down             | `provider_unavailable` 503. Writes `Identification` row `status=failed`, `failure_reason` = most specific internal reason. Photo kept in IndexedDB while on screen, lost on leave. "Try again" button. NO persistent retry queue |
| Backend timeout / network drop | `timeout` 504. `status=failed`, `failure_reason=timeout`. Visible in history                                                                                                                                                     |
| User leaves mid-request        | Request completes server-side, persists to history. No in-flight UI restored on return                                                                                                                                           |
| Malformed/empty response       | Counted as provider failure → breaker increment → fallover. `failure_reason=invalid_response`                                                                                                                                    |

### `Identification.status` schema

- `success`: call completed, structured result set returned (possibly empty after threshold filter).
- `failed`: requires `failure_reason` ∈ `{timeout, provider_unavailable, cost_ceiling_reached, breaker_open, invalid_response}`.

Client error codes: `timeout`, `provider_unavailable`, `cap_hit`. Internal-only: `cost_ceiling_reached`, `breaker_open` (surface as `provider_unavailable` when no fallback).

### Vercel function budgets (identification)

Total wall-clock 50s. Per-call cap 30s. Try next fallback only if remaining budget ≥10s, else short-circuit `provider_unavailable`. Per-call timeout = provider failure for breaker. Identification handlers hosted in route handlers (≤60s platform cap; 10s slack for parsing/buffering/response).

### LGPD consent gate

First identify attempt EVER triggers consent modal disclosing active providers (Plant ID, OpenAI-compat) and international transfer (Art. 33). Block until granted. Store consent version on each `Identification` record. Revocation in Settings blocks future identifications, preserves existing data.

### Manual correction

Override result by typing name. Stored in `manual_correction`. Resolves `Species` by name match if possible, else null + flag for species lookup. Flagged in DB for future training/quality (not used in MVP).

### History

Every attempt persisted (success + failure). Browsable. Re-associatable with catalog entries. Failures show `status` + `failure_reason`.

---

## 7. Catalog ("Meu Jardim")

### Add plant

- From identification: prefilled name + photo, `species_id` set, `Identification.plant_id` set on confirm.
- Manual: name + ≥1 photo required, `species_id` null, `PhotoEntry` created for initial photo.
- Required: name, ≥1 photo. Optional: nickname, location, acquisition_date, notes.

### Plant profile

Cover + thumbnail gallery, name, nickname, room, acquisition_date, notes, care card link (if `CareGuide` exists), active reminders, photo journal, ID history (if applicable), edit inline, delete in overflow.

### Room/location field

Combined input. Shows: user's previously-used locations (quick-select) + defaults `[living room, balcony, bedroom, bathroom, kitchen, office, garden, other]` + free text. Free text becomes reusable. NOT GPS.

### Photo journal

Chronological per plant. Add photo + optional note → `PhotoEntry`. Reverse-chrono timeline. Doubles as motivation + diagnostic.

### Sorting

Name A-Z, name Z-A, acquisition_date newest (DEFAULT), acquisition_date oldest, location. Null dates sort last. Sort persists for session.

---

## 8. Care Guides

Two tracks.

### Track 1 — Curated launch corpus (LAUNCH BLOCKER)

- Owner: founder
- Target: 200+ domestic species, complete care guides published before MVP launch
- Source pipeline: PlantNet open data (https://identify.plantnet.org/open_data) for species/scientific/reference images → curated DBs (RHS, Embrapa) for care fields → LLM-assisted draft + human review → toxicity AI-sourced via grounded LLM (same `CareGuideProvider`) → common-name normalization to pt-BR
- "Grounding" = provider-side web search/RAG. Folhário does NOT implement own retrieval pipeline.

### Track 2 — Runtime augmentation

Async, after successful identification, when `Species` has no `CareGuide` row OR existing row missing fields. OFF user's critical path (identify response not delayed).

`CareGuideProvider`:

```
augment(species: SpeciesRef, missing_fields: string[], language: string) → CareGuideDraftPayload
CareGuideDraftPayload: { fields: Record<string,any>, citations: Record<string,string>, metadata: Record<string,any> }
```

Toxicity included. Provider grounding relied upon. Disclaimer makes AI provenance explicit.

Augmented row handling:

- LLM result → upsert `CareGuide` row with `source=augmented`, bump `version`. No editor review queue in MVP — augmented guides go live immediately.
- Augmented guides ALWAYS render with persistent "Gerado por IA" badge (§17 chip). Badge never disappears for `source=augmented` rows.
- On successful upsert, `Species.flag_status` set to `resolved`, `resolved_by="augmentation"`, `resolved_at=now`.

Cost: through `(provider, purpose=care_guide)` budget row. Care_guide exhaustion pauses augmentation, leaves identification untouched. Function exits without provider call when budget hit, logs `cost_ceiling_reached`, leaves `CareGuide` untouched.

Logging per attempt: provider, model, prompt version, latency, est cost, outcome, resulting `CareGuide` row id.

### Card content

| Field       | Format                                          |
| ----------- | ----------------------------------------------- |
| Watering    | frequency range + descriptive guidance          |
| Light       | direct sun / indirect / shade + guidance        |
| Soil        | substrate type                                  |
| Temperature | °C range                                        |
| Humidity    | low/med/high + tips                             |
| Toxicity    | safe / toxic_pets / toxic_children / toxic_both |
| Difficulty  | easy/med/hard (visual scale)                    |

Plus seasonal tips (SH summer/winter), plant compatibility reference block.

### Toxicity rules

- Icon + colored badge + text. TOP of care card AND plant profile.
- Mandatory disclaimer line always visible: **"Informação gerada por IA — confirme com um veterinário."**
- One-time modal on first-ever care guide view per user. Persisted in `User.toxicity_disclaimer_acknowledged_at`.
- Never relies on color alone.

### Missing care guide

Care card section HIDDEN on plant profile. All other features work (journal, reminders, notes). Flag set on `Species` (`flag_reason=missing_care_guide`, `flag_status=open`, `identification_count` incremented). Augmentation triggered async. Card appears on next view if augmentation succeeds.

---

## 9. Reminders

### Creation

Only from plant profile. NO suggestions or prompts on plants without reminders. Frequency prefilled from care guide if available, editable. Advance rule default `from_scheduled`, editable. Time of day is NOT per-reminder — all reminders fire at `User.notification_time_local` (default `09:00`, editable in Settings).

### Scheduling

`next_due_at` stored as UTC. Computed at create/advance from `User.notification_time_local + User.timezone`. Dispatcher queries by UTC. NO per-request tz math at fire time.

### Timezone

`User.timezone` IANA. Captured at signup via device, editable in Settings.

Travel NOT handled. Changing tz in Settings does NOT retroactively shift already-scheduled reminders — only future computations use the new tz. Rationale: traveling user isn't tending plants.

### Advance rules

- `from_scheduled`: next due = previous scheduled + frequency. Use when CADENCE matters ("always Mondays").
- `from_acted`: next due = done timestamp + frequency. Use when INTERVAL since action matters ("water 7 days after last").
- Default `from_scheduled`.
- Snooze affects ONLY current occurrence; next occurrence after Done unaffected by snooze.

### Actions

In-app only. Push is a SINGLE DAILY NUDGE that tells the user to open the app — it never carries Done/Snooze controls (§15).

- Done (in-app) → `ReminderLog action=done` + advance `next_due_at`.
- Snooze (in-app, 1h / 3h / tomorrow) → `ReminderLog action=snoozed`, `snooze_until` set.

### Overdue

Visually distinct from upcoming. NO escalation, NO auto-mute, NO auto-complete. Doesn't change visual weight as it ages. Stays in daily summary until user acts.

### Daily summary

Morning in-app summary screen (NOT push) listing today's pending tasks across all plants with active reminders. Lives on Home (§Screens). Doubles as in-app notification center for missed pushes.

### Pause on billing

Scheduling + delivery PAUSED when subscription not in `trialing`/`active`. `next_due_at` not advanced. Resume on return to trialing/active.

### Failure modes

- Daily nudge push fails / no permission / device offline → user simply sees the same due/overdue list on Home next time they open the app. The list is derived live from `Reminder` + `ReminderLog`. NO dedicated entity, NO missed-push backlog — Home IS the source of truth.
- Done while offline → queued, synced on reconnect, idempotent.
- Plant deleted on another device → queued Done action dropped silently on sync.

---

## 10. Offline & Sync

### Queue

Each action gets client-generated UUID for idempotency. Replays deduped server-side via `Idempotency-Key` mechanism. Replay in CHRONOLOGICAL order by client timestamp.

Offline blocks:

- New identifications BLOCKED (cloud-only). Clear message.
- Cached catalog + care guides BROWSABLE.
- Photo adds + reminder dones QUEUED.

### Conflict rules

- Plant deleted server-side → drop ALL queued actions for it → single discard summary toast on next open → tappable expands to modal listing discarded actions grouped by type ("2 photo uploads, 1 note edit" for plant "Maria") with original client timestamps. Read-only list.
- Field edit on stale data → last-write-wins by SERVER timestamp. NO merge UI.
- Photo upload to deleted plant → drop, included in summary.
- Reminder Done when reminder gone → drop SILENT.

### Retry

Action fails 5 retries → `OfflineSyncFailure` row → "Needs attention" list in Settings → manual retry/discard.

---

## 11. Image Handling

- Object storage (Supabase Storage buckets §2).
- Client-side compression before upload, target ≤1MB.
- EXIF (incl GPS) stripped CLIENT-SIDE (LGPD minimization). Server REJECTS uploads still carrying GPS as `validation_failed` (defense in depth).
- Thumbnail generation on upload for catalog views.
- Original preserved for ID accuracy.
- NO per-user storage limits in MVP.

### Failure modes

- Compression fail → retry once at lower quality → still fail → error + prompt different photo.
- Upload fail mid-transfer → compressed image stays in IndexedDB queue → standard offline retry. NO partial files in storage.
- Thumbnail gen fail → original saved → catalog placeholder → next sync regenerates.

---

## 12. Auth & Subscription

### Auth

Email+password OR OAuth (Google min). NO anonymous. Trial requires account.

**Email verification gate.** Email+password signups MUST verify their email before any identification, plant create/edit, reminder action, or other mutation. Verification email dispatched via Resend on signup. Until verified, requests to gated endpoints return `email_unverified` 403; only resend-verification, Settings/account, and logout endpoints are reachable. OAuth signups (Google) are pre-verified by the provider and bypass the gate. The §1 "value <2 min" non-negotiable measures from verification, not signup.

JWT per-device. No server sessions. Per-device tokens + push subs, independently revocable.

Signup form:

- Email, password, confirm password
- Age confirmation ≥13 checkbox (block <13 — `User.age_confirmed_at` set only on confirm)
- OAuth (Google)
- Optional expandable: "Tenho um código de parceiro" → input
- T&C + privacy policy links (must accept)

Capture timezone from device at signup (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

### Credential management (MVP scope)

MVP ships TWO credential flows. Change-email and "logout-all-devices" are out of scope (post-MVP).

- **Password reset** (forgot password): unauthed flow. POST email → Resend dispatches reset link with single-use token + 1h expiry. Tokens stored hashed; bound to user; invalidated on use OR on next successful password change. Public endpoint shares the public-auth per-IP throttle (§5). Always returns 200 regardless of email existence (no enumeration). Clicking the link → set-new-password screen → on success, password updated. Existing JWTs stay valid (no global revocation in MVP).
- **Change password** (Settings, authed): requires CURRENT password + new password + confirmation. Wrong current → `invalid_credentials` 401. On success, password updated; existing JWTs stay valid.
- OAuth-only accounts (Google) have NO password and see neither flow. Settings hides both controls when user has no email+password credential.

### Partner codes

- At signup: valid → 30-day trial + `User.trial_source=partner` + `User.partner_code` recorded. Invalid → inline error, user clears to proceed with 14-day. Absent → 14-day.
- Late entry in Settings: accepted ONLY while `Subscription.status=trialing` AND server wall-clock STRICTLY before `trial_end_date`. Valid late code → `trial_end_date = created_at + 30 days` in ONE write. NO clock reset. NEVER stacks. Once trial_end_date passed (even by 1s), code never accepted again.
- Deactivating `PartnerStore` post-grant does NOT affect already-established trials.

### Subscription state machine

| From             | To       | Trigger                                             |
| ---------------- | -------- | --------------------------------------------------- |
| (none)           | trialing | account created                                     |
| trialing         | active   | first charge success after trial end                |
| trialing         | expired  | trial_end_date passes, no valid PM                  |
| active           | past_due | renewal charge fails                                |
| past_due         | active   | payment recovered                                   |
| past_due         | canceled | dunning exhausted                                   |
| active           | canceled | user cancels (effective at current_period_end)      |
| canceled         | expired  | current_period_end reached                          |
| canceled/expired | active   | user reactivates with new PM (pre-account-deletion) |

Full app access: `active` + `trialing`. All else → read-only catalog mode.

Webhook handler is AUTHORITATIVE for `Subscription.status`. Client NEVER mutates status directly. Trial → paid transition driven by Stripe webhook.

### Read-only catalog mode (when not active/trialing)

- Plants, photos, journal, care guides: VIEW.
- Identify: blocked → `subscription_required` 402 + paywall prompt UI.
- Reminders: paused (no push, no scheduling, no `next_due_at` advance).
- New plants / journal entries / edits: blocked → `read_only_mode` 402.
- Settings: FULL access (payment update, reactivate, export, delete).

### Dunning

Stripe 4 retries over 7 days. Email per failed attempt with PM update link via Resend. Recovered → active. Exhausted → canceled → read-only.

### Cancellation

From Settings. Sets `cancel_at_period_end=true`. UI confirms `current_period_end` date. Full access until that date.

### Reactivation

From Settings. Available while account exists, including 7-day deletion grace. Reactivating after `expired` = NEW subscription (not resume of prior one).

### `BillingProvider` interface

```
create_customer(user) → CustomerRef
start_subscription(customer, plan, trial_end?) → SubscriptionRef
cancel_subscription(subscription, at_period_end: bool) → SubscriptionRef
reactivate_subscription(subscription) → SubscriptionRef
update_payment_method(customer) → PaymentMethodRef
get_subscription(subscription) → SubscriptionState
handle_webhook(payload, signature) → BillingEvent
```

Business logic NEVER calls Stripe SDKs directly. Allows swap to Pagar.me/Mercado Pago/Iugu later.

### Stripe config

- One product `folhario_monthly`, one price (TBD BRL).
- Test + live modes; live enabled only after pricing blocker resolves.
- Methods: card + Pix.
- Dunning: 4 retries / 7 days.
- Webhook: `POST /api/v1/webhooks/stripe`. Handler does THREE steps SYNCHRONOUSLY before returning 200:
  1. Verify signature (fail → `webhook_signature_invalid` 401, NO BillingEvent row, log to Sentry critical, no Inngest enqueue)
  2. Insert `BillingEvent` with UNIQUE constraint on `event_id` — constraint violation = dedup signal, return 200 no-op
  3. Enqueue `billing.webhook.received` to Inngest for heavy work
- Any (1)–(3) failure returns non-2xx → Stripe retries.
- Async function `billing/process-webhook` does the actual subscription state transition, emits `subscription.status_changed`, triggers dunning email via Resend.
- Local dev: `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe`.

### Trial tier facts

- Organic 14-day trial → `trial_source=organic`.
- Partner 30-day trial → `trial_source=partner` + `partner_code` recorded.
- Trial clock starts at signup, NOT first identification.
- Trial caps same for organic and partner (75 IDs/window) — partner gets longer window only.

---

## 13. LGPD

### Legal basis (Art. 7)

| Activity                     | Basis                                    |
| ---------------------------- | ---------------------------------------- |
| Account, auth, catalog       | Contract                                 |
| Billing                      | Contract                                 |
| Photos to 3rd-party identify | Consent                                  |
| Push                         | Consent                                  |
| Aggregated metrics           | Legitimate interest                      |
| ID history retention         | Contract + legitimate interest (quality) |

### Rights from Settings (Art. 18)

- **Access:** download all personal data as a zip containing `data.json` (all user records: profile, plants, photo metadata, reminders, reminder logs, identification history, consent log, subscription, billing events) + `photos/` directory holding ORIGINAL photo files (catalog covers + photo journal entries + identification uploads), filenames keyed by their record id.
- **Correction:** existing edit flows.
- **Anonymization/deletion:** account delete.
- **Portability:** structured JSON export.
- **Consent revocation:** per-consent toggle. NEVER breaks existing catalog access.
- **Sharing info:** privacy policy lists all third parties.

### Account deletion (Art. 18 erasure)

- Triggered from Settings. Confirm modal: what's deleted, 7-day grace, cancellation path.
- Insert `DataDeletionRequest`, `grace_period_ends_at = now + 7d`. Set `User.deletion_requested_at`.
- Email sent ("deletion requested") via Resend.
- Account SUSPENDED immediately (only cancel-deletion + read-only LGPD endpoints reachable; others return `deletion_in_progress` 403).
- Inngest function uses `step.sleepUntil(grace_period_ends_at)` — NO cron scanning.
- On wake: if cancelled → exit silently. If still pending → hard-delete photos, plants, ID history, reminder logs, consent records (except minimal deletion-audit row) → "deletion complete" email.
- Backups purged within 30 days (next full backup cycle).
- Aggregated/anonymized metrics may be retained.

### Cancel deletion in grace

From recovery flow. Sets `DataDeletionRequest.status=cancelled`. Account returns to normal access.

### International transfers (Art. 33)

Photos to Plant ID + OpenAI-compat = international transfer. Privacy policy must disclose providers, jurisdictions, safeguards. Consent captured before first transfer.

### Children (Art. 14)

- Signup requires age confirmation ≥13.
- <13 BLOCKED.
- 13–17 follows standard consent.

### Governance

- DPO (Encarregado) appointed, contact in privacy policy + Settings (BLOCKER).
- Breach response: ANPD + affected user notification within Art. 48 timeframes. Documented.
- Privacy policy + ToS published before launch, versioned. Material changes → re-consent for affected processing activities (`policy_version` tracked on `ConsentLog`, surfaced as new consent prompt before next activity use).

### Retention

- ID history, photo journal, catalog: life of account.
- Operational logs with PII: target ≤90 days.
- Deletion audit: as required by law.

### Sentry PII scrubbing (LGPD)

Strip `Authorization`, `Cookie`, any field matching `email|password|token|photo_url`. DROP request bodies on identification routes (photos). Users must NOT appear in breadcrumbs by email.

---

## 14. Multi-Device

- Catalog/care guides replicate via §10 sync — eventually consistent, LWW by server timestamp, idempotent by client UUID.
- Per-device JWT, independently revocable.
- Per-device `PushSubscription` keyed `(user_id, device_id)`. Logout revokes ONLY that device's sub.
- Daily nudge (§15) fans out to EVERY device with an active push sub — one nudge per user-day, not per reminder.
- Done tapped in-app on one device clears the entry on others on next sync.
- Notification prefs (global mute, per-plant mute) GLOBAL across devices, NOT per-device.

---

## 15. Push Notifications

Push is a SINGLE DAILY NUDGE per user — never per-reminder. The nudge tells the user to open the app; the actual due/overdue list lives in-app on Home (§16). The push payload carries NO Done/Snooze controls and NO per-plant detail.

- Permission DEFERRED until first reminder creation. NEVER at signup, first visit, or first identify.
- Service worker via `web-push` + VAPID. Key pair generated once per env.
- Per-device `PushSubscription` row. Daily nudge fans out to every active subscription on the user.
- `reminders/dispatch` (cron) emits `daily_reminder_summary.due` per user at their `notification_time_local` ONLY when at least one reminder is due or overdue that day. Suppressed entirely when subscription not in trialing/active.
- `notifications/send-push` consumes that event and sends the nudge. When the push service returns 410 Gone or 404 Not Found for an endpoint, the corresponding `PushSubscription` row is DELETED in the same step. No cron prune; self-healing.
- Fallback when no push (denied / offline / pruned): user simply sees the same due/overdue list on Home next time they open the app. There is no "missed push backlog" — Home IS the source of truth.
- Notification prefs: global mute (suppresses the daily nudge entirely) and per-plant mute (excludes that plant's reminders from the due/overdue count that decides whether the nudge fires). Both prefs are global across devices (§14).

---

## 16. Screens

All screens constrained to tablet-width on desktop (centered, bg fill sides). Mobile-first.

### Home / Daily Summary

**Empty (zero plants):** Full-bleed primary CTA "Identifique sua primeira planta" + camera button. Secondary text link below: "Adicionar manualmente" → opens manual entry (create plant w/o identification). NOTHING ELSE — no tasks, no notifications, no nav.

**Default (≥1 plant):**

- "Hoje" — reminders due today + overdue (only plants with reminders surface). This list IS the source of truth — it stands in for any missed push (§15), so there is no separate notification center.
- Quick action: "Identificar planta" (camera button)
- Nav to Catalog

**Read-only mode:** persistent banner top "Sua assinatura expirou. Reative para identificar e receber lembretes." → Settings billing. Catalog nav still works. Identify → paywall modal.

### Identify

- Picker (camera/gallery, multi-photo, static capture guide visible: leaf + flower if present + whole plant + "Mais fotos melhoram a precisão")
- Loading (spinner + "Identificando sua planta..." — NO progress bar)
- Results (top 3 cards, ranked, each: thumbnail + common pt-BR + scientific + confidence%, button "Nenhum destes — adicionar manualmente")
- No results / low confidence (retake guidance + "Tentar novamente" + "Adicionar manualmente")
- **Consent gate (first ever):** modal disclosing providers + Art. 33 transfer + data usage. "Aceitar e continuar" / "Cancelar". Blocks until accepted
- **Cap reached:** "Você atingiu o limite de identificações de hoje. Tente novamente após [time]." + manual entry link. NO retry button
- **Provider unavailable:** "Identificação temporariamente indisponível. Tente novamente mais tarde." + "Tentar novamente" (photo retained in IndexedDB while on screen) + manual entry link
- **Offline:** "Identificação requer conexão à internet."
- **Read-only paywall modal:** "Reative sua assinatura para identificar novas plantas." → Settings billing

### Catalog ("Meu Jardim")

Grid (2 cols ≤375px, 3 cols 600–899px, 4 cols ≥900px). Each card: cover photo (4:5), name, nickname (if set), location. Sort top: name A-Z/Z-A, acquisition_date new (default)/old, room. Tap → Plant Profile. Read-only: "Add plant" hidden/disabled.

### Plant Profile

Cover + thumbnail gallery, name + nickname (edit inline), room, acquisition_date, notes, care card preview if available, active reminders, photo journal preview, ID history link, delete in overflow. No-care-guide variant: care card section HIDDEN. Augmented variant (`source=augmented`): persistent "Gerado por IA" badge on top of care card. Read-only: edit affordances hidden.

### Care Guide

Visual icons per dimension. Toxicity badge + disclaimer prominent at top. Persistent "Gerado por IA" badge if `source=augmented`. Seasonal tips. Compatibility block. First-ever-view → one-time toxicity AI disclaimer modal → acknowledge persisted.

### Reminders Management

List grouped by plant. Per entry: plant name, type (water/fertilize), frequency, next due, advance rule. Edit/delete. Create form: type / frequency (prefilled) / advance_rule (default from_scheduled). Header shows current global notification time with a "Change in Settings" link. On save of FIRST reminder ever → push permission prompt (browser-native). Read-only: list visible, "scheduling paused" notice, no edit.

### Photo Journal

Per-plant chronological list (photo + date + optional note). Add entry: picker + note textarea. Read-only: browse only.

### Identification History

Per-user list. Each entry: date, thumbnails, results returned, selected (or "manual correction" or "failed: [reason]"). Detail view: full record + action "re-associate with catalog entry."

### Settings

- **Account:** email (read-only in MVP), "Alterar senha" (email+password accounts only — opens current-password + new-password form), timezone (IANA picker), logout (this device)
- **Notification preferences:** global mute, per-plant mute, push permission status indicator
- **Subscription & billing:** current plan + status, renewal/trial-end date, payment method (last 4 / Pix indicator) + "Atualizar", **partner code input — ONLY shown while status=trialing AND wall-clock < trial_end_date**, cancel button (confirms period end), reactivate (visible on canceled/expired), billing history
- **Privacy & LGPD:** "Exportar meus dados" → DataExportRequest → JSON; "Excluir minha conta" → confirm modal → 7-day grace; manage consents (per-consent toggle); privacy policy link; ToS link; DPO contact info
- **Needs attention (sync failures):** list of `OfflineSyncFailure`, retry/discard per item
- **App info:** version, OSS licenses, support link

### Cross-cutting states

- Unverified-email gate (email+password signups only): full-screen blocker shown in place of the app shell — "Verifique seu e-mail para começar." + resend-verification button + logout link. Cleared the instant verification completes; OAuth signups never see this screen.
- Persistent offline banner top: "Você está offline. Algumas ações serão sincronizadas quando a conexão voltar."
- Persistent read-only banner when subscription not in trialing/active.
- Discard summary toast post-sync (tappable → modal listing discarded actions grouped by type with timestamps, read-only).
- LGPD consent modal triggered contextually, blocks until decided.
- Push permission prompt browser-native, FIRST REMINDER CREATION ONLY.
- Toxicity disclaimer modal one-time, first care guide view.
- **App update toast:** when the service worker detects a new version waiting to activate, a non-blocking bottom toast appears: "Nova versão disponível" + "Atualizar" button. Tapping triggers `skipWaiting` + reloads the page. Dismissible; reappears on next route change if still pending. Honors `prefers-reduced-motion` (no slide-in animation, instant fade). Never auto-reloads mid-session.

---

## 17. Design System

### Atmosphere

"Sunlit morning on a Brazilian veranda." Warm, grounded, quietly confident. Photography-first — user's plant photos are hero. NOT clinical, NOT minty wellness, NEVER textbook.

Adjectives: warm, humanist, tactile, reassuring, unhurried, honest.

### Color tokens (LIGHT — Paper Cream backgrounds)

| Token              | Hex     | Role                                                                                                                      |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Paper Cream        | #FBF7EF | primary app bg (never pure white)                                                                                         |
| Warm Ivory Surface | #FFFDF7 | cards, sheets                                                                                                             |
| Hairline Beige     | #E8E1D0 | 1px dividers, input strokes at rest                                                                                       |
| Canopy Green       | #1F4D35 | brand anchor — primary buttons, active indicators, logo, links. 9.1:1                                                     |
| Forest Ink         | #143424 | headlines, high-emphasis labels. 12.9:1                                                                                   |
| Calm Slate         | #5A6358 | body secondary, metadata, placeholder, inactive. 5.9:1. ONLY approved muted text                                          |
| Understory Sage    | #8AA593 | DECORATIVE ONLY — empty state line art, icons w/ adjacent text labels. 2.5:1. NEVER text, NEVER state graphic             |
| Terracotta Clay    | #C96F4A | delight moments, partner trial badge, streak celebrations, nav badge dots. 3.4:1. Badge/large glyph only, NEVER body text |
| Honey Amber        | #D4A340 | medium-confidence bar fill ONLY. 2.2:1. NEVER text, borders, outlines                                                     |
| Urgent Poppy       | #C73E1D | TOXICITY + destructive confirm ONLY. 4.7:1. Warm Ivory label on Urgent Poppy fill 5.0:1                                   |
| Overdue Rust       | #A14A2C | OVERDUE reminders + form-validation errors. 5.6:1. Shared "needs attention" signal, distinct from safety                  |
| Trust Teal         | #2B6F7A | informational callouts, LGPD disclaimer strip, "Gerado por IA" chip, first-view care-guide modal. 5.4:1                   |

### Color tokens (DARK — Night Cream backgrounds, NOT inverted greyscale, "veranda at dusk")

| Token           | Hex     | Role                                                                                |
| --------------- | ------- | ----------------------------------------------------------------------------------- |
| Night Cream     | #1A1613 | primary bg (never pure black)                                                       |
| Embered Surface | #231E1A | cards, sheets                                                                       |
| Hairline Umber  | #3A332B | 1px dividers, ELEVATION borders (shadows invisible on near-black)                   |
| Canopy Sprout   | #6FAE8A | dark-mode brand. 6.9:1. Primary button label = Night Cream on Canopy Sprout (6.9:1) |
| Moonpaper       | #F2EADB | headlines. 15.0:1. Warm undertone, NOT bone-white                                   |
| Lantern Slate   | #B8B0A5 | body secondary. 8.4:1                                                               |
| Dusk Sage       | #A6BFAE | decorative-only counterpart                                                         |
| Terracotta Glow | #E08B66 | delight, nav badge dots. ≥5:1                                                       |
| Honey Lantern   | #E8BC5E | confidence bar fill only                                                            |
| Urgent Blossom  | #E8593A | toxicity + destructive                                                              |
| Overdue Copper  | #C96A44 | overdue + form errors                                                               |
| Trust Mist      | #5BA5B0 | informational                                                                       |

`color-scheme: light dark`. Follow system pref. Manual override in Settings. Every screen designed and reviewed in BOTH variants. No light-only tokens.

### Confidence ladder (Honest AI — REDUNDANT signals)

Identification result cards combine 4 signals:

- **High (≥70%):** Canopy Green/Sprout bar, 3 filled segments, percentage in Forest Ink/Moonpaper. SR: "Confiança alta, <n>%."
- **Medium (40–69%):** Honey Amber/Lantern bar, 2 filled, percentage label, "Pode ser..." copy. SR: "Confiança média, <n>%."
- **Low (threshold–39%):** Calm/Lantern Slate bar, 1 filled, "Pode ser..." copy. SR: "Confiança baixa, <n>%."

### Accent discipline

Canopy Green/Sprout = ONLY brand accent. All other colors are SEMANTIC SIGNALS — never decorative, marketing, onboarding. Never CTA in Terracotta. Never button in Honey Amber. Never bg panel in Trust Teal. If decoration needed → brand green, neutral surface, or Sage line art. ANY pair not in the contrast ledger is unapproved.

### Typography

- **Editorial — Source Serif 4 (variable):** screen titles, plant names, hero welcome. Weight 500–600. Chosen for pt-BR diacritic rendering + literary warmth (over Fraunces/Instrument Serif).
- **Interface — Plus Jakarta Sans (variable):** everything else. Weight 400 body, 500 labels, 600 buttons. Chosen over Inter/Geist/Satoshi for pt-BR diacritic stacking + warm humanist terminals.
- NEVER substitute Inter, generic serifs (Times, Georgia, Garamond, Palatino), system fonts.
- NEVER mix Source Serif 4 into buttons or form fields.
- Plus Jakarta Sans buttons + all-caps section labels at +2% tracking. No condensed/ultra-tight tracking anywhere.

Type scale (mobile):

- Hero: Source Serif 4 32/38, w500
- Title: Source Serif 4 24/30, w500
- Section label: Plus Jakarta Sans 14/18, w600, uppercase, +4% tracking
- Body: Plus Jakarta Sans 16/24, w400
- Metadata: Plus Jakarta Sans 14/20, w400, Calm/Lantern Slate
- Button: Plus Jakarta Sans 16/20, w600

Respect browser zoom + native Dynamic Type / Android font-scale to LARGEST setting. Line-height 1.4–1.55. Fixed-height containers grow to fit scaled text — clipping = bug.

### Iconography

**Lucide ONLY**, 1.5px stroke, rounded line caps. Stroke variant default; filled only for approved exceptions (toxicity paw+child, bottom-nav active). Sizes: 24px body/care rows, 20px in buttons, 18px in badges/chips, 28px bottom-nav. Empty-state line art = custom but same 1.5px family. NO emoji. NO mixing icon sets within a screen.

### Buttons

- **Primary:** Canopy Green/Sprout fill, Warm Ivory/Night Cream label, 8px radius, 48px tall, flat (no gradient, no shadow at rest), darken to Forest Ink on press. Icon-left = 20px Lucide + 8px gap.
- **Secondary:** transparent fill, Canopy label + 1.5px Canopy stroke. Same geometry. Non-committal actions ("Editar", "Mais tarde").
- **Tertiary / text link:** Canopy label, no border. Inline body actions.
- **Destructive:** Urgent Poppy/Blossom fill, Warm Ivory/Night Cream label. ONLY in confirmation dialogs. Always SECONDARY to "Cancelar" in layout order.
- **Capture button (Identify):** circular 72px Canopy fill, Warm Ivory/Night Cream camera glyph. Floats above capture-guide illustration. ONLY exception to rounded-rectangle geometry — pure circle = "the one thing to do."

### Cards & containers

- **Plant card (catalog):** Warm Ivory/Embered bg, 16px radius, light: shadow `0 2px 12px rgba(20,52,36,0.06)`; dark: 1px Hairline Umber border. 4:5 portrait photo top. 16px padding.
- **Care card section (plant profile):** full-width Paper/Night Cream bg, Hairline Beige/Umber dividers between dimensions. Each dimension = icon-left row, 24px Sage icon, label Plus Jakarta Sans 16 w500, supporting Plus Jakarta Sans 14 Calm/Lantern Slate.
- **Modal sheet (bottom):** 24px top-corner radius, Warm Ivory/Embered Surface, scrim 50% opacity Forest Ink/Night Cream. Light: `0 -8px 32px rgba(20,52,36,0.12)`. Dark: 1px Hairline Umber top border. 36×4px drag handle Hairline Beige/Umber center top.
  - Behavior: focus trap, first focusable receives focus, return focus on close. Android back + iOS swipe-down dismiss with unsaved-changes confirmation. VISIBLE close affordance required (drag handle + labelled "Fechar" button) — tap-scrim allowed only in addition.

### Inputs / forms

- **Text input:** Warm Ivory/Embered bg, 8px radius, 1.5px Hairline Beige/Umber stroke at rest, 1.5px Canopy stroke on focus. Focus ring uses GLOBAL 3px ring. Label floats above in Plus Jakarta Sans 14 w600 Forest Ink/Moonpaper. Error: 1.5px Overdue stroke + filled alert icon + Overdue helper line (3 redundant signals).
- **Select/dropdown:** same geometry + chevron in Calm/Lantern Slate.
- **Toggle:** track 52×32, knob 28×28, Canopy when on, Hairline Beige/Umber when off. Adjacent ON/OFF text label always.

Input behavior (NON-NEGOTIABLE):

1. Validate on BLUR, not keystroke.
2. Semantic types + correct `autocomplete` token (`email`, `tel-national`, `postal-code`, `name`, `given-name`, `street-address`, `new-password`). Forgetting `autocomplete` = bug.
3. Error copy = CAUSE + RECOVERY ("CEP inválido — use o formato 00000-000"). Never color/icon alone.
4. On submit, auto-focus first invalid field + announce via `role="alert"` / `aria-live="polite"`.
5. Multi-error: summary block above form with anchor links + inline per-field errors.
6. Forms >3 fields auto-save draft state locally.

### Toxicity badge composition (NON-NEGOTIABLE)

1. Filled rounded-rect badge 8px radius, Urgent Poppy/Blossom bg, Warm Ivory/Night Cream text.
2. Filled paw+child silhouette icon left at 18px.
3. Literal text "Tóxico para pets e crianças", Plus Jakarta Sans 14 w600.
4. 3px DIAGONAL STRIPED accent border on left edge of parent care-card block — Urgent Poppy/Blossom on Warm Ivory/Embered. Survives even if badge scrolled off-screen.
5. Mandatory disclaimer line directly below: "Informação gerada por IA — confirme com um veterinário", Plus Jakarta Sans 14 Calm/Lantern Slate.
6. SR label: `role="alert"`, full phrase "Alerta de toxicidade. Tóxico para pets e crianças. Informação gerada por IA — confirme com um veterinário." Never just "aviso."
7. Haptic: first reveal per session = native warning (iOS `UINotificationFeedbackGenerator.warning`, Android `HapticFeedbackConstants.REJECT`). Subsequent reveals same session SILENT.

This composition is the ONLY approved treatment.

### Confidence result card

Warm Ivory/Embered bg, 16px radius, whisper shadow / 1px border. Top-left: ref thumbnail 64×64, 8px radius. Top-right: confidence ladder + percentage label. Below: common name (Source Serif 4 20 w500) + scientific name (Plus Jakarta Sans 14 italic Calm/Lantern Slate). Whole-card tap target. `accessibilityLabel` combines common + scientific + confidence in ONE utterance.

### Notification chips

- "Gerado por IA" (augmented care guide, persistent — never removed): Trust Teal/Mist 1px stroke + label, Paper/Night Cream bg, 999px pill, 8px icon-gap. Top of care guide screen.
- "Cap atingido": Overdue Rust/Copper 1px stroke + label, Paper/Night Cream bg, reset time on second line.

### Bottom navigation

Folhário's ONLY nav pattern.

- Max 5 items, current MVP 4: Home, Catálogo, Identificar, Perfil. Overflow → Perfil tab, NEVER another nav slot.
- Each: Lucide icon + text label, ALWAYS. Icon-only nav forbidden. Icon 28px, label Plus Jakarta Sans 12/14 w500, +2% tracking.
- Active: Canopy/Sprout filled-Lucide icon + Forest Ink/Moonpaper label w600 + 3px Canopy/Sprout top-indicator bar flush with bar's top edge.
- Inactive: Calm/Lantern Slate stroke icon + Calm/Lantern Slate label.
- Height: 56px content + `env(safe-area-inset-bottom)` padding. Scroll views reserve equivalent inset.
- Badge: 8px Terracotta Clay/Glow dot top-right of icon, NO numerals. Clears the moment destination visited. Decorative nudge, not counter.
- Switching tabs preserves scroll + filter per tab. Never silently jumps to Home or resets.
- Android back + iOS swipe-back respect stack within active tab.
- Sign-out + "Excluir conta" live at BOTTOM of Perfil tab, separated from normal settings, never reachable from nav bar.

### Loading states

Skeletal shimmer matching final geometry. **NEVER circular spinners.** Catalog card skeleton: 4:5 Hairline Beige/Umber photo block + 60% title line + 40% metadata line. Shimmer left-to-right 1.4s in Warm Ivory/Embered at 40% opacity.

**Timing threshold (NON-NEGOTIABLE):** skeletons render only after 300ms delay. Faster operations skip shimmer, fade content in over 120ms. Flashing shimmer on cached responses looks unserious.

Reduced motion: shimmer disabled, becomes static block, fade-in over 80ms.

### Empty states

Composed invitations, NOT "Nada por aqui" apologies. Each carries:

1. Soft illustrative element (terracotta pot, sprout, watering can — Sage line art, 1.5px stroke, NEVER stock photos)
2. Welcoming Source Serif 4 headline ("Sua estante ainda está esperando a primeira planta.")
3. Calm/Lantern Slate supporting hint
4. EXACTLY ONE Canopy/Sprout primary action

Empty Home, Catálogo, Reminders, ID History each get tailored composition. NEVER generic shell reused.

### Error states

Inline + calm. NEVER full-screen red wall. Network fail on identification: Warm Ivory/Embered card + Sage cloud-off icon + Forest Ink/Moonpaper headline ("Não consegui conectar agora.") + Calm/Lantern Slate supporting line CAUSE+RECOVERY + Canopy "Tentar de novo" primary button. Urgent Poppy/Blossom NEVER for transient errors. Field validation = Overdue Rust/Copper. Every error exposes retry/edit path. "Algo deu errado" with no next step = forbidden.

### Layout

**Whitespace:** strict 8pt grid. 4 allowed only for tight icon-to-label gaps. Section gaps Home + Plant Profile = 32px. Card-to-card grid gaps = 16px. Card padding = 16px. Empty states are MOST spacious surfaces. Home empty state centers circular capture button with ≥96px clearance all sides.

**Grid:** mobile single-column, 20px outer gutters. Catalog: 2 cols ≤375px, 3 cols 600–899px, 4 cols ≥900px (outer gutter expands to 32px). Breakpoint ladder 375/600/900 chosen so 4:5 catalog card lands whole number of columns at every tier. NEVER substitute 768/1024 generic ladder.

Vertical alignment: baseline-oriented. Headlines + body align same left edge. Icon-left rows: icon-center to label-baseline.

Photography: full-bleed Plant Profile hero, 4:5 catalog cards, 16:9 Home Today's tasks preview strip.

**Focus + keyboard:** GLOBAL focus ring = 3px Canopy/Sprout @ 40% opacity, offset 2px outside element bounding box, 8px corner radius matching element shape. 40% opacity is MIN that clears 3:1 UI-graphic floor on Paper/Night Cream — don't lower to 20%. Tab order = visual reading order. Modal sheets trap focus until dismissed. After route change, focus moves programmatically to main content region.

**Hero composition (anti-generic):**

- Asymmetric, NEVER centered. Headline hangs left-aligned ragged-right; primary visual offset right or bleeds beyond right gutter.
- Source Serif 4 headline breaks 2–3 lines @ 32–40px w500. No all-caps. No tracking tricks. No gradient text.
- EXACTLY ONE primary CTA in Canopy/Sprout. NO "Saiba mais" secondary, NO "Ver demo" tertiary.
- Inline plant thumbnail signature move: small circular 40px plant photo may sit inline between headline words ("Cuide das suas [photo] plantas sem medo"). The ONLY approved decorative flourish — sparingly, never twice in same hero, never overlapping type.
- NO scroll arrows, NO "role para baixo", NO bouncing chevrons.
- Photo + type NEVER overlap.

**Elevation model:** mostly flat. ONLY two levels.

- L1 (cards, top nav on scroll): light = `0 2px 12px rgba(20,52,36,0.06)`; dark = 1px Hairline Umber border on Embered Surface
- L2 (modals, bottom sheets, toast): light = `0 8px 32px rgba(20,52,36,0.12)`; dark = 1px Hairline Umber border + 50% Night Cream scrim

In light, depth = surface color shift (Paper → Warm Ivory) more than shadow. In dark, surface shift (Night → Embered) + 1px border.

NO heavy shadows, neumorphism, glassmorphism.

### Motion

Spring-physics, NOT easing-curve. Weighty + organic, NEVER bouncy-cartoonish.

- Primary interactions (button press, sheet reveal, tab switch): spring `stiffness: 120, damping: 18, mass: 1`. Enter ~240ms, exit ~180ms, via spring.
- Capture button press: spring scale `1.00 → 1.03 → 1.00`. THE ONE tactile bounce in entire system.
- Empty-state capture button breathing loop: scale `1.00 → 1.02` over 3.2s, infinite, ease-in-out. THE ONLY perpetual micro-interaction in the app.
- Staggered orchestration: catalog grid + care-card rows reveal with 60ms cascade per item — opacity 0→1 + translateY 8px→0. NEVER mount lists instantly.
- Celebration (first plant, streak milestone): brief Terracotta Clay/Glow accent flourish, single element, ≤600ms. NEVER full-screen confetti.
- Animate ONLY via `transform` + `opacity`. NEVER `top, left, width, height`. NO backdrop-filter animations. Grain/noise = static pseudo-elements.

`prefers-reduced-motion: reduce`: breathing loop stops at rest. Shimmer → static. 60ms cascade collapses to instant 120ms opacity fade. Spring transitions become 120ms linear crossfade. Terracotta celebration becomes 200ms color tint (no scale/translation). Motion is NEVER sole indicator of state change.

### Safe areas + responsive

Full-height surfaces use `min-h-[100dvh]`. NEVER `h-screen` (iOS Safari dynamic viewport jump breaks capture screen). Top padding honors `env(safe-area-inset-top)`, bottom honors `env(safe-area-inset-bottom)`. Capture button sits 24px above `env(safe-area-inset-bottom)`. Bottom nav reserves `env(safe-area-inset-bottom)` inside its padding.

Horizontal scroll on mobile = CRITICAL FAILURE. ONE exception: Home "Today's tasks" strip — gesture-scoped with right-edge fade mask, `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`.

Headlines scale with `clamp()`. Body text minimum 16px regardless of viewport. Desktop PWA keeps bottom nav (no sidebar). Folhário is ONE shape across devices.

Localization: `<html lang="pt-BR">`. Body copy may use `hyphens: auto` for long scientific names; headlines do NOT hyphenate. Numbers/dates/currency via `Intl.*` with `pt-BR`. Latin scientific names: `<i lang="la">`.

PWA manifest: installable, display `standalone`, theme color matches brand, all icon sizes. `<meta name="viewport" content="width=device-width, initial-scale=1">`. User scaling NOT disabled.

### Banned patterns (BRAND-COHERENCE GUARDRAILS)

**Visual slop:**

- NO emojis in any UI copy/labels/buttons/empty states. Plant icons = Lucide.
- NO pure black `#000000`. Use Forest Ink `#143424` (light) / Night Cream `#1A1613` (dark).
- NO neon, outer glow, drop-shadow fakery beyond two elevation levels.
- NO glassmorphism, frosted blur, neumorphism.
- NO gradient headline text. NO gradient buttons. Flat fills only.
- NO overlapping text + imagery (inline plant-thumbnail in hero is the ONLY approved exception).
- NO mixed icon sets within a screen. Lucide only.

**Typography slop:**

- NO Inter. Plus Jakarta Sans is the interface font, full stop.
- NO generic serifs (Times, Georgia, Garamond, Palatino). Source Serif 4 only.
- NO all-caps headlines. Uppercase reserved for 14px section labels @ +4% tracking.
- NO `LABEL // 2026` or `SYSTEM // V1.1` formatting (lazy AI convention).
- NO condensed/ultra-tight tracking.
- NO fixed-height text containers that clip when text scales up.

**Color slop:**

- Terracotta, Honey Amber, Urgent Poppy, Overdue Rust, Trust Teal (+ dark counterparts) = SEMANTIC SIGNALS only. Never decorative CTA, bg, marketing accent.
- NO secondary accent "just to add warmth." If a screen feels cold, add Paper/Night Cream surface area + a real plant photo, not another color.
- Urgent Poppy/Blossom NEVER for form errors, network failures, generic "something went wrong." Toxicity + destructive only.
- NO dark-mode palette derived by inverting light tokens. Veranda-at-dusk variant only.
- NO contrast pair not in the contrast ledger.

**Layout slop:**

- NO centered hero with headline+subtitle+button stacked vertically on axis. Heroes asymmetric.
- NO 3-equal-card "Recursos"/"Features" row. Use 2-col zig-zag or single hero feature block.
- NO bouncing chevrons, "role para baixo", scroll-hint arrows, "Swipe down."
- NO floating AI-chatbot bubble in corner.
- NO sidebar nav on mobile or desktop. Bottom nav only.
- NO fixed chrome without safe-area padding. NO content hidden behind bottom nav.

**Content slop:**

- NO fabricated data. NEVER invent "99.8% de precisão", "50.000 plantas catalogadas", "4.9★ na App Store". Use `[metric]` placeholders or omit.
- NO fake system-metrics dashboard blocks ("SYSTEM PERFORMANCE", "KEY STATISTICS").
- NO AI clichés: "Eleve seu jardim", "Desbloqueie o potencial", "Revolucione", "Next-gen", "Seamless", "Unleash."
- NO generic placeholder names ("Maria Silva", "João Santos", "Acme Plantas"). Use first-name-only pt-BR ("Clara", "Rafael"), clearly illustrative.
- NO broken Unsplash hotlinks. Use local assets, `picsum.photos`, or SVG illustrations.

**Interaction slop:**

- NO custom mouse cursors.
- NO pulsing/shimmering/floating animations beyond capture-button breathing loop.
- NO "tap anywhere to dismiss" without visible dismiss affordance.
- NO confetti explosions.
- NO interaction depends on hover. Hover is decorative amplification only, NEVER load-bearing.
- NO perpetual animation without reduced-motion fallback.
- NO haptic feedback on transient errors / non-critical events.

---

## 18. Accessibility (Folhário-specific rules beyond WCAG AA defaults)

WCAG 2.1 AA = ship blocker, not aspirational.

### Color is never sole signal — every state combines redundant cues

- **Toxicity:** icon + colored badge + text + striped border + SR `role="alert"` + haptic
- **Overdue reminders:** icon + color + text label "Atrasado"
- **Cap-reached:** icon + text explanation
- **Augmented care guide:** badge icon + text "Gerado por IA"
- **Confidence:** numeric % + text + color (NEVER color alone)
- **Subscription status:** text label always present
- **Offline / read-only banners:** icon + text

### Image alt text

User-uploaded photos: NO AI auto-captioning in MVP, but MUST expose programmatic accessible name from context. NO empty or filename-based alt allowed.

- Catalog cards: `name` (+ `nickname` if present). E.g., "Samambaia (Maria)"
- Photo journal entries: plant name + entry date pt-BR locale. E.g., "Foto de Maria, 12 de abril de 2026"
- Identification result thumbnails: provider-returned common name
- Plant profile cover: plant name + nickname

### Screen reader announcements

- Live regions for async state (identification results, sync completion, discard summary)
- Loading states announced ("Identificando sua planta")

### Modals

Click-outside optional (NOT for critical modals like LGPD consent).

### Native a11y (PWA → native evolution)

- Capture button: "Identificar planta, botão."
- Confidence ladder: "Confiança <alta|média|baixa>, <n>%" (NEVER "três barras verdes").
- Toxicity badge: full phrase with `role="alert"`.
- Bottom-nav items: "<Label>, aba, <selecionado|não selecionado>."
- Plant card: "<Nome comum>, <nome científico>, adicionada em <data>."

Reading order matches visual order. Decorative illustrations (empty-state line art, veranda scenes) marked `accessibility hidden`.

Haptics:

- Capture button tap → light impact (iOS `UIImpactFeedbackGenerator.light`)
- Toxicity first-reveal per session → warning notification
- First plant added / care streak milestone → success notification, ONCE
- Destructive confirm tap → medium impact
- Transient errors (network, validation) → NO haptic (haptic noise on non-critical = trains users to ignore)

---

## 19. Testing

3 layers, ALL must pass before release.

- **Unit:** backend business logic, frontend, pure functions, state machines.
- **Backend integration:** HTTP handlers, repositories, provider adapters AGAINST REAL DATABASE. **Mocking the DB is NOT permitted.** Dedicated test DB per run, migrations applied as in production. External providers (identification, care guide, billing) use recorded fixtures or vendor test modes; the database itself is always real. Mocks mask schema, migration, query bugs.
- **Playwright E2E:** every primary screen has happy path + documented failure states (cap-reached, provider-unavailable, offline queue discard, augmented care guide badge, read-only catalog mode). Runs against the deployed preview URL in CI, NOT a local dev server — exercises real serverless build.

Coverage thresholds + CI gating left to impl. Release blocked on any failing test in any layer.

---

## 20. Environments + CI/CD

|                  | Local                     | Preview                   | Production          |
| ---------------- | ------------------------- | ------------------------- | ------------------- |
| Host             | `next dev`                | Vercel Preview            | Vercel Production   |
| DB               | `supabase start` (Docker) | Supabase branch DB per PR | Supabase production |
| Inngest          | Inngest Dev Server        | Inngest preview           | Inngest production  |
| Stripe           | CLI test mode             | test mode                 | live mode           |
| Resend           | sandbox domain            | sandbox                   | verified domain     |
| Sentry           | disabled                  | `preview` env             | `production` env    |
| PostHog          | disabled                  | dev project               | production project  |
| ID/LLM providers | stubs (default)           | stubs; real via flag      | real                |

Preview envs created by GitHub Actions on PR open, torn down on PR close.

### GitHub Actions workflows

Vercel git integration DISABLED. Every deploy runs from Actions so tests + migrations + deploys share one pipeline.

- **`ci.yml`** (PR + push to main): install, lint, typecheck, unit (Vitest), integration against real Postgres service container `postgres:16` (migrations applied, fixtures seeded), build
- **`deploy-preview.yml`** (PR open/sync): depends on ci.yml → apply migrations to Supabase branch DB → `vercel pull` preview env → `vercel build` → `vercel deploy --prebuilt` → run Playwright against returned preview URL → comment URL on PR
- **`deploy-production.yml`** (push to main): depends on ci.yml → apply migrations to prod Supabase (manual approval gate for destructive changes) → `vercel pull` prod env → `vercel build --prod` → `vercel deploy --prebuilt --prod` → create Sentry release + upload source maps → sync Inngest functions
- **`deploy-preview-cleanup.yml`** (PR close): delete Supabase branch DB, remove Vercel preview alias

### Env vars

Runtime → Vercel Project Environment Variables per environment. CI-only → GitHub Actions repository secrets. NEVER committed, NEVER logged.

| Name                                                                 | Service  | Scope                                         |
| -------------------------------------------------------------------- | -------- | --------------------------------------------- |
| `DATABASE_URL`                                                       | Supabase | direct, migrations only                       |
| `DATABASE_POOL_URL`                                                  | Supabase | Supavisor txn mode, runtime                   |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY`                                 | Supabase | all (anon = public)                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                          | Supabase | server (bypasses RLS)                         |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`                          | Inngest  | all / server                                  |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID`    | Stripe   | server / server / all                         |
| `RESEND_API_KEY` / `RESEND_FROM_ADDRESS`                             | Resend   | server / all                                  |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Sentry   | all / CI / CI / CI                            |
| `POSTHOG_API_KEY` / `POSTHOG_HOST`                                   | PostHog  | all (`POSTHOG_HOST=https://us.i.posthog.com`) |
| `PLANTID_API_KEY`                                                    | Plant ID | server                                        |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`                         | LLM      | server                                        |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`           | Web Push | all / server / server                         |
| `IDENTIFICATION_PROVIDER_MODE`                                       | App      | `stub` \| `real` (gates accidental spend)     |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`               | Vercel   | CI                                            |
| `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF`                     | Supabase | CI (migrations)                               |

### Local dev commands

- `next dev` — frontend + API
- `supabase start` — local Postgres + Auth + Storage + Studio
- `supabase db reset` — rebuild from migrations + seed
- `npx inngest-cli dev` — Inngest dev server
- `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe`

### Resend triggers

| Trigger                    | When                      |
| -------------------------- | ------------------------- |
| Email verification         | signup                    |
| Password reset             | recovery                  |
| Trial ending               | T-3d, T-1d (cron)         |
| Trial expired              | trial → expired           |
| Payment failed             | dunning 1–4               |
| Subscription canceled      | cancellation confirm      |
| Reactivation confirmation  | reactivate                |
| Account deletion requested | grace start               |
| Account deletion completed | hard delete               |
| Data export ready          | DataExportRequest → ready |
| 80% provider cost ceiling  | operator alert            |

PostHog event taxonomy (seed): `signup_completed`, `consent_granted`, `identification_started`, `identification_succeeded`, `identification_cap_hit`, `plant_added`, `reminder_created`, `reminder_acted`, `care_guide_viewed`, `trial_started`, `subscription_activated`, `subscription_canceled`, `data_export_requested`, `data_deletion_requested`. Each maps to ≥1 §22 metric.

---

## 21. Security checklist

- JWT verified in middleware on every `/api/v1/*` except public endpoints (signup, login, OAuth callbacks, Stripe webhook)
- Stripe webhook signature verified every request; failures → `webhook_signature_invalid` 401, NO BillingEvent, page Sentry
- Image EXIF stripped client-side; server rejects images with GPS as defense in depth (`validation_failed`)
- RLS enabled on all user-owned tables. Service role key server-side only, never exposed to client
- Sentry breadcrumbs scrub `Authorization`, `Cookie`, `email`, `password`, `photo_url`. Identification route bodies dropped entirely
- Standard security headers via Next.js middleware
- Rate limiting app-layer only in MVP, plus a narrow per-IP attempt throttle on public auth endpoints (signup, login, OAuth callbacks) emitting `rate_limited` 429 — defends against credential stuffing / password spray
- Email verification gate enforced on email+password signups before any identification or mutation; OAuth signups pre-verified by provider

### Observability

- Errors + traces: Sentry (release tag = git SHA)
- Product metrics: PostHog
- Identification quality metrics: scheduled SQL rollups via Inngest cron over `Identification` table → Supabase dashboards
- Infra: Vercel HTTP, Inngest dashboard, Supabase dashboard
- Alerts: Sentry → email/Slack on new issues + error rate spikes; 80% provider ceiling → Resend operator email; Stripe webhook signature failure → Sentry critical + operator email; Inngest function failure after retries exhausted → Sentry

---

## 22. Metrics

### Product (provisional rows blocked on pricing)

| Metric                                                  | Target                 |
| ------------------------------------------------------- | ---------------------- |
| First identification within 2 min of email verification | ≥60% of verified users |
| Plants added (week 1)                                   | ≥3 per active user     |
| Reminder interaction rate (done/snooze)                 | ≥50%                   |
| Trial-to-paid (14d organic)                             | ≥8% _provisional_      |
| Trial-to-paid (30d partner)                             | ≥15% _provisional_     |
| Weekly retention (week 4)                               | ≥40%                   |
| DAU returning via reminder                              | track, no target       |
| Care guide coverage hit rate                            | track, no target       |

WAU = opens at least once in rolling 7-day window. DAU = at least once per UTC calendar day.

### Identification quality

Confidence distribution per provider; manual correction rate; success rate; provider latency p50/p95/p99; provider error rate; photos per identification; species flagged as missing care guide; per-user cap hit rate; provider breaker open minutes/day; augmentation attempt rate; augmentation success rate; augmentation cost per species.

### Operational

API response time p50/p95/p99; daily nudge delivery rate (per user-day); push permission grant rate; PushSubscription prune rate (410/404); offline queue sync success rate; image upload success rate; image storage growth; auth success rate; email verification rate (signup → verified); public-auth-throttle trip rate; error rate by endpoint.

### Business

Signup volume (org vs partner); trial start → first action time; monthly churn; partner code redemption rate per partner; MRR; cost per identification per provider; cost per active user; failed-payment recovery rate (7d dunning); involuntary churn rate; dunning success rate.

---

## 23. Acceptance criteria (testable assertions, IDs preserved)

Keyed: AC-AUTH (authentication), AC-ID (identification), AC-CAT (catalog), AC-CARE (care guides), AC-REM (reminders), AC-OFF (offline), AC-SUB (subscription), AC-COST (cost controls), AC-LGPD (LGPD).

### Authentication

- **AC-AUTH-001** Email+password signup → user row created, verification email dispatched via Resend, Subscription created `status=trialing`. Until the user clicks the verification link, every request to a gated endpoint (identification, plant create/edit, reminder mutations, photo upload, etc.) returns `email_unverified` 403; only resend-verification, Settings/account, and logout endpoints are reachable.
- **AC-AUTH-002** OAuth signup (Google) → user is treated as pre-verified; gated endpoints reachable immediately. No verification email sent.
- **AC-AUTH-003** Unverified user clicks the verification link → user marked verified; subsequent requests to gated endpoints succeed; the §1 "value <2 min" clock starts at this moment.
- **AC-AUTH-004** N+1 failed login attempts from the same IP within the throttle window → next attempt returns `rate_limited` 429; the throttle applies independently of which account was targeted (defends both single-account brute force and password spray across accounts). Successful logins do not consume from the failure budget.
- **AC-AUTH-005** Same throttle applies to `POST /auth/signup` and OAuth callback endpoints; no other endpoints emit `rate_limited` in MVP.
- **AC-AUTH-006** Password reset request → endpoint always returns 200 (no email enumeration); for matching email+password accounts, Resend dispatches a reset link containing a single-use token with 1h expiry; token stored hashed; OAuth-only accounts get no email. Clicking a valid, unused, unexpired token within the window → set-new-password screen accepts a new password and updates the user record; reusing the same token returns `validation_failed`. Existing JWTs are NOT revoked on reset (logout-all is post-MVP).
- **AC-AUTH-007** Authed user POSTs change-password from Settings with current + new passwords → wrong current returns `invalid_credentials` 401, password unchanged; correct current updates the password; existing JWTs remain valid; OAuth-only accounts cannot reach this endpoint (Settings control hidden + endpoint returns `forbidden` 403).

### Identification

- **AC-ID-001** Authed user, consent granted, sub trialing/active, below caps → POST /v1/identifications returns ≤3 results above `min_confidence`, ordered desc; persists `Identification status=success` w/ provider, model, latency_ms, consent_version, photo_urls; emits `identification.succeeded`.
- **AC-ID-002** First identification ever w/o `identification_third_party` consent → consent prompt surfaced disclosing providers + intl transfer; NO provider call until granted.
- **AC-ID-003** Consent revoked/never granted → `consent_required` 403; no provider call; no Identification row.
- **AC-ID-004** Provider returns mix above/below threshold → only above-threshold returned (max 3).
- **AC-ID-005** Zero results above threshold → "could not identify" UI + retake guidance; Identification row STILL persisted with raw provider results for history.
- **AC-ID-006** User selects result + confirms add → Plant created linked to Species, name pre-filled, `Identification.plant_id` FK set.
- **AC-ID-007** Manual correction → typed value stored in `manual_correction`; Species resolved by name match if possible, else null + flagged.
- **AC-ID-008** History lists success + timeout + provider_unavailable attempts with `status` + `failure_reason`; success shows results + selection.
- **AC-ID-009** Trial user with 5 successful today → 6th → `cap_hit` 429 with reset time; no provider call; NO ProviderUsageCounter increment.
- **AC-ID-010** Paid user with 200 since `current_period_start` → next → `cap_hit`; no provider call.
- **AC-ID-011** Primary at cost ceiling, fallback available → router skips primary, logs `cost_ceiling_reached`, dispatches fallback, client gets success.
- **AC-ID-012** All providers exhausted → `provider_unavailable` 503; UI shows temporarily unavailable + "Try again"; photo retained in IndexedDB while on screen; Identification row persisted `status=failed` with most specific internal `failure_reason` (`provider_unavailable`/`cost_ceiling_reached`/`breaker_open`); internal reason NEVER leaks to client response.
- **AC-ID-013** Provider call exceeds backend timeout → `timeout` 504; row persisted `status=failed`, `failure_reason=timeout`; visible in history.
- **AC-ID-014** User navigates away mid-request → request completes server-side, row persisted; no in-flight UI restored on return.
- **AC-ID-015** Malformed/empty provider response → router treats as failure with `failure_reason=invalid_response`, increments breaker counter (tripping breaker writes `breaker_open` on subsequent attempts once threshold crossed), falls over to next provider for current request.
- **AC-ID-016** Photo with EXIF GPS → uploaded bytes contain no GPS tags; server rejects as `validation_failed` any upload still containing GPS (defense in depth).

### Catalog

- **AC-CAT-001** From identification + selected result → Plant created with `species_id`, name pre-filled, cover photo from identification upload.
- **AC-CAT-002** Manual creation with name + ≥1 photo → Plant row `species_id=null` + PhotoEntry for initial photo.
- **AC-CAT-003** Manual without name OR without photo → `validation_failed`; no row; field highlighted.
- **AC-CAT-004** Plant profile shows: name, nickname, room, acquisition_date, notes, cover, care-card link (if CareGuide exists), active reminders, photo journal, identification history.
- **AC-CAT-005** User has prior locations "Sala", "Varanda" → location picker lists those as quick-select then defaults then free-text.
- **AC-CAT-006** Type new location "Lavanderia" for plant A → it appears as quick-select for plant B.
- **AC-CAT-007** Add photo with optional note → PhotoEntry created with plant_id, photo_url, thumbnail_url, note; timeline shows in reverse chrono.
- **AC-CAT-008** Default sort: by `acquisition_date` desc; null dates last.
- **AC-CAT-009** Sort control changes catalog grid order (name A-Z, name Z-A, date oldest, location); selected sort persists for session.
- **AC-CAT-010** Delete plant → Plant + PhotoEntry + Reminder rows removed; storage objects scheduled for deletion; `Identification.plant_id` FK NULLed but history row preserved.

### Care guides

- **AC-CARE-001** Published care guide → all 7 fields rendered + seasonal tips + compatibility when present.
- **AC-CARE-002** Toxicity in (`toxic_pets`/`toxic_children`/`toxic_both`) → toxicity badge is FIRST visual element, icon + colored badge + text, never color alone.
- **AC-CARE-003** Any care card with toxicity badge → disclaimer "Informação gerada por IA — confirme com um veterinário" visible on same viewport as badge.
- **AC-CARE-004** First-ever care guide view → one-time toxicity disclaimer modal + acknowledgement recorded on User row; not shown again on subsequent views.
- **AC-CARE-005** Plant whose Species has no CareGuide row → care card section hidden; rest works; `Species.flag_reason=missing_care_guide`, `Species.flag_status=open`, `Species.identification_count` incremented.
- **AC-CARE-006** `identification.succeeded` for species with no CareGuide or missing fields → `care-guide/augment` Inngest fn calls CareGuideProvider, upserts CareGuide `source=augmented` (live immediately, no draft state), bumps `version`, sets `Species.flag_status=resolved` + `resolved_by="augmentation"` + `resolved_at`, emits `care_guide.augmented`; identification response NOT delayed.
- **AC-CARE-007** CareGuide with `source=augmented` → care card rendered with persistent "Gerado por IA" badge at top; badge is never removed for augmented rows.
- **AC-CARE-008** _(removed — no editor review queue in MVP)_
- **AC-CARE-009** _(removed — no editor review queue in MVP)_
- **AC-CARE-010** ProviderBudget row for care_guide purpose at/above `daily_cost_cap_cents` → augment fn exits w/o provider call, logs `cost_ceiling_reached`, leaves CareGuide untouched; `purpose=identification` budget for same provider untouched; concurrent identification through that provider unaffected.

### Reminders

- **AC-REM-001** Plant with no reminders → no prompt/suggestion to create one; user must initiate from profile.
- **AC-REM-002** New User default `notification_time_local=09:00`; editable in Settings; applies to ALL reminders for that user (no per-reminder override).
- **AC-REM-003** Plant whose species has published CareGuide with watering frequency → `frequency_days` pre-filled; user may override.
- **AC-REM-004** User with 2 devices each holding active PushSubscription, ≥1 reminder due/overdue at user's `notification_time_local` → `reminders/dispatch` emits ONE `daily_reminder_summary.due`; `notifications/send-push` fans out the daily nudge to BOTH devices. Push payload contains no Done/Snooze controls and no per-plant detail; tapping deep-links to Home. ZERO reminders due/overdue → no event emitted, no nudge sent.
- **AC-REM-005** User opens app on device A and taps Done in-app → ReminderLog `action=done`; device B clears entry on next sync; `next_due_at` advances per `advance_rule`. Done is never reachable from the push payload.
- **AC-REM-006** Snooze options offered: 1h, 3h, tomorrow; choosing one writes ReminderLog `action=snoozed` + `snooze_until`.
- **AC-REM-007** `from_scheduled` reminder snoozed then later marked done → `next_due_at` computed from ORIGINAL scheduled date + `frequency_days`, not from snooze time.
- **AC-REM-008** `from_scheduled`, scheduled Mondays, freq 7d → user marks done Wed → `next_due_at` = following Monday, NOT Wed+7d.
- **AC-REM-009** `from_acted`, freq 7d → done day D → `next_due_at` = D+7d.
- **AC-REM-010** Default `advance_rule=from_scheduled` persisted when user doesn't touch control.
- **AC-REM-011** Overdue reminder → appears in overdue section with distinct visual; not auto-muted, not auto-completed, doesn't change visual weight as it ages.
- **AC-REM-012** Subscription past_due/canceled/expired → `reminders/dispatch` sends no pushes for that user; `next_due_at` not advanced; resumes on return to trialing/active.
- **AC-REM-013** User has no push permission OR all devices offline at `notification_time_local` → no nudge delivered; user sees the full due/overdue list on Home next time they open the app. No backlog or missed-push entity is created.
- **AC-REM-014** Done while offline → on reconnect, replayed with client UUID, server dedupes, single ReminderLog row exists.
- **AC-REM-015** Done queued for reminder/plant deleted on another device → action dropped silently; no error shown.
- **AC-REM-016** Push service returns 410 Gone or 404 Not Found for a `PushSubscription` endpoint during daily nudge delivery → `notifications/send-push` deletes that row in the same step; subsequent dispatches for the user fan out to remaining devices only; no cron prune required.

### Offline sync

- **AC-OFF-001** Action queued in IndexedDB while offline; close + reopen still offline → action remains in queue.
- **AC-OFF-002** Queued action with client UUID replayed >1 time after reconnect → server processes exactly once; duplicates return original result.
- **AC-OFF-003** Multiple queued actions with distinct client timestamps → replayed in ascending client timestamp order.
- **AC-OFF-004** Queued actions targeting plant deleted server-side → all dropped; single discard summary toast on next app open.
- **AC-OFF-005** Queued field edit on stale row → later wins by server timestamp; no merge UI.
- **AC-OFF-006** Queued action fails sync 5 attempts → OfflineSyncFailure row written; removed from active queue.
- **AC-OFF-007** OfflineSyncFailure rows visible in Settings → "Needs attention" with retry/discard per entry.
- **AC-OFF-008** Previously loaded catalog browsable offline; new identifications blocked with clear message.

### Subscription & billing

- **AC-SUB-001** New signup completes → Subscription created `status=trialing`, `trial_end_date` from signup time.
- **AC-SUB-002** Signup no partner code → `trial_end_date = created_at + 14d`, `User.trial_source=organic`.
- **AC-SUB-003** Signup with partner code matching active PartnerStore → `trial_end_date = created_at + 30d`, `User.trial_source=partner`, `User.partner_code` recorded.
- **AC-SUB-004** Signup with unknown/inactive code → `invalid_partner_code` inline error; user clears + proceeds with 14d.
- **AC-SUB-005** Organic user inside 14d window enters valid partner code in Settings → `trial_end_date = created_at + 30d`; clock NOT reset.
- **AC-SUB-006** User with 30d partner trial attempts another partner code in Settings → rejected; `trial_end_date` unchanged.
- **AC-SUB-007** PartnerStore deactivated after granting trial → existing user's `trial_end_date` preserved until trial ends.
- **AC-SUB-008** Trial ends with valid PM, first charge succeeds (Stripe webhook) → status → active.
- **AC-SUB-009** Trial ends with no valid PM, `trial_end_date` passes → status → expired; read-only catalog mode.
- **AC-SUB-010** Active subscription, renewal charge fails (webhook) → status → past_due; payment-failed email.
- **AC-SUB-011** Past_due subscription, retry/manual payment succeeds → status → active.
- **AC-SUB-012** Past_due subscription, 4th retry over 7 days fails → status → canceled.
- **AC-SUB-013** Active subscription, user cancels from Settings → `cancel_at_period_end=true`; UI confirms access-ends date; full access until `current_period_end`.
- **AC-SUB-014** Canceled subscription, `current_period_end` passes → status → expired.
- **AC-SUB-015** Canceled or expired subscription on non-deleted account, user adds valid PM + reactivates → new subscription started in active.
- **AC-SUB-016** Sub status not in (trialing/active) → plants/photos/journal/care guides viewable; POST /v1/identifications → `subscription_required`; reminders paused; mutations → `read_only_mode`; Settings fully accessible.
- **AC-SUB-017** Stripe sub state change → `Subscription.status` updated only by webhook handler; no client-callable route mutates status.
- **AC-SUB-018** Stripe delivers same event_id twice → only one BillingEvent row exists; second delivery is no-op.
- **AC-SUB-019** Webhook with bad signature → `webhook_signature_invalid` 401; no BillingEvent written; logged to Sentry critical.
- **AC-SUB-020** End-to-end happy path: live active sub + valid Stripe webhook for `invoice.payment_failed` signed with configured secret → handler verifies signature + returns 200, inserts BillingEvent with event_id unique key + raw payload, enqueues `billing.webhook.received` to Inngest before returning; `billing/process-webhook` transitions Subscription.status to past_due, emits `subscription.status_changed`, triggers dunning email via Resend; app immediately returns `subscription_required` on identification + `read_only_mode` on mutations per AC-SUB-016; no BillingEvent created twice on Stripe re-delivery.

### Cost controls

- **AC-COST-001** Trial user → IdentificationLimit returns `daily_cap=5`, `period_cap=75` for tier `trial`; window = `[trial_start_date, trial_end_date]`.
- **AC-COST-002** Paid user → `daily_cap=15`, `period_cap=200` for tier `paid`; window = `[current_period_start, current_period_end]`.
- **AC-COST-003** Cap check executes BEFORE any ProviderUsageCounter increment or provider call; over-cap requests never reach provider.
- **AC-COST-004** Provider's ProviderUsageCounter for today reaches 80% of `daily_cost_cap_cents` → operator alert email sent via Resend.
- **AC-COST-005** Provider counter at daily ceiling → provider marked unavailable rest of UTC day; router skips it.
- **AC-COST-006** Primary unavailable + fallback configured → router dispatches fallback + logs rejection reason for primary.
- **AC-COST-007** No provider available → `provider_unavailable` to client; internal reasons (`cost_ceiling_reached`, `breaker_open`) persisted in `Identification.failure_reason` but never returned.
- **AC-COST-008** Provider fails N consecutive calls within window → breaker opens; subsequent requests skip provider until cooldown elapses + half-open probe succeeds.
- **AC-COST-009** Two concurrent identification requests to same provider → ProviderUsageCounter increments serialized atomically; no counter write lost.
- **AC-COST-010** Operator updates IdentificationLimit or ProviderBudget directly in DB → next request (past in-memory cache TTL) uses new values; no redeploy.

### LGPD

- **AC-LGPD-001** User requests data export → DataExportRequest `status=pending`; Inngest job generates a zip containing `data.json` (all user records) + `photos/` directory with ORIGINAL photo files; archive uploaded to `data-exports` bucket; status → ready, `download_url` is signed time-limited URL.
- **AC-LGPD-002** Export ready → "data export ready" email dispatched via Resend with signed URL.
- **AC-LGPD-003** User requests deletion → DataDeletionRequest with `grace_period_ends_at = now + 7d`; `User.deletion_requested_at` set; confirmation email sent; account suspended.
- **AC-LGPD-004** User in 7-day grace attempts login → only cancel-deletion + read-only LGPD endpoints reachable; other requests → `deletion_in_progress`.
- **AC-LGPD-005** Deletion request inside grace, user cancels from recovery → `DataDeletionRequest.status=cancelled`; Inngest fn wakes on `grace_period_ends_at`, observes cancellation, exits without deleting; account back to normal.
- **AC-LGPD-006** Grace elapsed without cancellation → fn resumes, hard-deletes all personal data (photos, plants, ID history, reminder logs, consent rows except minimal deletion-audit record); "deletion complete" email sent.
- **AC-LGPD-007** Hard-deleted account → next full backup cycle reflects deletion within 30 days.
- **AC-LGPD-008** User revokes identification or push consent from Settings → recorded in ConsentLog; existing catalog access preserved; only affected processing activity blocked going forward.
- **AC-LGPD-009** Successful identification → `Identification.consent_version` captures version of consent policy active at request time.
- **AC-LGPD-010** Signup → `User.age_confirmed_at` set only if ≥13 confirmed; accounts cannot be created without confirmation.
- **AC-LGPD-011** Privacy policy version bump flagged material for an activity → on next use, consent prompt shown before activity proceeds; new `policy_version` recorded on grant.

Out of acceptance scope: accessibility (§18), i18n, visual/layout details (§17), launch blockers (§24).

---

## 24. Launch blockers (must have owner + dated target before first prod deploy)

| Blocker                            | Owner   | Target                                                                                                                                                |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscription pricing (BRL monthly) | TBD     | pre-launch, before Stripe live mode enabled. Until set, AC-SUB targets are provisional                                                                |
| NFS-e issuance                     | TBD     | pre-launch, before first paid charge. Stripe doesn't issue BR electronic service invoices. Decide: third-party (NFE.io, accounting partner) or manual |
| DPO (Encarregado) appointment      | TBD     | pre-launch, contact published in privacy policy + Settings before any identification request accepted                                                 |
| Privacy policy + ToS authoring     | TBD     | pre-launch, finalized before §3.1.5 consent flow ships                                                                                                |
| 200+ curated care guides           | founder | by MVP launch                                                                                                                                         |

`Owner = TBD` row IS itself a blocker. Reviewed weekly.

---

## 25. Open questions (non-blocker)

1. iOS PWA push notification edge cases — fallback strategy left to impl
2. Concrete retention windows for operational logs, ID history, post-deletion audit (numbers, not policy)
3. Supabase preview branching cost at PR volume (fallback: single shared preview project)
4. Inngest durable-step budget for `step.sleepUntil(7d)` — monitor against free tier
5. Sentry trace sampling — start at 10%, tune after launch
6. PostHog session replay — off in MVP
7. Image CDN — Supabase Storage CDN is default; whether to layer Vercel Image Optimization on top is TBD
8. Backup retention alignment — verify Supabase default backup window against ≤30d propagation commitment

---

## 26. Glossary

- **Plant** — catalog entry; one row in user's `Plant` table
- **Species** — reference data shared across users
- **Identification attempt** — single call to one provider
- **Identification** — user-initiated request, possibly composed of multiple attempts (retries, fallover); one `Identification` row
- **Care guide** — `CareGuide` row, either editorial/imported (curated) or augmented (LLM-generated, persistent "Gerado por IA" badge)
- **Care card** — UI surface that renders a care guide
- **Reminder** — scheduled task tied to a single plant
- **Notification** — push or in-app delivery of a reminder
- **Trial** — subscription in trialing state
- **Active subscription** — subscription in active state
- **WAU** — opens app at least once in rolling 7d window
- **DAU** — opens app at least once per UTC calendar day
- **Provider** — third-party service accessed through Provider abstraction (identification §6, care guide §8, billing §12)
- **Augmentation** — runtime LLM-driven completion of missing care guide fields
- **Read-only catalog mode** — app state when subscription not in trialing/active
- **Grounding** — provider-side web search/RAG. Folhário relies on it at provider layer; does NOT implement own retrieval
