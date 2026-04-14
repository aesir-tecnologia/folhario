# Folhário — Acceptance Criteria

**Version:** 1.0
**Date:** 2026-04-12
**Status:** Draft

Companion to [`PRD-V1.1.md`](./PRD-V1.1.md), [`API-CONTRACT.md`](./API-CONTRACT.md), and [`HIGH-LEVEL-DESIGN.md`](./HIGH-LEVEL-DESIGN.md). Each criterion below is a testable assertion; scenarios map directly onto unit, integration, or Playwright tests per §4.11 PRD.

**ID prefixes:**
- `AC-ID` — Identification (§3.1)
- `AC-CAT` — Catalog (§3.2)
- `AC-CARE` — Care Guides (§3.3)
- `AC-REM` — Reminders (§3.4)
- `AC-OFF` — Offline Sync (§4.4)
- `AC-SUB` — Subscription & Billing (§4.2, §4.7)
- `AC-COST` — Cost Controls (§4.8)
- `AC-LGPD` — LGPD (§4.6)

Out of scope: accessibility (§4.10), i18n (§4.3), visual/layout details (belong with wireframes), and launch blockers from §0.

---

## Identification — `AC-ID`

### AC-ID-001 — Successful identification with valid consent
**PRD §3.1.1**
- **Given:** authenticated user with identification consent granted, subscription in `trialing` or `active`, below daily and monthly caps
- **When:** the user submits 1..N photos to `POST /v1/identifications`
- **Then:** response returns up to top 3 results with confidence ≥ `ProviderBudget.min_confidence`, ordered by confidence descending; an `Identification` row is persisted with `status=success`, `provider`, `model`, `latency_ms`, `consent_version`, `photo_urls`; `identification.succeeded` is emitted

### AC-ID-002 — Consent prompt on first identification attempt
**PRD §3.1.5, §4.6.5**
- **Given:** authenticated user who has never granted `identification_third_party` consent
- **When:** the user initiates their first identification
- **Then:** the client surfaces the consent prompt disclosing active providers and international transfer; no request reaches any provider until consent is granted

### AC-ID-003 — Identification blocked without consent
**PRD §3.1.5**
- **Given:** authenticated user with identification consent revoked or never granted
- **When:** the user submits a photo to `POST /v1/identifications`
- **Then:** the response is `consent_required` (HTTP 403); no provider call is made; no `Identification` row is created

### AC-ID-004 — Below-threshold results filtered
**PRD §3.1.1**
- **Given:** a provider returns results including some below `min_confidence`
- **When:** the response is assembled
- **Then:** only results at or above threshold are returned to the client, up to 3

### AC-ID-005 — No results above threshold
**PRD §3.1.1**
- **Given:** a provider returns zero results at or above `min_confidence`
- **When:** the response is assembled
- **Then:** the client shows the "could not identify" state with retake guidance; the `Identification` row is still persisted with the raw provider results for history

### AC-ID-006 — Add identified plant to catalog
**PRD §3.1.1, §3.2.1**
- **Given:** identification returned ≥1 result
- **When:** the user selects a result and confirms "add to catalog"
- **Then:** a `Plant` row is created linked to the selected `Species`, with name pre-filled; the `Identification.plant_id` FK is set

### AC-ID-007 — Manual correction path
**PRD §3.1.4**
- **Given:** identification returned results but the user disagrees
- **When:** the user enters a plant name manually in the override field
- **Then:** the `Identification` row stores the typed value in `manual_correction`; the selected `Species` is resolved by name match when possible, else left null with the plant flagged for species lookup

### AC-ID-008 — History includes failures
**PRD §3.1.3, §3.1.6**
- **Given:** a user has made successful, timed-out, and provider-unavailable attempts
- **When:** the user opens identification history
- **Then:** all attempts are listed with their `status` and `failure_reason` where applicable; successful attempts show the returned results and selection

### AC-ID-009 — Daily per-user cap blocks request
**PRD §4.8.1**
- **Given:** a trial user who has made 5 successful identifications today
- **When:** the user submits a 6th identification
- **Then:** the response is `cap_hit` (HTTP 429) including the next reset time; no provider call is made; no `ProviderUsageCounter` increment occurs

