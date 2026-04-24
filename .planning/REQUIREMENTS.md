# Requirements: Folhário

**Defined:** 2026-04-14
**Core Value:** A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.
**Source of truth:** `docs/CAVE-PRD.md` — every requirement below maps back to an AC-* in PRD §23 or a behavioral rule in §1–§22.

## v1 Requirements

Requirements for the MVP launch. Each maps to exactly one roadmap phase.

### AUTH — Authentication, verification, credentials

- [ ] **AUTH-01**: User can sign up with email + password; User row created; Subscription created `status=trialing`; verification email dispatched via Resend (PRD §12, AC-AUTH-001)
- [ ] **AUTH-02**: Unverified email+password user is blocked on gated endpoints with `email_unverified` 403 until they click the verification link; only resend-verification, Settings/account, and logout are reachable (AC-AUTH-001, §1, §12)
- [ ] **AUTH-03**: User can sign up / log in with Google OAuth; user treated as pre-verified; gated endpoints reachable immediately; no verification email sent (AC-AUTH-002)
- [ ] **AUTH-04**: Clicking the verification link marks the user verified and starts the "value <2 min" clock; subsequent requests to gated endpoints succeed (AC-AUTH-003, §1)
- [ ] **AUTH-05**: User can log in with email + password using per-device JWT; no server sessions (§12)
- [ ] **AUTH-06**: Age confirmation ≥13 is mandatory at signup; `User.age_confirmed_at` set only on confirm; <13 blocked (PRD §13, AC-LGPD-010)
- [ ] **AUTH-07**: Signup form accepts optional partner code; partner code captured in `User.partner_code` and surfaced to billing (PRD §12, AC-SUB-003)
- [ ] **AUTH-08**: Signup captures device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and stores it in `User.timezone` (§12)
- [ ] **AUTH-09**: Signup records T&C + privacy policy acceptance linked to active `policy_version` in ConsentLog (§13)
- [ ] **AUTH-10**: Public auth endpoints (signup, login, OAuth callbacks) enforce a narrow per-IP attempt throttle; tripping returns `rate_limited` 429; successful logins do not consume the failure budget; independent of target account (AC-AUTH-004, AC-AUTH-005, §5)
- [ ] **AUTH-11**: User can request a password reset; endpoint always returns 200 (no enumeration); valid email receives a Resend email with single-use token, 1h expiry, hashed storage (AC-AUTH-006)
- [ ] **AUTH-12**: Valid reset token within window lets user set a new password; reused token returns `validation_failed`; existing JWTs remain valid (AC-AUTH-006)
- [ ] **AUTH-13**: Authed user can change password from Settings with current + new; wrong current → `invalid_credentials` 401; OAuth-only accounts have the UI hidden and the endpoint rejects with `forbidden` (AC-AUTH-007)
- [ ] **AUTH-14**: User can log out of the current device (revokes that JWT and its push subscription only) (§14)
- [ ] **AUTH-15**: Unverified-email full-screen blocker shown in place of app shell: "Verifique seu e-mail para começar." + resend-verification + logout link; cleared on verification (§16)

### IDENT — Identification flow, providers, caps, failure modes

- [ ] **IDENT-01**: Authed, consented, trialing/active, below caps → `POST /v1/identifications` returns ≤3 results above `min_confidence` ordered desc; persists `Identification status=success` with provider/model/latency/consent_version/photo_urls; emits `identification.succeeded` (AC-ID-001)
- [ ] **IDENT-02**: First identification ever without `identification_third_party` consent triggers the LGPD consent modal disclosing Plant ID + OpenAI-compat providers and Art. 33 transfer; no provider call until granted (AC-ID-002, §13)
- [ ] **IDENT-03**: Consent revoked or never granted → `consent_required` 403; no provider call; no Identification row (AC-ID-003)
- [ ] **IDENT-04**: Backend filters results below `ProviderBudget.min_confidence` (seed 0.30); only above-threshold results returned, max 3 (AC-ID-004, §6)
- [ ] **IDENT-05**: Zero results above threshold → "could not identify" UI + retake guidance; Identification row persisted with raw provider results for history (AC-ID-005)
- [ ] **IDENT-06**: User selects a result and confirms → Plant created linked to Species, name pre-filled, `Identification.plant_id` FK set (AC-ID-006)
- [ ] **IDENT-07**: Manual correction stored in `manual_correction`; Species resolved by name match if possible, else null + flagged (AC-ID-007)
- [ ] **IDENT-08**: Identification history lists success + timeout + provider_unavailable attempts with `status` + `failure_reason`; success shows results + selection; re-associate-with-catalog link available (AC-ID-008, §6)
- [ ] **IDENT-09**: Trialing user over daily cap (5) or period cap (75) → `cap_hit` 429 with reset time; no provider call; no counter increment; UI shows manual entry link, no retry button (AC-ID-009, AC-COST-001)
- [ ] **IDENT-10**: Active user over daily cap (15) or period cap (200 per billing period) → `cap_hit` 429 (AC-ID-010, AC-COST-002)
- [ ] **IDENT-11**: Primary provider at cost ceiling, fallback available → router skips primary, logs `cost_ceiling_reached`, dispatches fallback, client gets success (AC-ID-011, AC-COST-006)
- [ ] **IDENT-12**: All providers exhausted → `provider_unavailable` 503; Identification row persisted `status=failed` with most specific internal `failure_reason`; internal reason never leaks to client; photo retained in IndexedDB while on screen (AC-ID-012, AC-COST-007)
- [ ] **IDENT-13**: Provider call exceeds backend timeout → `timeout` 504; row persisted `status=failed`, `failure_reason=timeout`; visible in history (AC-ID-013)
- [ ] **IDENT-14**: User navigates away mid-request → request completes server-side, row persisted; no in-flight UI restored on return (AC-ID-014)
- [ ] **IDENT-15**: Malformed/empty provider response → `failure_reason=invalid_response`, breaker counter incremented, fallover to next provider (AC-ID-015)
- [ ] **IDENT-16**: Photos with EXIF GPS tags are rejected by the server as `validation_failed`; client-side strip is the primary defense (AC-ID-016, §11)
- [ ] **IDENT-17**: Identification accepts 1..N photos (camera/gallery multipart) with static capture guide visible (leaf + flower + whole plant + "Mais fotos melhoram a precisão") (§16)
- [ ] **IDENT-18**: Vercel function budget for identification: total wall-clock 50s, per-call cap 30s, fallover requires ≥10s remaining budget else short-circuit `provider_unavailable` (§6)
- [ ] **IDENT-19**: `IdentificationProvider` adapter interface with Plant ID + OpenAI-compat connectors; backend chooses active provider, not client; prompts + config versioned with app deploy (§6)
- [ ] **IDENT-20**: Offline identification blocked with clear "Identificação requer conexão à internet." message (§10, §16)
- [ ] **IDENT-21**: Read-only catalog mode shows paywall modal on identify attempt: "Reative sua assinatura para identificar novas plantas." (§12, §16)

