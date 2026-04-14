# Requirements: Folhário

**Defined:** 2026-04-14
**Core Value:** A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.

Requirements below are derived from `docs/CAVE-PRD.md` (CAVE-PRD — Folhário MVP, dated 2026-04-12). The PRD's §23 acceptance criteria are the acceptance source-of-truth; REQ-IDs here are user-centric rollups that each trace back to one or more ACs.

---

## v1 Requirements

### Foundation

Cross-cutting invariants that every other context depends on.

- [ ] **FDN-01**: Repo scaffolded with Next.js 16 App Router + React 19 + TypeScript, `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/` + `src/shared/{db,events,adapters,config,telemetry,contracts}/` layout, with ESLint import-restriction rule blocking cross-context repository imports
- [ ] **FDN-02**: Drizzle ORM client factory uses `postgres(url, { prepare: false })` against Supabase Supavisor transaction pooler; Drizzle only callable from inside repositories
- [ ] **FDN-03**: Supabase project created with RLS enabled on all user-owned tables; service-role key used server-side only
- [ ] **FDN-04**: Inngest SDK wired with dev server locally, production event + signing keys separated
- [ ] **FDN-05**: `next-intl` i18n layer loads pt-BR catalogue from day one; every user-facing string flows through the translation layer; `<html lang="pt-BR">` and `Intl.*` formatters used for dates, numbers, currency
- [ ] **FDN-06**: Vitest unit tests runnable via `vitest run`; Playwright E2E runnable against a deployed preview URL
- [ ] **FDN-07**: GitHub Actions `ci.yml` runs lint, typecheck, unit, and integration tests against a real `postgres:16` service container with migrations applied; `deploy-preview.yml` provisions a Supabase branch DB per PR and runs Playwright against the Vercel preview URL; `deploy-production.yml` applies migrations to prod, deploys to Vercel, and uploads Sentry source maps. Vercel git integration is OFF
- [ ] **FDN-08**: Sentry configured with `beforeSend` PII scrub stripping `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`; request bodies dropped on identification routes; users never set via email
- [ ] **FDN-09**: PostHog EU cloud (`https://eu.posthog.com`) initialized; event taxonomy seeded per PRD §20 (`signup_completed`, `identification_started`, `plant_added`, etc.); session replay OFF
- [ ] **FDN-10**: PWA shell via `@serwist/next` — manifest, installable, `display: standalone`, all icon sizes, `<meta viewport>` with user scaling enabled; app-update toast notifies user when new service-worker version is waiting, triggers `skipWaiting` + reload on confirm
- [ ] **FDN-11**: Design tokens implemented for light + dark Folhário palette (Paper Cream / Night Cream families), `color-scheme: light dark`, system preference honored, Settings override available
- [ ] **FDN-12**: Typography — Source Serif 4 (variable) for headlines/plant names; Plus Jakarta Sans (variable) for everything else; Lucide icons only (1.5px stroke, rounded caps)
- [ ] **FDN-13**: Safe-area support — `min-h-[100dvh]` (never `h-screen`), `env(safe-area-inset-*)` honored on top/bottom chrome; bottom nav reserves safe-area inset
- [ ] **FDN-14**: Bottom navigation shell — Home, Catálogo, Identificar, Perfil tabs; icon + label always visible; 56px + safe-area inset; tab scroll + filter state preserved per tab
- [ ] **FDN-15**: Focus ring global 3px Canopy/Sprout at 40% opacity, 2px offset, 8px corner radius; tab order matches visual reading order; focus moves programmatically to main content on route change

### Authentication & Identity

Maps to PRD §12, AC-AUTH-001 through AC-AUTH-007.

- [ ] **AUTH-01**: User can sign up with email + password, age-confirmation checkbox ≥13 (block <13), T&C + privacy-policy acceptance required, timezone captured from device via `Intl.DateTimeFormat().resolvedOptions().timeZone`, optional partner-code field
- [ ] **AUTH-02**: Email-verification email dispatched via Resend on email+password signup; until verified, every gated endpoint returns `email_unverified` 403 — only resend-verification, Settings/account, and logout endpoints reachable
- [ ] **AUTH-03**: OAuth signup (Google minimum) treated as pre-verified, bypasses the email-verification gate
- [ ] **AUTH-04**: User can log in with email + password or Google OAuth; JWT issued per device; no server sessions
- [ ] **AUTH-05**: Unauthed password-reset endpoint always returns 200 regardless of email existence; matching email+password accounts receive a Resend link with single-use hashed token + 1h expiry; token invalidated on use or on next password change; OAuth-only accounts receive no email
- [ ] **AUTH-06**: Authed user can change password from Settings requiring current + new + confirmation; wrong current returns `invalid_credentials` 401; OAuth-only accounts cannot reach the endpoint (Settings control hidden)
- [ ] **AUTH-07**: Public auth endpoints (signup, login, OAuth callbacks) share a narrow per-IP attempt throttle; tripped returns `rate_limited` 429 — this is the only place `rate_limited` is emitted in MVP
- [ ] **AUTH-08**: Email-verification resend endpoint throttled narrowly (per-email + per-IP) and returns `rate_limited` 429 on trip without revealing whether the email exists
- [ ] **AUTH-09**: User can log out from the current device; per-device JWT and PushSubscription revoked, other devices unaffected

### LGPD & Consent

Maps to PRD §13, AC-LGPD-001 through AC-LGPD-011.