### AC-ID-010 — Period per-user cap blocks request
**PRD §4.8.1**
- **Given:** a paid user who has made 200 identifications since `Subscription.current_period_start`
- **When:** the user submits another identification
- **Then:** the response is `cap_hit`; no provider call is made

### AC-ID-011 — Cost ceiling triggers router failover
**PRD §3.1.5, §4.8.2**
- **Given:** the primary provider has reached its daily cost ceiling; a fallback provider is available
- **When:** the user submits an identification
- **Then:** the router skips the primary provider, logs reason `cost_ceiling_reached`, and dispatches to the fallback; the client receives a successful response

### AC-ID-012 — All providers exhausted
**PRD §3.1.6, §4.8.2**
- **Given:** every configured provider is unavailable (cost ceiling, breaker, or outage)
- **When:** the user submits an identification
- **Then:** the response is `provider_unavailable` (HTTP 503); the Identify screen shows the "temporarily unavailable" state with a "Try again" affordance; the selected photo is retained in IndexedDB while the user stays on the screen; an `Identification` row is persisted with `status=failed` and `failure_reason` set to the most specific internal reason (`provider_unavailable`, `cost_ceiling_reached`, or `breaker_open`) per PRD §3.1.6; the internal reason never leaks to the client response

### AC-ID-013 — Backend timeout
**PRD §3.1.6**
- **Given:** a provider call exceeds the configured backend timeout
- **When:** the timeout fires
- **Then:** the response is `timeout` (HTTP 504); an `Identification` row is persisted with `status=failed` and `failure_reason=timeout`; the failure is visible in identification history

### AC-ID-014 — User navigates away mid-request
**PRD §3.1.6**
- **Given:** an identification request is in flight
- **When:** the user navigates away from the Identify screen
- **Then:** the server-side request completes and persists an `Identification` row; no in-flight UI is restored on return; the attempt is visible in history

### AC-ID-015 — Malformed provider response
**PRD §3.1.6**
- **Given:** a provider returns a response that fails schema validation or is empty
- **When:** the router receives the response
- **Then:** the router treats the response as a provider failure with `failure_reason=invalid_response`, increments the provider's breaker failure counter (§4.8.3) — tripping the breaker and writing `failure_reason=breaker_open` on subsequent attempts once the threshold is crossed — and falls over to the next provider for the current request

### AC-ID-016 — EXIF stripped client-side
**PRD §4.5**
- **Given:** the user picks a photo carrying EXIF GPS metadata
- **When:** the client compresses and uploads the photo
- **Then:** the uploaded bytes contain no GPS tags; the server rejects with `validation_failed` any upload that still contains GPS tags (defense in depth)

---

## Catalog — `AC-CAT`

### AC-CAT-001 — Add plant from identification
**PRD §3.2.1**
- **Given:** identification returned at least one result the user selected
- **When:** the user confirms "add to catalog"
- **Then:** a `Plant` is created with `species_id` set, `name` pre-filled from the common name, cover photo drawn from the identification upload

### AC-CAT-002 — Add plant manually
**PRD §3.2.1**
- **Given:** no identification in progress
- **When:** the user creates a plant via the manual form with a name and ≥1 photo
- **Then:** a `Plant` row is created with `species_id=null`; `PhotoEntry` is created for the initial photo

### AC-CAT-003 — Required fields enforced
**PRD §3.2.1**
- **Given:** the user is creating a plant manually
- **When:** they submit without a name or without any photo
- **Then:** the response is `validation_failed`; no row is created; the client highlights the missing field

### AC-CAT-004 — Plant profile content
**PRD §3.2.2**
- **Given:** an existing plant
- **When:** the user opens its profile
- **Then:** the screen shows name, nickname, room, acquisition date, notes, cover photo, care-card link (if a `CareGuide` exists for the species), active reminders, photo journal, and identification history