### CAT — Catalog ("Meu Jardim")

- [ ] **CAT-01**: From identification + selected result, Plant created with `species_id`, name pre-filled, cover photo from identification upload (AC-CAT-001)
- [ ] **CAT-02**: Manual plant creation with name + ≥1 photo creates Plant `species_id=null` + PhotoEntry for initial photo (AC-CAT-002)
- [ ] **CAT-03**: Manual create missing name OR missing photo → `validation_failed`, no row, field highlighted (AC-CAT-003)
- [ ] **CAT-04**: Plant profile shows name, nickname, room, acquisition_date, notes, cover, care-card link (if CareGuide exists), active reminders, photo journal, identification history (AC-CAT-004, §7)
- [ ] **CAT-05**: Location picker shows user's prior locations as quick-select + defaults `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]` + free text; free text becomes reusable (AC-CAT-005, AC-CAT-006)
- [ ] **CAT-06**: Add photo to photo journal with optional note → PhotoEntry with plant_id, photo_url, thumbnail_url, note; reverse-chronological timeline (AC-CAT-007)
- [ ] **CAT-07**: Catalog default sort: `acquisition_date` desc, null dates last (AC-CAT-008)
- [ ] **CAT-08**: Sort control offers name A-Z, name Z-A, date newest, date oldest, location; selected sort persists for session (AC-CAT-009)
- [ ] **CAT-09**: Deleting a plant cascades PhotoEntry + Reminder rows, schedules storage objects for deletion, sets `Identification.plant_id` NULL but preserves the history row (AC-CAT-010)
- [ ] **CAT-10**: Catalog grid responsive: 2 cols ≤375px, 3 cols 600–899px, 4 cols ≥900px (§16)
- [ ] **CAT-11**: Empty catalog state: "Sua estante ainda está esperando a primeira planta." with Sage line-art illustration + single Canopy Green primary CTA (§17)

### CARE — Care guides + toxicity + augmentation

- [ ] **CARE-01**: Published care guide renders all 7 fields (watering, light, soil, temperature, humidity, toxicity, difficulty) + seasonal tips + compatibility block (AC-CARE-001, §8)
- [ ] **CARE-02**: Toxicity badge composition: icon + colored filled badge + literal text + striped border + SR `role="alert"`; always at top of care card and plant profile (AC-CARE-002, §17)
- [ ] **CARE-03**: Mandatory disclaimer "Informação gerada por IA — confirme com um veterinário" visible on same viewport as any toxicity badge (AC-CARE-003)
- [ ] **CARE-04**: First-ever care guide view shows one-time toxicity disclaimer modal; acknowledgement persisted in `User.toxicity_disclaimer_acknowledged_at`; never shown again (AC-CARE-004)
- [ ] **CARE-05**: Plant whose species has no CareGuide hides the care card section but keeps all other features; `Species.flag_reason=missing_care_guide`, `flag_status=open`, `identification_count` incremented (AC-CARE-005)
- [ ] **CARE-06**: `identification.succeeded` for a species missing a care guide triggers the `care-guide/augment` Inngest function via `CareGuideProvider.augment`; on success upsert `CareGuide source=augmented`, bump version, set `Species.flag_status=resolved`, emit `care_guide.augmented`; identification response not delayed (AC-CARE-006)
- [ ] **CARE-07**: Augmented CareGuide rows always render with a persistent "Gerado por IA" Trust Teal chip at top; badge never removed (AC-CARE-007, §17)
- [ ] **CARE-08**: `ProviderBudget` row for `purpose=care_guide` at/above `daily_cost_cap_cents` → augment function exits without provider call, logs `cost_ceiling_reached`, leaves CareGuide untouched; `purpose=identification` budget for same provider untouched (AC-CARE-010)
- [ ] **CARE-09**: Founder-curated launch corpus of ≥200 domestic species with complete care guides published (LAUNCH BLOCKER, §8)
- [ ] **CARE-10**: Care guide card visual implementation per §17 — icon rows, Calm Slate secondary text, photography-first atmosphere

### REM — Reminders + daily nudge

- [ ] **REM-01**: Plants without reminders show no prompt/suggestion to create one (AC-REM-001, §9)
- [ ] **REM-02**: New user defaults `notification_time_local=09:00`; editable in Settings; applies to ALL reminders for that user; no per-reminder override (AC-REM-002)
- [ ] **REM-03**: Reminder creation from plant profile with type (watering/fertilization) + frequency (prefilled from care guide if available) + advance_rule (default `from_scheduled`) (AC-REM-003, §9)
- [ ] **REM-04**: First reminder ever created → browser-native push permission prompt surfaced (never at signup/first-visit/first-identify) (§15)
- [ ] **REM-05**: `reminders/dispatch` cron emits exactly ONE `daily_reminder_summary.due` per user at their `notification_time_local` when ≥1 reminder is due/overdue; `notifications/send-push` fans out single daily nudge to every active PushSubscription; push payload carries no Done/Snooze, taps deep-link to Home (AC-REM-004, §15)
- [ ] **REM-06**: Zero reminders due/overdue → no event emitted, no nudge sent (AC-REM-004)
- [ ] **REM-07**: Done tapped in-app on device A → ReminderLog `action=done`; device B clears on next sync; `next_due_at` advances per `advance_rule`; Done never reachable from push payload (AC-REM-005)
- [ ] **REM-08**: Snooze offers 1h / 3h / tomorrow; chosen option writes `ReminderLog action=snoozed` + `snooze_until` (AC-REM-006)
- [ ] **REM-09**: `from_scheduled` reminder: next_due computed from previous scheduled + frequency regardless of snooze or late-done date (AC-REM-007, AC-REM-008)
- [ ] **REM-10**: `from_acted` reminder: next_due computed from done timestamp + frequency (AC-REM-009)
- [ ] **REM-11**: Default `advance_rule=from_scheduled` persisted when user doesn't touch control (AC-REM-010)
- [ ] **REM-12**: Overdue reminders appear in a visually distinct section but do not auto-mute, auto-complete, or change visual weight as they age (AC-REM-011, §9)
- [ ] **REM-13**: Subscription not in trialing/active → `reminders/dispatch` sends no pushes; `next_due_at` not advanced; resumes on return to trialing/active (AC-REM-012)
- [ ] **REM-14**: No push permission OR all devices offline at notification_time → no nudge delivered; user sees due/overdue list on Home next open; no missed-push backlog entity (AC-REM-013, §15)
- [ ] **REM-15**: Done queued offline → replayed with client UUID, server dedupes, single ReminderLog row (AC-REM-014)
- [ ] **REM-16**: Done queued for reminder/plant deleted elsewhere → action dropped silently, no error (AC-REM-015)
- [ ] **REM-17**: Push service returns 410 Gone or 404 Not Found → corresponding `PushSubscription` row deleted in same step; self-healing, no cron prune (AC-REM-016, §15)
- [ ] **REM-18**: `next_due_at` computed at create/advance (UTC) from `User.notification_time_local` + `User.timezone`; dispatcher queries by UTC only; no per-request tz math at fire time (§9)
- [ ] **REM-19**: Home "Hoje" section is the authoritative due/overdue list (source of truth for any missed push), derived live from Reminder + ReminderLog (§9, §16)
- [ ] **REM-20**: Changing `User.timezone` in Settings does NOT retroactively shift already-scheduled reminders; only future computations use the new tz (§9)
- [ ] **REM-21**: Reminders management screen lists reminders grouped by plant with edit/delete; header shows current global notification time with "Change in Settings" link (§16)