- [ ] **LGPD-01**: ConsentLog stores ToS + privacy-policy acceptance at signup on Contract legal basis (policy_version recorded); revocation never breaks catalog view access
- [ ] **LGPD-02**: First-ever identification attempt triggers a blocking consent modal disclosing active providers (Plant ID, OpenAI-compat) + Art. 33 international transfer; ConsentLog records `identification_third_party` on Consent basis; no provider call until granted
- [ ] **LGPD-03**: ConsentLog records push-notification consent on Consent basis when the user grants browser permission from the first-reminder prompt
- [ ] **LGPD-04**: Settings per-consent toggle allows revocation; revoking `identification_third_party` blocks future identification requests (`consent_required` 403) but preserves existing catalog + identification history
- [ ] **LGPD-05**: Privacy-policy version bump flagged material for an activity forces a new consent prompt before next use of that activity; updated `policy_version` recorded on grant
- [ ] **LGPD-06**: User can request data export from Settings; Inngest `iam/generate-export` builds a zip containing `data.json` (profile, plants, photo metadata, reminders, reminder logs, identification history, consent log, subscription, billing events) + `photos/` directory with ORIGINAL photos keyed by record id; archive uploaded to `data-exports` bucket; DataExportRequest status → ready with signed time-limited `download_url`; "data export ready" email dispatched via Resend
- [ ] **LGPD-07**: User can request account deletion from Settings; confirmation modal discloses what's deleted + 7-day grace + cancellation path; DataDeletionRequest created with `grace_period_ends_at = now + 7d`; `User.deletion_requested_at` set; account suspended immediately (only cancel-deletion + read-only LGPD endpoints reachable, others return `deletion_in_progress` 403)
- [ ] **LGPD-08**: Inngest `iam/process-deletion` uses `step.sleepUntil(grace_period_ends_at)` with cancelOn on `deletion_cancelled`; on wake, if cancelled → exit silently; if still pending → hard-delete photos, plants, ID history, reminder logs, consent records (except minimal deletion-audit row) and dispatch "deletion complete" email; state re-read from DB on wake, never from memoized pre-sleep snapshot
- [ ] **LGPD-09**: User in 7-day grace can cancel deletion from recovery flow; DataDeletionRequest.status → cancelled; account returns to normal access; Inngest function exits silently when it wakes
- [ ] **LGPD-10**: Identification records capture `consent_version` active at request time
- [ ] **LGPD-11**: Settings exposes DPO (Encarregado) contact info, privacy policy link, and ToS link (content is a pre-launch blocker, page structure ships in v1)
- [ ] **LGPD-12**: Backups purge deleted user data within 30 days (next full backup cycle); aggregated/anonymized metrics may be retained

### Image Handling

Maps to PRD §11.

- [ ] **IMG-01**: Client-side compression before upload, target ≤1MB, retry once at lower quality on failure before prompting user for a different photo
- [ ] **IMG-02**: EXIF (including GPS) stripped client-side before upload; server rejects any upload still carrying GPS tags as `validation_failed`
- [ ] **IMG-03**: Thumbnail generation on upload for catalog views; original preserved for identification accuracy; thumbnail-gen failure falls back to original + placeholder, next sync regenerates
- [ ] **IMG-04**: Photos stored in private Supabase Storage buckets (`plant-photos`, `plant-thumbnails`, `data-exports`); access via signed URLs only; no signed URLs persisted in DB columns
- [ ] **IMG-05**: Upload failure mid-transfer keeps the compressed image in IndexedDB for standard offline retry; no partial files in storage

### Plant Identification

Maps to PRD §6, AC-ID-001 through AC-ID-016, AC-COST-001 through AC-COST-010.

- [ ] **ID-01**: `IdentificationProvider` abstraction with Plant ID v3 primary and OpenAI-compatible vision fallback; router consults per-provider cost ceiling + circuit breaker BEFORE dispatch; prompts + provider config versioned in source
- [ ] **ID-02**: Identify flow accepts 1..N photos via camera or gallery, returns top 3 results above `ProviderBudget.min_confidence` ranked by confidence descending; each result: common_name (pt-BR), scientific_name, confidence 0..1, thumbnail
- [ ] **ID-03**: Zero results above threshold → "could not identify" UI with retake guidance + "Tentar novamente" + "Adicionar manualmente"; Identification row still persisted with raw provider results for history
- [ ] **ID-04**: Per-user daily + period caps enforced BEFORE any provider call (trial: 5/day, 75/window; paid: 15/day, 200/billing-period); over-cap returns `cap_hit` 429 with reset time, writes NO Identification row, increments NO ProviderUsageCounter
- [ ] **ID-05**: Per-provider daily USD ceilings (default $5/day Plant ID + $5/day OpenAI-compat) enforced via atomic `INSERT ... ON CONFLICT` pattern on ProviderUsageCounter keyed `(provider, purpose, utc_date)`; no lost writes under concurrency
- [ ] **ID-06**: `purpose` field on ProviderBudget separates `identification` and `care_guide` budgets; care_guide exhaustion NEVER affects identification
- [ ] **ID-07**: Provider router falls over to next configured provider on unavailability; logs rejection reason per provider (`cap_hit`, `cost_ceiling_reached`, `breaker_open`); internal reasons persisted in `Identification.failure_reason` but surfaced to client only as `provider_unavailable` 503
- [ ] **ID-08**: Circuit breaker trips after N consecutive provider failures in window, half-opens after cooldown, closes on success; state managed in-memory as optimization only (DB budget gate is authoritative)
- [ ] **ID-09**: Operator alert email dispatched via Resend when a ProviderUsageCounter reaches 80% of daily cap; latched via `alert_80_sent_at` so it fires once per counter row; idempotent on `(provider, purpose, utc_date)`
- [ ] **ID-10**: Vercel function budget — total wall-clock 50s, per-call 30s; router tries next fallback only if remaining budget ≥10s, else short-circuits `provider_unavailable`
- [ ] **ID-11**: Backend timeout → `timeout` 504; Identification row persisted `status=failed`, `failure_reason=timeout`, visible in history
- [ ] **ID-12**: Malformed / empty provider response counted as provider failure (`failure_reason=invalid_response`), increments breaker counter, falls over to next provider for current request
- [ ] **ID-13**: User-initiated manual correction stored in `Identification.manual_correction`; Species resolved by name match if possible, else NULL and flagged for later
- [ ] **ID-14**: Identification history screen lists every attempt (success + failure) with `status`, `failure_reason`, thumbnails, results returned, selected result; detail view offers "re-associate with catalog entry"
- [ ] **ID-15**: OpenAI-compat vision fallback uses a JSON-schema-constrained response that forces self-reported confidence 0..1 so the `min_confidence` filter is meaningful; fallback results labeled visibly differently from Plant ID results ("confiança estimada pela IA")
- [ ] **ID-16**: Identify screen shows a static pre-capture guide (leaf + flower + whole plant + "Mais fotos melhoram a precisão") before camera picker opens