### AC-CAT-005 — Room/location recall
**PRD §3.2.3**
- **Given:** the user has previously used rooms "Sala" and "Varanda"
- **When:** the user creates or edits a plant
- **Then:** the location picker lists "Sala" and "Varanda" as quick-select options, followed by the predefined suggestions, and offers free-text entry

### AC-CAT-006 — Custom location becomes reusable
**PRD §3.2.3**
- **Given:** the user types a new location "Lavanderia" for plant A
- **When:** the user later creates plant B
- **Then:** "Lavanderia" appears as a quick-select option alongside previously used locations

### AC-CAT-007 — Photo journal entry
**PRD §3.2.4**
- **Given:** an existing plant
- **When:** the user adds a photo with an optional note
- **Then:** a `PhotoEntry` is created with `plant_id`, `photo_url`, `thumbnail_url`, and `note`; the timeline shows the new entry in reverse chronological order

### AC-CAT-008 — Catalog default sort
**PRD §3.2.5**
- **Given:** the user has multiple plants with distinct acquisition dates
- **When:** they open "Meu Jardim" without changing sort
- **Then:** plants are listed by `acquisition_date` descending (newest first); plants with null dates sort last

### AC-CAT-009 — Catalog sort options
**PRD §3.2.5**
- **Given:** the user has multiple plants
- **When:** they change the sort control to name A-Z, name Z-A, acquisition date oldest first, or room/location
- **Then:** the grid re-orders accordingly and the selected sort persists for the session

### AC-CAT-010 — Deleting a plant cascades
**PRD §3.2, §4.6.3**
- **Given:** a plant with photo journal entries, reminders, and identification history links
- **When:** the user deletes the plant
- **Then:** the `Plant`, its `PhotoEntry` rows, and its `Reminder` rows are removed; storage objects for its photos are scheduled for deletion; the `Identification.plant_id` FK is nulled but the history row is preserved

---

## Care Guides — `AC-CARE`

### AC-CARE-001 — Published care card rendering
**PRD §3.3.1**
- **Given:** a species with a `CareGuide` in `status=published`
- **When:** the user opens the care card
- **Then:** all seven fields (watering, light, soil, temperature, humidity, toxicity, difficulty) are rendered; seasonal tips and compatibility notes appear when present

### AC-CARE-002 — Toxicity badge prominence
**PRD §3.3.2**
- **Given:** a plant whose species has a `CareGuide` with `toxicity` in (`toxic_pets`, `toxic_children`, `toxic_both`)
- **When:** the user opens the plant profile or the care card
- **Then:** the toxicity badge is the first visual element, combining icon + colored badge + text; it never relies on color alone

### AC-CARE-003 — Toxicity disclaimer always visible
**PRD §3.3.2**
- **Given:** any care card with a toxicity badge
- **When:** the card is rendered
- **Then:** the disclaimer "Informação gerada por IA — confirme com um veterinário" is visible on the same viewport as the badge

### AC-CARE-004 — First-view toxicity modal
**PRD §3.3.2**
- **Given:** a user who has never viewed a care guide
- **When:** the user opens their first care card
- **Then:** a one-time modal displays the toxicity disclaimer and records acknowledgement on the `User` row; the modal is not shown again on subsequent views

### AC-CARE-005 — Missing care guide hides section
**PRD §3.3.6**
- **Given:** a plant whose `Species` has no `CareGuide` row
- **When:** the user opens the plant profile
- **Then:** the care card section is hidden; all other sections (photo journal, reminders, notes) work normally; a `SpeciesFlag` row with `reason=missing_care_guide` exists or its `identification_count` has been incremented

### AC-CARE-006 — Augmentation trigger
**PRD §3.3.7**
- **Given:** an `identification.succeeded` event for a species with no `CareGuide` row or with missing fields
- **When:** the `care-guide/augment` Inngest function runs
- **Then:** it calls the `CareGuideProvider`, upserts a `CareGuide` row with `status=draft` and `source=augmented`, and emits `care_guide.augmented`; the identification response to the client is not delayed by the augmentation