### OFF — Offline sync + queue

- [ ] **OFF-01**: Action queued in IndexedDB while offline survives close + reopen while still offline (AC-OFF-001)
- [ ] **OFF-02**: Queued action replayed >1 time after reconnect is processed exactly once; duplicates return the original result (server-side dedup via `Idempotency-Key` = client UUID) (AC-OFF-002)
- [ ] **OFF-03**: Multiple queued actions with distinct client timestamps replayed in ascending client-timestamp order (AC-OFF-003)
- [ ] **OFF-04**: Queued actions targeting a plant deleted server-side are all dropped; a single discard summary toast appears on next app open, tappable to a modal grouping discarded actions by type with client timestamps (read-only) (AC-OFF-004, §10)
- [ ] **OFF-05**: Queued field edit on stale row: last-write-wins by server timestamp, no merge UI (AC-OFF-005)
- [ ] **OFF-06**: Queued action failing sync 5 attempts creates an `OfflineSyncFailure` row and is removed from the active queue (AC-OFF-006)
- [ ] **OFF-07**: `OfflineSyncFailure` rows visible in Settings "Needs attention" with retry/discard per entry (AC-OFF-007)
- [ ] **OFF-08**: Previously loaded catalog browsable offline; new identifications blocked with clear message (AC-OFF-008, §10)
- [ ] **OFF-09**: Service worker + PWA manifest (installable, display `standalone`, all icon sizes, theme color matches brand, viewport allows user scaling) (§17, §2)
- [ ] **OFF-10**: App-update toast: new SW version waiting → non-blocking bottom toast "Nova versão disponível" + "Atualizar"; tapping triggers `skipWaiting` + reload; honors `prefers-reduced-motion`; never auto-reloads mid-session (§16)

### SUB — Subscription, trials, billing, webhooks

- [ ] **SUB-01**: New signup creates Subscription `status=trialing` with `trial_end_date` from signup time (AC-SUB-001)
- [ ] **SUB-02**: Signup without partner code → `trial_end_date = created_at + 14d`, `trial_source=organic` (AC-SUB-002)
- [ ] **SUB-03**: Signup with valid partner code → `trial_end_date = created_at + 30d`, `trial_source=partner`, `partner_code` recorded (AC-SUB-003)
- [ ] **SUB-04**: Signup with unknown/inactive code → `invalid_partner_code` inline error, user clears to proceed with 14-day trial (AC-SUB-004)
- [ ] **SUB-05**: Organic trialing user inside window can enter a valid partner code in Settings → `trial_end_date = created_at + 30d`, clock NOT reset (AC-SUB-005)
- [ ] **SUB-06**: Partner trialing user cannot stack a second partner code; rejected; `trial_end_date` unchanged (AC-SUB-006)
- [ ] **SUB-07**: Deactivating a PartnerStore does NOT affect already-established trials (AC-SUB-007)
- [ ] **SUB-08**: Trial ends with valid payment method → Stripe webhook transitions status to `active` (AC-SUB-008)
- [ ] **SUB-09**: Trial ends without valid PM → status → `expired`; read-only catalog mode (AC-SUB-009)
- [ ] **SUB-10**: Active subscription renewal charge fails → status → `past_due`; payment-failed email dispatched via Resend (AC-SUB-010)
- [ ] **SUB-11**: Past_due recovered via retry/manual payment → status → `active` (AC-SUB-011)
- [ ] **SUB-12**: Past_due exhausting 4-retry/7-day dunning → status → `canceled` (AC-SUB-012)
- [ ] **SUB-13**: User cancels from Settings → `cancel_at_period_end=true`; UI confirms access-ends date; full access until `current_period_end` (AC-SUB-013)
- [ ] **SUB-14**: Canceled subscription reaching `current_period_end` → status → `expired` (AC-SUB-014)
- [ ] **SUB-15**: Canceled/expired non-deleted account with valid PM can reactivate as a NEW subscription in `active` (AC-SUB-015)
- [ ] **SUB-16**: Sub not in trialing/active → catalog/photos/journal/care guides viewable, identification → `subscription_required` 402, reminders paused, mutations → `read_only_mode` 402, Settings fully accessible; persistent read-only banner shown (AC-SUB-016)
- [ ] **SUB-17**: `Subscription.status` mutated only by webhook handler; no client-callable route mutates status directly (AC-SUB-017)
- [ ] **SUB-18**: Stripe delivering same `event_id` twice → only one `BillingEvent` row via UNIQUE constraint; second delivery is no-op returning 200 (AC-SUB-018)
- [ ] **SUB-19**: Bad Stripe webhook signature → `webhook_signature_invalid` 401, no BillingEvent, logged to Sentry critical (AC-SUB-019)
- [ ] **SUB-20**: End-to-end Stripe webhook path: verify signature → insert BillingEvent → enqueue `billing.webhook.received` to Inngest → `billing/process-webhook` transitions state + emits `subscription.status_changed` + triggers dunning email via Resend (AC-SUB-020, §12)
- [ ] **SUB-21**: `BillingProvider` adapter interface (`create_customer`, `start_subscription`, `cancel_subscription`, `reactivate_subscription`, `update_payment_method`, `get_subscription`, `handle_webhook`) — business logic never touches Stripe SDK directly (§12)
- [ ] **SUB-22**: Stripe Checkout accepts card + Pix as payment methods (§12)
- [ ] **SUB-23**: Settings → Subscription & billing screen shows current plan + status, renewal/trial-end date, PM (last 4 / Pix indicator), update PM button, partner code input (ONLY while trialing AND wall-clock < trial_end_date), cancel, reactivate (when canceled/expired), billing history (§16)

