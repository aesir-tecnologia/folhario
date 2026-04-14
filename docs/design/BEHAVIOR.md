# Behavior & Interaction Specs — Folhário

## Identification

### Thresholds
- Min confidence cutoff: seed 30%, configurable per-provider via `ProviderBudget.min_confidence`. Runtime tunable. Never exposed to users.
- Display top 3 results if ≥1 passes threshold.
- <1 result passes → "could not identify" state.

### Provider Routing
- Backend decides active provider. Client just sends images.
- Router checks per-provider cost ceiling + breaker state BEFORE dispatch.
- Falls over to next configured provider if unavailable.
- Logs rejection reason: `cap_hit`, `breaker_open`, `cost_ceiling_reached`.
- A/B testing + model swaps without client change.

### Cost Controls (enforced backend, before provider call)

**Per-user caps** (from `IdentificationLimit` table):
| Tier | Daily | Period |
|---|---|---|
| trialing | 5/day | 75/trial window |
| active | 15/day | 200/billing period |

- Period window resolved from subscription at query time.
- Check before any provider call. Over-cap = typed error, no provider touch.
- Cap-exceeded requests write NO Identification row.
- Computed via `count(Identification where user_id=X AND created_at >= window_start)`. Denormalized counter only if perf demands.
- On cap hit: UI shows reset time + manual entry link.

**Per-provider global ceiling** (from `ProviderBudget`, keyed by `(provider, purpose)`):
- Default USD 5/day for Plant ID, USD 5/day for OpenAI-compat.
- `ProviderUsageCounter` row keyed by `(provider, purpose, UTC date)`.
- Increment atomically before dispatch.
- At ceiling → provider unavailable rest of UTC day → fallback → if all exhausted: `provider_unavailable` error.
- Alert at 80% ceiling.
- `purpose` = `identification` | `care_guide`. Independent budgets; care_guide exhaustion does NOT affect identification.

**Circuit breaker** (per provider):
- Trip after N consecutive failures in window.
- Half-open after cooldown.
- Close on success.
- Trip events logged with `breaker_open`.

### Failure Modes
| Scenario | Behavior |
|---|---|
| All providers down | Typed `provider_unavailable`, writes `Identification` row with `status=failed`, `failure_reason=provider_unavailable`. Photo kept in IndexedDB while on screen, lost on leave. "Try again" available. No persistent queue. |
| Timeout / network drop | Same UX. `status=failed`, `failure_reason=timeout`. |
| User leaves mid-request | Request completes server-side, persists to history, no in-flight UI restore. |
| Malformed/empty response | Counted as provider failure, breaker increment, fallover. `failure_reason=invalid_response`. |

### `Identification.status` Schema
- `success`: call completed, structured result set returned (possibly empty after threshold filter).
- `failed`: requires `failure_reason` ∈ {`timeout`, `provider_unavailable`, `cost_ceiling_reached`, `breaker_open`, `invalid_response`}.
- Client-facing error codes: `timeout`, `provider_unavailable`, `cap_hit`. Internal-only: `cost_ceiling_reached`, `breaker_open` (surface as `provider_unavailable` when no fallback).

### LGPD Consent Gate
- First identify attempt triggers consent modal (third-party providers + international transfer, Art. 33).
- Block identification until granted.
- Store consent version on each `Identification` record.
- Revocation in Settings → blocks future identifications, preserves existing data.

### Manual Correction
- Override result by typing name.
- Flagged in DB for future training/quality (not used in MVP).

### History
- Every attempt persisted: date, photos, results, selection (or manual correction or failure reason).
- Browsable, re-associatable with catalog entries.

---

## Catalog

### Add Plant
- From identification: prefilled name + photo from identify flow.
- Manual: name required, ≥1 photo required.
- Optional: nickname, room/location, acquisition date, notes.

### Room/Location Field
- Combined input.
- Shows user's previously-used locations (quick-select).
- Shows defaults: living room, balcony, bedroom, bathroom, kitchen, office, garden, other.
- Free text allowed → becomes reusable entry.
- Not GPS.

### Sorting
- Name A-Z, Z-A.
- Acquisition date newest (default) / oldest.
- Room/location.

### Photo Journal
- Chronological timeline per plant.
- Add photo + optional note.
- Doubles as motivation + diagnostic.