### AC-CARE-007 — Draft visible with review badge
**PRD §3.3.7, §7.5**
- **Given:** a `CareGuide` with `status=draft` and `source=augmented`
- **When:** the user opens the care card
- **Then:** the card is rendered and displays the "Gerado por IA — em revisão" badge at the top

### AC-CARE-008 — Editor approval flips draft to published
**PRD §3.3.7**
- **Given:** a `CareGuide` in `status=draft` visible in the review queue
- **When:** an editor approves the draft
- **Then:** the row transitions to `status=published`, `version` is incremented, `reviewed_by` and `reviewed_at` are set; the "em revisão" badge is removed from user-facing views

### AC-CARE-009 — Editor rejection deletes draft
**PRD §3.3.7**
- **Given:** a `CareGuide` in `status=draft`
- **When:** an editor rejects the draft
- **Then:** the row is deleted; a `SpeciesFlag` is re-raised for the species

### AC-CARE-010 — Augmentation budget exhaustion
**PRD §3.3.7, §4.8**
- **Given:** the `ProviderBudget` row for the configured care guide provider with `purpose=care_guide` has its daily `ProviderUsageCounter` (keyed on `provider + purpose + utc_date`) at or above `daily_cost_cap_cents`
- **When:** the `care-guide/augment` function runs
- **Then:** the function exits without calling the provider, logs reason `cost_ceiling_reached`, and leaves the `CareGuide` row untouched; the corresponding `purpose=identification` budget row for the same provider is untouched, and concurrent identification requests routed through that provider are unaffected

---

## Reminders — `AC-REM`

### AC-REM-001 — Reminder creation is explicit
**PRD §3.4.4**
- **Given:** a plant with no reminders configured
- **When:** the user opens the plant profile
- **Then:** no prompt or suggestion to create a reminder is shown; the user must initiate creation from the profile

### AC-REM-002 — Default notification time
**PRD §3.4.1**
- **Given:** a user creating a new reminder
- **When:** they do not override the time
- **Then:** `notification_time_local` is set to `09:00`; the user may change it per reminder

### AC-REM-003 — Frequency pre-filled from care guide
**PRD §3.4.1**
- **Given:** a plant whose species has a published `CareGuide` with watering frequency
- **When:** the user creates a watering reminder
- **Then:** `frequency_days` is pre-filled from the care guide; the user may override before saving

### AC-REM-004 — Reminder fires on all devices
**PRD §4.9**
- **Given:** a user with 2 devices each holding an active `PushSubscription`
- **When:** a reminder becomes due
- **Then:** `reminders/dispatch` sends a push to both device endpoints

### AC-REM-005 — "Done" syncs across devices
**PRD §4.9**
- **Given:** a reminder due on devices A and B
- **When:** the user taps "Done" on device A
- **Then:** a `ReminderLog` row is created with `action=done`; device B clears the entry on next sync; `next_due_at` advances per `advance_rule`

### AC-REM-006 — Snooze options
**PRD §3.4.1**
- **Given:** a due reminder
- **When:** the user taps "Snooze"
- **Then:** the options offered are 1h, 3h, and tomorrow; choosing one writes a `ReminderLog` with `action=snoozed` and `snooze_until` set

### AC-REM-007 — Snooze affects current occurrence only
**PRD §3.4.4**
- **Given:** a reminder with `advance_rule=from_scheduled`
- **When:** the user snoozes an occurrence and later marks it done
- **Then:** `next_due_at` is computed from the original scheduled date plus `frequency_days`, not from the snooze time

### AC-REM-008 — `advance_rule=from_scheduled`
**PRD §3.4.4**
- **Given:** a reminder scheduled for Mondays with `advance_rule=from_scheduled`, `frequency_days=7`
- **When:** the user marks it done on Wednesday
- **Then:** `next_due_at` is set to the following Monday, not Wednesday + 7 days

### AC-REM-009 — `advance_rule=from_acted`
**PRD §3.4.4**
- **Given:** a reminder with `advance_rule=from_acted`, `frequency_days=7`
- **When:** the user marks it done on day D
- **Then:** `next_due_at` is set to D + 7 days