### COST — Per-user caps + per-provider ceilings + breakers

- [ ] **COST-01**: `IdentificationLimit` returns `daily_cap=5`, `period_cap=75` for tier `trial`; window = `[trial_start_date, trial_end_date]` (AC-COST-001)
- [ ] **COST-02**: `IdentificationLimit` returns `daily_cap=15`, `period_cap=200` for tier `paid`; window = `[current_period_start, current_period_end]` (AC-COST-002)
- [ ] **COST-03**: Cap check executes BEFORE any `ProviderUsageCounter` increment or provider call; over-cap requests never reach a provider (AC-COST-003)
- [ ] **COST-04**: Provider counter reaching 80% of `daily_cost_cap_cents` dispatches an operator alert email via Resend (AC-COST-004)
- [ ] **COST-05**: Provider counter at daily ceiling → provider marked unavailable rest of UTC day; router skips it; fallover engaged (AC-COST-005)
- [ ] **COST-06**: Per-provider ceilings keyed `(provider, purpose)` — `identification` and `care_guide` are independent budgets/counters; care_guide exhaustion never affects identification (AC-COST-006, §6, §8)
- [ ] **COST-07**: Only `provider_unavailable` surfaces to clients; internal reasons (`cost_ceiling_reached`, `breaker_open`) persisted in `Identification.failure_reason` but never returned (AC-COST-007)
- [ ] **COST-08**: Circuit breaker per provider: opens after N consecutive failures within window, half-open after cooldown, close on success; trips logged with `breaker_open` (AC-COST-008, §6)
- [ ] **COST-09**: Two concurrent identification requests to the same provider → `ProviderUsageCounter` increments serialized atomically; no lost writes (AC-COST-009)
- [ ] **COST-10**: Operator updates to `IdentificationLimit` or `ProviderBudget` in DB take effect on next request past in-memory cache TTL; no redeploy (AC-COST-010)

### LGPD — Data rights, deletion grace, consent

- [ ] **LGPD-01**: Data export request creates `DataExportRequest status=pending`; Inngest `iam/generate-export` generates a zip containing `data.json` (all user records) + `photos/` directory (originals); uploaded to `data-exports` bucket; status → ready, `download_url` signed time-limited (AC-LGPD-001)
- [ ] **LGPD-02**: Export ready → "data export ready" email dispatched via Resend with signed URL (AC-LGPD-002)
- [ ] **LGPD-03**: Deletion request creates `DataDeletionRequest` with `grace_period_ends_at = now + 7d`; `User.deletion_requested_at` set; confirmation email sent; account suspended immediately (AC-LGPD-003)
- [ ] **LGPD-04**: Inside 7-day grace, only cancel-deletion + read-only LGPD endpoints reachable; other requests → `deletion_in_progress` 403 (AC-LGPD-004)
- [ ] **LGPD-05**: Cancellation during grace sets `DataDeletionRequest.status=cancelled`; Inngest function `iam/process-deletion` wakes on `grace_period_ends_at`, observes cancellation, exits without deleting; account returns to normal access (AC-LGPD-005)
- [ ] **LGPD-06**: Grace elapsed without cancellation → function resumes, hard-deletes photos, plants, ID history, reminder logs, consent rows (except minimal deletion-audit record); "deletion complete" email sent (AC-LGPD-006)
- [ ] **LGPD-07**: Hard-deleted account reflected in next full backup cycle within 30 days (AC-LGPD-007)
- [ ] **LGPD-08**: Consent revocation from Settings records in ConsentLog; existing catalog access preserved; only affected processing activity blocked going forward (AC-LGPD-008)
- [ ] **LGPD-09**: Successful identification captures `consent_version` of the policy active at request time (AC-LGPD-009)
- [ ] **LGPD-10**: Privacy policy version bump flagged material for an activity → on next use of that activity, a new consent prompt appears before proceeding; new `policy_version` recorded on grant (AC-LGPD-011)
- [ ] **LGPD-11**: `iam/process-deletion` uses `step.sleepUntil(grace_period_ends_at)` with `grace_period_ends_at` embedded in the event payload (not fetched at wake time) — survives cancellation races (§13, stack notes)
- [ ] **LGPD-12**: Privacy policy + ToS published and versioned before launch; DPO contact info surfaced in privacy policy + Settings (§13)
- [x] **LGPD-13**: Sentry breadcrumbs scrub `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`; drop request bodies on identification routes; `Sentry.setUser({ id })` only (§13, §21)
- [ ] **LGPD-14**: Settings Privacy & LGPD panel: "Exportar meus dados", "Excluir minha conta" (confirm modal → 7-day grace), manage consents (per-consent toggle), privacy policy link, ToS link, DPO contact (§16)

### NOTIF — Email + push notifications

- [ ] **NOTIF-01**: `notifications/send-email` Inngest function handles all transactional email via Resend: verification, password reset, trial ending (T-3d, T-1d), trial expired, payment failed (dunning 1–4), subscription canceled, reactivation confirmation, account deletion requested, account deletion completed, data export ready, 80% provider cost ceiling alert (§20)
- [ ] **NOTIF-02**: React Email templates for each transactional message, pt-BR copy, brand-aligned (§20)
- [ ] **NOTIF-03**: Per-device `PushSubscription` keyed `(user_id, device_id)`; logout revokes only that device's subscription (§14)
- [ ] **NOTIF-04**: `notifications/send-push` via `web-push` + VAPID; VAPID keys generated once per env (§15)
- [ ] **NOTIF-05**: Notification preferences: global mute + per-plant mute; global across devices (§14, §15)
- [ ] **NOTIF-06**: Trial ending notifier: daily Inngest cron fires `trial.ending` at T-3d and T-1d relative to `trial_end_date` (§3)

### OBS — Observability + metrics