### Catalog ("Meu Jardim")

Maps to PRD §7, AC-CAT-001 through AC-CAT-010.

- [ ] **CAT-01**: User can add a plant from the identification flow (name + photo prefilled, `species_id` set, `Identification.plant_id` set on confirm)
- [ ] **CAT-02**: User can add a plant manually with name + ≥1 photo required; optional nickname, location, acquisition_date, notes; `species_id` NULL; PhotoEntry created for initial photo
- [ ] **CAT-03**: Plant profile shows cover + thumbnail gallery, name + nickname (editable inline), room, acquisition_date, notes, care card link (if CareGuide exists), active reminders, photo journal, ID history link, delete in overflow
- [ ] **CAT-04**: Room/location picker combines quick-select of previously-used locations + defaults (`sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro`) + free text that becomes reusable
- [ ] **CAT-05**: Photo journal — user can add a photo with optional note per plant; entries shown reverse-chronological; each entry is a PhotoEntry row
- [ ] **CAT-06**: Catalog grid: 2 cols ≤375px, 3 cols 600–899px, 4 cols ≥900px; cards are 4:5 portrait with cover + name + nickname + location
- [ ] **CAT-07**: Sort options name A-Z / Z-A / acquisition_date newest (default) / oldest / location; null dates sort last; sort persists for session
- [ ] **CAT-08**: Delete plant cascades PhotoEntry + Reminder rows; storage objects scheduled for deletion; `Identification.plant_id` set NULL but Identification row preserved
- [ ] **CAT-09**: Empty-state Home (zero plants) shows full-bleed primary CTA "Identifique sua primeira planta" + camera button, plus secondary "Adicionar manualmente" link — and nothing else (no tasks, no notifications, no nav clutter)
- [ ] **CAT-10**: Alt text on images is generated programmatically from context (plant name + nickname for catalog cards, plant + date for journal entries, provider common name for identification thumbnails); never empty or filename-based

### Species & Care Guides

Maps to PRD §8, AC-CARE-001 through AC-CARE-010.

- [ ] **CARE-01**: Curated care-guide corpus of ≥200 domestic species loaded into `Species` + `CareGuide` tables in pt-BR before launch (launch blocker, founder-owned); fields: watering, light, soil, temperature range, humidity, toxicity, difficulty, seasonal tips (SH), compatibility notes
- [ ] **CARE-02**: Care card renders all 7 fields + seasonal tips + compatibility block when present; visual icons per dimension; Sage icons, never used as state graphic
- [ ] **CARE-03**: Toxicity badge composition — filled rounded-rect in Urgent Poppy/Blossom, paw+child icon (18px filled), literal text "Tóxico para pets e crianças", 3px diagonal striped accent border on left edge of care card (survives scroll), disclaimer "Informação gerada por IA — confirme com um veterinário" directly below, `role="alert"` SR announcement reading full phrase, first-reveal-per-session warning haptic
- [ ] **CARE-04**: Toxicity badge and disclaimer appear at TOP of care card AND plant profile; color is never the sole signal (redundant icon + text + striped border always present)
- [ ] **CARE-05**: First-ever care-guide view shows a one-time toxicity-AI disclaimer modal; acknowledgement persisted in `User.toxicity_disclaimer_acknowledged_at`; not shown again
- [ ] **CARE-06**: Plant with missing CareGuide hides the care card section entirely; `Species.flag_reason=missing_care_guide`, `flag_status=open`, `identification_count` incremented; rest of plant profile still works
- [ ] **CARE-07**: `identification.succeeded` for a species with no CareGuide (or missing fields) triggers `care-guide/augment` Inngest function, which calls `CareGuideProvider.augment()`, upserts CareGuide `source=augmented`, bumps version, sets `Species.flag_status=resolved` + `resolved_by="augmentation"` + `resolved_at`, emits `care_guide.augmented`; identification response NOT delayed
- [ ] **CARE-08**: Augmented care guides ALWAYS render with a persistent "Gerado por IA" Trust Teal chip at top of the care card; never removed for `source=augmented` rows
- [ ] **CARE-09**: Care-guide augmentation uses a separate `(provider, purpose=care_guide)` budget row; exhaustion pauses augmentation and logs `cost_ceiling_reached` without touching the identification budget or existing CareGuide rows

### Reminders

Maps to PRD §9, AC-REM-001 through AC-REM-016.