### AC-REM-010 — Default `advance_rule`
**PRD §3.4.4**
- **Given:** a user creating a new reminder without touching the advance rule control
- **When:** they save
- **Then:** `advance_rule=from_scheduled` is persisted

### AC-REM-011 — Overdue handling
**PRD §3.4.4**
- **Given:** a reminder whose `next_due_at` is in the past and has not been acted on
- **When:** the user opens the daily summary
- **Then:** the reminder appears in the overdue section with a distinct visual; it is not auto-muted, not auto-completed, and does not change visual weight as it ages

### AC-REM-012 — Reminders paused in read-only mode
**PRD §3.4.4, §4.7.3**
- **Given:** a subscription in `past_due`, `canceled`, or `expired`
- **When:** `reminders/dispatch` runs
- **Then:** no pushes are sent for that user; `next_due_at` is not advanced; reminders resume when the subscription returns to `trialing` or `active`

### AC-REM-013 — Missed push surfaces in notification center
**PRD §3.4.5, §7.1**
- **Given:** a reminder fired while the user had no push permission or the device was offline
- **When:** the user next opens the app
- **Then:** the missed reminder appears in the in-app notification center on Home; tapping it links to the relevant plant or reminder

### AC-REM-014 — Offline "Done" is idempotent
**PRD §3.4.5, §4.4**
- **Given:** the user taps "Done" while offline
- **When:** connectivity returns
- **Then:** the action is replayed with its client UUID; the server dedupes duplicates; a single `ReminderLog` row exists

### AC-REM-015 — "Done" for deleted reminder dropped silently
**PRD §3.4.5**
- **Given:** a reminder the user had queued "Done" for offline; the reminder or its plant was deleted on another device
- **When:** the queued action syncs
- **Then:** the action is dropped silently; no error is shown to the user

---

## Offline Sync — `AC-OFF`

### AC-OFF-001 — Queued action survives restart
**PRD §4.4**
- **Given:** an action queued in IndexedDB while offline
- **When:** the app is closed and reopened still offline
- **Then:** the action remains in the queue

### AC-OFF-002 — Idempotency dedupes replay
**PRD §4.4, API-CONTRACT §1**
- **Given:** a queued action with a client UUID
- **When:** the client replays the action more than once after reconnect
- **Then:** the server processes it exactly once; duplicate replays return the original result

### AC-OFF-003 — Chronological replay
**PRD §4.4**
- **Given:** multiple queued actions with distinct client timestamps
- **When:** the queue replays
- **Then:** actions are sent in ascending client timestamp order

### AC-OFF-004 — Deleted target drops all queued actions
**PRD §4.4**
- **Given:** queued actions targeting a plant deleted server-side
- **When:** the queue replays
- **Then:** all affected actions are dropped without error; a single toast summarizes discarded actions on next app open

### AC-OFF-005 — Stale edit resolved last-write-wins
**PRD §4.4**
- **Given:** a queued field edit whose remote row has been modified since
- **When:** the edit syncs
- **Then:** the later of the two wins by server timestamp; no merge UI is shown

### AC-OFF-006 — Retry budget exhausted
**PRD §4.4**
- **Given:** a queued action that has failed to sync on 5 attempts
- **When:** the 5th failure occurs
- **Then:** an `OfflineSyncFailure` row is written; the action is removed from the active queue

### AC-OFF-007 — Failures surfaced in Settings
**PRD §4.4**
- **Given:** one or more `OfflineSyncFailure` rows
- **When:** the user opens Settings → "Needs attention"
- **Then:** the list is visible with actions to retry or discard each entry

### AC-OFF-008 — Cached catalog browsable offline
**PRD §4.4**
- **Given:** the user has previously loaded their catalog
- **When:** the user opens the app offline
- **Then:** the catalog and care guides are viewable from cache; new identifications are blocked with a clear message

---

## Subscription & Billing — `AC-SUB`

### AC-SUB-001 — Trial starts at signup
**PRD §1, §4.7.2**
- **Given:** a new signup completes
- **When:** the account is created
- **Then:** a `Subscription` is created with `status=trialing` and `trial_end_date` computed from signup time