- [x] **OBS-01**: Sentry Next.js SDK integrated; release tag = git SHA; source maps uploaded post-build from GitHub Actions (Turbopack requirement); PII scrubbing rules enforced (§21, stack notes)
- [x] **OBS-02**: PostHog US cloud integrated (client + server via `posthog-node` for Inngest-emitted events); LGPD Art. 33 international transfer basis documented via PostHog SCCs (§21)
- [ ] **OBS-03**: PostHog event taxonomy implemented: `signup_completed`, `consent_granted`, `identification_started`, `identification_succeeded`, `identification_cap_hit`, `plant_added`, `reminder_created`, `reminder_acted`, `care_guide_viewed`, `trial_started`, `subscription_activated`, `subscription_canceled`, `data_export_requested`, `data_deletion_requested` (§20)
- [ ] **OBS-04**: Scheduled SQL rollups via Inngest cron over `Identification` table → dashboards for confidence distribution, manual correction rate, success rate, provider latency p50/p95/p99, error rate, cap-hit rate, breaker open minutes/day, augmentation success rate, augmentation cost (§21, §22)
- [ ] **OBS-05**: Alerts: Sentry on new issues + error-rate spikes, 80% provider ceiling → Resend operator email, Stripe webhook signature failure → Sentry critical + operator email, Inngest function failure after retries exhausted → Sentry (§21)

### UI — Screens, design system, accessibility

- [ ] **UI-01**: Global design tokens implementation — Paper Cream / Night Cream palettes (light + dark), Source Serif 4 + Plus Jakarta Sans typography, Lucide icons (§17)
- [ ] **UI-02**: Dark mode via `color-scheme: light dark` following system pref with manual override in Settings; every screen designed and reviewed in both variants (§17)
- [ ] **UI-03**: Global focus ring: 3px Canopy @ 40% opacity, 2px offset, 8px corner radius; tab order matches visual reading order; focus moves to main content region on route change (§17, §18)
- [ ] **UI-04**: Home screen — empty (zero plants): full-bleed "Identifique sua primeira planta" CTA + camera button + "Adicionar manualmente" text link; nothing else (§16)
- [ ] **UI-05**: Home screen — default (≥1 plant): "Hoje" section listing reminders due + overdue, quick "Identificar planta" action, Catalog nav (§16)
- [ ] **UI-06**: Identify screen — picker with capture guide, loading, results (top 3 cards), no-results, cap reached, provider unavailable, offline, read-only paywall, first-time consent modal (§16)
- [ ] **UI-07**: Catalog grid responsive breakpoints (2/3/4 cols at 375/600/900) with card: 4:5 photo + name + nickname + location; sort control (§16)
- [ ] **UI-08**: Plant profile screen — cover + thumbnail gallery, inline-edit name/nickname, room, acquisition_date, notes, care card (or hidden), active reminders, photo journal preview, ID history link, delete overflow; augmented / no-care / read-only variants (§16)
- [ ] **UI-09**: Care guide screen — visual icons per dimension, toxicity badge prominent at top, first-view toxicity modal, "Gerado por IA" chip when augmented, seasonal tips, compatibility block (§16, §17)
- [ ] **UI-10**: Reminders management screen per §16 + first-reminder push-permission prompt (§16)
- [ ] **UI-11**: Photo journal screen — per-plant chronological list with add entry flow; read-only variant (§16)
- [ ] **UI-12**: Identification history screen — per-user list with thumbnails, results, selected/manual/failed status; detail view with re-associate action (§16)
- [ ] **UI-13**: Settings screen — account, notifications, subscription & billing, privacy & LGPD, needs attention (sync failures), app info sections (§16)
- [ ] **UI-14**: Bottom navigation: 4 items (Home, Catálogo, Identificar, Perfil), 28px Lucide + label always, Canopy active indicator bar, 56px + safe-area padding, per-tab scroll preservation (§17)
- [ ] **UI-15**: Confidence ladder: 3 states (high ≥70%, medium 40–69%, low threshold–39%) with redundant signals (bar, segments, percentage, SR label) (§17, §18)
- [ ] **UI-16**: Toxicity badge composition (non-negotiable 7-part spec): filled rounded-rect, 18px paw+child icon, literal text, 3px diagonal striped accent border, disclaimer line, SR `role="alert"` full phrase, haptic warning on first reveal per session (§17, §18)
- [ ] **UI-17**: Skeletal shimmer loading (never circular spinners) with 300ms delay threshold and 120ms fade-in for faster ops; static block + 80ms fade under reduced motion (§17)
- [ ] **UI-18**: Empty states — composed invitations with Sage line-art illustration + Source Serif headline + Calm Slate hint + exactly one Canopy primary CTA (§17)
- [ ] **UI-19**: Error states — inline + calm, never full-screen red wall; cause + recovery copy; retry path always exposed (§17)
- [ ] **UI-20**: Spring-physics motion (120 stiffness / 18 damping / 1 mass), capture-button 1.00→1.03 tactile bounce, 3.2s breathing loop on empty Home CTA, 60ms cascade on list reveal; reduced-motion fallbacks defined for every motion (§17)
- [ ] **UI-21**: Safe areas: `min-h-[100dvh]`, `env(safe-area-inset-*)` everywhere, no `h-screen`, no horizontal scroll except Home "Today's tasks" strip (§17)
- [ ] **UI-22**: Accessibility — color never sole signal; image alt text from context (plant name + nickname); live regions for async state; modal focus trap; decorative illustrations `accessibility hidden`; haptics only on critical events (§18)
- [ ] **UI-23**: `next-intl` day-one integration, `<html lang="pt-BR">`, `date-fns-tz` for server-rendered user-local times, all strings via i18n layer (no hardcoded copy), `Intl.*` with pt-BR for numbers/dates/currency (§17, stack notes)
- [ ] **UI-24**: Persistent banners — offline ("Você está offline..."), read-only ("Sua assinatura expirou..."), discard summary post-sync toast (§16)
- [ ] **UI-25**: Design system guardrails enforced: no emoji, no pure black/white, no gradient text, no glassmorphism/neumorphism, no Inter/generic serifs, no centered hero stacks, no fabricated metrics (§17)

### INFRA — Tech stack, repo layout, DB, CI/CD, security