---

## Care Guides

### Content Sources
- **Track 1 Curated:** 200+ species, published before launch. PlantNet + RHS/Embrapa + LLM-assisted draft + human review.
- **Track 2 Runtime augmentation:** async `CareGuideProvider` call when species has no care guide or missing fields. Off critical path. Appears on next profile view.

### Draft Handling
- LLM result → `CareGuide` row with `status=draft`, `source=augmented`.
- Drafts visible immediately with "Gerado por IA — em revisão" badge.
- Editor review queue (operator tooling). Approve → `published` + bump `version`. Reject → delete + re-flag species via `SpeciesFlag`.

### Toxicity
- Icon + colored badge + text. Top of care card + plant profile.
- Mandatory disclaimer line: "Informação gerada por IA — confirme com um veterinário."
- One-time modal on first-ever care guide view. Acknowledgement persisted.

### Missing Care Guide
- Care card section HIDDEN on plant profile. All other plant features work.
- Species flagged via `SpeciesFlag`.
- Augmentation triggered async.

### Versioning
- `version` field on `CareGuide`. Bumps on publish.

---

## Reminders

### Creation
- Only from plant profile. No suggestions/prompts for plants without reminders.
- Frequency prefilled from care guide if available, editable.
- Time of day default 09:00, editable per reminder.
- Advance rule default `from_scheduled`, editable.

### Scheduling
- `next_due_at` stored as UTC timestamp.
- Computed from `notification_time_local` + `User.timezone` at create/advance time.
- Dispatcher queries by UTC. No per-request tz math at fire time.

### Timezone
- `User.timezone` IANA field. Captured at signup via device, editable in Settings.
- Travel NOT handled. Changing tz in Settings does NOT retroactively shift already-scheduled reminders — only future computations.

### Advance Rules
- `from_scheduled`: next due = previous scheduled + frequency. Use when cadence matters ("always Mondays").
- `from_acted`: next due = done timestamp + frequency. Use when interval since action matters ("water 7 days after last").
- Snooze pushes ONLY current occurrence. Next occurrence unaffected by snooze.

### Actions
- "Done" → ReminderLog entry + advance.
- "Snooze" → delays 1h / 3h / tomorrow. Current occurrence only.

### Overdue
- Visually distinct from upcoming. No escalation. No auto-mute. No auto-complete. Don't change weight with age.

### Pause on Billing
- Scheduling + delivery paused when subscription not in `trialing` / `active`.

### Failure Modes
| Scenario | Behavior |
|---|---|
| Push fails / no permission / offline | Missed reminder in in-app notification center on next open. Derived from overdue `Reminder` + `ReminderLog`. No dedicated entity. |
| Done while offline | Queued (§offline), synced on reconnect, idempotent. |
| Fires for deleted plant | Queued action dropped silently on sync. |

---

## Offline & Sync

### Queue
- Each action: client-generated UUID for idempotency. Replays deduped server-side.
- Replay in chronological order by client timestamp.

### Conflict Rules
- Plant deleted server-side → drop all queued actions for it → discard summary toast → modal listing by type + timestamps.
- Field edit stale → last-write-wins by server timestamp. No merge UI.
- Photo upload to deleted plant → drop, included in summary.
- Reminder "Done" when reminder gone → drop silent.

### Retry
- Fails 5 retries → "needs attention" list in Settings → manual retry/discard.

### Offline Blocks
- New identifications blocked (cloud-only). Clear message.
- Cached catalog + care guides browsable.
- Photo adds + reminder dones queued.

---

## Image Handling

- Client-side compression before upload, target ≤1MB.
- EXIF metadata (incl. GPS) stripped client-side (LGPD minimization).
- Thumbnail generation on upload for catalog.
- Original preserved for identification accuracy.
- No per-user storage limits in MVP.

### Failures
- Compression fail → retry once at lower quality → still fail → error + pick different photo.
- Upload fail mid-transfer → compressed image stays in IndexedDB queue → standard offline retry. No partial files in storage.
- Thumbnail gen fail → original saved → placeholder in catalog → next sync regenerates.

---

## Subscription