### AC-SUB-002 — Organic trial length
**PRD §1**
- **Given:** signup with no partner code
- **When:** the account is created
- **Then:** `trial_end_date = created_at + 14 days`; `User.trial_source=organic`

### AC-SUB-003 — Valid partner code at signup
**PRD §4.2**
- **Given:** signup with a partner code matching an active `PartnerStore`
- **When:** the account is created
- **Then:** `trial_end_date = created_at + 30 days`; `User.trial_source=partner`; `User.partner_code` is recorded

### AC-SUB-004 — Invalid partner code at signup
**PRD §4.2**
- **Given:** signup with a partner code that is unknown or inactive
- **When:** the user submits the form
- **Then:** the response is `invalid_partner_code` with an inline error; the user can clear the field and proceed with a 14-day trial

### AC-SUB-005 — Partner code entered later extends trial
**PRD §1, §4.2, §7.7**
- **Given:** an organic user inside their original 14-day trial window
- **When:** they enter a valid partner code in Settings
- **Then:** `trial_end_date` is set to `created_at + 30 days`; the clock is not reset

### AC-SUB-006 — Partner code never stacks
**PRD §1**
- **Given:** a user who already received a 30-day trial from a partner code
- **When:** they attempt to enter another partner code in Settings
- **Then:** the operation is rejected; `trial_end_date` is unchanged

### AC-SUB-007 — Partner inactivation does not affect existing trials
**PRD §4.2**
- **Given:** a user whose 30-day trial was granted under a `PartnerStore` that is subsequently deactivated
- **When:** the deactivation takes effect
- **Then:** the user's existing `trial_end_date` is preserved until the trial ends

### AC-SUB-008 — `trialing` → `active`
**PRD §4.7.2**
- **Given:** a trial ending with a valid payment method
- **When:** the first charge succeeds (Stripe webhook)
- **Then:** `Subscription.status` transitions to `active`; full access continues

### AC-SUB-009 — `trialing` → `expired`
**PRD §4.7.2**
- **Given:** a trial ending with no valid payment method
- **When:** `trial_end_date` passes
- **Then:** `Subscription.status` transitions to `expired`; the app enters read-only catalog mode

### AC-SUB-010 — `active` → `past_due`
**PRD §4.7.2**
- **Given:** an active subscription
- **When:** a renewal charge fails (Stripe webhook)
- **Then:** `Subscription.status` transitions to `past_due`; the user receives a payment-failed email

### AC-SUB-011 — `past_due` → `active`
**PRD §4.7.2**
- **Given:** a `past_due` subscription
- **When:** a retry or manual payment succeeds
- **Then:** `Subscription.status` transitions back to `active`

### AC-SUB-012 — `past_due` → `canceled` after dunning
**PRD §4.7.2, §4.7.4**
- **Given:** a `past_due` subscription
- **When:** the 4th retry over 7 days fails
- **Then:** `Subscription.status` transitions to `canceled`

### AC-SUB-013 — User cancels (at period end)
**PRD §4.7.6**
- **Given:** an `active` subscription
- **When:** the user cancels from Settings
- **Then:** `cancel_at_period_end=true`; the UI confirms the access-ends date; full access continues until `current_period_end`

### AC-SUB-014 — `canceled` → `expired`
**PRD §4.7.2**
- **Given:** a `canceled` subscription
- **When:** `current_period_end` passes
- **Then:** `Subscription.status` transitions to `expired`

### AC-SUB-015 — Reactivation
**PRD §4.7.6**
- **Given:** a `canceled` or `expired` subscription on an account that has not been deleted
- **When:** the user adds a valid payment method and confirms reactivation
- **Then:** a new subscription is started in `active`

### AC-SUB-016 — Read-only catalog mode
**PRD §4.7.3**
- **Given:** a subscription in any state other than `trialing` or `active`
- **When:** the user interacts with the app
- **Then:** plants, photos, photo journal, and care guides remain viewable; `POST /v1/identifications` returns `subscription_required`; reminder scheduling and dispatch are paused; any mutation (new plant, edit, new photo journal entry) returns `read_only_mode`; Settings remains fully accessible