- [x] **INFRA-01**: Next.js 16 App Router project scaffolded with React 19, TS strict (+ `noUncheckedIndexedAccess`), pt-BR locale default, PWA via `@serwist/next` (stack)
- [x] **INFRA-02**: Repo layout per PRD §2 — `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/` + `src/shared/{db,events,adapters,config,telemetry}/` (§2)
- [ ] **INFRA-03**: Route handlers under `/api/v1` are thin: validate → use-case → HTTP map; no Drizzle in handlers (§2)
- [ ] **INFRA-04**: Drizzle ORM + `postgres-js` + `{ prepare: false }` mandatory for Supavisor txn-pooler compatibility; single shared `db/client.ts` (stack)
- [ ] **INFRA-05**: Drizzle schema + migrations for all entities in §4 (User, Plant, Species, CareGuide, PhotoEntry, Identification, Reminder, ReminderLog, PartnerStore, ConsentLog, DataExportRequest, DataDeletionRequest, Subscription, BillingEvent, IdentificationLimit, ProviderBudget, ProviderUsageCounter, OfflineSyncFailure, PushSubscription)
- [ ] **INFRA-06**: Supabase Storage buckets created (private): `plant-photos`, `plant-thumbnails`, `data-exports`; `StorageAdapter` interface with signed URL helpers (§2)
- [ ] **INFRA-07**: Supabase Auth behind `AuthAdapter`; JWT verification in Next middleware on every `/api/v1/*` except public endpoints (§21)
- [ ] **INFRA-08**: RLS enabled on all user-owned tables as defense in depth; service-role key server-only (§21)
- [ ] **INFRA-09**: Zod validation at route-handler body/query boundaries; `drizzle-zod` for DB-schema-derived Zod (stack)
- [ ] **INFRA-10**: Inngest `serve()` handler at `/api/inngest/route.ts`; all async functions registered: `care-guide/augment`, `iam/process-deletion`, `iam/generate-export`, `billing/process-webhook`, `billing/trial-ending-notifier`, `reminders/dispatch`, `notifications/send-email`, `notifications/send-push` (§3)
- [ ] **INFRA-11**: Vercel hosting configured; Vercel git integration DISABLED (stack)
- [ ] **INFRA-12**: `ci.yml` GitHub Action: install, lint, typecheck, unit (Vitest), integration against real `postgres:16-alpine` service container with Drizzle migrations seeded, build (§20)
- [ ] **INFRA-13**: `deploy-preview.yml`: apply migrations to Supabase branch DB per PR → `vercel pull` → `vercel build` → `vercel deploy --prebuilt` → Playwright against returned preview URL → comment URL on PR (§20)
- [ ] **INFRA-14**: `deploy-production.yml`: apply migrations to prod Supabase (manual approval gate for destructive) → `vercel deploy --prebuilt --prod` → create Sentry release + upload source maps → sync Inngest functions (§20)
- [ ] **INFRA-15**: `deploy-preview-cleanup.yml`: delete Supabase branch DB + remove Vercel preview alias on PR close (§20)
- [x] **INFRA-16**: `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real providers to prevent accidental spend in preview (§20)
- [x] **INFRA-17**: All env vars from PRD §20 table configured in Vercel + GitHub secrets; none committed, none logged (§20)
- [x] **INFRA-18**: Standard security headers via Next.js middleware (CSP, HSTS, X-Frame-Options, etc.) (§21)
- [ ] **INFRA-19**: Image pipeline — client-side compression to ≤1MB + EXIF/GPS strip → upload → thumbnail generation on upload → originals preserved for ID accuracy (§11)
- [x] **INFRA-20**: Closed error code registry implemented as a single source enum; no ad-hoc codes (§5)
- [ ] **INFRA-21**: Pagination implemented as opaque cursor `?cursor=&limit=`, default 50 / max 200, `next_cursor` in response; clients never parse cursors (§5)
- [ ] **INFRA-22**: Idempotency-Key support on mutating endpoints; client UUID is the key for offline queue actions (§5, §10)
- [ ] **INFRA-23**: Vitest unit + integration test setup; Playwright E2E against preview URL; zero DB mocking (§19)
- [ ] **INFRA-24**: `ConsentLog`, `policy_version`, legal-basis registry seed data (contract, consent, legitimate interest) loaded (§13)
- [ ] **INFRA-25**: Launch-blocker checklist surfaced in repo (pricing TBD, NFS-e strategy, DPO appointment, privacy policy + ToS authoring, ≥200 care guides) tracked separately from phases (§24)
- [x] **INFRA-26**: Local dev environment: `supabase start` launches local Postgres + Auth + Storage + Studio in Docker; `supabase db reset` rebuilds from migrations; developer can run the full app locally against this stack without cloud Supabase (§20)

## v2 Requirements

Deferred to post-MVP. Tracked but not in current roadmap.

### AUTH-v2
- **AUTH-v2-01**: Change-email flow
- **AUTH-v2-02**: Logout-all-devices (global JWT revocation)

### BILL-v2
- **BILL-v2-01**: NFS-e emission integration (NFE.io, eNotas, Omie, or manual municipal portal)
- **BILL-v2-02**: Annual billing tier
- **BILL-v2-03**: Stripe Pix Automático mandate flow with 3-day pre-debit window modeled in subscription state (`trialing → processing → active`)

### ID-v2
- **ID-v2-01**: PlantNet tertiary provider fallback
- **ID-v2-02**: LLM-provider-aware confidence calibration (vision LLMs don't return calibrated scores)
- **ID-v2-03**: Quality-flag feedback loop (use `manual_correction` + `flag_reason` data)

### REM-v2
- **REM-v2-01**: Travel-aware reminder shifting
- **REM-v2-02**: Per-reminder notification time override

### CARE-v2
- **CARE-v2-01**: Editor review queue for augmented care guides
- **CARE-v2-02**: User-contributed care guide notes

### NOTIF-v2
- **NOTIF-v2-01**: Configurable push reminder cadence (beyond single daily nudge)
- **NOTIF-v2-02**: Email digest of weekly care activity

### PLATFORM-v2
- **PLATFORM-v2-01**: Native mobile app (iOS/Android) via adapter-backed shared business logic
- **PLATFORM-v2-02**: Wide-screen desktop experience (beyond tablet-width centered)
- **PLATFORM-v2-03**: Additional locales (en-US, es-MX, etc.) — i18n layer is already in place

### ANALYTICS-v2
- **ANALYTICS-v2-01**: PostHog session replay
- **ANALYTICS-v2-02**: Cohort dashboards beyond identification-quality rollups

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Freemium gating on identification | Single paid tier; trial is the free experience |
| Anonymous use | Trial requires account; consent + LGPD gates depend on user identity |
| Real-time chat / community / social | Not a social app; reminders are the retention engine |
| Video posts or video care guides | Images only — storage/bandwidth + AI accuracy focus |
| On-device identification ML | Cloud-only per PRD §6; accuracy gap vs Plant.id too large |
| Editor review queue for augmented guides | Badge + disclaimer satisfy honesty; review queue is v2 complexity |
| Per-reminder notification time | Single `User.notification_time_local` is simpler and sufficient |
| Per-reminder push actions (Done/Snooze on push payload) | Push is one daily nudge; actions live in-app |
| Travel-aware reminder shifts | Tz change does not retroactively shift; traveling user isn't tending plants |
| Per-user storage limits (MVP) | Trust first, measure later |
| Admin UI for cost caps / tier limits | Runtime tuning via direct DB writes only |
| Confetti / bouncing / emoji / floating chatbot / circular spinner | Banned by design system |
| Sidebar navigation | Bottom-nav only; max 5 items |
| Inter / generic serifs / gradient text / glassmorphism / neumorphism | Banned by design system |
| Pure black `#000000` / pure white | Use Forest Ink / Paper Cream |
| Raw cron / `setInterval` for durable sleeps | Inngest `step.sleepUntil` only |
| BullMQ / Redis queues | Extra infra for MVP scale; forbidden by PRD |
| Drizzle inside route handlers | Data access lives inside repositories only |
| Server sessions | Per-device JWT only, independently revocable |
| Broad per-endpoint rate limiting | Only narrow per-IP throttle on public auth endpoints in MVP |
| Vercel git integration | Disabled; all deploys from GitHub Actions |
| `Sentry.setUser({ email })` | Leaks PII into Sentry; use `{ id }` only |
| Change-email, logout-all-devices | Explicitly deferred to post-MVP |
| Dark-mode palette via greyscale inversion | Veranda-at-dusk variant designed separately |
| Pre-verified email skip for email+password accounts | Verification gate is mandatory before first identification |
| Non-pt-BR locales at launch | pt-BR only; i18n layer is in place for future additions |
| Fake AI confidence numbers / hidden AI provenance | Non-negotiable from PRD §1 |
| Custom mouse cursors, hover-dependent interactions | Accessibility + anti-slop |

