# Pitfalls Research

**Domain:** pt-BR plant identification/care/reminder PWA (Next.js App Router + Supabase + Inngest + Stripe + Resend + Sentry + PostHog), Brazilian market, LGPD-regulated
**Researched:** 2026-04-14
**Confidence:** HIGH for domain-specific rules anchored in CAVE-PRD; MEDIUM-to-HIGH for platform gotchas (Supabase/Supavisor, Inngest, iOS Safari, Stripe) verified against 2026 official docs; MEDIUM for Brazilian-market specifics (Pix Automático, NFS-e) where policy is moving fast.

This file is scoped to pitfalls that the PRD does NOT already pin down by acceptance criterion. Where the PRD nails it, the entry points at the AC and notes what the implementation still has to not screw up.

---

## Critical Pitfalls

### Pitfall 1: LGPD Art. 33 consent collapsed into generic T&C checkbox

**What goes wrong:**
Signup bundles privacy policy + ToS + international-transfer consent into one "Aceito os termos" checkbox. User can never revoke identification-transfer consent without deleting the account. ANPD treats this as invalid consent under Art. 8 §4 (consent must be specific and for a clearly indicated purpose), exposing Folhário to fines and a pause order.

**Why it happens:**
Fast signup pressure. Developers assume "they accepted the privacy policy, it mentions Plant ID" is enough. PRD §13 explicitly separates the consent — but the first dev to build the consent modal is tempted to preload the checkbox or coalesce it with ToS.

**How to avoid:**
- Two distinct storage records: (a) ToS+PP acceptance at signup (Contract basis, Art. 7 V), (b) `identification_third_party` consent at first identification (Consent basis, Art. 7 I). Never coalesce.
- Modal at first identify is BLOCKING (AC-ID-002), lists Plant ID + OpenAI-compat by name, lists jurisdiction (US), links privacy policy, has unchecked default.
- Settings surfaces a per-consent toggle with "Revogar" copy (AC-LGPD-008). Revoking identification consent must NOT break catalog view (AC-LGPD-008 explicit).
- Every `Identification` row stamps `consent_version` (AC-LGPD-009). New policy version bumps `policy_version` on ConsentLog and forces re-prompt (AC-LGPD-011).

**Warning signs:**
- Only one ConsentLog row per user.
- Settings "Privacy" panel has a single "Revogar consentimento" button instead of per-activity toggles.
- Revoking consent blocks the catalog view (the read-only-catalog rule is violated).
- `consent_version` column is nullable or always the same value.

**Phase to address:** LGPD + Identification (consent gate can only ship after both foundational LGPD storage and the identify endpoint exist). Auth+Billing gets the "T&C acceptance at signup" half.

---

### Pitfall 2: Per-user identification cap is bypassed by concurrent tab/device requests

**What goes wrong:**
User with 4 IDs already today opens two tabs, mashes both "Identificar" buttons simultaneously. Both reads of `count(Identification)` return 4, both pass the cap check, both reach the provider, both increment counters. User gets 6 identifications done in a day where the cap is 5. Repeat at scale and per-user caps become advisory.

**Why it happens:**
Cap check is implemented as `SELECT count() → if < cap THEN dispatch` without row-level locking or a serializable transaction. The check-then-act gap is the classic TOCTOU race. Denormalized counters are explicitly "only if perf demands" (§6), so developers reach for SELECT naively.

**How to avoid:**
- Wrap cap check + counter claim in a single SERIALIZABLE transaction, OR use `INSERT ... RETURNING` on a `DailyUsageClaim(user_id, utc_date, seq)` table with a unique constraint on `(user_id, utc_date, seq)` and `seq = cap`. The Nth claim either succeeds or conflicts, cleanly.
- Same pattern for `ProviderUsageCounter` (AC-COST-009): `INSERT ... ON CONFLICT (provider, purpose, utc_date) DO UPDATE SET counter = counter + $cost WHERE counter + $cost <= cap RETURNING *`. If no row returned → ceiling hit.
- Integration test with two concurrent requests (real Postgres, per PRD §19) asserting only one passes.
- Never do the cap check in one connection and the insert in another.

**Warning signs:**
- Cap logic written with a ReadCommitted default and no explicit locking.
- No integration test firing two parallel requests.
- `ProviderUsageCounter` uses `SELECT ... UPDATE` instead of a single atomic statement.
- Period-window cap uses `count(*)` on the live table every call (slow AND racy).

**Phase to address:** Identification (cost controls ship with the first provider dispatch).

---

### Pitfall 3: Cap-exceeded path still creates an `Identification` row or increments counters

**What goes wrong:**
Cap-hit requests write an `Identification` row "for history" or increment `ProviderUsageCounter` before the check. Next request sees cap of 5 but count of 7. Worse, retries of cap-hit errors flood the table, and the 80% ceiling alert trips prematurely.

**Why it happens:**
Developers reuse the success path and add an early-return. It feels natural to persist "user tried but was capped" for analytics.

**How to avoid:**
- AC-ID-009 and §6 are explicit: cap-hit emits `cap_hit` 429, writes NO row, increments NO counter.
- Track cap-hit events in PostHog or a dedicated `CapHitLog` table (no FKs, no provider cost signal).
- Code review guard: grep for `.insert(Identification)` and verify every call is behind the cap guard.
- Unit test: "user at 5/5 → 6th request → count of Identification rows unchanged, counter unchanged."

