# Folhário — Product Requirements Document (MVP)

**Version:** 1.2
**Date:** 2026-04-12
**Status:** Approved

---

## 0. Launch Blockers

These items block MVP launch and must be resolved before or in parallel with implementation. They are called out separately from §9 Open Questions because the product cannot ship without them.

Every blocker below must have a named owner and a dated target assigned before the first production deploy is cut. An `Owner = TBD` row is itself a blocker: it means no human has committed to resolving the item. The table is reviewed weekly until all rows are assigned.

| Blocker | Owner | Target | Notes |
|---|---|---|---|
| Subscription pricing | TBD | Pre-launch — required before Stripe live mode is enabled (HIGH-LEVEL-DESIGN §5.4) | Monthly price for the Brazilian market (referenced in §1). Required before Stripe product setup and before the conversion targets in §8.1 become meaningful. Until this is set, the §8.1 trial-to-paid targets are provisional. |
| NFS-e issuance | TBD | Pre-launch — required before first paid charge | Stripe does not issue Brazilian electronic service invoices. Decision needed on third-party integration (e.g., NFE.io, accounting partner) or a manual process. |
| DPO (Encarregado) appointment | TBD | Pre-launch — contact must be published in privacy policy and Settings before any identification request is accepted | LGPD requires an appointed Data Protection Officer with a published contact channel (§4.6.7). |
| Privacy policy and terms of service authoring | TBD | Pre-launch — text must be finalized before the §3.1.5 consent flow is shipped to production | Ownership (legal counsel vs. internal) and timeline relative to launch. The §3.1.5 consent flow depends on the final text. |

---

## 1. Overview

Folhário is a plant identification and care app for beginners and hobbyists in home gardening. The MVP delivers the core loop: identify a plant, add it to a personal catalog, learn how to care for it, and get reminders so it doesn't die.

The product launches as a PWA (Progressive Web App) with plans to evolve into native apps. All architectural decisions must account for this trajectory.

### Business Model

Single-tier monthly subscription. No freemium, no feature gating. Pricing TBD based on future market research for the Brazilian market.

| Channel | Trial Period | Goal |
|---|---|---|
| Organic (search, referrals) | 14 days | Convert through product value |
| Partner stores & florists | 30 days | Convert through habit + partner relationship |

Revenue in the MVP comes exclusively from subscriptions, processed via Stripe (Pix and card). Partner onboarding flows and dashboards are post-MVP; partner trial codes are managed manually. The full subscription lifecycle, state machine, and trial-expiry behavior are defined in §4.7.

The trial clock starts at **signup**, not on first identification. Partner codes are captured as an optional field on the signup screen — present → 30-day trial, absent → 14-day trial. A code can also be entered later from Settings, but only while the user is still inside their original trial window, and it can only **extend** an organic trial up to 30 days from signup (never resets, never stacks).

### Target Audience

Beginners and hobbyists in home gardening. People who buy plants on impulse and then Google "why is my fern dying." They don't know species names, don't understand light requirements, and forget to water. The app should feel like a knowledgeable friend, not a botany textbook.

---

## 2. Principles

- **Simple language, always.** No jargon. The audience is beginners.
- **Value in under 2 minutes.** First photo → identified plant → in catalog. That's the "aha" moment.
- **Safety first.** Toxicity warnings for pets/children must be visually prominent. Toxicity information is AI-sourced with grounding and is always displayed with an explicit disclaimer advising users to confirm with a veterinarian; the visual prominence and disclaimer presence are non-negotiable.
- **Honest AI.** Show confidence levels. Never present a guess as certainty.
- **i18n from day one.** MVP ships in Portuguese (pt-BR) only, but every user-facing string must go through an internationalization layer. No hardcoded text.

---

## 3. Functional Requirements

Testable acceptance criteria for every functional requirement in this section — plus §4.4, §4.6, §4.7, and §4.8 — live in [`ACCEPTANCE-CRITERIA.md`](./ACCEPTANCE-CRITERIA.md). Each criterion there is cross-referenced back to the PRD section it covers.

### 3.1 Plant Identification (Core)

The identification engine is cloud-only for the MVP. No embedded/on-device model.

#### 3.1.1 Identification Flow

The user takes or uploads one or more photos. The app sends them to the identification backend and displays results.

**Inputs:** One or more photos from camera or gallery.

**Outputs:** Top 3 results ranked by confidence, each containing: common name (pt-BR), scientific name, confidence percentage, thumbnail reference image.

**Rules:**
- Results with confidence below a configurable threshold (seed default: 30%) are not displayed. The threshold is **operator-configured per provider** via the `ProviderBudget.min_confidence` field — runtime-tunable from the database without redeployment, never exposed to end users.
- If fewer than 1 result passes the threshold, show a "could not identify" state with guidance to retake the photo.
- The user can select the correct result or dismiss all and enter manually.
- Before any provider call, the backend checks the user's per-tier cap and the active provider's global ceiling (§4.8). Cap-exceeded and provider-unavailable states have dedicated UI on the Identify screen (§7.2).

#### 3.1.2 Capture Guide

Before/during photo capture, display visual guidance to help the user take useful photos: photograph the leaf, the flower (if present), and the whole plant. Multiple photos improve accuracy. This is static UI guidance, not AI-driven.

#### 3.1.3 Identification History

Every identification attempt is persisted: date, original photo(s), results returned, result selected by user (or manual correction).

The user can browse past identifications and re-associate them with catalog entries.

#### 3.1.4 Manual Correction

The user can override the AI result by typing a plant name. Corrected identifications should be flagged in the database for potential future use in training/quality analysis (not in MVP scope, but the data structure must support it).

#### 3.1.5 Provider Architecture

The identification backend must be modular. The system communicates through a provider interface, not directly with any specific API.

**Required connectors for MVP:**
- **Plant ID API** (or equivalent specialized plant identification service)
- **OpenAI-compatible API** (vision model — supports OpenAI, Anthropic, open-source models behind compatible endpoints)

**Provider interface contract (conceptual):**

```
IdentificationProvider:
  identify(images: Binary[], options: IdentificationOptions) → IdentificationResult[]

IdentificationResult:
  common_name: string
  scientific_name: string
  confidence: float (0-1)
  metadata: Record<string, any>

IdentificationOptions:
  max_results: int
  language: string
  min_confidence: float
```