### State Machine
| From | To | Trigger |
|---|---|---|
| (none) | `trialing` | Account created |
| `trialing` | `active` | First charge success after trial end |
| `trialing` | `expired` | Trial ends no valid PM |
| `active` | `past_due` | Renewal fails |
| `past_due` | `active` | Payment recovered |
| `past_due` | `canceled` | Dunning exhausted |
| `active` | `canceled` | User cancels (at `current_period_end`) |
| `canceled` | `expired` | `current_period_end` reached |
| `canceled`/`expired` | `active` | Reactivate (new PM, pre-deletion) |

### Access
- `active` + `trialing` → full app.
- All other → read-only catalog mode.

### Read-Only Catalog Mode
- Plants, photos, journal, care guides: VIEW.
- Identify: blocked, paywall.
- Reminders: paused, no push, no scheduling.
- New plants / journal entries / edits: BLOCKED.
- Settings: full (payment update, reactivate, export, delete).

### Partner Codes
- At signup: valid → 30-day trial + partner link. Invalid → inline error, user clears to continue 14-day. Absent → 14-day.
- Late entry in Settings: accepted ONLY while `status=trialing` AND wall-clock < `trial_end_date`.
- Late valid code: `trial_end_date = created_at + 30 days` in one write. No reset. No stack. Never extends past expired trial.
- Deactivating `PartnerStore` post-grant does NOT affect already-established trials.

### Dunning
- Stripe 4 retries over 7 days.
- Email per failed attempt with PM update link.
- Exhausted → `canceled` → read-only.

### Cancellation
- From Settings. Confirms `current_period_end`. Full access until then.

### Reactivation
- From Settings. Available while account exists (incl. 7-day deletion grace).
- Reactivating after `expired` = new subscription (not resume).

### Webhooks
- Signature verification on every request.
- Idempotency: `BillingEvent.event_id`, duplicates = no-ops.
- Webhook handler is authoritative for `Subscription.status`. Client never mutates.
- Every event persisted with raw payload.

---

## LGPD

### Consent Points
| Activity | Basis |
|---|---|
| Account, auth, catalog | Contract |
| Billing | Contract |
| Photos to 3rd-party identify | Consent |
| Push | Consent |
| Aggregated metrics | Legitimate interest |
| ID history retention | Contract + legitimate interest |

### Rights (from Settings)
- Access: JSON export (all personal data).
- Correction: via existing edit flows.
- Deletion: 7-day grace → hard delete.
- Portability: structured JSON export.
- Consent revocation: per-consent toggle. Never breaks existing catalog access.
- Info about sharing: privacy policy.

### Deletion Flow
- Request from Settings.
- 7-day grace, account suspended (inaccessible) but recoverable.
- Email on request.
- After 7 days → hard delete: photos, catalog, ID history, reminder logs, consent records (except minimal proof record).
- Backups purged within 30 days.
- Anonymized metrics may be retained.

### Retention
- ID history, photo journal, catalog: life of account.
- Operational logs with PII: ≤90 days target.
- Deletion audit: as required by law.

### Age Gate
- Signup requires ≥13 confirmation.
- <13 blocked.
- 13-17 follows standard consent.

### Data Breach Process
- ANPD + affected user notification within LGPD Art. 48 timeframes. Documented process.

---

## Push Notifications

- Permission DEFERRED until first reminder creation. Never at signup / first visit / first identify.
- Service worker via web-push + VAPID.
- Per-device `PushSubscription` keyed by `(user_id, device_id)`.
- Logout revokes this device's sub only.
- Reminder fires on ALL devices with active push subs.
- Done on one device clears others via sync.
- Notification prefs (global mute, per-plant mute) apply across all devices.
- Fallback if no push: in-app notification center on Home.

---

## Multi-Device

- Catalog/care guides replicate via offline sync mechanism.
- Per-device JWT (or equivalent), independently revocable.
- Per-device push subs.
- Global notification prefs.
- Eventually consistent, LWW, idempotent.

---

## Auth Boundaries

- Email+password OR OAuth (Google min).
- No anonymous usage.
- Trial requires account.
- JWT stateless. No server sessions.

---

## Testing Boundaries

- Unit tests (fast, isolated).
- Backend integration tests against REAL database. Mocking DB not permitted. External providers use fixtures/test modes.
- Playwright E2E: every §7 screen's happy path + documented failure states (cap-reached, provider-unavailable, offline discard, draft badge, read-only mode).
- All layers pass before release.