## Traceability

Which phases cover which requirements. Populated by `gsd-roadmapper` during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| AUTH-03 | Phase 4 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 4 | Pending |
| AUTH-06 | Phase 4 | Pending |
| AUTH-07 | Phase 4 | Pending |
| AUTH-08 | Phase 4 | Pending |
| AUTH-09 | Phase 4 | Pending |
| AUTH-10 | Phase 4 | Pending |
| AUTH-11 | Phase 4 | Pending |
| AUTH-12 | Phase 4 | Pending |
| AUTH-13 | Phase 4 | Pending |
| AUTH-14 | Phase 4 | Pending |
| AUTH-15 | Phase 4 | Pending |
| IDENT-01 | Phase 6 | Pending |
| IDENT-02 | Phase 6 | Pending |
| IDENT-03 | Phase 6 | Pending |
| IDENT-04 | Phase 6 | Pending |
| IDENT-05 | Phase 6 | Pending |
| IDENT-06 | Phase 6 | Pending |
| IDENT-07 | Phase 6 | Pending |
| IDENT-08 | Phase 6 | Pending |
| IDENT-09 | Phase 6 | Pending |
| IDENT-10 | Phase 6 | Pending |
| IDENT-11 | Phase 6 | Pending |
| IDENT-12 | Phase 6 | Pending |
| IDENT-13 | Phase 6 | Pending |
| IDENT-14 | Phase 6 | Pending |
| IDENT-15 | Phase 6 | Pending |
| IDENT-16 | Phase 6 | Pending |
| IDENT-17 | Phase 6 | Pending |
| IDENT-18 | Phase 6 | Pending |
| IDENT-19 | Phase 6 | Pending |
| IDENT-20 | Phase 6 | Pending |
| IDENT-21 | Phase 6 | Pending |
| CAT-01 | Phase 5 | Pending |
| CAT-02 | Phase 5 | Pending |
| CAT-03 | Phase 5 | Pending |
| CAT-04 | Phase 5 | Pending |
| CAT-05 | Phase 5 | Pending |
| CAT-06 | Phase 5 | Pending |
| CAT-07 | Phase 5 | Pending |
| CAT-08 | Phase 5 | Pending |
| CAT-09 | Phase 5 | Pending |
| CAT-10 | Phase 5 | Pending |
| CAT-11 | Phase 5 | Pending |
| CARE-01 | Phase 7 | Pending |
| CARE-02 | Phase 7 | Pending |
| CARE-03 | Phase 7 | Pending |
| CARE-04 | Phase 7 | Pending |
| CARE-05 | Phase 7 | Pending |
| CARE-06 | Phase 7 | Pending |
| CARE-07 | Phase 7 | Pending |
| CARE-08 | Phase 7 | Pending |
| CARE-09 | Phase 7 | Pending |
| CARE-10 | Phase 7 | Pending |
| REM-01 | Phase 8 | Pending |
| REM-02 | Phase 8 | Pending |
| REM-03 | Phase 8 | Pending |
| REM-04 | Phase 8 | Pending |
| REM-05 | Phase 8 | Pending |
| REM-06 | Phase 8 | Pending |
| REM-07 | Phase 8 | Pending |
| REM-08 | Phase 8 | Pending |
| REM-09 | Phase 8 | Pending |
| REM-10 | Phase 8 | Pending |
| REM-11 | Phase 8 | Pending |
| REM-12 | Phase 8 | Pending |
| REM-13 | Phase 8 | Pending |
| REM-14 | Phase 8 | Pending |
| REM-15 | Phase 8 | Pending |
| REM-16 | Phase 8 | Pending |
| REM-17 | Phase 8 | Pending |
| REM-18 | Phase 8 | Pending |
| REM-19 | Phase 8 | Pending |
| REM-20 | Phase 8 | Pending |
| REM-21 | Phase 8 | Pending |
| OFF-01 | Phase 9 | Pending |
| OFF-02 | Phase 9 | Pending |
| OFF-03 | Phase 9 | Pending |
| OFF-04 | Phase 9 | Pending |
| OFF-05 | Phase 9 | Pending |
| OFF-06 | Phase 9 | Pending |
| OFF-07 | Phase 9 | Pending |
| OFF-08 | Phase 5 | Pending |
| OFF-09 | Phase 3 | Pending |
| OFF-10 | Phase 3 | Pending |
| SUB-01 | Phase 10 | Pending |
| SUB-02 | Phase 10 | Pending |
| SUB-03 | Phase 10 | Pending |
| SUB-04 | Phase 10 | Pending |
| SUB-05 | Phase 10 | Pending |
| SUB-06 | Phase 10 | Pending |
| SUB-07 | Phase 10 | Pending |
| SUB-08 | Phase 10 | Pending |
| SUB-09 | Phase 10 | Pending |
| SUB-10 | Phase 10 | Pending |
| SUB-11 | Phase 10 | Pending |
| SUB-12 | Phase 10 | Pending |
| SUB-13 | Phase 10 | Pending |
| SUB-14 | Phase 10 | Pending |
| SUB-15 | Phase 10 | Pending |
| SUB-16 | Phase 10 | Pending |
| SUB-17 | Phase 10 | Pending |
| SUB-18 | Phase 10 | Pending |
| SUB-19 | Phase 10 | Pending |
| SUB-20 | Phase 10 | Pending |
| SUB-21 | Phase 10 | Pending |
| SUB-22 | Phase 10 | Pending |
| SUB-23 | Phase 10 | Pending |
| COST-01 | Phase 6 | Pending |
| COST-02 | Phase 6 | Pending |
| COST-03 | Phase 6 | Pending |
| COST-04 | Phase 6 | Pending |
| COST-05 | Phase 6 | Pending |
| COST-06 | Phase 6 | Pending |
| COST-07 | Phase 6 | Pending |
| COST-08 | Phase 6 | Pending |
| COST-09 | Phase 6 | Pending |
| COST-10 | Phase 6 | Pending |
| LGPD-01 | Phase 11 | Pending |
| LGPD-02 | Phase 11 | Pending |
| LGPD-03 | Phase 11 | Pending |
| LGPD-04 | Phase 11 | Pending |
| LGPD-05 | Phase 11 | Pending |
| LGPD-06 | Phase 11 | Pending |
| LGPD-07 | Phase 11 | Pending |
| LGPD-08 | Phase 11 | Pending |
| LGPD-09 | Phase 6 | Pending |
| LGPD-10 | Phase 11 | Pending |
| LGPD-11 | Phase 11 | Pending |
| LGPD-12 | Phase 11 | Pending |
| LGPD-13 | Phase 1 | Complete (Plans 01-05a + 01-05b) |
| LGPD-14 | Phase 11 | Pending |
| NOTIF-01 | Phase 4 | Pending |
| NOTIF-02 | Phase 4 | Pending |
| NOTIF-03 | Phase 8 | Pending |
| NOTIF-04 | Phase 8 | Pending |
| NOTIF-05 | Phase 8 | Pending |
| NOTIF-06 | Phase 10 | Pending |
| OBS-01 | Phase 1 | Complete (Plan 01-05b; release tag + source-map upload deferred to Phase 12) |
| OBS-02 | Phase 1 | Complete (Plans 01-06 + 01-07) |
| OBS-03 | Phase 13 | Pending |
| OBS-04 | Phase 13 | Pending |
| OBS-05 | Phase 1 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 5 | Pending |
| UI-05 | Phase 8 | Pending |
| UI-06 | Phase 6 | Pending |
| UI-07 | Phase 5 | Pending |
| UI-08 | Phase 5 | Pending |
| UI-09 | Phase 7 | Pending |
| UI-10 | Phase 8 | Pending |
| UI-11 | Phase 5 | Pending |
| UI-12 | Phase 6 | Pending |
| UI-13 | Phase 4 | Pending |
| UI-14 | Phase 3 | Pending |
| UI-15 | Phase 6 | Pending |
| UI-16 | Phase 7 | Pending |
| UI-17 | Phase 3 | Pending |
| UI-18 | Phase 3 | Pending |
| UI-19 | Phase 3 | Pending |
| UI-20 | Phase 3 | Pending |
| UI-21 | Phase 3 | Pending |
| UI-22 | Phase 3 | Pending |
| UI-23 | Phase 3 | Pending |
| UI-24 | Phase 3 | Pending |
| UI-25 | Phase 3 | Pending |
| INFRA-01 | Phase 1 | Complete (01-03) |
| INFRA-02 | Phase 1 | Complete (01-02) |
| INFRA-03 | Phase 2 | Pending |
| INFRA-04 | Phase 2 | Pending |
| INFRA-05 | Phase 2 | Pending |
| INFRA-06 | Phase 2 | Pending |
| INFRA-07 | Phase 2 | Pending |
| INFRA-08 | Phase 2 | Pending |
| INFRA-09 | Phase 2 | Pending |
| INFRA-10 | Phase 4 | Pending |
| INFRA-11 | Phase 12 | Pending |
| INFRA-12 | Phase 1 | Pending |
| INFRA-13 | Phase 12 | Pending |
| INFRA-14 | Phase 12 | Pending |
| INFRA-15 | Phase 12 | Pending |
| INFRA-16 | Phase 1 | Complete (01-02) |
| INFRA-17 | Phase 1 | Complete (01-02) |
| INFRA-18 | Phase 1 | Complete (01-03) |
| INFRA-19 | Phase 2 | Pending |
| INFRA-20 | Phase 1 | Complete (01-02) |
| INFRA-21 | Phase 2 | Pending |
| INFRA-22 | Phase 2 | Pending |
| INFRA-23 | Phase 1 | Pending |
| INFRA-24 | Phase 2 | Pending |
| INFRA-25 | Phase 13 | Pending |
| INFRA-26 | Phase 1 | Complete (01-04) |