### AC-SUB-017 — Webhook is authoritative for status
**PRD §4.7.5**
- **Given:** any Stripe subscription state change
- **When:** the change is processed
- **Then:** `Subscription.status` is updated only by the webhook handler; no client-callable route mutates the status

### AC-SUB-018 — Webhook idempotency
**PRD §4.7.5**
- **Given:** Stripe delivers the same `event_id` twice
- **When:** both deliveries reach the handler
- **Then:** only one `BillingEvent` row exists; the second delivery is a no-op

### AC-SUB-019 — Invalid webhook signature
**PRD §4.7.5, API-CONTRACT §2**
- **Given:** a webhook request with a bad signature
- **When:** the handler verifies the signature
- **Then:** the response is `webhook_signature_invalid` (HTTP 401); no `BillingEvent` is written; the failure is logged to Sentry as critical

### AC-SUB-020 — Webhook end-to-end happy path
**PRD §4.7.5, §4.7.3, HIGH-LEVEL-DESIGN §5.4**
- **Given:** a live `active` subscription and a valid Stripe webhook for `invoice.payment_failed` signed with the configured secret
- **When:** Stripe delivers the webhook to `POST /api/v1/webhooks/stripe`
- **Then:** the handler (1) verifies the signature and returns 200, (2) inserts a `BillingEvent` row with the Stripe `event_id` as the unique key and stores the raw payload, (3) enqueues `billing.webhook.received` to Inngest before returning; the `billing/process-webhook` function transitions `Subscription.status` to `past_due`, emits `subscription.status_changed`, and triggers the dunning email via Resend; the app immediately begins returning `subscription_required` on identification requests and `read_only_mode` on mutations for that user per AC-SUB-016; no `BillingEvent` row is created twice even if Stripe re-delivers the same `event_id`

---

## Cost Controls — `AC-COST`

### AC-COST-001 — Trial cap values
**PRD §4.8.1**
- **Given:** a trial user
- **When:** caps are read at request time
- **Then:** `IdentificationLimit` returns `daily_cap=5` and `period_cap=75` for tier `trial`; the period window is `[Subscription.trial_start_date, Subscription.trial_end_date]`

### AC-COST-002 — Paid cap values
**PRD §4.8.1**
- **Given:** a paid user
- **When:** caps are read at request time
- **Then:** `IdentificationLimit` returns `daily_cap=15` and `period_cap=200` for tier `paid`; the period window is `[Subscription.current_period_start, Subscription.current_period_end]`

### AC-COST-003 — Cap check precedes provider dispatch
**PRD §4.8.1**
- **Given:** any identification request
- **When:** the use-case runs
- **Then:** the cap check executes before any `ProviderUsageCounter` increment or provider call; over-cap requests never reach the provider

### AC-COST-004 — 80% ceiling alert
**PRD §4.8.2**
- **Given:** a provider's `ProviderUsageCounter` for today reaches 80% of `ProviderBudget.daily_cost_cap_cents`
- **When:** the threshold is crossed
- **Then:** an operator alert email is sent via Resend to the configured recipients

### AC-COST-005 — Daily cost ceiling marks provider unavailable
**PRD §4.8.2**
- **Given:** a provider whose counter has reached its daily ceiling
- **When:** the next request arrives
- **Then:** the provider is marked unavailable for the remainder of the UTC day; the router skips it

### AC-COST-006 — Failover to next provider
**PRD §3.1.5, §4.8.2**
- **Given:** the primary provider is unavailable and a fallback is configured
- **When:** an identification is requested
- **Then:** the router dispatches to the fallback and logs the rejection reason for the primary

### AC-COST-007 — All providers exhausted surfaces `provider_unavailable`
**PRD §4.8.2**
- **Given:** no provider is available
- **When:** an identification is requested
- **Then:** the response is `provider_unavailable`; internal reasons (`cost_ceiling_reached`, `breaker_open`) are persisted in `Identification.failure_reason` but never returned to the client