**Warning signs:**
- `Identification.status` enum includes `cap_hit` (it shouldn't — §6 closes the enum to `success | failed`).
- Counter graph shows a spike every time a user hits the cap.
- Cap-hit rate and counter value correlate.

**Phase to address:** Identification.

---

### Pitfall 4: 80% provider-ceiling alert never fires because check is at 100%

**What goes wrong:**
Alert is wired at "counter >= cap" instead of "counter >= cap * 0.80". Operator never gets warning; first signal is customer tickets about `provider_unavailable`. OR: alert fires every request after 80% (thousands of emails), operator mutes them, and then misses the 100% trip.

**Why it happens:**
AC-COST-004 says "at 80% → alert". Developers implement it as a post-increment check, so every request after 80% re-fires the alert. The naive fix is a threshold instead of a latching transition.

**How to avoid:**
- Track a boolean on `ProviderUsageCounter`: `alert_80_sent_at`. Alert fires on the FIRST increment that crosses from <80% to >=80% in that row.
- Row resets daily (fresh row per `utc_date`), so no daily alert-rearm logic needed.
- Send via Resend, idempotent on `(provider, purpose, utc_date)` (Resend idempotency key).
- Integration test: simulate 100 increments to 79% → no alert; next increment → exactly one alert; next increment → no duplicate.

**Warning signs:**
- Operator inbox has zero 80% alerts in the first week of traffic.
- Alert inbox is flooded with duplicates.
- Alert code calls Resend without an idempotency key.

**Phase to address:** Identification (cost-controls phase).

---

### Pitfall 5: Stripe webhook processed synchronously — state transitions lost on crash

**What goes wrong:**
Webhook handler verifies signature → applies subscription state transition → returns 200, all in one request. A crash mid-transition leaves state half-applied, no BillingEvent row, Stripe retries but the next delivery can see a half-mutated Subscription row or a FK constraint violation.

**Why it happens:**
"Webhook handler = state machine" is the default mental model. PRD §12 is explicit about the three-step synchronous contract (verify → insert BillingEvent → enqueue Inngest) + separate `billing/process-webhook`, but a first-time implementer may collapse it for speed.

**How to avoid:**
- Follow AC-SUB-020 literally. Three-step handler: (1) signature verify, (2) INSERT BillingEvent with `UNIQUE(event_id)` (constraint violation = dedupe, return 200), (3) Inngest enqueue. Return 200 after all three.
- Heavy work (state transition, Resend dispatch) runs in `billing/process-webhook` Inngest function, which is naturally retryable by step.
- Integration test: Stripe sends same event_id twice → exactly one BillingEvent row (AC-SUB-018).
- Never put `UPDATE Subscription` in the HTTP handler.

**Warning signs:**
- Webhook handler file imports the subscription state-machine module.
- No `UNIQUE` constraint on `BillingEvent.event_id`.
- "Stripe retried this 10 times" alerts without an Inngest function failure to explain them.
- Stripe dashboard shows >1s webhook latency p95 (async enqueue should be ~100ms).

**Phase to address:** Auth+Billing.

---

### Pitfall 6: NFS-e assumed to be handled by Stripe

**What goes wrong:**
First charge succeeds in production, customer requests the nota fiscal (legally required for B2C service receipts in Brazil), and nobody issues it. Accounting partner is notified a month late. Municipal tax compliance is breached.

**Why it happens:**
Stripe does NOT issue NFS-e (Nota Fiscal de Serviços Eletrônica). It's a municipal (not federal) obligation in Brazil. Developers coming from US SaaS assume "Stripe invoices → done." Launch blocker §24 flags this but can be forgotten under pricing pressure.

**How to avoid:**
- Launch blocker §24 remains open until one of: (a) third-party NFS-e service integrated (NFE.io, Omie, NFSeBrasil, Nota Control), (b) manual accounting process documented with SLA, (c) decision to issue only upon user request.
- Webhook `invoice.payment_succeeded` → Inngest function `billing/issue-nfse` → provider call → store `InvoiceReceipt { stripe_invoice_id, nfse_number, nfse_url, status }`.
- Failure to issue NFS-e must alert operator (Resend) and NOT block the user's subscription state.
- NFS-e provider abstraction (like `BillingProvider` §12) so impl can swap.

**Warning signs:**
- Code references "invoice" but never "NFS-e" or "nota fiscal."
- No line item for NFS-e vendor costs in the budget.
- Post-launch ticket backlog has "cadê minha nota?" tickets.

**Phase to address:** Auth+Billing, AFTER Stripe basics ship. Block live-mode enablement on NFS-e decision.

---

### Pitfall 7: Inngest `step.sleepUntil(7d)` grace race with cancellation

**What goes wrong:**
User requests deletion → Inngest fn sleeps until `grace_period_ends_at`. User logs in day 3, cancels deletion → `DataDeletionRequest.status=cancelled`. But the Inngest function wakes (day 7) and either:
(a) doesn't check the status, hard-deletes anyway — data loss
(b) checks the status but `grace_period_ends_at` was changed, resulting in mismatch
(c) cancellation was done via a concurrent Inngest function (wrong pattern), creating two running instances

**Why it happens:**
Durable sleep looks like "wake → delete," and the cancel-on-wake check is easy to forget. Cancellation via `cancelOn` event is an alternative, but AC-LGPD-005 explicitly wants the function to wake, observe cancellation, and exit silently.

**How to avoid:**
- AC-LGPD-005 spec: `step.run("check-cancellation")` on wake reloads `DataDeletionRequest.status` — if `cancelled`, exit silently. Do NOT trust memoized state from before sleep.
- Use Inngest `cancelOn: [{ event: "lgpd.deletion.cancelled", match: "data.user_id" }]` as a belt-and-suspenders backup that short-circuits the sleep.
- Unit test: schedule fn → emit cancellation event → function completes without hard-delete.
- Integration test: 7-day grace + manual cancellation via Settings → no rows deleted.
- Never change `grace_period_ends_at` mid-flight (AC-LGPD-003 sets it once at request time); if you ever need to, use a new `DataDeletionRequest`.
- Use a DB-side idempotency key: `DataDeletionRequest.completed_at` is only set by the Inngest function on actual deletion — function refuses to run twice.

**Warning signs:**
- `DataDeletionRequest.status` read at schedule time (memoized) and re-used on wake.
- No `cancelOn` wired on the function.
- Multiple Inngest runs visible for the same user in the dashboard.
- Function version bumped mid-flight with breaking step structure (versioning bug; Inngest hashes step identifiers, so renaming steps while sleeping breaks memoization).

**Phase to address:** LGPD.

---

### Pitfall 8: Per-user reminder time drift across DST transitions

**What goes wrong:**
Reminder scheduled for 09:00 local. Crosses DST boundary. `next_due_at` was computed once in UTC and stored. User gets the nudge at 08:00 or 10:00 local after the transition.

**Context for Brazil:** DST was abolished in Brazil in 2019 (Decreto 9.772/2019) and has not returned as of April 2026. So the naive approach "UTC-3 forever" works for users in Brazil. BUT:
- Users may travel (PRD explicitly says "travel not handled").
- Users may move states (no DST changes, but their timezone may change).
- Servers in UTC — developers forget Brazil has multiple offsets (UTC-2 Fernando de Noronha, UTC-3 most of country, UTC-4 AM/MT/MS/RR, UTC-5 Acre).
- Users in countries WITH DST if Folhário ever localizes.

**What goes wrong specifically:**
- Developer computes `next_due_at` from `notification_time_local` assuming a fixed offset rather than IANA timezone arithmetic.
- User changes timezone in Settings → already-scheduled reminders don't shift (this is by design, AC and §9 agree) — but the developer implements it incorrectly and DOES shift them, or partially shifts them.
- `next_due_at` is recomputed at every read (not create/advance) and drift accumulates.

**How to avoid:**
- AC-REM-002: `notification_time_local` is global per user.
- PRD §9: `next_due_at` computed AT CREATE AND ADVANCE, not at fire time.
- Use `Intl.DateTimeFormat` + IANA timezone strings (not fixed offsets). Server-side use `date-fns-tz` or `Temporal` polyfill when available.
- Integration test with a timezone that DOES have DST (e.g., `Europe/Lisbon`) even though BR doesn't, to prove the code is IANA-correct for future-proofing. Travel case: user in `America/Sao_Paulo` → changes to `America/Manaus` → old reminders stay at old UTC, new ones use new UTC.
- Never store `next_due_at` as local time.
- Document that the "do not retroactively shift" rule is intentional, to prevent future refactors from "fixing" it.

**Warning signs:**
- Code references `-03:00` as a string literal.
- `next_due_at` column is `timestamp without time zone`.
- Test suite has no cases across multiple IANA zones.
- Settings "change timezone" mutates existing `Reminder.next_due_at`.

**Phase to address:** Reminders.

---

### Pitfall 9: iOS Safari PWA push silently fails — "installable" check passed but push doesn't arrive

**What goes wrong:**
Team ships PWA push. Android devices receive daily nudge fine. iPhone users never get a push. Sentry shows 0 errors. Team thinks "push has 70% delivery, that's fine" until users complain.

**Why it happens (2026 state of iOS Safari PWA push):**
- iOS 16.4+ supports web push ONLY when the PWA is installed to Home Screen. Push from a regular Safari tab silently fails.
- iOS 18.4 added Declarative Web Push (no service worker path) but most libraries (web-push + VAPID) still need the classic flow.
- iOS enforces the "user gesture" constraint: `Notification.requestPermission()` MUST be called synchronously in a user gesture callback. Calling it from a promise chain after an `await` breaks the gesture.
- iOS Safari PWA has a tighter storage quota and may evict IndexedDB — including the cached PushSubscription — under storage pressure.
- Users who uninstall-and-reinstall the PWA get a NEW endpoint; old PushSubscription rows are stale. 410 pruning handles this but only after a failed send.
- EU iOS 17.4 briefly removed PWAs (Apple reverted); re-verify before launch.

**How to avoid:**
- Detect iOS Safari PWA at runtime (`navigator.standalone === true` or `matchMedia('(display-mode: standalone)')`). If the user is on iOS Safari but NOT installed, show a contextual "Adicione à tela de início" hint at first reminder creation INSTEAD of `requestPermission()`.
- Call `requestPermission()` synchronously from the tap handler of "Salvar lembrete." Do NOT `await` anything between the tap and the permission call.
- E2E test on a real iOS device (Playwright with iOS WebKit can't fully simulate push delivery; manual device matrix is mandatory).
- Explicit dashboard metric: "push delivery rate by platform" (iOS / Android / Desktop Chrome). iOS should be >50%; if <30%, something is wrong with the flow, not the user.
- Fallback is already built in: Home is the source of truth (AC-REM-013). The nudge is best-effort.

**Warning signs:**
- "push permission grant rate" metric aggregated across platforms only.
- PostHog event `push_permission_requested` fires before an `async` boundary.
- Sentry shows `TypeError: Notification is not a function` (indicates calls in non-HTTPS contexts or non-installed state).
- Daily-nudge delivery rate on iOS <20%.
- No `PushSubscription` pruning activity (means 410s aren't happening — or means they're being dropped).

**Phase to address:** Reminders (push delivery) + Polish (iOS-specific UX hint).

---

### Pitfall 10: `100vh` or `h-screen` on PWA mobile breaks above the fold

**What goes wrong:**
Home/Identify screens use `h-screen` (Tailwind) which maps to `100vh`. On iOS Safari, `100vh` is the LARGEST viewport height (address-bar-hidden). Content spills below the browser chrome. On Android Chrome, same issue. Bottom nav hidden under home indicator / gesture bar.

**Why it happens:**
Tailwind ergonomics. `h-screen` is the obvious choice. Developers don't realize `100vh` is broken on mobile and `100dvh` (dynamic) is the fix since ~mid-2022. Pickup of `dvh` in design systems is still incomplete in 2026.

**How to avoid:**
- Ban `h-screen` / `100vh` from the codebase. Use `100dvh` (`h-[100dvh]`) or `100svh` (safe viewport) depending on whether bottom nav must stay pinned during scroll.
- Safe-area insets: respect `env(safe-area-inset-bottom)` on the bottom nav (PRD §17 explicit: "56px content + `env(safe-area-inset-bottom)` padding").
- ESLint rule or grep-based pre-commit hook: `\bh-screen\b` → error.
- Visual regression test on iOS device at multiple viewport heights.
- Don't forget `viewport-fit=cover` in the meta viewport tag; without it `env(safe-area-inset-*)` is always 0.

**Warning signs:**
- `h-screen` appears in any file.
- Bottom nav visible behind the home indicator on iPhone 14+.
- Scrollable content has empty space at bottom on Android Chrome.
- Sentry `window.innerHeight` breadcrumbs show values that don't match viewport.

**Phase to address:** Foundations (design system + layout primitives).

---

### Pitfall 11: Supabase RLS assumed sufficient, service-role-key path writes through it

**What goes wrong:**
RLS policies written perfectly. Repositories all use the user's JWT. Then one Inngest function (care guide augmentation, daily reminder dispatch, deletion fn) uses the service role key because it's "server-side trusted code." That function has a bug and writes rows for the wrong user. RLS doesn't stop it — service role bypasses RLS entirely.

**Why it happens:**
- The service role key is documented as "bypasses RLS." Developers read that as "use this when you need to bypass RLS" instead of "use this ONLY when you need to bypass RLS."
- Inngest functions often run as the "app" not "the user," so developers default to service role for everything.
- Drizzle repositories can't use Supabase Auth JWT propagation natively — teams take shortcuts.

**How to avoid:**
- PRD §21 explicit: "Service role key server-side only, never exposed to client."
- Code partition: `src/shared/db/clients/` exports exactly two DB clients: `userScopedDb(jwt)` and `serviceRoleDb`. Repositories take a client, so the call site decides which to use.
- ESLint custom rule: only specific files (Inngest functions + admin scripts) may import `serviceRoleDb`.
- Every service-role write MUST be wrapped in a function that takes `user_id` explicitly and validates ownership in-code with `WHERE user_id = $userId`.
- Integration tests run with RLS enabled by default. Test the RLS policy by attempting unauthorized reads; don't bypass RLS in integration tests except for fixture seeding.
- PRD mentions "RLS as defense in depth" — treat application-layer auth as primary, RLS as backup. That means every path must pass BOTH checks in tests.

**Warning signs:**
- Grep `SUPABASE_SERVICE_ROLE_KEY` finds >5 import sites.
- Repositories call `createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)` directly.
- Any file in `src/contexts/*/api/` (route handlers) imports the service role key.
- Integration tests run with RLS disabled.

**Phase to address:** Foundations (DB client design) + every subsequent phase respects the partition.

---

### Pitfall 12: Supavisor transaction mode + Drizzle prepared statements

**What goes wrong:**
App works locally against direct Postgres. Deploys to Vercel connected via Supavisor port 6543 (txn pooler). First production request errors with `prepared statement "..." does not exist` or intermittent connection errors. Supavisor in transaction mode reassigns connections per statement, and named prepared statements do not survive connection reassignment.

**Why it happens:**
Supavisor txn mode is the Supabase default for serverless. Drizzle + postgres.js (`postgres` driver) uses prepared statements by default for performance. The default collides with the pooler. Prisma solved it with `?pgbouncer=true`. Drizzle doesn't automatically.

**How to avoid:**
- Use Drizzle with `postgres("...", { prepare: false })` OR the `@vercel/postgres` adapter which disables prepare.
- Alternative: use the session-mode port (5432) for long-lived connections — doesn't work on serverless Vercel, but fine for Inngest workers if they pool differently.
- Integration tests run against Supavisor mode (not direct Postgres), otherwise you discover this in production.
- Also: `LISTEN/NOTIFY` does NOT work in transaction mode — any realtime-like feature must use Supabase Realtime or Inngest events.

**Warning signs:**
- Intermittent 500s with `prepared statement` in Sentry.
- Local dev works fine, preview URLs fail.
- Any code calls `db.listen(...)` or relies on `LISTEN`.
- `prepare` option not explicitly set in the postgres.js client init.

**Phase to address:** Foundations.

---

### Pitfall 13: Offline queue replays a Done action for a plant deleted on another device

**What goes wrong:**
Device A goes offline. User marks reminder Done on plant P. Meanwhile on device B, user deletes plant P. Device A reconnects and replays Done. Server:
(a) throws FK violation (reminder no longer exists) — retry loop — 5 fails → OfflineSyncFailure for something the user can't possibly care about
(b) or (worse) auto-recreates the plant because the queued action has a plant_id
(c) the sync runs in chronological order but delete happened on B at time T2 > the Done on A at time T1, so LWW says the Done should win

**Why it happens:**
PRD §10 and AC-REM-015 are explicit: queued Done for a deleted reminder is silently dropped. But the clean implementation requires handling FK-violation-but-don't-surface-error, separately from normal FK errors, AND detecting "target was deleted" vs "target never existed" (two different conditions).

**How to avoid:**
- Replay handler catches `not_found` specifically for Reminder/Plant targets in the queued-action path and translates it to "drop silently, log to discard-summary."
- AC-OFF-004: drop all queued actions for server-deleted plants with a single discard summary toast.
- The discard-summary toast modal (PRD §16 cross-cutting states) must already exist before the offline queue ships.
- Integration test with a real race: enqueue Done on A, delete plant on B, reconnect A, assert zero error surfaced to user and one discard-summary entry.
- Idempotency-Key on every queued action — replay is safe to run 2+ times.
- LWW is by SERVER timestamp (AC-OFF-005), not client timestamp — delete wins because server-applied delete > server-applied done in real time.

**Warning signs:**
- Sentry shows FK violation errors during sync that the user sees.
- OfflineSyncFailure rows for "reminder not found" — those should be dropped not escalated.
- Discard summary toast never appears despite test setups that should trigger it.
- Replay handler uses generic `catch(e) { retry }` without typing the error.

**Phase to address:** Reminders (Done/offline replay semantics) + Offline phase if separate.

---

### Pitfall 14: `PushSubscription` pruning creates per-device churn that looks like a bug

**What goes wrong:**
Daily nudge fires. Device A is offline / has pruned its SW / key was rotated → push endpoint returns 410. `notifications/send-push` deletes the row (AC-REM-016). User opens device A next day → app re-registers a new PushSubscription on load. But if user has 5 devices and rotates through them, the table churns and the operator sees "lots of push subs being deleted" as if there's a bug.

**Why it happens:**
Self-healing is counterintuitive. "Delete on 410" is correct but looks destructive. Operators may pattern-match it as an attack.

**How to avoid:**
- AC-REM-016 is explicit and correct: delete on 410 or 404. No cron prune.
- Metric: `push_subscription_prune_rate` — baseline this early. Prune rate 5-20% per day is normal.
- Re-registration logic on app open must be idempotent. Key the row by `(user_id, endpoint_hash)` not `(user_id, device_id)` alone — an existing device with a new endpoint should REPLACE the old row via upsert on endpoint_hash.
- Never rely on client-generated `device_id` surviving browser reset. IndexedDB can be evicted on iOS.
- Single daily nudge fan-out MUST de-duplicate by `(user_id, day)` to prevent firing twice if two tokens from one browser transiently exist.

**Warning signs:**
- Users report "I got the nudge twice today."
- PushSubscription table grows unbounded (no 410 deletes happening — endpoints never go stale → prune logic isn't wired).
- Metric rate spikes to 80%+ (something else is breaking).

**Phase to address:** Reminders.

---

### Pitfall 15: Daily nudge fires twice because user's local 09:00 crosses UTC boundary

**What goes wrong:**
User in São Paulo (UTC-3), notification time 09:00. Dispatcher cron runs hourly and queries "reminders due, user's local time is 09:00." If the dispatcher runs twice in the window (e.g., dispatched at 11:59 UTC and again at 12:00 UTC due to clock jitter), both runs see the user's time as "09:00 local" and both fire.

Alternatively: daily nudge is stored per `(user_id, local_date)` for dedupe, but `local_date` is computed differently in dispatcher vs sender.

**Why it happens:**
Cron/dispatcher runs are rarely exactly-once. Deduplication needs to be explicit at the event boundary, and AC-REM-004 says "emits ONE `daily_reminder_summary.due`" but doesn't pin the uniqueness constraint.

**How to avoid:**
- Unique constraint in DB: `DailyNudge(user_id, local_date)` UNIQUE. Dispatcher INSERTs; violation → "already dispatched today for this user" → skip.
- `local_date` computed on server using `Intl.DateTimeFormat('en-CA', { timeZone: user.timezone }).format(new Date())` — consistent anywhere in the stack.
- Inngest idempotency key on `daily_reminder_summary.due` event: `reminder-nudge-{user_id}-{local_date}`. Inngest dedupes events with the same idempotency key within a window.
- Integration test: run dispatcher twice within the same minute → exactly one event emitted, one nudge sent.

**Warning signs:**
- User reports "two nudges same day."
- Push delivery rate >100% of (users with reminders due).
- No UNIQUE constraint on any "daily dispatch" table.
- Inngest send without `id` parameter (idempotency key).

**Phase to address:** Reminders.

---

### Pitfall 16: Augmented care guide written twice for the same species under concurrent IDs

**What goes wrong:**
Two users identify the same species simultaneously. Both Inngest functions for `care-guide/augment` fire. Both call the LLM ($$$), both attempt to upsert the CareGuide row. Result: double cost, possibly flaky row with mixed content, versions bumped weirdly, cost-ceiling counter hit twice.

**Why it happens:**
No coordination between parallel Inngest runs for the same species. Upsert is idempotent per row but the LLM call is not.

**How to avoid:**
- Inngest function-level concurrency key: `concurrency: { key: "event.data.species_id", limit: 1 }`. Serializes augmentations per species. Inngest has native concurrency control.
- Inside the function, first step re-reads `CareGuide` and `Species.flag_status` — if already resolved by another run, exit without calling the provider (`step.run("check-already-resolved")`).
- `ProviderUsageCounter` (care_guide purpose) check happens AFTER the "already resolved" short-circuit, so the budget check doesn't race with a no-op.
- The upsert on CareGuide uses `(species_id, source)` as the conflict key, `version` bumped with `CASE WHEN version IS NULL THEN 1 ELSE version + 1 END`.
- Test: emit two `identification.succeeded` events for same species simultaneously → exactly one provider call, one CareGuide row.

**Warning signs:**
- `ProviderUsageCounter` for care_guide shows spikes that match identification spikes 1:1 (means no short-circuit).
- CareGuide row updated_at within seconds on same species.
- Inngest dashboard shows parallel runs of `care-guide/augment` with same species_id.

**Phase to address:** Care guides (augmentation).

---

### Pitfall 17: LLM hallucinates toxicity info — published as "safe" when species is toxic

**What goes wrong:**
Care guide augmentation asks LLM for toxicity. LLM is wrong. `toxicity=safe` row ships, no warning banner, a toddler eats the leaf, veterinarian call → lawsuit.

**Why it happens:**
- LLMs confidently return structured toxicity classifications without grounding.
- "Grounding" per PRD §8 relies on the provider's web search / RAG — Folhário doesn't verify.
- PRD §8 explicitly accepts this risk with "persistent Gerado por IA badge + always-visible disclaimer" as the mitigation.

**How to avoid:**
- Disclaimer is on the ACCEPT flow, every view, every session. AC-CARE-003 and §8 toxicity rules are non-negotiable.
- When in doubt, render toxicity as `unknown` rather than `safe`. The LLM prompt should return a fourth state `unknown` and the UI must handle it: "Toxicidade desconhecida — consulte um veterinário antes de deixar próximo de pets ou crianças."
- Cross-check against a known toxic-plants list during augmentation: if LLM returns `safe` for a species on the curated toxic list (ASPCA, Embrapa, Brazilian veterinary data), override to `toxic_both`.
- Curated 200-species launch corpus (LAUNCH BLOCKER §24) is human-reviewed.
- Augmented row has a `source=augmented` flag and the badge is persistent — do not remove the badge on operator edit, only on a separate `source=curated_reviewed` transition.
- First care guide view modal is one-time (AC-CARE-004), but the inline disclaimer is ALWAYS visible (AC-CARE-003).

**Warning signs:**
- Augmented CareGuide rows with `toxicity=safe` for species like Monstera, Philodendron, Sansevieria (known toxic-to-pets) — smoke test.
- No LLM output schema validation for `toxicity` field (accepts any string).
- Missing `unknown` state in the toxicity enum.

**Phase to address:** Care guides.

---

### Pitfall 18: Toxicity badge: color is the only carrier for one of the redundant signals

**What goes wrong:**
Design system says icon + color + text + striped border + SR alert + haptic. Developer ships it and it looks great... but the striped border is the same hue as the badge background (too subtle), OR the SR alert only says "aviso" instead of the full phrase, OR haptic fires on every reveal (should be first reveal per session only).

**Why it happens:**
§17 and §18 spell out all six signals. But implementations commonly miss one:
- `role="alert"` vs `aria-live="polite"` confusion
- striped border drawn on the badge instead of the parent care-card
- haptic misfired because "session" scope not implemented

**How to avoid:**
- Component-level test (React Testing Library + jest-axe): assert all six signals present on render.
- Visual regression test with explicit high-contrast and color-blind simulation.
- SR label test: `expect(alert).toHaveAccessibleName('Alerta de toxicidade. Tóxico para pets e crianças. Informação gerada por IA — confirme com um veterinário.')`.
- Haptic unit test: fire 5 reveal events in one "session" → exactly one haptic call. (Mock `navigator.vibrate`.)
- Manual VoiceOver pass at every release.

**Warning signs:**
- Accessibility audit tool reports missing `role="alert"`.
- Haptic triggered by a listener on the badge element rather than a session-scoped manager.
- Striped border on the badge, not the parent container (AC/§17 explicit: "left edge of parent care-card block").

**Phase to address:** Care guides + a11y polish.

---

### Pitfall 19: EXIF GPS stripped client-side but server trusts client

**What goes wrong:**
Client-side EXIF stripping via canvas re-encode. A malicious or broken client uploads a JPEG with GPS tags intact. Server stores the original. Later, LGPD Art. 9 audit finds PII in storage.

**Why it happens:**
PRD §11 calls this out — server must reject as `validation_failed`. But dev may implement it client-only and forget the server-side check.

**How to avoid:**
- Two layers: client canvas re-encode (fast UX) + server-side EXIF parser (`exifr` or `sharp` metadata check) rejecting any image with GPS tags.
- AC-ID-016: "server rejects as `validation_failed` any upload still containing GPS (defense in depth)."
- Upload validation middleware for ALL image endpoints (identification, plant creation, photo journal).
- Unit test: upload JPEG with GPS → 400 + `validation_failed`.
- Pixel-level test: re-encoded image has no GPS AND no `Orientation` issues (since some canvas libs silently rotate images).

**Warning signs:**
- Server upload handler has no EXIF check.
- Canvas compression logic lives in a single util file with no tests.
- GPS-bearing test image is not in the test fixtures directory.
- Storage scan shows files with GPS tags (immediate compliance incident).

**Phase to address:** Foundations (image pipeline) — before identification ships.

---

### Pitfall 20: Sentry captures photo URLs / request bodies / user email

**What goes wrong:**
Photo URL appears in a Sentry breadcrumb because of a fetch wrapper that logs URLs. LGPD incident: photos are personal data under ANPD guidance, being shipped to Sentry (Ireland/US) without consent.

**Why it happens:**
Sentry captures request bodies and URL breadcrumbs by default. `beforeSend` is only applied to events, not breadcrumbs (different hook: `beforeBreadcrumb`). Developers scrub events and forget breadcrumbs. User `email` ends up in `Sentry.setUser({ email })` because it's the default.

**How to avoid:**
- `Sentry.init({ beforeSend, beforeBreadcrumb })` — both hooks. §13 is explicit: strip `Authorization`, `Cookie`, `email|password|token|photo_url`.
- Wrap `Sentry.setUser` to accept only `{ id }` — never email.
- Disable `sendDefaultPii`. Set `tracingOptions.ignoreIncomingRequests` and `requestDataOptions` to avoid capturing bodies on identification routes explicitly.
- On identification route specifically, set a Sentry tag `is_upload_route=true` and in `beforeSend` drop `request.data` entirely if that tag is set.
- Smoke test: trigger an error on `/api/v1/identifications` → check the Sentry event payload (capture to a local sink) for photo URLs or emails. Fail CI if found.
- Periodic audit: export Sentry events, grep for `@` (emails), grep for `supabase.co/storage` (photo URLs).

**Warning signs:**
- `Sentry.setUser` called with anything other than `id`.
- `beforeBreadcrumb` hook missing.
- Test suite has no "no PII in Sentry" assertion.
- A Sentry event visibly contains a photo URL.

**Phase to address:** Foundations (observability) + LGPD verification.

---

### Pitfall 21: PostHog EU cloud used, but user identified via email

**What goes wrong:**
PostHog is pointed at EU cloud (good for LGPD data residency). But `posthog.identify(user.email, ...)` is called. Email is now PII stored in PostHog indefinitely. Data-residency compliance preserved, but consent-for-processing is not.

**Why it happens:**
PostHog examples show `identify(email)` because it's the simplest distinct ID. Developers copy the example.

**How to avoid:**
- Always `posthog.identify(user.id, { ... })` — never email.
- Never pass email in `$set` properties.
- Session replay OFF in MVP (Open question §25 #6) — confirm via `posthog-js` init options `disable_session_recording: true`.
- Autocapture: disable or allowlist fields. Default autocapture sends DOM text — plant nicknames, notes, emails in inputs all leak. Use `autocapture: false` + explicit event firing.
- Events named consistently (event name drift: "clicked_identify" vs "identification_started" across codebase) — maintain an `AnalyticsEvent` enum in TS.
- Privacy policy lists PostHog (EU) as a processor, not a controller.

**Warning signs:**
- `posthog.identify` called with any argument that looks like an email.
- PostHog event list has >100 distinct event names (drift).
- Session replay URL visible in PostHog dashboard.
- Autocapture events include user input text.

**Phase to address:** Foundations (observability).

---

### Pitfall 22: Email-verification gate has endpoint gaps

**What goes wrong:**
Middleware checks `email_verified` on most endpoints but some slip through: `/api/v1/plants/:id/photos` wasn't wired to the middleware, OR the check is done per-handler and one handler forgot. Unverified users upload photos.

**Why it happens:**
Per-handler checks are error-prone. PRD says "before any mutation" which is open to interpretation. AC-AUTH-001 lists "identification, plant create/edit, reminder mutations, photo upload, etc." — "etc." is a trap.

**How to avoid:**
- CENTRAL middleware: enforce email verification on everything in `/api/v1/*` EXCEPT an explicit allowlist: `[resend-verification, settings-read, settings-account, logout, data-export, data-deletion-start, cancel-deletion]`.
- Default-deny: new endpoints are gated unless added to the allowlist in the middleware config.
- Test: for every route in the OpenAPI spec, assert unverified user request → 403 `email_unverified` (unless allowlisted).
- Never do the check at the handler level — only in middleware.

**Warning signs:**
- Route handlers contain inline `if (!user.email_verified)` checks.
- Allowlist is computed per-handler rather than centrally.
- New route was added last week and no test verifies its gate.

**Phase to address:** Auth+Billing.

---

### Pitfall 23: Supabase storage signed URLs leak via shared expiry

**What goes wrong:**
Data export zip uses a 24h signed URL. User forwards the email. Anyone with the link for 24h can download. OR: signed URL for photo thumbnails is stored in DB, cached forever, and never refreshed — breaks after expiry.

**Why it happens:**
Supabase signed URL TTL is set at creation time. Caching signed URLs in DB is the obvious optimization.

**How to avoid:**
- NEVER store signed URLs in DB. Store storage paths (`bucket/user_id/filename.jpg`) and mint signed URLs at read time.
- Data export signed URL TTL = 15 minutes (operationally tight). AC-LGPD-002 "signed time-limited URL" — make it short.
- Immediately after download (if possible: 302-redirect download via app proxy route), invalidate by removing the file.
- Alternative: data export is streamed through the app via a short-lived token rather than a Supabase signed URL.
- Catalog thumbnails: use Supabase public bucket for thumbnails (with random filename, non-enumerable) and a private bucket for originals. Signed URL only on originals, minted on demand.

**Warning signs:**
- `Plant.cover_photo_url` is a signed URL in the DB.
- Test suite asserts a signed URL survives >1 hour — it shouldn't need to.
- Data export email uses a 7-day URL.

**Phase to address:** LGPD (data export) + Foundations (storage pattern).

---

### Pitfall 24: Per-IP auth throttle false-positives for NAT'd users

**What goes wrong:**
Shared-IP scenarios (Brazilian ISPs often CGNAT, corporate networks, mobile carrier gateways) cause legitimate users to share an IP. Throttle trips for account A, blocks account B trying to log in from the same NAT. Support tickets: "não consigo entrar."

**Why it happens:**
§5 says "public auth endpoint per-IP throttle." Per-IP on a CGNAT is effectively per-ISP-gateway. N users share one IP.

**How to avoid:**
- Throttle window and N need realistic defaults: e.g., 10 failed attempts per IP per 5 minutes, then 60s cooldown. Don't go aggressive (5/min kills mobile users).
- Track per-IP AND per-account windows. Trip based on whichever crosses.
- Reset window on successful login (AC-AUTH-004 explicit: "successful logins do not consume from the failure budget").
- Use X-Forwarded-For correctly on Vercel (first IP in list is client, but trust only the Vercel edge).
- `rate_limited` 429 response includes a `Retry-After` header so the client can show a countdown.
- Monitor `public_auth_throttle_trip_rate` — if >0.5% of logins, values are too tight.

**Warning signs:**
- Support tickets clustering around known CGNAT ISPs (Vivo, Claro).
- Trip rate metric >1%.
- No `Retry-After` header in 429 response.
- Throttle windows use `request.ip` (raw) rather than properly parsing X-Forwarded-For through the Vercel proxy.

**Phase to address:** Auth+Billing.

---

### Pitfall 25: Supabase branch DBs used per-PR but cost is uncapped

**What goes wrong:**
CI/CD spawns a Supabase branch DB per PR (PRD §20). 50 open PRs → 50 branch DBs → bill explodes. §25 open question #3 flags this.

**Why it happens:**
Greenfield mid-velocity teams open many PRs. Supabase branch cost per-project per-month.

**How to avoid:**
- Budget cap check before spawning: if >N branches open, queue PR tests serially against a shared preview project.
- GitHub Action workflow: on PR close/merge, explicitly destroy the branch DB (don't rely on Supabase auto-cleanup).
- Monthly budget alert via Supabase dashboard (if available) or via cost estimation in CI.
- Fallback to shared preview DB (§25 explicit): keep a docker-compose Postgres per PR for unit+integration, use real Supabase branch only for E2E.

**Warning signs:**
- Supabase invoice grows 10x between months.
- Branch DB list has >30 entries.
- No PR-closed cleanup workflow.

**Phase to address:** Foundations (CI/CD).

---

### Pitfall 26: Dunning + Pix flakiness — Pix failures look like card failures but recover differently

**What goes wrong:**
User on Pix fails renewal. Stripe retries. Pix is a push-payment (customer initiates a transfer from their bank app, or uses Pix Automático mandate). Auto-retry semantics differ from cards. Customer gets "payment failed" email but doesn't know the Pix QR code / auto-mandate expired.

**Why it happens:**
Stripe's Pix Automático (mandate-based recurring) is newer than card. Dunning UX copy written for cards assumes "update payment method" — but Pix has no "payment method" in the card sense.

**How to avoid:**
- Dunning email templates branch on `payment_method_type`. Pix email says "Autorize a próxima cobrança no app do seu banco" + link to re-mandate flow.
- Handle webhook event types for Pix specifically: `payment_intent.requires_action` may indicate Pix QR display needed (for one-off top-up).
- Pix Automático mandate lifecycle: mandates can expire or be revoked from the bank app — Stripe webhook on revocation needs explicit handling. Confirm the current Stripe event names (as of 2026, Pix Automático is rapidly evolving; verify in live mode before shipping).
- Test in Stripe test mode with Pix simulation (test mode is limited for Pix — flag this during launch blocker review with Stripe BR team).

**Warning signs:**
- Dunning email to Pix users says "atualize seu cartão."
- Only `card` payment method type covered in webhook handler.
- No test for Pix mandate revocation.
- Stripe dashboard shows Pix payments but no `payment_intent.requires_action` handled.

**Phase to address:** Auth+Billing (dunning comes late in billing phase).

---

### Pitfall 27: Partner code late-entry race at trial_end_date boundary

**What goes wrong:**
User enters partner code in Settings at `trial_end_date - 1s`. Request hits server at `trial_end_date + 1s`. Code is rejected. User is furious.

Or conversely: user enters partner code at trial_end_date - 1s, server processes at trial_end_date - 0.5s, ok. But the write happens concurrently with a Stripe webhook that transitions to `expired` — now two writes race on `Subscription.trial_end_date` and status.

**Why it happens:**
§12 is explicit: "accepted ONLY while status=trialing AND server wall-clock STRICTLY before trial_end_date." Edge case at the boundary is real.

**How to avoid:**
- Partner code application in a serializable transaction: `SELECT ... FOR UPDATE WHERE status='trialing' AND trial_end_date > now()` → update in one tx. AC-SUB-005/AC-SUB-006 cover the cases.
- Stripe webhook for trial-end must take the same row lock when transitioning to `expired`. Last-writer-wins by clock is fine if both writers respect the invariant.
- Test: partner code entry at T-1s vs status transition at T → one wins, one sees correct error (`invalid_partner_code` or `forbidden`).
- Clock skew between Stripe webhook time and DB server time: use server wall clock from `now()` consistently.

**Warning signs:**
- Partner code endpoint doesn't use transaction.
- `SELECT ... FOR UPDATE` absent from partner-code handler.
- Sentry shows "trial extended for expired subscription" events.

**Phase to address:** Auth+Billing.

---

### Pitfall 28: Age-gate is a client-side checkbox with no server validation

**What goes wrong:**
Signup form includes `<input type="checkbox" name="age_confirm" />`. Form posts to server but server doesn't validate the field. Users under 13 sign up. LGPD Art. 14 violation (children's consent requires specific parental authorization, not self-declaration).

**Why it happens:**
"It's a checkbox, how hard can it be." AC-LGPD-010 says `age_confirmed_at` set only if confirmed — needs server enforcement.

**How to avoid:**
- Zod schema on signup endpoint: `age_confirmed: z.literal(true)` — rejects anything else.
- `User.age_confirmed_at` set by server on signup success, not by client.
- Test: signup without the field → 400. With `false` → 400. With `true` → success and `age_confirmed_at` populated.
- Note: LGPD Art. 14 is stricter for <12 ("with consent of one of the parents or legal guardian"). PRD targets ≥13, which is a project choice. Document this in the privacy policy.

**Warning signs:**
- Signup endpoint accepts requests without `age_confirmed` field.
- `User.age_confirmed_at` is nullable for production users.
- Schema uses `z.boolean()` instead of `z.literal(true)`.

**Phase to address:** Auth+Billing.

---

### Pitfall 29: Image thumbnail generation fails silently — broken catalog tiles

**What goes wrong:**
Thumbnail generation lives in an Inngest function. Function fails on large images (>5MB memory limit) or corrupt JPEGs. Main photo saved OK, thumbnail never generated, catalog shows placeholder forever.

**Why it happens:**
"Thumbnail gen fail → original saved → catalog placeholder → next sync regenerates" per §11. But "next sync regenerates" isn't a real thing unless something re-triggers the Inngest fn.

**How to avoid:**
- Store `PhotoEntry.thumbnail_status` enum: `pending|generated|failed`.
- Inngest function `image/generate-thumbnail` runs on `photo.uploaded` event AND on cron every hour for any `status=pending` rows older than 10 min.
- On final failure (5 retries), status=failed + log; separate function or user-triggered retry regenerates.
- Client-side compressor also emits thumbnail directly if network is fast, upload BOTH to storage in one request.
- Integration test: upload corrupt JPEG → status=failed, catalog shows placeholder, regen via retry works.

**Warning signs:**
- Catalog has >1% placeholder tiles after 24h.
- `thumbnail_status` not present in schema.
- No retry path for thumbnail generation.

**Phase to address:** Catalog.

---

### Pitfall 30: Service worker update loop breaks the PWA

**What goes wrong:**
Service worker registered with `updateViaCache: 'imports'` or no explicit update handling. New deploy = new SW. Old SW caches old JS bundle. Users see "Nova versão disponível" toast, click Atualizar, page reloads, old cache still serves, toast reappears, loop.

Or: `self.skipWaiting()` called on every install, breaks users mid-session.

**Why it happens:**
PWA SW lifecycle is subtle. Next.js App Router PWA patterns are in flux (next-pwa, Serwist). Cache strategies interact with SW registration.

**How to avoid:**
- Use Serwist (modern successor to next-pwa for Next.js App Router). Pin its version.
- Handle updates: show toast (§16 "App update toast"), call `skipWaiting()` ONLY when user clicks "Atualizar."
- `updateViaCache: 'none'` for SW registration so the browser always fetches the latest SW file.
- Cache strategies: stale-while-revalidate for shell, network-first for `/api/*`.
- Do NOT precache route JS chunks by URL — chunk names change per build. Use Next.js built-in hashed filenames.
- Test: deploy v1 → install PWA → deploy v2 → user sees toast → tap → new version active, no loop.

**Warning signs:**
- Update toast appears but tapping it doesn't update anything.
- Users report "app is stuck on old version."
- `skipWaiting()` called in `install` event unconditionally.
- Cache keys include non-hashed asset paths.

**Phase to address:** Foundations (PWA shell).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Compute per-user cap via live `COUNT(*)` every request | Fewer moving parts, no denormalization | Slow at period end (Jun 30 spike), holds table lock, bad for RLS scans | MVP only, switch to denormalized counter if `identifications.count_query` p95 >50ms |
| Skip `prepare: false` on postgres.js | Zero config | Production outage with Supavisor txn mode | Never |
| Hardcode UTC-3 as Brazil offset | Fewer deps, simpler code | Wrong for AM/PR/MS/Fernando de Noronha, wrong if BR ever re-adopts DST, unusable for future i18n | Never — use IANA zones always |
| Store signed URLs in DB to avoid re-minting | Fewer storage calls on render | Expired URLs break catalog, LGPD leak via forwarded links, can't rotate access | Never |
| Use service role key in a route handler because "it's server-side trusted" | RLS policy complexity deferred | Any bug writes for wrong user; RLS-as-defense-in-depth violated | Only in Inngest functions, always with explicit user_id ownership check in the same tx |
| Inline email-verification check per handler | Less middleware complexity | Guaranteed to miss an endpoint; audit trail fragmented | Never — always middleware allowlist |
| Skip the 7-day-grace Inngest fn, just do cron scan of `DataDeletionRequest` | Simpler than durable sleep | Race conditions on cancel, harder to reason about, no PRD backing | Never — PRD is explicit, use `step.sleepUntil` |
| Single consent checkbox for "all providers" | Faster signup | Invalid consent per LGPD Art. 8 §4 | Never |
| Retry Pix dunning with the same card-style copy | Fewer templates | Confuses Pix users who don't have "payment methods" to update | Never |
| Call Plant ID without streaming back partial results | Simpler API | Perceived latency >5s, bad UX, no recovery from single-provider hang | MVP acceptable given the 50s total budget, revisit if p95 >15s |
| Client-only EXIF strip | Faster, no server CPU | Defense in depth missing → LGPD incident potential | Never — always both sides |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase (Supavisor txn mode) | Drizzle default prepared statements | `postgres("...", { prepare: false })` or `@vercel/postgres` |
| Supabase Storage | Storing signed URLs in DB | Store path; mint signed URL at read time |
| Supabase Auth | Using service role for user-context writes | Create a JWT-scoped DB client per request; service role only for system operations |
| Supabase RLS | Disabling RLS in integration tests | Keep RLS on in tests; separate path for fixture seeding via service role |
| Stripe (webhook) | State transition in HTTP handler | 3-step synchronous (verify, insert BillingEvent, enqueue); Inngest does the state change |
| Stripe (Pix Automático) | Treating Pix like card in dunning | Branch dunning copy and flow; handle mandate revocation events |
| Stripe (NFS-e) | Assuming Stripe issues Brazilian electronic invoices | Integrate NFS-e vendor (NFE.io, Omie, NFSeBrasil) OR manual process pre-launch |
| Stripe (test mode) | Fully testing Pix in test mode | Pix has limited test-mode support; manual test in live mode with a real BRL charge before launch |
| Inngest (`step.sleepUntil`) | Forgetting `cancelOn` and re-checking state on wake | Wire `cancelOn` AND `step.run("reload-state")` on wake |
| Inngest (versioning) | Renaming step IDs mid-flight | Keep step IDs stable; add new steps with new IDs; never rename |
| Inngest (concurrency) | No concurrency key on per-species augmentation | `concurrency: { key: "event.data.species_id", limit: 1 }` |
| Inngest (idempotency) | Sending events without `id` parameter | `inngest.send({ id: "nudge-{user}-{date}", ... })` for naturally idempotent events |
| Resend (operator alerts) | No idempotency on 80% alert | Resend `idempotencyKey: "budget-80-{provider}-{date}"` |
| Resend (transactional) | No reply-to / bounce handling | Configure proper From domain + DMARC; handle bounces via webhook |
| PostHog (EU cloud) | Identify by email | `identify(user.id)`; email is PII, LGPD sensitive |
| PostHog (autocapture) | Default-on in a pt-BR form-heavy PWA | `autocapture: false`, explicit event firing |
| PostHog (session replay) | On by default | Off for MVP (§25 open q #6) |
| Sentry (breadcrumbs) | Scrubbing events but not breadcrumbs | Both `beforeSend` AND `beforeBreadcrumb` |
| Sentry (setUser) | Passing email | Pass only `id`; `sendDefaultPii: false` |
| Sentry (identification routes) | Default request body capture | `beforeSend` drops `request.data` when tag set |
| Plant ID provider | No retry-on-5xx differentiation | 5xx → retry once with backoff, 4xx → fail fast, timeout → count as failure for breaker |
| OpenAI-compat vision | Passing raw base64 without size-check | Validate client compressed to ≤1MB before sending; per-call budget cap |
| Web Push (VAPID) | Rotating VAPID key without re-subscribing | Never rotate; if you must, force all clients to re-subscribe via version bump in SW |
| Supabase Realtime | Using via LISTEN/NOTIFY through Supavisor txn mode | Not supported in txn mode; use Supabase Realtime websocket layer directly or Inngest events |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-user cap via `count(*)` on Identification | Request latency grows at period-end | Denormalized counter OR partial index on `(user_id, created_at desc)` | >10k identifications/user/period |
| Catalog grid loading all photos eagerly | Home screen slow, bandwidth spike | Lazy-load thumbnails, `content-visibility: auto` on card, paginate | >50 plants/user |
| Cold-start on Vercel identification route | First ID of the day takes 10s+ | Keep route handler light; push heavy deps into adapter, prefer Edge runtime where compatible | Always; noticeable at <100 DAU |
| Inngest durable sleep storing function state per run | Free-tier durable step budget blown (§25 open q #4) | Monitor metric; for 7-day grace, N users * 1 run = OK | >N concurrent 7-day sleeps (check current free tier limit) |
| ProviderUsageCounter lock contention | Concurrent identification requests serialize, high p99 | Single-statement INSERT ... ON CONFLICT, minimal tx scope | Dozens of concurrent requests/sec |
| Augmentation queue backlog on new species | New-ish species takes minutes to get a care guide | Prioritize by `identification_count`; cap concurrent LLM calls per budget | High identification volume on long-tail species |
| Daily nudge dispatcher scanning all users | Slow cron, missed nudges | Query only `SELECT user_id FROM User WHERE notification_time_local = :currentMinute AND subscription_status IN ('trialing', 'active')`; index on `(notification_time_local, subscription_status)` | >1000 users |
| PushSubscription fan-out synchronous | Long Inngest step, timeouts | Fan out via per-device events; `step.run` per device | Users with many devices, or large user base |
| Offline queue full sync on every reconnect | Slow sync on large queues | Chunk replays (e.g., 50 actions per batch); resume markers | Users with >100 queued actions (after extended offline) |
| Thumbnail gen on upload, synchronous | Upload latency p95 >5s | Async via Inngest; AC covers `thumbnail_status=pending` display | Always, but tolerable at small scale |
| Re-rendering plant list on every reminder tick | Unnecessary re-renders | Subscribe to derived "due today" selector, not raw Reminder list | >20 plants/user |
| LLM prompt cache miss per species | Each augmentation pays full cost | Cache LLM results by `(species_id, prompt_version, missing_fields)` | Always; matters if augmentation frequency >species count |
| Drizzle select on `*` in hot paths | N+1 + overfetch | Explicit column lists; relational query API | >1k plants/read |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key imported in a route handler | Full DB access bypasses RLS | ESLint rule restricting import to `src/contexts/*/inngest/` and `src/scripts/` only |
| Email-verification gate missing on a mutation endpoint | Unverified users can write / identify | Central middleware allowlist, default-deny, test per route |
| Stripe webhook without signature verification | Anyone can forge billing events | `stripe.webhooks.constructEvent` verifying raw body; `webhook_signature_invalid` path to Sentry critical |
| Auth throttle by account only (not IP) | Credential stuffing across accounts undetected | Dual-dimension throttle (per-IP + per-account); take whichever trips |
| Password reset emails enumerate accounts | Account existence leak | Always return 200, always dispatch only on hit, generic copy (AC-AUTH-006) |
| JWT stored in `localStorage` | XSS exfil trivial | HTTP-only cookie OR in-memory + refresh token; Supabase-auth-helpers defaults acceptable |
| Partner codes brute-forced via Settings | Unauthorized trial extensions | Rate-limit partner-code attempts per user (not per IP) to ~5/hr; log invalid attempts |
| Photo URL paths predictable (`user_id/plant_id/n.jpg`) | Enumeration if signed URLs leak | Random UUID filenames; private bucket; signed URL minted per read |
| IndexedDB stores plaintext auth token | Token persisted across sessions, available to any JS | Never persist JWT in IndexedDB; auth tokens in memory (+ Supabase secure storage abstractions) |
| Sentry setUser with email | PII in third-party service | Only `id`; `sendDefaultPii: false` |
| Webhook endpoints open to bots | DoS via forged signature failures | Sentry-critical alert is costly if bot spams bad signatures; add raw IP allowlist via Vercel firewall after launch if abused |
| CSRF on mutation endpoints using cookie auth | State-changing requests from third-party sites | Double-submit cookie or SameSite=Lax enforcement; Next.js App Router handles for `POST` in server actions, but route handlers need explicit handling |
| Open CORS on `/api/v1/*` | Third-party sites call user's API | Lock CORS to app origin only |
| LLM prompt injection via plant nickname | User-controlled text in prompts steers augmentation output | Never pass user-controlled text into LLM prompts for care guide augmentation (care guides are per-species, not per-plant — this is structurally safe, but verify prompts don't leak user nicknames) |
| Reminders expose plant names in push payload | Home-screen lockscreen leak | Push payload carries NO plant detail (AC-REM-004 explicit) |
| Data export zip served from a bucket without TTL | Forwarded link = data leak | 15-min signed URL, or 302-redirect download through app with short token |
| OAuth callback accepts any redirect_uri | Open redirect | Allowlist exact callback URI in Supabase config |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pricing shown only inside signup, never before | Bounces at paywall moment | Marketing page shows price clearly (once pricing decided per launch blocker) |
| Asking push permission at signup | Browser denies, future prompts blocked forever | Defer to first reminder creation (PRD explicit, non-negotiable) |
| Confidence shown as "95%" without context | Users interpret as accuracy claim | "Confiança alta (95%)" + redundant bar, copy "Pode ser..." for medium |
| Toxicity warning below the fold | Missed on scroll | Top of care card AND plant profile; striped border on parent is the "it can't be scrolled away" signal |
| Error copy in English / technical | Lost beginners | pt-BR + cause + recovery ("CEP inválido — use o formato 00000-000") |
| "Add plant" disabled silently when read-only | User confused | Disabled affordance + persistent banner explaining state |
| Reminder created with frequency prefilled from care guide but user doesn't notice | Feels magical first, then surprise when wrong species | Show "Sugerido: rega a cada 7 dias" inline with "Alterar" affordance |
| Offline banner hidden after 3s | User doesn't realize they're offline | Persistent top banner while offline (§16) |
| Capture button not visually distinct | Users don't find identification | Circular 72px Canopy fill, ONLY pure-circle button in the app (§17) |
| Plant card uses user photo with bad aspect ratio | Ugly catalog | Cover is 4:5, fill + gradient for non-matching originals |
| No feedback during Identification (2-15s) | Anxiety, tap elsewhere | Spinner + "Identificando sua planta..." + estimated time |
| Push nudge tapped → lands on random page | Broken core loop | Deep link to Home (AC-REM-004) |
| Daily nudge sent when there's nothing to do | Annoyance, permission withdrawal | AC-REM-004: "ZERO reminders due/overdue → no event emitted" |
| "Logout all devices" button hidden users expect | Security-conscious users frustrated | Explicitly out of scope (post-MVP), documented in Settings copy |
| Confirmation dialogs with destructive as primary | Accidental data loss | Destructive always SECONDARY to "Cancelar" (§17) |
| Partner code field visible after trial expired | User tries to apply, sees error | Hidden when `wall-clock >= trial_end_date` OR status != trialing (§16) |
| LGPD disclaimer in legalese | Users skip/ignore | Plain pt-BR, "suas fotos são enviadas para X nos EUA para identificar a planta" |
| Account deletion flow allows click-through without reading | Accidental 7-day grace trigger | Multi-step confirm: what's deleted + grace + cancellation path |
| Data export email without estimated time | User thinks it's broken | "Seu arquivo estará pronto em até 10 minutos. Você receberá um e-mail." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Identification endpoint:** per-user cap check, per-provider counter increment, consent gate, verification gate, breaker check all fire BEFORE provider dispatch — verify with integration test exercising each
- [ ] **Stripe webhook handler:** synchronous 3-step (verify, insert BillingEvent w/ UNIQUE event_id, enqueue Inngest) — verify by tracing one event end-to-end AND by sending the same event twice (AC-SUB-018)
- [ ] **7-day deletion grace:** Inngest fn re-reads `DataDeletionRequest.status` on wake; `cancelOn` wired; cancel-in-grace integration tested
- [ ] **Offline queue:** replay is idempotent (client UUID), chronological, handles deleted-target silently, discard summary toast shown on next open
- [ ] **Toxicity badge:** all 6 signals present (icon, color, text, striped border on parent, SR alert with full phrase, haptic on first reveal per session)
- [ ] **EXIF stripping:** client-side AND server-side validation — verify with a GPS-bearing JPEG in tests
- [ ] **Sentry scrubbing:** both `beforeSend` AND `beforeBreadcrumb`; identification route drops request body; `Sentry.setUser` never receives email
- [ ] **PostHog identify:** uses `user.id` not email; autocapture off; session replay off
- [ ] **Email verification gate:** central middleware with default-deny + explicit allowlist; every route covered in tests
- [ ] **Push notification:** deferred to first reminder creation; user-gesture synchronous permission call; iOS installed-state detection
- [ ] **Per-device PushSubscription:** endpoint-hashed, upsert on re-register, 410/404 → delete row
- [ ] **Daily nudge dedup:** unique constraint on `(user_id, local_date)`; dispatcher uses user's IANA timezone for `local_date`
- [ ] **Read-only mode:** plants/photos/journal/care guides viewable; identify 402 `subscription_required`; mutations 402 `read_only_mode`; Settings fully accessible
- [ ] **Partner code late entry:** only while trialing AND wall-clock < trial_end_date (serializable tx)
- [ ] **Signed URLs for data export:** ≤15 min TTL; not stored in DB
- [ ] **Augmented care guide:** persistent "Gerado por IA" badge; cannot be removed (check render logic doesn't allow removal flag)
- [ ] **Care guide augmentation:** concurrency key by species_id (Inngest); budget check separate from identification budget
- [ ] **RLS:** enabled on every user-owned table; integration tests run WITH RLS on
- [ ] **Supavisor txn mode:** `prepare: false` set; no LISTEN/NOTIFY anywhere
- [ ] **NFS-e:** decision made and documented (vendor / manual / deferred) BEFORE first paid charge
- [ ] **DPO appointment:** contact in privacy policy AND Settings screen BEFORE first identification accepts
- [ ] **Privacy policy + ToS:** published, versioned, reconsent logic works (`policy_version` on ConsentLog)
- [ ] **Timezone handling:** `next_due_at` stored UTC, computed at create/advance with IANA zone, change-tz in Settings does NOT retroactively shift
- [ ] **Capture button:** pure circle, 72px, Canopy fill (only pure-circle in app)
- [ ] **Bottom nav:** `env(safe-area-inset-bottom)`, badge is dot only (no numerals), scroll preserved per tab
- [ ] **PWA update toast:** non-blocking, `skipWaiting` only on user click, no auto-reload mid-session, respects `prefers-reduced-motion`
- [ ] **`h-screen`:** absent from codebase (use `100dvh`)
- [ ] **Age gate:** server validation `z.literal(true)`, not just client checkbox

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cap bypass via race condition | MEDIUM | Audit counters, rebuild denormalized counters from `Identification` rows, ship atomic insert fix, backfill any affected users |
| Stripe webhook bad signature spam | LOW | Enable Vercel firewall rule / IP block for non-Stripe IPs; document Stripe IP ranges |
| NFS-e not issued for early customers | HIGH | Manually issue via accountant for backlog; integrate vendor; notify affected users; tax penalty review |
| 7-day grace function deleted data after cancel | HIGH | Restore from backup if within retention; notify user; root-cause the `cancelOn` / status-recheck gap; re-audit all Inngest functions for similar patterns |
| PostHog has user emails | MEDIUM | Trigger PostHog "delete person" bulk for all users; switch identify to user.id; add `$set` scrubbing; notify DPO |
| Sentry has photo URLs / emails | MEDIUM | Sentry bulk delete of affected events; add `beforeBreadcrumb`; configure scrubbing rules server-side; re-audit retention |
| Service role key bypassed RLS in production | HIGH | Audit DB writes for last N days, identify incorrect cross-user writes, correct or revert, re-architect repositories, rotate service role key |
| Supavisor prepared statement errors in prod | LOW | Hotfix: set `prepare: false`, deploy, monitor |
| Daily nudge fires twice | LOW | Add unique constraint, backfill de-dup, users get one "sorry" email (or just let it recover naturally) |
| Augmented care guide has wrong toxicity | CRITICAL | Immediate: hide all augmented toxicity for affected species, replace with "unknown" + veterinary prompt; escalate to founder for curated review; consider pausing augmentation until cross-check list in place |
| Per-IP throttle blocking CGNAT users | LOW | Relax window; ship hotfix; monitor |
| Offline queue stuck on deleted plant | LOW | Clear OfflineSyncFailure rows; ship drop-silently fix; users re-queue if desired |
| LGPD consent invalid (coalesced with ToS) | HIGH | Ship separate consent flow; force re-consent on next identify for all existing users; document ANPD response plan if complaint filed |
| Partner code applied after trial_end_date due to race | LOW | Revert `trial_end_date`; apologize; fix tx isolation |

---

## Pitfall-to-Phase Mapping

Assumed roadmap phases (informs ordering): **Foundations** (project setup, DB, auth scaffolding, PWA shell, design system, observability, storage) → **Auth+Billing** (signup, email verification, Stripe, partner codes, dunning) → **Catalog** (plants, photos, locations, journal) → **Identification** (provider abstraction, cost controls, consent gate, history) → **Care Guides** (curated + augmentation) → **Reminders** (scheduling, push, offline) → **LGPD** (export, deletion, consent management) → **Polish** (accessibility, iOS hardening, performance tuning).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| LGPD Art. 33 consent coalesced with ToS | LGPD (consent UI) + Identification (gate) | Two ConsentLog rows present; integration test at first ID blocks on consent |
| Per-user cap race condition | Identification | Concurrent-request integration test |
| Cap-hit writes row / increments counter | Identification | Unit test: cap-hit → counter unchanged, 0 rows |
| 80% alert not firing / flooding | Identification | Test: simulate crossing 80% → exactly one alert |
| Stripe webhook state change in handler | Auth+Billing | Re-delivery test (AC-SUB-018); async fn visible in Inngest |
| NFS-e not integrated | Auth+Billing (launch blocker) | Launch blocker §24 closed with owner + date |
| Inngest `step.sleepUntil` cancellation race | LGPD | Cancel-in-grace integration test (AC-LGPD-005) |
| Timezone/DST drift on reminders | Reminders | Test across multiple IANA zones incl. DST-bearing |
| iOS Safari push gotchas | Reminders + Polish | iOS device matrix manual pass; delivery rate metric |
| `h-screen` / `100vh` | Foundations (design system) | ESLint / grep; visual regression on device |
| Service role key bypassing RLS | Foundations (DB client design) | ESLint import restriction; RLS-on integration tests |
| Supavisor txn mode + prepared statements | Foundations | Integration tests against Supavisor, not direct PG |
| Offline queue deleted-target handling | Reminders / Offline sync | Integration test: race delete + Done |
| PushSubscription pruning churn | Reminders | Prune rate metric baselined; upsert on endpoint hash |
| Daily nudge dedup | Reminders | Unique constraint; dispatcher-run-twice test |
| Augmented care guide double-call | Care Guides | Concurrency-key test (two events same species_id) |
| Toxicity hallucination | Care Guides | Cross-check list + `unknown` state + smoke test against known toxic species |
| Toxicity badge missing redundant signal | Care Guides | Component test asserts all 6 signals + VoiceOver manual |
| EXIF server-side bypass | Foundations (image pipeline) | Unit test with GPS-bearing JPEG |
| Sentry PII leakage | Foundations (observability) | Smoke test: trigger error, assert no PII in captured event |
| PostHog identifying by email / autocapture | Foundations (observability) | Grep for `identify(.*@`; config review |
| Email verification gate endpoint gaps | Auth+Billing | Route coverage test: each route asserted against unverified user |
| Signed URL storage in DB | Foundations (storage) + LGPD (export) | Grep: no `.createSignedUrl()` return stored in DB |
| Per-IP throttle false positives | Auth+Billing | Metric `public_auth_throttle_trip_rate` <0.5% |
| Supabase branch DB cost | Foundations (CI/CD) | Branch cleanup workflow; budget alert |
| Pix dunning flow | Auth+Billing | Dunning email branch by payment method type; Pix mandate revoke handled |
| Partner code boundary race | Auth+Billing | Serializable tx; boundary integration test |
| Age-gate server validation | Auth+Billing | Signup endpoint test: missing / false field → 400 |
| Thumbnail gen silent failure | Catalog | Corrupt-image test; `thumbnail_status=failed` path |
| Service worker update loop | Foundations (PWA shell) | Deploy-v1 → deploy-v2 → update flow smoke test |

---

## Sources

- `/Users/machado/Projects/folhario/docs/CAVE-PRD.md` §5, §6, §8, §9, §10, §11, §12, §13, §15, §17, §18, §21, §23, §24, §25 — authoritative for all AC-referenced pitfalls (HIGH confidence)
- `/Users/machado/Projects/folhario/.planning/PROJECT.md` — project-level context
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS and service role bypass semantics (HIGH)
- [Why is my service role key client getting RLS errors | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) (HIGH)
- [Disabling Prepared statements · supabase discussion #28239](https://github.com/orgs/supabase/discussions/28239) — Supavisor txn mode + prepared statements gotcha (HIGH)
- [Inngest — step.sleepUntil](https://www.inngest.com/docs/reference/functions/step-sleep-until) (HIGH)
- [Inngest — Cancellation](https://www.inngest.com/docs/features/inngest-functions/cancellation) — `cancelOn` pattern (HIGH)
- [Inngest — Versioning and Function Evolution](https://www.inngest.com/docs/learn/versioning) — step identifier hashing (HIGH)
- [Stripe — Pix payments](https://docs.stripe.com/payments/pix) (HIGH)
- [Stripe — Adds Pix to payment method configurations (2025-04-30)](https://docs.stripe.com/changelog/basil/2025-04-30/add_pix_to_payment_method_configuration) (HIGH)
- [Stripe — Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) (HIGH)
- [MagicBell — PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS 16.4+ push, installation requirement, Declarative Web Push in 18.4 (MEDIUM; verified against Apple docs where applicable)
- [Apple Developer Forums — PWA push notifications on iOS](https://developer.apple.com/forums/thread/732594) — reliability anecdotes (MEDIUM)
- [MDN — `100dvh` / `100svh` viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths_and_mobile_viewports) — `dvh` vs `vh` on mobile (HIGH, training data + MDN authoritative)
- LGPD (Lei Geral de Proteção de Dados, Lei 13.709/2018) Art. 7, 8, 9, 14, 18, 33, 48 — legal basis structure anchors pitfalls #1, #7, #20, #21, #28 (HIGH, legal text)
- Brazil DST abolition — Decreto 9.772/2019 — anchors pitfall #8 (HIGH)
- NFS-e ecosystem (NFE.io, Omie, NFSeBrasil) — municipal electronic service invoice landscape — anchors pitfall #6 (MEDIUM, market knowledge)

Confidence legend:
- **HIGH** — Anchored in CAVE-PRD acceptance criteria, official vendor docs, or legal text
- **MEDIUM** — Web-verified against 2025–2026 sources, community-reported patterns
- **LOW** — n/a (no LOW-confidence pitfalls included; anything uncertain was flagged with "verify before ship" language)

---
*Pitfalls research for: Folhário (pt-BR plant identification PWA, Brazilian market, LGPD-regulated)*
*Researched: 2026-04-14*
