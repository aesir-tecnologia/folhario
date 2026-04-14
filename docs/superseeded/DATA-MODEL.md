# Folhário — Data Model (Conceptual)

Key entities and their relationships. Field types and implementation details are deferred.

```
User
  ├── id
  ├── email
  ├── name
  ├── locale (default: pt-BR)
  ├── timezone (IANA, e.g., "America/Sao_Paulo" — captured from device at signup, editable in Settings; see §3.4.4)
  ├── trial_source (organic | partner)
  ├── partner_code (nullable)
  ├── age_confirmed_at (timestamp — proof of ≥13 confirmation at signup)
  ├── toxicity_disclaimer_acknowledged_at (nullable — set when the user dismisses the first-view modal, §3.3.2)
  ├── deletion_requested_at (nullable — start of 7-day grace period)
  └── created_at

(Subscription is reached via Subscription.user_id; no inverse pointer on User.)

Plant (catalog entry, belongs to User)
  ├── id
  ├── user_id → User
  ├── species_id → Species (nullable, if identified)
  ├── name
  ├── nickname (nullable)
  ├── location (nullable)
  ├── acquisition_date (nullable)
  ├── notes (nullable)
  ├── cover_photo_url
  └── created_at

Species (reference data, shared across users)
  ├── id
  ├── common_name (localized)
  ├── scientific_name
  └── reference_image_url

CareGuide (belongs to Species, versioned, localized)
  ├── id
  ├── species_id → Species
  ├── locale
  ├── version
  ├── status (draft | published)
  ├── source (editorial | imported | augmented)
  ├── watering
  ├── light
  ├── soil
  ├── temperature_min
  ├── temperature_max
  ├── humidity
  ├── toxicity (safe | toxic_pets | toxic_children | toxic_both)
  ├── toxicity_source_url (nullable — grounding citation when available)
  ├── difficulty (easy | medium | hard)
  ├── seasonal_tips
  ├── compatibility_notes
  ├── reviewed_by (nullable)
  ├── reviewed_at (nullable)
  └── updated_at

PhotoEntry (photo journal, belongs to Plant)
  ├── id
  ├── plant_id → Plant
  ├── photo_url
  ├── thumbnail_url
  ├── note (nullable)
  └── created_at

Identification (history, belongs to User)
  ├── id
  ├── user_id → User
  ├── plant_id → Plant (nullable, if added to catalog)
  ├── photo_urls (array — supports multiple images per identification)
  ├── provider (e.g., "plantid", "openai")
  ├── model (e.g., "gpt-4o", "plant-id-v3")
  ├── results (JSON array of top-N results with confidence)
  ├── selected_result (nullable — which result the user confirmed)
  ├── manual_correction (nullable — user-typed override)
  ├── latency_ms
  ├── consent_version (version of identification consent active at request time)
  ├── status (success | failed — authoritative enum per PRD §3.1.6)
  ├── failure_reason (nullable — required when status=failed; enum: timeout | provider_unavailable | cost_ceiling_reached | breaker_open | invalid_response)
  └── created_at

Reminder (belongs to Plant)
  ├── id
  ├── plant_id → Plant
  ├── type (watering | fertilization)
  ├── frequency_days
  ├── notification_time_local (HH:MM, default "09:00", interpreted in User.timezone)
  ├── advance_rule (from_scheduled | from_acted, default from_scheduled)
  ├── next_due_at (UTC timestamp, computed at create/advance from notification_time_local + User.timezone; see §3.4.4)
  ├── is_active
  └── created_at

ReminderLog (completed/snoozed actions)
  ├── id
  ├── reminder_id → Reminder
  ├── action (done | snoozed)
  ├── scheduled_date
  ├── acted_at
  └── snooze_until (nullable)

PartnerStore (for extended trial tracking)
  ├── id
  ├── name
  ├── code (unique, used in trial_source)
  ├── trial_days (default: 30)
  └── is_active

SpeciesFlag (tracks species needing care guide content)
  ├── id
  ├── species_id → Species
  ├── reason (missing_care_guide | incomplete_data | user_reported)
  ├── identification_count (how many users hit this gap)
  ├── status (open | resolved — set resolved when a CareGuide is published for the species; re-raised to open if the published guide is later unpublished or rejected per §3.3.7)
  ├── resolved_at (nullable)
  ├── resolved_by (nullable — "augmentation" | "editor" | operator id)
  └── created_at

ConsentLog (LGPD consent history, belongs to User)
  ├── id
  ├── user_id → User
  ├── purpose (identification_third_party | push_notifications | marketing | ...)
  ├── legal_basis (consent | contract | legitimate_interest | ...)
  ├── policy_version (version of privacy policy / consent text)
  ├── granted_at (nullable)
  ├── revoked_at (nullable)
  └── source (signup | settings | first_use_prompt)

DataExportRequest (LGPD Art. 18 portability, belongs to User)
  ├── id
  ├── user_id → User
  ├── status (pending | ready | delivered | failed)
  ├── requested_at
  ├── completed_at (nullable)
  └── download_url (nullable, signed, time-limited)

DataDeletionRequest (LGPD Art. 18 erasure, belongs to User)
  ├── id
  ├── user_id → User
  ├── requested_at
  ├── grace_period_ends_at (requested_at + 7 days)
  ├── status (pending | cancelled | completed)
  └── completed_at (nullable)

Subscription (belongs to User)
  ├── id
  ├── user_id → User
  ├── provider (e.g., "stripe")
  ├── provider_customer_id
  ├── provider_subscription_id
  ├── status (trialing | active | past_due | canceled | expired)
  ├── trial_start_date (nullable — window start for trial period cap, §4.8.1)
  ├── trial_end_date (nullable)
  ├── current_period_start
  ├── current_period_end
  ├── cancel_at_period_end (boolean)
  ├── created_at
  └── updated_at

BillingEvent (webhook audit log, idempotency source)
  ├── id
  ├── subscription_id → Subscription (nullable — some events arrive before linkage)
  ├── provider (e.g., "stripe")
  ├── event_id (unique — provider's event identifier, used for idempotency)
  ├── event_type (e.g., "invoice.payment_failed")
  ├── payload (JSON — raw provider payload)
  ├── processed_at
  └── created_at

IdentificationLimit (DB-driven per-tier caps, see PRD §4.8.1)
  ├── id
  ├── tier (trial | paid)
  ├── daily_cap
  ├── period_cap (total allowed within the tier's active window — trial window for trial, billing period for paid)
  ├── updated_at
  └── updated_by (operator note, free text)

ProviderBudget (DB-driven per-provider operator config: cost ceiling + identification threshold)
  ├── id
  ├── provider (e.g., "plantid", "openai")
  ├── purpose (identification | care_guide — see PRD §4.8 scope note and §3.3.7)
  ├── daily_cost_cap_cents
  ├── alert_threshold_pct (default: 80)
  ├── min_confidence (nullable, 0..1 — identification confidence threshold, seed: 0.30; only meaningful when purpose=identification)
  ├── is_active (boolean — allows disabling a provider without deleting the row)
  ├── updated_at
  └── updated_by
  (unique: provider + purpose)

ProviderUsageCounter (atomic counter per provider per purpose per UTC date)
  ├── id
  ├── provider
  ├── purpose (identification | care_guide — mirrors ProviderBudget.purpose)
  ├── utc_date
  ├── request_count
  ├── estimated_cost_cents
  └── last_updated
  (unique: provider + purpose + utc_date)

OfflineSyncFailure (queued actions that exceeded retry budget, see PRD §4.4)
  ├── id
  ├── user_id → User
  ├── action_type (e.g., "photo_upload", "reminder_done", "plant_edit")
  ├── payload (JSON — original queued action)
  ├── attempts
  ├── last_error
  ├── last_attempt_at
  └── created_at

PushSubscription (per-device push registration, see PRD §4.9)
  ├── id
  ├── user_id → User
  ├── device_id (client-generated stable identifier)
  ├── endpoint (push service endpoint URL)
  ├── keys (JSON — VAPID keys / auth secret)
  ├── created_at
  └── last_seen_at
```