### AC-COST-008 — Circuit breaker opens after consecutive failures
**PRD §4.8.3**
- **Given:** a provider that fails N consecutive calls within the configured window
- **When:** the threshold is reached
- **Then:** the breaker opens; subsequent requests skip the provider until the cooldown elapses and a half-open probe succeeds

### AC-COST-009 — Atomic counter increment
**PRD §4.8.2**
- **Given:** two concurrent identification requests to the same provider
- **When:** both attempt to increment `ProviderUsageCounter`
- **Then:** the increments are serialized atomically; no counter write is lost

### AC-COST-010 — DB-driven config takes effect without redeploy
**PRD §4.8.5**
- **Given:** an operator updates `IdentificationLimit` or `ProviderBudget` directly in the database
- **When:** the next request arrives (past the in-memory cache TTL)
- **Then:** the new values are applied; no redeploy is required

---

## LGPD — `AC-LGPD`

### AC-LGPD-001 — Data export request
**PRD §4.6.2**
- **Given:** an authenticated user
- **When:** they request a data export from Settings
- **Then:** a `DataExportRequest` is created with `status=pending`; an Inngest job generates a JSON archive; the `status` moves to `ready` and `download_url` is a signed, time-limited URL

### AC-LGPD-002 — Export delivery email
**PRD §4.6.2**
- **Given:** an export that has moved to `status=ready`
- **When:** the notification step runs
- **Then:** a "data export ready" email is dispatched via Resend containing the signed URL

### AC-LGPD-003 — Deletion request and grace period
**PRD §4.6.3**
- **Given:** an authenticated user
- **When:** they request account deletion
- **Then:** a `DataDeletionRequest` is created with `grace_period_ends_at = now + 7 days`; `User.deletion_requested_at` is set; a confirmation email is sent; the account is suspended

### AC-LGPD-004 — Account suspended during grace
**PRD §4.6.3**
- **Given:** a user inside the 7-day grace period
- **When:** they attempt to log in
- **Then:** only the "cancel deletion" flow and read-only LGPD endpoints are reachable; other requests return `deletion_in_progress`

### AC-LGPD-005 — Cancel deletion during grace
**PRD §4.6.3**
- **Given:** a deletion request inside the grace period
- **When:** the user cancels from the recovery flow
- **Then:** the `DataDeletionRequest.status=cancelled`; the Inngest function wakes on `grace_period_ends_at`, observes the cancellation, and exits without deleting data; the account returns to normal access

### AC-LGPD-006 — Hard delete after grace
**PRD §4.6.3**
- **Given:** a deletion request whose grace period elapsed without cancellation
- **When:** the Inngest function resumes
- **Then:** all personal data is hard-deleted (photos, plants, identification history, reminder logs, consent rows except the minimal deletion-audit record); a "deletion complete" email is sent

### AC-LGPD-007 — Backup propagation window
**PRD §4.6.3**
- **Given:** a hard-deleted account
- **When:** the next full backup cycle runs
- **Then:** the deletion is reflected in backups within 30 days of the hard delete

### AC-LGPD-008 — Consent revocation preserves catalog
**PRD §4.6.2**
- **Given:** a user with catalog data and granted consents
- **When:** they revoke identification or push consent from Settings
- **Then:** the revocation is recorded in `ConsentLog`; the user retains access to their existing catalog; only the affected processing activity is blocked going forward

### AC-LGPD-009 — Consent version on Identification
**PRD §3.1.5**
- **Given:** any successful identification
- **When:** the `Identification` row is persisted
- **Then:** `consent_version` captures the version of the consent policy active at the time of the request

### AC-LGPD-010 — Age confirmation at signup
**PRD §4.6.6**
- **Given:** a user signing up
- **When:** they submit the signup form
- **Then:** `User.age_confirmed_at` is set only if they confirmed being ≥13; accounts cannot be created without this confirmation

### AC-LGPD-011 — Re-consent on material policy change
**PRD §4.6.7**
- **Given:** a privacy policy version bump flagged as material for a given processing activity
- **When:** the affected user next uses that activity
- **Then:** a consent prompt is shown before the activity proceeds; the new `policy_version` is recorded on grant