The active provider is determined by backend configuration, not client logic. The client sends the image(s); the backend routes to the configured provider. This allows A/B testing providers and swapping models without client changes. The router consults the per-provider cost ceiling and circuit breaker state (§4.8) before selecting a provider, falls over to the next configured provider when one is unavailable, and logs the reason (`cap_hit`, `breaker_open`, `cost_ceiling_reached`) on every rejection.

**Prompt and configuration management:** Prompts for OpenAI-compatible providers and all provider configuration (thresholds, model identifiers, parameters) are managed in code and versioned with the application source. Changes to prompts or provider settings follow the standard deployment pipeline.

**Consent and international transfer (LGPD):** The first identification attempt triggers a consent prompt disclosing the active third-party providers (Plant ID, OpenAI-compatible) and the fact that photos are transferred internationally (LGPD Art. 33). Identification is blocked until consent is granted. Each identification record stores the consent version active at the time of the request.

#### 3.1.6 Identification Failure Modes

- **All providers unavailable** (cost ceiling, circuit breaker, or hard outage): the backend returns a typed `provider_unavailable` error and the Identify screen shows the §4.8.2 "temporarily unavailable" state. An `Identification` record is written with `status = failed` and `failure_reason = provider_unavailable` (or the more specific internal reason, see below), so the attempt surfaces in identification history (§3.1.3) and feeds the §8.2 quality metrics. The selected photo is **kept locally (IndexedDB) while the user remains on the Identify screen**, with an explicit "Try again" action. Leaving the screen discards the local photo. No persistent server-side retry queue.
- **Backend timeout or network drop while waiting for results**: same UX as provider unavailable; the user can retry. An `Identification` record is written with `status = failed` and `failure_reason = timeout`, so the attempt surfaces in identification history (§3.1.3) and feeds the §8.2 quality metrics. Concrete budget values (per-call timeout, total wall-clock budget, fallback short-circuit threshold) are defined in `HIGH-LEVEL-DESIGN.md §5.1`.
- **User navigates away mid-request**: the request runs to completion server-side. The result is persisted to identification history but no in-flight UI is restored — the user can re-open the attempt from history. No push or interruption.
- **Malformed or empty provider response**: treated as a provider failure with `failure_reason = invalid_response`; the router increments the failure counter for the breaker (§4.8.3) and falls over to the next provider per §4.8.2.

**`Identification.status` and `failure_reason` taxonomy.** `Identification.status` takes one of exactly two values: `success` (the call completed and at least a structured result set — possibly empty after threshold filtering — was returned by a provider) or `failed`. When `status = failed`, `failure_reason` is required and is drawn from an internal enum: `timeout`, `provider_unavailable`, `cost_ceiling_reached`, `breaker_open`, `invalid_response`. This is the authoritative schema; `DATA-MODEL.md` and `ACCEPTANCE-CRITERIA.md` mirror it. Cap-exceeded requests never write an `Identification` row (§4.8.1). The client-visible error codes (`timeout`, `provider_unavailable`, `cap_hit`) are defined in `API-CONTRACT.md §2`; `cost_ceiling_reached` and `breaker_open` are internal-only and surface to clients as `provider_unavailable` when no fallback provider remains.

---

### 3.2 Personal Catalog ("Meu Jardim")

The catalog is the user's collection of plants. It's the persistent home for everything the user grows.

#### 3.2.1 Adding a Plant

A plant can be added to the catalog via two paths:
- **From identification:** After selecting a result, the user is prompted to add it to the catalog.
- **Manually:** The user creates an entry without identification, entering the name themselves.

**Required fields:** Name (pre-filled from identification or entered manually), at least one photo.

**Optional fields:** Nickname, room/location in the house, acquisition date, personal notes.

#### 3.2.2 Plant Profile

Each catalog entry has a profile page showing:
- Name and nickname
- Photo(s)
- Room/location
- Acquisition date
- Personal notes
- Link to care guide (section 3.3), if available
- Link to active reminders (section 3.4)
- Photo journal (section 3.2.4)
- Identification history (if added via identification)

#### 3.2.3 Room/Location

A combined input field for where in the house the plant lives. The field presents:
- **Previously used locations:** Any room/location names the user has already assigned to other plants, shown as quick-select options.
- **Predefined suggestions:** A default set of common locations (living room, balcony, bedroom, bathroom, kitchen, office, garden, other) shown when the user has no history or as additional options below the user's own locations.
- **Free text input:** The user can always type a custom location name, which then becomes available as a previously used option for future plants.

Not GPS-based — this is for indoor organization.

#### 3.2.4 Photo Journal

A chronological timeline of photos for each plant. The user can add photos with an optional note at any time. The journal doubles as a motivational tool (seeing growth over time) and a diagnostic aid (comparing leaf color across weeks).

#### 3.2.5 Sorting

The catalog supports sorting by: name (A-Z, Z-A), acquisition date (newest first, oldest first), and room/location. Default sort is acquisition date, newest first.

---

### 3.3 Plant Care Guides

Each identified plant species has an associated care guide sourced from a curated database.

#### 3.3.1 Care Card Content

Each care guide contains:

| Field | Format |
|---|---|
| Watering | Frequency range + descriptive guidance |
| Light | Category (direct sun / indirect light / shade) + guidance |
| Soil | Recommended substrate type |
| Temperature | Ideal range in °C |
| Humidity | Low / medium / high + tips |
| Toxicity | Safe / toxic to pets / toxic to children / toxic to both |
| Difficulty | Easy / medium / hard (visual scale) |

#### 3.3.2 Toxicity Warnings

Toxicity information must be visually prominent — icon + colored badge, not buried in text. If a plant is toxic to pets or children, this must be the first thing the user sees on the care card and the plant profile.

Every toxicity badge must carry a visible disclaimer: **"Informação gerada por IA — confirme com um veterinário."** A one-time modal with the same disclaimer is shown on the first care guide view per user; acknowledgement is recorded so it does not repeat.

#### 3.3.3 Seasonal Tips

Care adjustments by season (summer/winter in the southern hemisphere). Static content per species, not dynamic weather-based.

#### 3.3.4 Plant Compatibility

Information on which plants coexist well in the same pot or environment. This is reference content within the care guide, not a standalone feature.

#### 3.3.5 Content Strategy & Sourcing

Care guide content is delivered through two parallel tracks: a curated launch corpus (Track 1, this section) and runtime augmentation for the long tail (Track 2, §3.3.7).

**Track 1 — Curated launch corpus.**

This is a hard launch dependency.