- [ ] **REM-01**: User creates a reminder ONLY from a plant profile; no prompt or suggestion on plants without reminders
- [ ] **REM-02**: Reminder types: watering, fertilization; frequency prefilled from CareGuide if available, always editable
- [ ] **REM-03**: `User.notification_time_local` defaults to `09:00`, editable in Settings, applies to ALL reminders for that user — no per-reminder override
- [ ] **REM-04**: `advance_rule` defaults to `from_scheduled` and is editable per reminder (`from_scheduled` = next = previous scheduled + frequency; `from_acted` = next = done timestamp + frequency)
- [ ] **REM-05**: `next_due_at` stored in UTC and computed at create/advance from `User.notification_time_local + User.timezone`; no per-request tz math at fire time
- [ ] **REM-06**: User can mark a reminder done in-app — writes `ReminderLog action=done`, advances `next_due_at` per `advance_rule`
- [ ] **REM-07**: User can snooze a reminder (1h / 3h / tomorrow) in-app — writes `ReminderLog action=snoozed` + `snooze_until`; snooze affects only the current occurrence, next occurrence after Done is unaffected
- [ ] **REM-08**: `from_scheduled` reminder snoozed then later marked done — `next_due_at` computed from ORIGINAL scheduled date + frequency, not from snooze time or done time
- [ ] **REM-09**: Overdue reminders visually distinct from upcoming; no escalation, no auto-mute, no auto-complete, no visual-weight change as they age
- [ ] **REM-10**: Home surfaces the due + overdue list for today grouped by "Hoje" — this list IS the source of truth (no separate notification center); derived live from `Reminder` + `ReminderLog`
- [ ] **REM-11**: Reminder scheduling + delivery PAUSED while subscription is not in `trialing`/`active`; `next_due_at` NOT advanced; resume on return to `trialing`/`active`
- [ ] **REM-12**: Changing `User.timezone` in Settings does NOT retroactively shift already-scheduled reminders; only future computations use the new tz
- [ ] **REM-13**: Reminders management screen lists reminders grouped by plant; each entry shows plant name, type, frequency, next due, advance_rule; edit/delete per entry; create form has type + frequency (prefilled) + advance_rule (default from_scheduled); header shows current global notification time with "Change in Settings" link

### Push Notifications

Maps to PRD §15, AC-REM-004, AC-REM-013, AC-REM-016.