**Coverage:**
- v1 requirements: 197 total across 13 categories (AUTH 15, IDENT 21, CAT 11, CARE 10, REM 21, OFF 10, SUB 23, COST 10, LGPD 14, NOTIF 6, OBS 5, UI 25, INFRA 26)
- Mapped to phases: 197 (100%) ✓
- Unmapped: 0

**Per-phase totals:**
- Phase 1 (Foundation): 13 — INFRA-01,02,12,16,17,18,20,23,26 + OBS-01,02,05 + LGPD-13
- Phase 2 (Data Layer): 11 — INFRA-03,04,05,06,07,08,09,19,21,22,24
- Phase 3 (Design System): 15 — UI-01,02,03,14,17,18,19,20,21,22,23,24,25 + OFF-09,10
- Phase 4 (IAM): 19 — AUTH-01..15 + INFRA-10 + NOTIF-01,02 + UI-13
- Phase 5 (Catalog): 16 — CAT-01..11 + OFF-08 + UI-04,07,08,11
- Phase 6 (Identification + Cost): 35 — IDENT-01..21 + COST-01..10 + LGPD-09 + UI-06,12,15
- Phase 7 (Care Guides): 12 — CARE-01..10 + UI-09,16
- Phase 8 (Reminders): 26 — REM-01..21 + NOTIF-03,04,05 + UI-05,10
- Phase 9 (Offline Queue): 7 — OFF-01..07
- Phase 10 (Billing): 24 — SUB-01..23 + NOTIF-06
- Phase 11 (LGPD): 12 — LGPD-01..08,10,11,12,14
- Phase 12 (Deploy Pipeline): 4 — INFRA-11,13,14,15
- Phase 13 (Observability + Launch): 3 — OBS-03,04 + INFRA-25
- **Total: 197 ✓**

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after roadmap creation by gsd-roadmapper*
*Rescoped: 2026-04-22 — Phase 1 trimmed to local-dev foundation; Inngest setup folded into Phase 4 (first async consumer); deploy pipeline extracted to new Phase 12; old Phase 12 renumbered to Phase 13; new INFRA-26 added for local Supabase dev*