- **Owner:** the founder is accountable for the corpus reaching launch quality.
- **Target:** 200+ domestic species with complete care guides published before MVP launch.
- **Timeline commitment:** delivery by MVP launch (no later).
- **Source pipeline:**
  - PlantNet open data (https://identify.plantnet.org/open_data) → species list, scientific names, reference images.
  - Care fields (watering, light, soil, temperature, humidity, difficulty, seasonal tips, compatibility) → secondary curated databases (e.g., RHS, Embrapa for BR-relevant species) supplemented by LLM-assisted drafting with human review before publication.
  - Toxicity → AI-sourced via a grounded LLM (same `CareGuideProvider` mechanism used at runtime, see §3.3.7), with the mandatory disclaimer of §3.3.2 always shown to the user. *Grounding, here and throughout this document, means provider-side web search or RAG that augments the model's response with retrieved sources. Grounding is relied on at the provider layer; Folhário does not implement its own retrieval pipeline.*
  - Common-name normalization to pt-BR.

The data model supports versioning of care content (corrections, seasonal updates) via the `version` field on `CareGuide`.

#### 3.3.6 Missing Care Guide

If a plant is identified but has no corresponding care guide in the database, the care guide section is hidden from the plant profile and the species is flagged via `SpeciesFlag` for investigation. The user sees the plant in their catalog with all other features (photo journal, reminders, notes) working normally — just no care card.

In parallel, runtime augmentation (§3.3.7) is triggered asynchronously to attempt to fill the gap. If augmentation succeeds, the care card appears on the next view of the plant profile.

#### 3.3.7 Runtime Care Guide Augmentation

When an identification matches a species with no care guide or with missing fields, the system asynchronously calls a `CareGuideProvider` to fill the gap. This is the long-tail strategy that complements the curated launch corpus (§3.3.5).

- **Provider abstraction:** `CareGuideProvider` is a modular interface mirroring the identification provider pattern of §3.1.5. The full architectural definition lives in §5.5.
- **Trigger:** asynchronously, after a successful identification, when no `CareGuide` row exists for the matched species, or when the current `CareGuide` row is missing one or more fields. Augmentation is **off the user's critical path** — the identification result is shown immediately; the care card appears once augmentation completes.
- **Toxicity is included** in the augmentation request. The provider's grounding capability is relied upon, and the disclaimer of §3.3.2 makes the AI provenance explicit to the user.
- **Draft handling:** the LLM result is written to a `CareGuide` row with `status = draft` and `source = augmented`. Drafts are visible to users immediately, marked with an "Gerado por IA — em revisão" badge in the UI. There is no separate draft entity — `status` on `CareGuide` is the single source of truth.
- **Editor review:** drafts enter a review queue surfaced in operator tooling. Approval flips the row to `status = published` and bumps the `version`. Rejection deletes the row and re-flags the species via `SpeciesFlag`.
- **Cost control:** augmentation calls go through the `ProviderBudget` ceiling and circuit breaker infrastructure defined in §4.8, but against its **own** budget row. `ProviderBudget` and `ProviderUsageCounter` are keyed by `(provider, purpose)`, where `purpose` is `identification` or `care_guide`, so an augmentation-purpose budget can be exhausted without affecting identification and vice versa. When the `care_guide` budget is exhausted, augmentation pauses but identification continues unaffected.
- **Logging:** each augmentation attempt records provider, model, prompt version, latency, estimated cost, and outcome — feeding the §8.2 metrics.

---

### 3.4 Reminders

Reminders are the retention engine. They bring the user back daily.

#### 3.4.1 Watering Reminders

Push notifications (via PWA push / service worker) with configurable frequency per plant.

**Default frequency** is pre-filled from the care guide when the user creates a reminder, but can be overridden.

**Time of day:** Each reminder has a user-configurable notification time. The default is **09:00** when a reminder is created; the user can change it per reminder. Times are interpreted in the user's configured timezone (`User.timezone`, see §3.4.4), resolved at the moment a reminder is created or advanced.

**Interaction:** The notification (or in-app prompt) offers two actions: "Done" (marks as watered) and "Snooze" (configurable delay: 1h, 3h, tomorrow).

#### 3.4.2 Fertilization Reminders

Same mechanism as watering but with longer default cycles (monthly, quarterly, etc.). Pre-filled from care guide data where available. The same per-reminder time-of-day and timezone rules of §3.4.1 apply.

#### 3.4.3 Daily Summary

A morning summary screen (in-app, not push) listing today's pending tasks across all plants with active reminders.

#### 3.4.4 Reminder Rules

- Plants with no reminders configured show no prompt or suggestion. The user creates reminders explicitly from the plant profile.
- Completed tasks are logged with a timestamp (feeds future analytics and potential features in later versions).
- Overdue tasks are visually distinct from upcoming tasks. There is **no escalation policy** in MVP — overdue items remain in the daily summary until the user acts on them. They are not auto-muted, not auto-completed, and do not change visual weight as they age.
- Reminder scheduling and notification delivery are paused while the subscription is not in `trialing` or `active` state (see §4.7 for the read-only catalog mode).

**Timezone handling:**
- Each user has a `timezone` field (IANA, e.g., `America/Sao_Paulo`) on `User`. It is captured from the device at signup via `Intl.DateTimeFormat().resolvedOptions().timeZone` and editable in Settings.
- Reminder fire time is computed at create/advance time by combining `notification_time_local` with `User.timezone`, and stored on the reminder as a UTC timestamp (`next_due_at`). The server-side dispatcher queries reminders by UTC; there is no per-request timezone math at fire time.
- **Travel is not handled in MVP.** A user who crosses timezones continues to see reminders fire on their account-configured timezone. Changing `User.timezone` in Settings does **not** retroactively shift already-scheduled reminders — only reminders computed after the change use the new timezone. Rationale: a user who is traveling is not tending their plants, so a few hours of drift on reminders is acceptable and does not justify automatic reconciliation.

**Advancing `next_due_at`:**
- Each reminder has a user-selectable `advance_rule`, configurable per reminder when it is created or edited:
  - **`from_scheduled`** — the next due date is computed from the previous scheduled date plus the frequency. Choose this when the cadence matters (e.g., "always water on Mondays").
  - **`from_acted`** — the next due date is computed from the timestamp at which the user marked the task done, plus the frequency. Choose this when the interval since last action matters (e.g., "water 7 days after I last watered").
- The default for new reminders is **`from_scheduled`**.
- Snooze actions push only the current occurrence; they do not change the `advance_rule` calculation for the next occurrence after the user marks "Done."

#### 3.4.5 Reminder Failure Modes

- **Push delivery fails or push permission was never granted**: the missed reminder appears in the in-app notification center on the next app open. The §3.4.3 Daily Summary screen is repurposed as the host for this center (see §7.1). The notification center has no dedicated entity — entries are derived at read time from overdue `Reminder` rows and their `ReminderLog` history.
- **Notification arrives but the app is offline when the user taps "Done"**: the action is queued (§4.4) and synced on reconnect with idempotent semantics.
- **Reminder fires for a plant that was deleted on another device**: the queued action is dropped silently on sync; no error is shown to the user.

---

## 4. Non-Functional Requirements

### 4.1 Platform: PWA

The MVP ships as a Progressive Web App. The app must:
- Be installable on home screen (web app manifest).
- Work with degraded experience when offline (cached catalog view, queued actions).
- Support push notifications via service worker.
- Be responsive across mobile screen sizes (primary target).
- On desktop viewports, constrain the application layout to a tablet-like max-width (centered, with background fill on the sides). The app is not designed for wide-screen desktop layouts.

### 4.2 Authentication

Email + password and OAuth (Google at minimum). No anonymous usage — a trial still requires account creation.

The signup screen includes an optional **partner code** field ("Tenho um código de parceiro"). When present and valid, it sets the trial length to 30 days and records the partner association on the user record. When absent, the trial defaults to 14 days. Trial start happens at the moment account creation completes (see §1 and §4.7).

The code is validated at signup against the `PartnerStore` table. If the code is present but invalid (unknown or inactive), the signup form shows an inline error and the user may proceed by clearing the field and accepting a 14-day trial. Deactivating a `PartnerStore` after a trial has been granted does **not** affect users whose trial was already established under that code — their existing trial length is preserved until the trial ends.

**Late code entry boundary.** A partner code entered from Settings after signup is accepted only while `Subscription.status = trialing` and the server wall-clock time is strictly before `Subscription.trial_end_date`. A valid code entered at this stage sets `trial_end_date` to `created_at + 30 days` in one write (no gradual advance, no clock reset); the user effectively gains whatever days remain in the 30-day window. Once `trial_end_date` has passed — even by one second — `Subscription.status` has already transitioned out of `trialing` and the app is in read-only catalog mode (§4.7.3); partner codes are no longer accepted and access is restored only through reactivation with a payment method.

### 4.3 Internationalization (i18n)

All user-facing strings must be externalized into translation files. The MVP ships with a single locale: `pt-BR`. The i18n infrastructure must support:
- Pluralization rules.
- Date/number formatting per locale.
- Dynamic content (care guides) stored with a locale field, not just UI strings.

No locale switcher in the MVP UI. The locale is hardcoded to `pt-BR` in configuration.

### 4.4 Offline Behavior

The PWA must handle offline gracefully:
- Cached catalog and care guides remain browsable.
- New identifications are blocked (cloud-only) — show a clear message.
- Actions (adding photos, marking reminders as done) are queued and synced when connectivity returns.

**Sync semantics and conflict resolution:**
- Each queued action carries a **client-generated UUID** for idempotency; replays are deduped server-side.
- Queued actions are replayed in **chronological order** by client timestamp.
- **Conflict rules:**
  - Plant deleted on the server → drop all queued actions targeting that plant. A single toast on next app open summarizes discarded actions: "X queued actions were discarded because the plant was deleted." The toast is tappable and expands into a short modal listing the discarded actions grouped by type (e.g., "2 photo uploads, 1 note edit" for plant "Maria") with the target plant name and the original client timestamp of each action. The list is read-only — the plant no longer exists, so there is no retry affordance — but the user can see exactly what was lost before dismissing.
  - Field edit on stale data → **last-write-wins by server timestamp** (no merge UI in MVP).
  - Photo upload to a deleted plant → drop, included in the same discard summary.
  - Reminder "Done" action when the reminder no longer exists → drop silently.
- A queued action that fails to sync after **5 retries** is moved to a "needs attention" list in Settings, where the user can manually retry or discard it.

### 4.5 Image Handling

- Photos are stored in object storage (see 5.2).
- Client-side compression before upload (target: ≤1MB per image).
- EXIF metadata (including GPS coordinates) is stripped client-side before upload (LGPD data minimization).
- Thumbnail generation on upload for catalog views.
- Original images are preserved for identification accuracy.
- No per-user storage limits in MVP. Cost reduction strategy to be defined as usage data becomes available. Note: identification (the dominant variable cost) is capped per user and per provider — see §4.8.

**Failure modes:**
- **Compression failure**: retry once at a lower target quality. If it still fails, surface an error and prompt the user to pick a different photo.
- **Upload failure mid-transfer**: the compressed image stays in the offline queue (IndexedDB) and is retried by the standard offline sync (§4.4). No partial files are written to object storage.
- **Thumbnail generation failure**: the original is still saved; the catalog falls back to a placeholder until the next successful sync regenerates the thumbnail.

### 4.6 LGPD Compliance

The product processes personal data of Brazilian residents and must comply with the Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

#### 4.6.1 Legal Basis

Each processing activity is bound to a specific legal basis (LGPD Art. 7):

| Activity | Legal basis |
|---|---|
| Account creation, authentication, catalog storage | Execution of contract |
| Subscription billing | Execution of contract |
| Sending photos to third-party identification providers | Consent |
| Push notifications | Consent |
| Quality and operational metrics (aggregated) | Legitimate interest |
| Identification history retention | Execution of contract + legitimate interest (quality) |

#### 4.6.2 Data Subject Rights

The following rights (LGPD Art. 18) must be exercisable from the Settings screen:
- **Access:** download a copy of all personal data held about the user.
- **Correction:** edit account and catalog data (covered by existing edit flows).
- **Anonymization / deletion:** delete account and associated data.
- **Portability:** export data in a structured, machine-readable format (JSON).
- **Consent revocation:** withdraw any previously granted consent (e.g., disable identification, push). Revocation must not break access to data already in the catalog.
- **Information about sharing:** the privacy policy lists all third parties that receive personal data.

#### 4.6.3 Account Deletion (Right to Erasure)

- The user requests deletion from Settings.
- A **7-day grace period** follows, during which the account is suspended (not accessible) but recoverable. The user is notified by email at request time.
- After 7 days, all personal data is hard-deleted: photos in object storage, catalog entries, identification history, reminder logs, consent records (except the minimal record required to prove deletion was performed).
- Deleted data propagates to backups on the next full backup cycle, within 30 days.
- Aggregated/anonymized metrics that no longer identify the user may be retained.

#### 4.6.4 Retention Policy

Each entity has a defined retention window. Concrete values are an open question (see section 9), but the data model and deletion jobs must support per-entity retention:
- Identification history, photo journal, catalog entries: retained for the life of the account.
- Operational logs containing personal data: bounded retention (target: ≤90 days).
- Deleted-account audit record: retained as required to demonstrate compliance.

#### 4.6.5 International Data Transfers

Photos sent to identification providers (Plant ID, OpenAI-compatible) constitute international data transfers under LGPD Art. 33. The privacy policy must disclose the providers, the destination jurisdictions, and the safeguards in place. Consent is captured before the first transfer (see 3.1.5).

#### 4.6.6 Children's Data

LGPD Art. 14 imposes special requirements on processing data of children under 13. The MVP does not support under-13 accounts:
- Signup requires age confirmation (≥13).
- Accounts identified as belonging to minors under 13 are blocked.
- Best-interest processing for users 13–17 follows the standard consent model.

#### 4.6.7 Governance

- A Data Protection Officer (DPO / Encarregado) is appointed; contact information is published in the privacy policy and in Settings.
- A data breach response process is documented: ANPD notification and affected-user notification within the timeframes required by LGPD Art. 48.
- A privacy policy and terms of service are published before launch and versioned. Material changes trigger re-consent for affected processing activities.

### 4.7 Subscription & Billing

The MVP charges users via a single-tier monthly subscription processed by **Stripe**. Stripe is chosen for the MVP based on developer experience, native support for Pix and card payments in Brazil, and built-in dunning. Tax and NFS-e handling are tracked as an open question (§9).

#### 4.7.1 Provider Abstraction

Following the same boundary pattern as the storage and identification layers, billing must sit behind a `BillingProvider` interface. Business logic must not call Stripe SDKs directly.

**Conceptual contract:**

```
BillingProvider:
  create_customer(user) → CustomerRef
  start_subscription(customer, plan, trial_end?) → SubscriptionRef
  cancel_subscription(subscription, at_period_end: bool) → SubscriptionRef
  reactivate_subscription(subscription) → SubscriptionRef
  update_payment_method(customer) → PaymentMethodRef
  get_subscription(subscription) → SubscriptionState
  handle_webhook(payload, signature) → BillingEvent
```

This keeps the option open to swap to a local Brazilian provider (Pagar.me, Mercado Pago, Iugu) if tax or pricing constraints later demand it.

#### 4.7.2 Subscription State Machine

The `Subscription.status` field replaces the simple three-value `subscription_status` from the original draft. Valid states and transitions:

| From | To | Trigger |
|---|---|---|
| (none) | `trialing` | Account created |
| `trialing` | `active` | First successful charge after trial end |
| `trialing` | `expired` | Trial ends with no valid payment method |
| `active` | `past_due` | Renewal charge fails |
| `past_due` | `active` | Payment recovered (manual or automatic retry succeeds) |
| `past_due` | `canceled` | Dunning exhausted |
| `active` | `canceled` | User cancels (effective at `current_period_end`) |
| `canceled` | `expired` | `current_period_end` reached |
| `canceled` / `expired` | `active` | User reactivates (new payment method, before account deletion) |

States `active` and `trialing` grant full app access. All other states put the app into read-only catalog mode (see 4.7.4).

#### 4.7.3 Trial Expiry and Read-Only Catalog Mode

When the subscription is not in `trialing` or `active`, the app enters **read-only catalog mode**:
- Plants, photos, photo journal entries, and care guides remain **viewable**.
- Identification is **blocked** (with a paywall prompt).
- Reminder scheduling and push notifications are **paused** (see §3.4.4).
- New plants, new photo journal entries, and edits to existing entries are **blocked**.
- Settings remain fully accessible: payment method update, reactivation, data export (§4.6.2), account deletion (§4.6.3).

This preserves user trust by never holding their data hostage while still gating the parts of the product that drive cost (identification) and engagement (reminders).

#### 4.7.4 Dunning

When a renewal charge fails, Stripe retries automatically. Folhário's dunning policy:
- **4 retry attempts over 7 days** (configured in Stripe).
- Email notification on each failed attempt with a link to update payment method.
- After the final failed attempt, the subscription transitions to `canceled` and the app enters read-only catalog mode.
- The user can still reactivate by providing a working payment method, until the account is deleted.

#### 4.7.5 Webhooks

A single backend endpoint receives Stripe webhooks. Requirements:
- **Signature verification** on every request.
- **Idempotency**: each event is recorded by `event_id` in `BillingEvent`. Duplicate deliveries are no-ops.
- **State sync**: the webhook handler is the authoritative source for `Subscription.status` transitions. The client never mutates subscription status directly.
- **Logging**: every event is persisted with its raw payload for audit and debugging.

#### 4.7.6 Cancellation and Reactivation

- **Cancellation** is initiated from Settings. The UI confirms the date access ends (`current_period_end`). The subscription is canceled at period end, not immediately — the user retains full access until then.
- **Reactivation** is available from Settings while the account exists, including during the 7-day deletion grace period (§4.6.3). Reactivating after `expired` requires a new subscription start (not a resume of the prior one).

### 4.8 Identification Cost Controls

Identification calls third-party paid APIs and is the largest variable cost in the product. Cost controls operate at two layers: per-user caps and per-provider global ceilings. All caps and ceilings are **stored in the database**, not in environment variables or code, so values can be tuned without a deployment.

**Scope note.** The infrastructure described in this section — `ProviderBudget`, `ProviderUsageCounter`, the failure-based circuit breaker, the 80% alert — is shared between identification and runtime care guide augmentation (§3.3.7). `ProviderBudget` and `ProviderUsageCounter` are keyed by `(provider, purpose)`, where `purpose` is `identification` or `care_guide`. Each purpose has its own budget row and counter row, so exhausting the `care_guide` budget never affects identification and vice versa. Tables, examples, and text in §4.8.1 and §4.8.2 refer to `purpose = identification` unless explicitly stated otherwise.

#### 4.8.1 Per-User Caps

Caps are tier-based and read from the `IdentificationLimit` table at request time:

| Tier | Daily cap | Period cap |
|---|---|---|
| Trial (`trialing`) | 5 / day | 75 per trial window |
| Paid (`active`) | 15 / day | 200 per billing period |

The **period** is the tier's active window, resolved from the user's subscription at query time:
- **Trial** — `window_start = Subscription.trial_start_date`, `window_end = trial_end_date`. The window length (14 or 30 days, depending on partner status) is a billing concern; the cap is the same for organic and partner trials.
- **Paid** — `window_start = Subscription.current_period_start`, `window_end = current_period_end`.

Both tiers use the same query shape: `count(Identification where user_id = X and created_at >= window_start)`. There is no rolling computation.

Caps are checked **before** any provider call is made. Over-cap requests are rejected with a typed error code and never reach the provider. Usage is computed from the `Identification` table indexed by `user_id, created_at`; a denormalized counter is only introduced if query performance demands it.

When a user hits a cap, the Identify screen shows a clear message ("You've reached today's identification limit. Resets at [time].") and points the user at the manual entry path (§3.1.1). No background queueing — the user retries explicitly after the reset.

#### 4.8.2 Per-Provider Global Ceiling

Each identification provider has a daily spend ceiling, stored in the `ProviderBudget` table:

| Provider | Daily cost ceiling (default) |
|---|---|
| Plant ID | USD 5 / day |
| OpenAI-compatible | USD 5 / day |

A `ProviderUsageCounter` row, keyed by `(provider, purpose, UTC date)`, tracks request count and estimated cost. Each request increments the counter atomically before dispatch. Identification requests increment the row with `purpose = identification`; augmentation requests (§3.3.7) increment the row with `purpose = care_guide`.

When the ceiling is reached:
1. The provider is marked **unavailable** for the remainder of the UTC day.
2. The identification router falls over to the next configured provider (matches the §3.1.5 provider abstraction).
3. If **all** providers are exhausted, identification returns a "temporarily unavailable" state. Manual entry remains available. No background queue — the user retries later.

An alert fires when a provider reaches 80% of its daily ceiling so the team can react before users see degradation.

#### 4.8.3 Failure-Based Circuit Breaker

Independent of the cost ceiling, each provider has a standard failure circuit breaker: trip after N consecutive failures within a window, half-open after a cooldown, close on success. Defaults are left to implementation. Trip events are logged with `breaker_open` as the reason.

#### 4.8.4 Enforcement Boundary

All caps and ceilings are enforced in **backend application logic**, before the provider call. This is the authoritative enforcement point, robust against client tampering and applied uniformly across web and future native clients.

The MVP does **not** add an edge/gateway rate limit. Burst/bot abuse is mitigated by the per-user caps and the requirement that all users have authenticated accounts (§4.2). Edge rate limiting can be revisited post-MVP if abuse patterns emerge.

#### 4.8.5 Configuration via Database

All values in §4.8.1 and §4.8.2 are stored in the database (`IdentificationLimit`, `ProviderBudget`) so they can be adjusted without redeployment. The application reads these values at request time (with a short in-memory cache to limit DB load). No admin UI is in MVP scope; changes are made directly in the database by the operator.

### 4.9 Multi-Device Behavior

A user may be signed in on N concurrent devices. The MVP supports multi-device usage with the following rules:

- **Catalog and care guide sync**: replicated across devices via the same offline sync mechanism described in §4.4 — eventually consistent, last-write-wins by server timestamp, idempotent by client-generated UUID.
- **Authentication tokens**: per-device. Each login session issues its own JWT (or equivalent) and can be revoked independently.
- **Push subscriptions**: per-device. Each device that grants push permission registers a `PushSubscription` row keyed by `(user_id, device_id)`. Logging out on a device revokes only that device's push subscription.
- **Reminder delivery**: a reminder fires on every device that holds an active push subscription. Tapping "Done" on one device marks the reminder complete everywhere via the standard sync — the other devices clear the entry on next sync.
- **Notification preferences** (global mute, per-plant mute, see §5.4): apply across all of a user's devices, not per-device.

### 4.10 Accessibility

The MVP targets **WCAG 2.1 Level AA** as the baseline. Specific requirements:

- **Screen readers**: semantic HTML throughout; ARIA attributes only where native semantics are insufficient.
- **Font scaling**: respects browser and OS font-size settings up to 200% without layout breakage.
- **Contrast**: AA contrast ratios — 4.5:1 for body text, 3:1 for large text and meaningful UI elements.
- **Keyboard navigation**: every interactive element is reachable and operable via keyboard; visible focus indicators on all focusable elements.
- **Touch targets**: minimum 44×44 px.
- **Color is never the only signal**: toxicity badges already combine icon + colored badge + text per §3.3.2; the same rule applies to all other status indicators (overdue reminders, cap-reached states, draft care guide badges).
- **Forms**: labels and error messages associated programmatically with their inputs.
- **Image alt text**: all UI images carry meaningful alt text. **User-uploaded photos are exempt** from alt text generation in MVP — no auto-captioning is performed. User photos must still expose a programmatic accessible name derived from their surrounding context so screen readers announce something meaningful: catalog cards use the plant's `name` (and `nickname` when present); photo journal entries use the plant name plus the entry date in the user's locale (e.g., "Foto de Maria, 12 de abril de 2026"); identification result thumbnails use the provider-returned common name. The rule is that no user-facing photo element may render with an empty or filename-based accessible name.

### 4.11 Testing Strategy

The MVP ships with three layers of automated testing. All layers must pass before a release is cut.

- **Unit tests** — backend business logic, frontend logic, pure functions, and state machines. Fast, isolated, no external dependencies.
- **Backend integration tests** — exercise HTTP handlers, repositories, and provider adapters against a **real database instance**. Mocking the database is not permitted; a dedicated test database is provisioned per run and migrations are applied as in production. External provider adapters (identification, care guide, billing) are exercised against recorded fixtures or vendor-provided test modes; the database itself is always real. Rationale: mocked databases mask schema, migration, and query-level bugs that only surface in production.
- **End-to-end UI tests (Playwright)** — cover user-facing flows across the PWA, not limited to critical paths. Every primary screen defined in §7 has Playwright coverage for its happy path and its documented failure states (e.g., cap-reached, provider-unavailable, offline queue discard, draft care guide badge, read-only catalog mode).

Concrete coverage thresholds and CI gating details are left to implementation. A release is blocked on any failing test in any layer.

---

## 5. Technical Architecture Constraints

### 5.1 Backend

The backend must serve a PWA today and native apps tomorrow. This means:
- **API-first.** All client-server communication goes through a documented **REST** API. No server-rendered pages, no tight coupling to the web client. Cross-cutting conventions, the canonical error code registry, and rate-limiting policy are defined in [`API-CONTRACT.md`](./API-CONTRACT.md) and are authoritative over any prose in this PRD. Infrastructure, bounded contexts, external services, and CI/CD topology are defined in [`HIGH-LEVEL-DESIGN.md`](./HIGH-LEVEL-DESIGN.md).
- **Stateless API layer.** Authentication via tokens (JWT or similar), no server-side sessions.

### 5.2 Database and Storage Abstraction

Supabase is the infrastructure provider for the MVP (database, auth, storage, realtime). However, the backend must implement a thin abstraction layer over Supabase-specific APIs so that switching to another provider (e.g., a self-hosted PostgreSQL + S3-compatible storage) does not require rewriting business logic.

**What this means in practice:**
- Business logic does not call Supabase client libraries directly. It calls repository/service interfaces.
- Storage operations (upload, download, delete, signed URLs) go through a storage adapter interface.
- Auth operations go through an auth adapter interface.
- Database queries go through a data access layer (repositories), not raw Supabase queries in route handlers.

This is not an ORM mandate. It's a boundary mandate — keep Supabase behind interfaces.

### 5.3 Identification Provider Layer

As described in 3.1.5. The provider pattern must support:
- Adding a new provider without modifying existing providers.
- Configuration-driven provider selection (environment variable or database flag).
- Logging of provider, model, latency, and confidence per request for quality comparison.

### 5.4 Push Notifications

PWA push notifications require a push service (e.g., web-push protocol with VAPID keys). The implementation must account for:
- Browser permission flow. The permission prompt is deferred until the user **creates their first reminder** — that is the contextually appropriate moment, since the user has just chosen to be notified. Permission is never requested at signup, on first visit, or on first identification.
- Fallback for browsers/devices that don't support push: in-app notification center (hosted in §7.1 Home / Daily Summary).
- Notification preferences per user (global mute, per-plant mute).

### 5.5 Care Guide Provider Layer

Mirrors §5.3 (identification providers). The runtime care guide augmentation flow described in §3.3.7 must:
- Sit behind a `CareGuideProvider` interface; business logic does not call LLM SDKs directly.
- Support adding new providers without modifying existing ones.
- Be configuration-driven for provider selection.
- Reuse the §4.8 `ProviderBudget` infrastructure for cost ceilings and circuit breakers.
- Log provider, model, prompt version, latency, estimated cost, and the resulting `CareGuide` row id per request.

**Conceptual contract:**

```
CareGuideProvider:
  augment(species: SpeciesRef, missing_fields: string[], language: string) → CareGuideDraftPayload

CareGuideDraftPayload:
  fields: Record<string, any>   // only the fields that were requested
  citations: Record<string, string>   // source URLs from grounding, where available
  metadata: Record<string, any>
```

Prompts are versioned in source code alongside the application, following the same management policy as identification prompts (§3.1.5).

### 5.6 No Versioned Tech Stack in This Document

Technology and framework versions are deferred to implementation. This PRD defines what is built and the architectural constraints, not which version of which library to use.

---

## 6. Data Model (Conceptual)

See [DATA-MODEL.md](./DATA-MODEL.md) for the full conceptual data model.

---

## 7. Screens (Conceptual)

Not wireframes. A description of what each screen contains and its purpose.

### 7.1 Home / Daily Summary

The default landing screen after login.

**Empty state (no plants in catalog yet):** a single full-bleed CTA — "Identifique sua primeira planta" with the camera button — and nothing else. No tasks section, no notifications section, no catalog link. The first identification creates the first plant; on the next visit, the full layout below replaces the empty state.

**Default state (one or more plants in catalog):**
- **Today's tasks**: reminders due today and overdue items. Only for plants with configured reminders.
- **Recent notifications**: in-app notification center for missed pushes (push delivery failed, permission not granted, or device was offline). Each entry links to the relevant plant or reminder. Tapping clears the entry.
- Quick action: "Identify a plant" (camera button).
- Quick access to the catalog.

### 7.2 Identify

Camera/gallery picker (supports multiple photos) → loading state → results screen (top 3 cards with confidence %) → select result → prompt to add to catalog or dismiss.

If identification fails or returns low-confidence results: guidance to retake the photo + option to add manually.

**Cap-reached state:** When the user has hit their daily or monthly identification cap (§4.8.1), the screen shows a clear message with the reset time and a link to manual entry. No retry button.

**Provider-unavailable state:** When all providers are exhausted by global cost ceilings or circuit breakers (§4.8.2), the screen shows a "temporarily unavailable" message and surfaces manual entry. The user is encouraged to try again later.

### 7.3 Catalog ("Meu Jardim")

Grid or list of the user's plants. Each card shows: cover photo, name, nickname (if set), room/location. Sort control at the top (by name, acquisition date, room/location). Tap a card → plant profile.

### 7.4 Plant Profile

Full detail view for a single plant: photo, name, nickname, room, acquisition date, notes, care card summary (if available), photo journal timeline, active reminders, identification history. Edit button for all user-editable fields.

### 7.5 Care Guide

Detailed care information for a species. Visual icons for each care dimension. Toxicity warning prominently displayed if applicable, with the mandatory disclaimer of §3.3.2 ("Informação gerada por IA — confirme com um veterinário"). On the user's first ever care guide view, a one-time modal surfaces the same disclaimer; acknowledgement is recorded.

Seasonal tips section. Care guides can be reached for any species with a `CareGuide` row in `published` or `draft` status. Drafts (rows with `status = draft` and `source = augmented`, see §3.3.7) display an "Gerado por IA — em revisão" badge at the top of the screen.

### 7.6 Reminders Management

List of all active reminders grouped by plant. Ability to edit frequency or delete. No suggestions or prompts for plants without reminders.

### 7.7 Settings

Account management (email, password). Notification preferences. Partner code input — only available while the user is still inside their original trial window. Entering a code at this stage extends an organic 14-day trial up to 30 days from the original signup date; it never resets the clock and never stacks on a code already applied at signup.

**Subscription & billing section:**
- Current plan and status (e.g., trialing, active, past_due, canceled).
- Renewal date or trial end date.
- Payment method on file (last 4 digits / Pix indicator) with an "update payment method" action.
- Cancel subscription (confirms `current_period_end`; cancellation is at period end, not immediate).
- Reactivate subscription (visible when `canceled` or `expired`).
- Billing history (past invoices/charges).

**Privacy & LGPD section:**
- Export my data (triggers a `DataExportRequest`, delivers a JSON download).
- Delete my account (triggers a `DataDeletionRequest` with a 7-day grace period; clearly states what is deleted and when, and how to cancel).
- Manage consents (toggle each granted consent: identification third-party transfer, push notifications, etc.).
- Link to the privacy policy and terms of service.
- DPO (Encarregado) contact information.

---

## 8. Metrics and Monitoring

**Definitions used throughout this section:**
- **Active user (WAU):** a user who opens the app at least once in a rolling 7-day window. Unless qualified otherwise, "active user" in the tables below refers to this definition.
- **Daily active user (DAU):** a user who opens the app at least once in a UTC calendar day.

### 8.1 Product Metrics

The two trial-to-paid conversion rows below are marked **provisional** because they were chosen without a price in hand. They are placeholders until the §0 pricing blocker resolves; both must be re-baselined against the chosen price before launch, and the revised numbers replace the provisional ones in this table.

| Metric | Target | Rationale |
|---|---|---|
| First identification within 2 min of signup | ≥ 60% of new users | Validates the "aha" moment without onboarding. |
| Plants added to catalog (week 1) | ≥ 3 per active user | Indicates engagement beyond the first interaction. |
| Reminder interaction rate | ≥ 50% of reminders acted on (done/snooze) | Validates reminders are useful, not noise. |
| Trial-to-paid conversion (14-day organic) | ≥ 8% *(provisional — re-baseline after §0 pricing)* | Industry baseline for utility apps. Realistic target depends on the monthly price. |
| Trial-to-paid conversion (30-day partner) | ≥ 15% *(provisional — re-baseline after §0 pricing)* | Longer trial + partner trust should outperform. Realistic target depends on the monthly price. |
| Weekly retention (week 4) | ≥ 40% | Reminders are the retention driver. |
| Daily active users returning via reminder | Track, no target | Measures reminder effectiveness as a re-engagement channel. |
| Care guide coverage hit rate | Track, no target | % of identifications that have a matching care guide. Drives content prioritization. |

### 8.2 Identification Quality Metrics

| Metric | Purpose |
|---|---|
| Confidence distribution per provider | Compare provider accuracy profiles. Detect degradation over time. |
| Manual correction rate | % of identifications where the user overrides the AI result. High rate signals quality problems. |
| Identification success rate | % of attempts that return at least 1 result above threshold. |
| Provider latency (p50, p95, p99) | Monitor response times. Alert on degradation. |
| Provider error rate | % of API calls that fail (timeout, 5xx, rate limit). |
| Photos per identification | Average number of photos submitted. Correlate with accuracy. |
| Species flagged as missing care guide | Absolute count and trend. Prioritization input for content work. |
| Per-user cap hit rate | % of identification requests rejected by per-user cap (§4.8.1). High rate signals caps may be too tight or abuse. |
| Provider breaker open minutes / day | Total minutes per UTC day a provider was unavailable (cost ceiling or circuit breaker). Capacity planning input. |
| Augmentation attempt rate | Number of `CareGuideProvider` augmentation requests per day (§3.3.7). |
| Augmentation success rate | % of augmentation attempts that produced a usable draft. |
| Augmentation cost per species | Average estimated cost to augment a single species. Sustainability input. |

### 8.3 Operational Metrics

| Metric | Purpose |
|---|---|
| API response time (p50, p95, p99) | Overall backend health. |
| Push notification delivery rate | % of scheduled notifications successfully delivered. Critical for PWA push reliability. |
| Push notification permission grant rate | % of users who accept push permissions when prompted. |
| Offline queue sync success rate | % of queued offline actions that sync successfully on reconnect. |
| Image upload success rate | % of photo uploads that complete without error. |
| Image storage growth rate | Monthly storage consumption trend. Input for cost planning. |
| Authentication success rate | Login/signup failures. Detect auth provider issues. |
| Error rate by endpoint | Identify problematic API routes. |

### 8.4 Business Metrics

| Metric | Purpose |
|---|---|
| Signup volume (daily/weekly) | Growth tracking. Segment by organic vs. partner. |
| Trial start → first action time | How quickly new users engage. Proxy for activation quality. |
| Churn rate (monthly) | % of paid subscribers who cancel. |
| Partner code redemption rate | Volume of extended trials activated. Track per partner. |
| Subscription MRR | Monthly recurring revenue. |
| Cost per identification | Infrastructure cost per AI API call. Track per provider. |
| Cost per active user | Total infra cost / active users. Sustainability indicator. |
| Failed-payment recovery rate | % of failed charges recovered during the 7-day dunning window. Validates dunning effectiveness. |
| Involuntary churn rate | % of cancellations driven by payment failure (vs. user-initiated). |
| Dunning success rate | % of `past_due` subscriptions that return to `active`. |

---

## 9. Open Questions

1. **iOS PWA push notifications:** Safari's support for web push has improved but still has edge cases. The specific fallback strategy is left to implementation.
2. **Retention period values:** Concrete retention windows for operational logs, identification history, and post-deletion audit records need to be defined and reflected in deletion jobs.

Additional items that block launch (pricing, NFS-e, DPO appointment, privacy policy authoring) are tracked in §0 Launch Blockers, not here.

---

## 10. Glossary

Terms used throughout this PRD. Implementation should use these definitions consistently.

- **Plant** — a catalog entry; one row in a user's `Plant` table representing a specific instance the user owns.
- **Species** — reference data shared across users; the botanical identity (`Species` table).
- **Identification attempt** — a single call to one identification provider.
- **Identification** — a user-initiated request, possibly composed of multiple attempts (retries, provider failover); one row in the `Identification` table.
- **Care guide** — a `CareGuide` row in `published` or `draft` status.
- **Care card** — the UI surface that renders a care guide on the plant profile.
- **Reminder** — a scheduled task tied to a single plant (`Reminder` table).
- **Notification** — push or in-app delivery of a reminder.
- **Trial** — a subscription in `trialing` state (see §4.7.2).
- **Active subscription** — a subscription in `active` state (see §4.7.2).
- **Active user (WAU) / Daily active user (DAU)** — see §8 definitions.
- **Provider** — a third-party service accessed through a Provider abstraction (identification §3.1.5, care guide §5.5, billing §4.7.1).
- **Augmentation** — runtime LLM-driven completion of missing care guide fields (§3.3.7).
- **Read-only catalog mode** — the app state when a subscription is not in `trialing` or `active` (§4.7.3).