- [ ] **PUSH-01**: Web Push via `web-push` + VAPID; VAPID key pair generated once per environment, persisted as env var
- [ ] **PUSH-02**: Push-permission browser prompt shown ONLY on save of the first reminder ever; never at signup, first visit, or first identify
- [ ] **PUSH-03**: Per-device `PushSubscription` row keyed `(user_id, device_id)`; logout revokes only the current device's subscription
- [ ] **PUSH-04**: `reminders/dispatch` Inngest cron runs every 5 minutes; emits `daily_reminder_summary.due` ONCE per user per day at the user's `notification_time_local` ONLY when at least one reminder is due or overdue; suppressed entirely when subscription is not in `trialing`/`active`
- [ ] **PUSH-05**: `notifications/send-push` Inngest function fans out the daily nudge to every active `PushSubscription` for the user; push payload carries NO Done/Snooze controls and NO per-plant detail — tapping deep-links to Home
- [ ] **PUSH-06**: Push-service 410 Gone or 404 Not Found for an endpoint → `PushSubscription` row DELETED in the same Inngest step (reactive self-healing, no cron prune)
- [ ] **PUSH-07**: User with no push permission OR all devices offline sees the same due/overdue list on Home next app open; no missed-push backlog entity
- [ ] **PUSH-08**: Notification preferences — global mute (suppresses daily nudge entirely) and per-plant mute (excludes that plant's reminders from the due/overdue count used to decide nudge firing); both are GLOBAL across devices, not per-device

### Offline Sync

Maps to PRD §10, AC-OFF-001 through AC-OFF-008.

- [ ] **OFF-01**: Each mutating action gets a client-generated UUID used as `Idempotency-Key`; server dedupes; replays return original result
- [ ] **OFF-02**: Offline queue lives in IndexedDB; survives app close/reopen; replayed in ascending client-timestamp order on reconnect
- [ ] **OFF-03**: New identifications BLOCKED while offline with a clear message (cloud-only); cached catalog + care guides browsable; photo adds + reminder-done actions queued
- [ ] **OFF-04**: Queued actions targeting a plant deleted server-side dropped en masse; single discard summary toast on next app open → tappable → modal listing discarded actions grouped by type with original client timestamps
- [ ] **OFF-05**: Field edit on stale data — last-write-wins by SERVER timestamp; no merge UI
- [ ] **OFF-06**: Reminder-done queued for a reminder/plant gone on server dropped silently (no error shown)
- [ ] **OFF-07**: Queued action failing sync 5 times writes an `OfflineSyncFailure` row and is removed from active queue
- [ ] **OFF-08**: Settings "Needs attention" list shows OfflineSyncFailure rows with retry/discard per item

### Subscription & Billing

Maps to PRD §12, AC-SUB-001 through AC-SUB-020.

- [ ] **SUB-01**: `BillingProvider` adapter interface (`create_customer`, `start_subscription`, `cancel_subscription`, `reactivate_subscription`, `update_payment_method`, `get_subscription`, `handle_webhook`); business logic never calls Stripe SDKs directly
- [ ] **SUB-02**: Account creation creates a Subscription row `status=trialing` with `trial_start_date=now`; organic signup → `trial_end_date=now+14d`, `trial_source=organic`; valid partner code at signup → `trial_end_date=now+30d`, `trial_source=partner`, `partner_code` recorded
- [ ] **SUB-03**: Invalid/unknown/inactive partner code at signup returns `invalid_partner_code` inline error; user clears to proceed with 14-day trial; absent code → 14-day trial
- [ ] **SUB-04**: Late partner-code entry in Settings accepted ONLY while `Subscription.status=trialing` AND wall-clock STRICTLY before `trial_end_date`; valid late code → `trial_end_date = created_at + 30 days` in ONE write; never stacks; never resets the clock; once trial_end_date passed (even by 1s), code rejected
- [ ] **SUB-05**: Deactivating a PartnerStore post-grant does NOT affect already-established trials
- [ ] **SUB-06**: Stripe Checkout collects card-only payment method for MVP (Pix deferred to v1.1 per SUMMARY decision); single product `folhario_monthly`, single price (value TBD, launch blocker)
- [ ] **SUB-07**: Stripe webhook handler `POST /api/v1/webhooks/stripe` synchronously (1) verifies signature → fail returns `webhook_signature_invalid` 401, no BillingEvent, Sentry critical, no Inngest enqueue; (2) inserts `BillingEvent` with UNIQUE constraint on `event_id` — violation = dedup, return 200 no-op; (3) enqueues `billing.webhook.received` to Inngest — then returns 200. Handler response <200ms
- [ ] **SUB-08**: Inngest `billing/process-webhook` is idempotent on `event_id`, does the state transition, emits `subscription.status_changed`, triggers dunning/trial emails via Resend
- [ ] **SUB-09**: Subscription state machine honors PRD §12 transitions: trialing→active, trialing→expired, active→past_due, past_due→active, past_due→canceled, active→canceled, canceled→expired, canceled/expired→active (reactivation)
- [ ] **SUB-10**: Webhook is authoritative for `Subscription.status`; no client-callable route mutates status directly
- [ ] **SUB-11**: Dunning — Stripe configured for 4 retries over 7 days; email per failed attempt with PM update link via Resend; recovered → active; exhausted → canceled → read-only catalog
- [ ] **SUB-12**: User cancels from Settings → `cancel_at_period_end=true`; UI confirms `current_period_end` date; full access until that date; status → canceled, then expired at period end
- [ ] **SUB-13**: User reactivates from Settings while account exists (including 7-day deletion grace); reactivating after `expired` starts a NEW subscription in `active`
- [ ] **SUB-14**: `billing/trial-ending-notifier` daily cron emits `trial.ending` at T-3 and T-1 days before `trial_end_date`; Resend sends trial-ending email
- [ ] **SUB-15**: Subscription status not in `trialing`/`active` → read-only catalog mode: plants/photos/journal/care guides VIEWABLE; identify returns `subscription_required` 402 with paywall UI; reminders paused; mutations return `read_only_mode` 402; Settings FULLY accessible (payment update, reactivate, export, delete)
- [ ] **SUB-16**: Persistent top banner in read-only mode: "Sua assinatura expirou. Reative para identificar e receber lembretes." → links to Settings billing
- [ ] **SUB-17**: Settings billing section shows current plan + status, renewal/trial-end date, payment method, partner-code input (only while trialing AND before trial_end_date), cancel, reactivate, billing history

### Screens & UX

Maps to PRD §16, §17, §18.

- [ ] **UX-01**: All screens constrained to tablet-width on desktop, centered, background fills sides — no wide-screen layouts; mobile-first single-column with 20px outer gutters
- [ ] **UX-02**: Unverified-email gate shows a full-screen blocker in place of the app shell — "Verifique seu e-mail para começar." + resend-verification button + logout link; cleared the instant verification completes
- [ ] **UX-03**: Persistent offline banner ("Você está offline. Algumas ações serão sincronizadas quando a conexão voltar.") shown whenever network offline
- [ ] **UX-04**: LGPD consent modal and push-permission prompt are contextual, triggered only when the gated action is attempted for the first time; never at signup or first visit
- [ ] **UX-05**: Identify capture button is a circular 72px Canopy fill with Ivory camera glyph floating above the capture-guide illustration — the only non-rounded-rectangle shape in the app
- [ ] **UX-06**: Loading states use skeletal shimmer matching final geometry (never circular spinners); skeleton renders only after 300ms delay; faster operations skip shimmer and fade content in over 120ms; `prefers-reduced-motion` disables shimmer
- [ ] **UX-07**: Empty states compose: soft Sage line-art illustration + Source Serif 4 headline + Calm/Lantern Slate supporting hint + exactly one Canopy primary action; tailored composition per empty state (Home, Catalog, Reminders, ID History), never generic shell reused
- [ ] **UX-08**: Error states are inline + calm (never full-screen red walls); network identification failure shows Sage cloud-off icon + Forest Ink headline ("Não consegui conectar agora.") + Slate supporting line CAUSE+RECOVERY + Canopy "Tentar de novo" primary button
- [ ] **UX-09**: All form inputs validate on BLUR (not keystroke); semantic types + correct `autocomplete` tokens; error copy = CAUSE + RECOVERY; submit auto-focuses first invalid field with `role="alert"` / `aria-live="polite"`; forms >3 fields auto-save draft locally
- [ ] **UX-10**: Confidence ladder in identification results combines 4 signals: colored bar, filled segment count, numeric % label, SR announcement ("Confiança <alta|média|baixa>, <n>%"); color is never the sole signal
- [ ] **UX-11**: Spring-physics motion (stiffness 120, damping 18, mass 1); enter ~240ms, exit ~180ms; capture button press is the ONE tactile bounce in the system; empty-home capture-button breathing loop is the ONLY perpetual micro-interaction; `prefers-reduced-motion` disables all motion beyond 120ms linear crossfade
- [ ] **UX-12**: Dark mode is a hand-tuned "veranda at dusk" palette (Night Cream family), NOT inverted greyscale; every screen designed and reviewed in both variants

### Accessibility

Maps to PRD §18.

- [ ] **A11Y-01**: WCAG 2.1 AA audit is a ship blocker — not aspirational; every interactive element has sufficient contrast, redundant state cues, and labeled SR role
- [ ] **A11Y-02**: Browser zoom + Dynamic Type / Android font-scale honored to the LARGEST setting; fixed-height containers grow to fit — clipping is a bug
- [ ] **A11Y-03**: Haptics — capture button tap = light impact, toxicity first-reveal per session = warning, first plant added / streak milestone = success (once), destructive confirm = medium impact; transient errors get NO haptic
- [ ] **A11Y-04**: Live regions announce async state changes (identification results, sync completion, discard summary) via `aria-live="polite"` or `role="alert"` as appropriate
- [ ] **A11Y-05**: Decorative illustrations (empty-state line art, veranda scenes) marked `aria-hidden` / `accessibility hidden`

### Observability

Maps to PRD §21, §22.

- [ ] **OBS-01**: Sentry release tagged with git SHA on every production deploy; source maps uploaded from CI; breadcrumbs scrub `Authorization`, `Cookie`, `email`, `password`, `photo_url`; request bodies dropped on identification routes; users never identified by email
- [ ] **OBS-02**: PostHog EU events emitted for `signup_completed`, `consent_granted`, `identification_started`, `identification_succeeded`, `identification_cap_hit`, `plant_added`, `reminder_created`, `reminder_acted`, `care_guide_viewed`, `trial_started`, `subscription_activated`, `subscription_canceled`, `data_export_requested`, `data_deletion_requested`; each mapped to ≥1 §22 metric
- [ ] **OBS-03**: Scheduled SQL rollups via Inngest cron over `Identification` surface per-provider confidence distribution, manual-correction rate, success rate, latency p50/p95/p99, error rate, cap-hit rate, breaker open minutes/day
- [ ] **OBS-04**: Alerting — Sentry → email on new issues + error-rate spikes; 80% provider ceiling → Resend operator email; Stripe webhook signature failure → Sentry critical + operator email; Inngest function failure after retries exhausted → Sentry
- [ ] **OBS-05**: PostHog funnel measures the core-value metric: signup → email verification → first identification within 2 minutes; target ≥60% of verified users

### Testing

Maps to PRD §19.

- [ ] **TEST-01**: Unit layer (Vitest) covers backend business logic (use cases, domain logic, state machines) and pure frontend functions
- [ ] **TEST-02**: Backend integration layer runs HTTP handlers, repositories, and provider adapters against a REAL `postgres:16` database with migrations applied; DB mocking is NOT permitted; external providers use recorded fixtures or vendor test modes
- [ ] **TEST-03**: Playwright E2E suite exercises every primary screen's happy path + documented failure states (cap-reached, provider-unavailable, offline queue discard, augmented care-guide badge, read-only catalog mode); runs against the deployed Vercel preview URL (not local dev server)
- [ ] **TEST-04**: Integration tests assert cap-enforcement atomicity — two concurrent requests at the boundary produce exactly one success + one cap_hit, with exactly one counter increment

### Security

Maps to PRD §21.

- [ ] **SEC-01**: JWT verified in middleware on every `/api/v1/*` except the public allowlist (signup, login, OAuth callbacks, Stripe webhook)
- [ ] **SEC-02**: RLS enabled on all user-owned tables; service-role key used server-side only, never exposed to client bundles
- [ ] **SEC-03**: Standard security headers (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) via Next.js middleware
- [ ] **SEC-04**: Email-verification gate enforced on every gated endpoint (checked in middleware, not per-handler) so new routes cannot accidentally bypass the gate
- [ ] **SEC-05**: Stripe webhook signature verified on every request; failures logged as Sentry critical with NO BillingEvent row written

---

## v2 Requirements

Deferred — tracked but not in the current MVP roadmap.

### Disease Diagnosis

- **DIAG-01**: User can photograph a diseased plant and receive top-N possible diagnoses with recommended actions
- **DIAG-02**: Diagnoses always labeled as AI-estimated with "consulte um especialista" disclaimer

### Pix & Brazilian Payments

- **PIX-01**: Pix Automático (recurring Pix) supported as a second payment method with mandate flow + 3-day pre-debit notification window
- **PIX-02**: `Subscription.status` state machine extended with `processing` state to model Pix pre-debit window
- **PIX-03**: CPF collected at Pix checkout (not at signup)
- **NFSE-01**: NFS-e (Brazilian electronic service invoice) issued automatically per paid charge via third-party provider (NFE.io / eNotas / accounting-partner integration)

### Advanced Auth

- **AUTH2-01**: User can change their account email with re-verification
- **AUTH2-02**: User can log out from all devices (global JWT invalidation)
- **AUTH2-03**: OAuth provider set expanded (Apple, Facebook)
- **AUTH2-04**: Two-factor authentication (TOTP)

### Admin & Ops

- **ADM-01**: Admin web UI for tuning IdentificationLimit, ProviderBudget, and reviewing flagged Species (replaces direct DB writes)
- **ADM-02**: Review queue for augmented care guides with editorial override
- **ADM-03**: Per-user storage quota enforcement

### Advanced Reminders

- **REM2-01**: Plant-specific notification time overrides
- **REM2-02**: Travel-aware timezone handling (hold reminders while user is traveling)
- **REM2-03**: Additional reminder types (repotting, pruning, misting)

### Social & Sharing

- **SOC-01**: Share plant profile via link
- **SOC-02**: Friends feed with public plant catalogs

### Content Expansion

- **CONT2-01**: Curated care-guide corpus expanded beyond 200 species to 500+
- **CONT2-02**: Video content per care guide
- **CONT2-03**: Regional seasonal tips per BR state

---

## Out of Scope

Explicitly excluded from MVP. Documented to prevent scope creep.

| Feature | Reason |
|---|---|
| Freemium tier | Dilutes the <2-min-to-value promise; pays LGPD + provider cost without recovery; single paid tier by design |
| Anonymous accounts | Trial requires real account to tie Subscription state and consent logs |
| Real-time chat / social | Outside core loop (identify → catalog → care → remind); MVP focus |
| Native iOS/Android apps (MVP) | PWA ships first; native later; all architectural decisions keep the native door open |
| On-device / offline plant identification | Cloud-only; accuracy + latency of on-device models don't hit beginner expectations |
| Disease diagnosis | Every competitor ships this; deferred to v2 with explicit rationale to protect scope discipline and the <2-min promise |
| Change-email flow | Post-MVP; reduces credential-management surface in v1 |
| Logout-all-devices | Post-MVP; per-device tokens already independently revocable |
| Editor review queue for augmented care guides | Would block value; persistent "Gerado por IA" badge keeps provenance honest without human gating |
| Admin UI for caps/budgets | MVP tunes via direct DB writes; operator alert emails handle visibility |
| Wide-screen / desktop-optimized layouts | Tablet-width on desktop is the shape; mobile-first; no wide-screen design debt |
| Per-reminder notification times | All reminders fire at `User.notification_time_local`; per-reminder times add UX complexity without demand |
| Travel-aware timezone handling | Changing tz in Settings affects future computations only; traveling users aren't tending plants |
| Suggestions / prompts to create reminders | User-initiated from plant profile only; no nagging |
| Done/Snooze controls inside push payload | Push is a nudge to open the app; Home is the source of truth |
| Pix Automático recurring billing | Deferred to v1.1; adds a `processing` subscription state, CPF capture, and 3-day pre-debit window; card-only first |
| NFS-e issuance (in-app) | Deferred to v1.1; Stripe doesn't emit BR fiscal receipts; manual or third-party for MVP, pre-launch blocker owned by founder |
| GPS / location-based features | LGPD data minimization; EXIF GPS stripped client-side |
| Per-user storage limits (MVP) | Monitored later; premature optimization |
| Stock photo empty states | Banned; all illustrations custom Sage line art |
| Locales beyond pt-BR (MVP) | i18n layer built day one but only pt-BR strings ship; brand/content focus |
| Emojis in UI copy | Banned brand guardrail; Lucide icons only |
| Inter font / generic serifs | Banned; Source Serif 4 + Plus Jakarta Sans only |
| Forced onboarding tour | Banned (anti-pattern); inline "saiba mais" expansion within consent/push modals allowed |
| Dark patterns on cancel/delete | Banned; 7-day grace + clear disclosure on deletion |
| Auto-escalation / shaming on overdue reminders | Banned; overdue stays visually distinct but doesn't change weight as it ages |
| Fake confidence scores | Banned; honest AI is non-negotiable |
| Hiding AI provenance | Banned; augmented care guides permanently badged "Gerado por IA" |
| Session replay (PostHog) | OFF in MVP; LGPD + minimization posture |
| PostHog on server (identifying users by email) | Banned; SSR events use pseudonymous distinct_id |
| Dark-mode-as-inverted-greyscale | Banned; "veranda at dusk" hand-tuned palette only |
| Custom mouse cursors | Banned interaction anti-pattern |
| Confetti / pulsing / floating UI | Banned beyond capture-button breathing loop |
| Sidebar nav (mobile or desktop) | Bottom nav only; Folhário is one shape across devices |


---

## Traceability

Populated by `/gsd-roadmap` on 2026-04-14. All v1 requirements map to exactly one phase.

| Requirement | Phase | Status |
|---|---|---|
| FDN-01 | 1. Foundation | Pending |
| FDN-02 | 1. Foundation | Pending |
| FDN-03 | 1. Foundation | Pending |
| FDN-04 | 1. Foundation | Pending |
| FDN-05 | 1. Foundation | Pending |
| FDN-06 | 1. Foundation | Pending |
| FDN-07 | 1. Foundation | Pending |
| FDN-08 | 1. Foundation | Pending |
| FDN-09 | 1. Foundation | Pending |
| FDN-10 | 1. Foundation | Pending |
| FDN-11 | 1. Foundation | Pending |
| FDN-12 | 1. Foundation | Pending |
| FDN-13 | 1. Foundation | Pending |
| FDN-14 | 1. Foundation | Pending |
| FDN-15 | 1. Foundation | Pending |
| AUTH-01 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-02 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-03 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-04 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-05 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-06 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-07 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-08 | 2. IAM (Auth + LGPD) | Pending |
| AUTH-09 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-01 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-02 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-03 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-04 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-05 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-06 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-07 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-08 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-09 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-10 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-11 | 2. IAM (Auth + LGPD) | Pending |
| LGPD-12 | 2. IAM (Auth + LGPD) | Pending |
| IMG-01 | 4. Catalog + Offline | Pending |
| IMG-02 | 4. Catalog + Offline | Pending |
| IMG-03 | 4. Catalog + Offline | Pending |
| IMG-04 | 4. Catalog + Offline | Pending |
| IMG-05 | 4. Catalog + Offline | Pending |
| ID-01 | 6. Identification | Pending |
| ID-02 | 6. Identification | Pending |
| ID-03 | 6. Identification | Pending |
| ID-04 | 6. Identification | Pending |
| ID-05 | 6. Identification | Pending |
| ID-06 | 6. Identification | Pending |
| ID-07 | 6. Identification | Pending |
| ID-08 | 6. Identification | Pending |
| ID-09 | 6. Identification | Pending |
| ID-10 | 6. Identification | Pending |
| ID-11 | 6. Identification | Pending |
| ID-12 | 6. Identification | Pending |
| ID-13 | 6. Identification | Pending |
| ID-14 | 6. Identification | Pending |
| ID-15 | 6. Identification | Pending |
| ID-16 | 6. Identification | Pending |
| CAT-01 | 4. Catalog + Offline | Pending |
| CAT-02 | 4. Catalog + Offline | Pending |
| CAT-03 | 4. Catalog + Offline | Pending |
| CAT-04 | 4. Catalog + Offline | Pending |
| CAT-05 | 4. Catalog + Offline | Pending |
| CAT-06 | 4. Catalog + Offline | Pending |
| CAT-07 | 4. Catalog + Offline | Pending |
| CAT-08 | 4. Catalog + Offline | Pending |
| CAT-09 | 4. Catalog + Offline | Pending |
| CAT-10 | 4. Catalog + Offline | Pending |
| CARE-01 | 5. Species & Care | Pending |
| CARE-02 | 5. Species & Care | Pending |
| CARE-03 | 5. Species & Care | Pending |
| CARE-04 | 5. Species & Care | Pending |
| CARE-05 | 5. Species & Care | Pending |
| CARE-06 | 5. Species & Care | Pending |
| CARE-07 | 5. Species & Care | Pending |
| CARE-08 | 5. Species & Care | Pending |
| CARE-09 | 5. Species & Care | Pending |
| REM-01 | 7. Reminders & Notifications | Pending |
| REM-02 | 7. Reminders & Notifications | Pending |
| REM-03 | 7. Reminders & Notifications | Pending |
| REM-04 | 7. Reminders & Notifications | Pending |
| REM-05 | 7. Reminders & Notifications | Pending |
| REM-06 | 7. Reminders & Notifications | Pending |
| REM-07 | 7. Reminders & Notifications | Pending |
| REM-08 | 7. Reminders & Notifications | Pending |
| REM-09 | 7. Reminders & Notifications | Pending |
| REM-10 | 7. Reminders & Notifications | Pending |
| REM-11 | 7. Reminders & Notifications | Pending |
| REM-12 | 7. Reminders & Notifications | Pending |
| REM-13 | 7. Reminders & Notifications | Pending |
| PUSH-01 | 7. Reminders & Notifications | Pending |
| PUSH-02 | 7. Reminders & Notifications | Pending |
| PUSH-03 | 7. Reminders & Notifications | Pending |
| PUSH-04 | 7. Reminders & Notifications | Pending |
| PUSH-05 | 7. Reminders & Notifications | Pending |
| PUSH-06 | 7. Reminders & Notifications | Pending |
| PUSH-07 | 7. Reminders & Notifications | Pending |
| PUSH-08 | 7. Reminders & Notifications | Pending |
| OFF-01 | 4. Catalog + Offline | Pending |
| OFF-02 | 4. Catalog + Offline | Pending |
| OFF-03 | 4. Catalog + Offline | Pending |
| OFF-04 | 4. Catalog + Offline | Pending |
| OFF-05 | 4. Catalog + Offline | Pending |
| OFF-06 | 4. Catalog + Offline | Pending |
| OFF-07 | 4. Catalog + Offline | Pending |
| OFF-08 | 4. Catalog + Offline | Pending |
| SUB-01 | 3. Billing | Pending |
| SUB-02 | 3. Billing | Pending |
| SUB-03 | 3. Billing | Pending |
| SUB-04 | 3. Billing | Pending |
| SUB-05 | 3. Billing | Pending |
| SUB-06 | 3. Billing | Pending |
| SUB-07 | 3. Billing | Pending |
| SUB-08 | 3. Billing | Pending |
| SUB-09 | 3. Billing | Pending |
| SUB-10 | 3. Billing | Pending |
| SUB-11 | 3. Billing | Pending |
| SUB-12 | 3. Billing | Pending |
| SUB-13 | 3. Billing | Pending |
| SUB-14 | 3. Billing | Pending |
| SUB-15 | 3. Billing | Pending |
| SUB-16 | 3. Billing | Pending |
| SUB-17 | 3. Billing | Pending |
| UX-01 | 1. Foundation | Pending |
| UX-02 | 2. IAM (Auth + LGPD) | Pending |
| UX-03 | 4. Catalog + Offline | Pending |
| UX-04 | 2. IAM (Auth + LGPD) | Pending |
| UX-05 | 6. Identification | Pending |
| UX-06 | 1. Foundation | Pending |
| UX-07 | 1. Foundation | Pending |
| UX-08 | 1. Foundation | Pending |
| UX-09 | 1. Foundation | Pending |
| UX-10 | 6. Identification | Pending |
| UX-11 | 1. Foundation | Pending |
| UX-12 | 1. Foundation | Pending |
| A11Y-01 | 8. Hardening + Launch | Pending |
| A11Y-02 | 1. Foundation | Pending |
| A11Y-03 | 1. Foundation | Pending |
| A11Y-04 | 1. Foundation | Pending |
| A11Y-05 | 1. Foundation | Pending |
| OBS-01 | 1. Foundation | Pending |
| OBS-02 | 1. Foundation | Pending |
| OBS-03 | 6. Identification | Pending |
| OBS-04 | 8. Hardening + Launch | Pending |
| OBS-05 | 8. Hardening + Launch | Pending |
| TEST-01 | 1. Foundation | Pending |
| TEST-02 | 1. Foundation | Pending |
| TEST-03 | 1. Foundation | Pending |
| TEST-04 | 6. Identification | Pending |
| SEC-01 | 2. IAM (Auth + LGPD) | Pending |
| SEC-02 | 1. Foundation | Pending |
| SEC-03 | 1. Foundation | Pending |
| SEC-04 | 2. IAM (Auth + LGPD) | Pending |
| SEC-05 | 3. Billing | Pending |

**Coverage (post-roadmap):**
- v1 requirements: 153 total (across 16 categories — FDN 15 + AUTH 9 + LGPD 12 + IMG 5 + ID 16 + CAT 10 + CARE 9 + REM 13 + PUSH 8 + OFF 8 + SUB 17 + UX 12 + A11Y 5 + OBS 5 + TEST 4 + SEC 5)
- Mapped to phases: 153 / 153 ✓
- Orphans: 0
- Duplicates: 0

> Note: `/gsd-new-project` instructions referenced 138 items; the authoritative REQUIREMENTS.md file ships 153 v1 items. Phase mapping reflects the actual file contents and the full 153 items are covered by the 8-phase roadmap.

### Phase distribution summary

| Phase | Requirements | Count |
|---|---|---|
| 1. Foundation | FDN-01..15, TEST-01..03, SEC-02, SEC-03, OBS-01, OBS-02, UX-01, UX-06..09, UX-11, UX-12, A11Y-02..05 | 33 |
| 2. IAM (Auth + LGPD) | AUTH-01..09, LGPD-01..12, SEC-01, SEC-04, UX-02, UX-04 | 25 |
| 3. Billing | SUB-01..17, SEC-05 | 18 |
| 4. Catalog + Offline | CAT-01..10, IMG-01..05, OFF-01..08, UX-03 | 24 |
| 5. Species & Care | CARE-01..09 | 9 |
| 6. Identification | ID-01..16, UX-05, UX-10, TEST-04, OBS-03 | 20 |
| 7. Reminders & Notifications | REM-01..13, PUSH-01..08 | 21 |
| 8. Hardening + Launch | A11Y-01, OBS-04, OBS-05 | 3 |
| **Total** | | **153** |

---

*Requirements defined: 2026-04-14*
*Source: docs/CAVE-PRD.md + .planning/research/SUMMARY.md*
*Last updated: 2026-04-14 after roadmap traceability mapping*
