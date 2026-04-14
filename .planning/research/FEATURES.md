# Feature Research

**Domain:** Plant identification + care-guide + reminder PWA (Brazilian beginner audience)
**Researched:** 2026-04-14
**Confidence:** HIGH (competitive set is well-documented; PRD is exhaustive)

---

## Competitive Set Surveyed

| App | Positioning | Notable |
|---|---|---|
| **PictureThis** | Market leader in accuracy (400k+ species, 98%+ claim), aggressive subscription | Disease diagnosis, expert chat, weed ID, toxicity warnings, water/light tracking |
| **PlantNet** | Free citizen-science, botanist-grade, regional flora filters | No paywall, no care guides, no reminders — pure ID |
| **Planta** | Care-first, 100+ variable algorithm, local weather/climate, "Quick Add Tool" (2026) | Smart reminders (water/fertilize/mist/repot/clean), Plant Journal, Dr. Planta disease tool, light meter, community |
| **Greg** | ML-personalized watering, "zero-guesswork" | Custom per-plant watering plans from home environment + species + size; 8–9am local delivery + afternoon follow-up |
| **PlantIn** | High accuracy (99% claim, 24k species), feature-dense | Light meter, watering reminders, moon calendar, botanist chat, light meter |
| **Blossom** | 10k+ species, reminder + disease features mostly paywalled | 3 free IDs then paywall; common dark-pattern complaints |
| **PlantSnap** | Older ID-first app, 600k+ species claim | Mostly ID, care guides thin |

**Brazilian-market reference points:** No pt-BR-native app dominates. LGPD now expects pt-BR privacy notices, opt-in consent per purpose (not grouped), revocation paths. Pix + Pix Automático (2025) is now a viable recurring-billing method — Stripe supports it (the PRD commits to card + Pix).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these in 2026 and users immediately feel the product is incomplete or broken. Unless otherwise noted, Folhário's PRD already covers them.

| Feature | Why Expected | Complexity | PRD status / notes |
|---|---|---|---|
| Photo-based plant identification with confidence-ranked top results | Category-defining feature; the reason users open the app | HIGH | **Covered** — §6. Top 3 results, `min_confidence=0.30` floor, provider abstraction (Plant ID + OpenAI-compat), cloud-only |
| Camera OR gallery picker, multi-photo per identification | Beginners take 3 bad shots; one good photo isn't enough | LOW | **Covered** — §6/§16, multi-photo multipart upload, static capture guide (leaf + flower + whole plant) |
| Personal plant catalog ("my garden") with cover photo + notes | Retention anchor; without it, app is a toy | MEDIUM | **Covered** — §7 "Meu Jardim" with name, nickname, location, acquisition_date, notes |
| Per-plant care guide (water/light/soil/temp/humidity/toxicity/difficulty) | Beginners need to know what to DO after identification | MEDIUM | **Covered** — §8 7-field structure + seasonal tips + compatibility |
| Watering reminders with customizable frequency | The "won't kill it" promise; reminders = retention engine | MEDIUM | **Covered** — §9 watering + fertilization, frequency prefilled from care guide |
| Push notification delivery for reminders | Users won't open the app unprompted | MEDIUM | **Covered** — §15 single daily nudge + VAPID/web-push |
| Done/Snooze actions on reminders | Without these, reminders become anxiety | LOW | **Covered** — §9 in-app only, 1h/3h/tomorrow snooze options |
| Overdue/due-today visibility on home screen | First thing a returning user should see | LOW | **Covered** — §16 Home "Hoje" list |
| Photo journal per plant (growth tracking) | Emotional lock-in; "look how it grew" is the moment of love | MEDIUM | **Covered** — §7 `PhotoEntry`, reverse-chrono |
| Toxicity warnings (pets + children) | Safety-critical; missing is liability and trust failure | MEDIUM | **Covered and hardened** — §8 redundant signals, disclaimer, one-time modal |
| Account system with secure auth | Baseline for paid software | MEDIUM | **Covered** — §12 email+password + Google OAuth, email-verification gate |
| Subscription billing with clear trial + cancel path | Table stakes in 2026 post-FTC click-to-cancel | MEDIUM | **Covered** — §12 Stripe, 14/30-day trial, Settings cancel, no dark patterns |
| Offline browsing of previously-viewed catalog + care guides | Users are in the garden without signal | HIGH | **Covered** — §10 IndexedDB cache, offline queue for mutations |
| Plant identification history | Users want to re-check what they scanned last week | LOW | **Covered** — §6 every attempt persisted, success + failure browsable |
| Manual plant entry (no identification) | Users know what some plants already are | LOW | **Covered** — §7 manual create with name + photo |
| Room/location organization | Users with >5 plants need this | LOW | **Covered** — §7 combined picker with user history + defaults + free text |
| Plant profile edit (name, nickname, notes) | Users rename plants immediately | LOW | **Covered** — §7/§16 inline edit |
| Brand-correct pt-BR (not machine translation) | Brazilian users detect bad pt-BR instantly; "jardim" not "garden" | MEDIUM | **Covered** — §1 i18n layer day one, pt-BR only at launch, voice spec ("knowledgeable friend") |
| LGPD-compliant consent + privacy policy in pt-BR | Legally required, ANPD enforcement has intensified 2025–2026 | HIGH | **Covered** — §13 per-purpose consent, ConsentLog, Art. 33 transfer disclosure |
| LGPD data export + deletion rights | Required by Art. 18; users increasingly check | MEDIUM | **Covered** — §13 JSON + photos zip, 7-day grace |
| Pix as payment method | 76%+ of Brazilian e-commerce uses Pix; card-only is a conversion killer | MEDIUM | **Covered** — §12 Stripe card + Pix |
| Multi-device sync | Users use phone + tablet; PWA makes this free-ish | MEDIUM | **Covered** — §14 per-device JWT, catalog sync via offline queue |
| Password reset flow | Required the first time a user forgets | LOW | **Covered** — §12 unauthed reset + authed change |

**Table-stakes gap analysis — what the PRD may have under-specified:**

| Potential gap | Why this might matter | Recommendation for requirements phase |
|---|---|---|
| **Plant disease diagnosis ("why is my plant dying?")** | Every mainstream competitor (PictureThis, Planta's "Dr. Planta", PlantIn, Greg, FloraMate) ships disease diagnosis. Brazilian beginners googling "manchas na minha costela" expect it. This is the single most common feature the PRD omits. | **Flag for v1.x** — decide explicitly: (a) ship in MVP and extend the `IdentificationProvider` interface, (b) defer post-launch and state it as out-of-scope with rationale, (c) partially ship as "take a photo of the problem → augmented LLM diagnosis with disclaimer." Option (b) is PRD-consistent (scope discipline), but leaving the decision implicit will surface as a feature request within week 1 of launch. |
| **Light meter (lux via camera sensor)** | Planta, PlantIn, FloraMate, Plantora all ship one. Beginners don't know "bright indirect light." This feature is cheap (WebRTC + camera API on PWA) and high-perceived-value. | **Flag for v1.x decision** — cheap to add post-launch. Not MVP. |
| **Photo capture guide overlay (leaf/flower/whole-plant hint during camera)** | PRD §16 mentions "static capture guide visible" but doesn't specify whether it's a persistent overlay during camera use or just a pre-capture screen. | Clarify in requirements: is it a silhouette overlay (like ID.me docs) or static help text? Accuracy impact is meaningful. |
| **Home-screen onboarding beyond "empty state" CTA** | PRD explicitly bans a forced onboarding tour (good). But a brand-new user needs to understand "first identify, then the reminder screen will ask for push permission." Is the empty-state CTA self-explanatory enough? | Requirements phase: validate with a prototype that the empty-home CTA alone gets users to first identification in <2 min. If not, a one-screen "how it works" (dismissible, not forced) may be required without violating the anti-pattern. |
| **Contextual help / "why is this asking me?"** | LGPD consent modals and push permission prompts often need a "learn more" inline expansion. PRD mentions modals but not secondary explanation surfaces. | Clarify: consent modal wording + links to privacy policy; push prompt copy. |
| **Weed / "is this plant a weed" classification** | PictureThis and PlantNet surface this. Brazilian audiences split on whether a plant in the quintal is "erva daninha" or desirable. | Not MVP. Out-of-scope candidate. |
| **Empty-state illustrations in non-Home screens** | PRD mentions "custom Sage line art" illustrations and bans stock photos; ensure every list (catalog, reminders, history, journal) has an illustration spec | Design system task, low cost, high brand impact. |
| **Notification sound / haptic preference** | PRD §14 says prefs are "global mute + per-plant mute" only. Users often want quiet hours or specific haptic preferences. | Not MVP. iOS PWA limits this anyway. |
| **Account recovery when email lost** | Edge case but important for Brazilian users who change employers (lose work email) or operators (Hotmail → Gmail migrations still happen). Change-email is explicitly post-MVP. | Risk: user locked out of paid sub. Mitigation: document a manual support path. Settings "contact support" link. |
| **Email verification resend + rate limit** | PRD §16 mentions "resend-verification button" in the unverified blocker, but rate limiting the resend endpoint is not called out — throttle §5 only covers login + signup. | Clarify in requirements: is resend-verification subject to public-auth-throttle? If a user verifies then loses the email, can they trigger unlimited Resend calls? |
| **"First-time tip" on reminder creation** | PRD defers push permission to first reminder save. Users need to understand what "Done" vs "Snooze" do in-app. One-time coach marks acceptable? | Clarify in requirements. PRD bans forced tours but inline tooltips are different. |

---

### Differentiators (Folhário's Committed Competitive Advantage)

These are the features that distinguish Folhário. The PRD is highly opinionated here — most differentiators are ETHICAL/TRUST positioning, not technical firsts.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Honest AI: visible confidence% ladder + Gerado por IA badge** | Every competitor (PictureThis, PlantIn, Blossom) hides AI provenance or shows fake certainty. Folhário shows top-3 with real confidence scores and marks LLM-augmented care guides permanently. This is trust differentiation. | MEDIUM | §1 non-negotiable, §17 confidence ladder design token, §8 persistent badge on `source=augmented` rows |
| **No freemium — single paid tier** | Blossom (3 free IDs), PlantIn, PictureThis all use freemium guilt-trips. Folhário commits to a clean try/pay model with a 14-day (organic) or 30-day (partner code) trial. | LOW (business model, not code) | §1, §12. Requires pricing decision (launch blocker) |
| **No data hostage — read-only catalog on billing lapse** | Competitors lock the catalog when subscriptions lapse, effectively extorting re-subscription. Folhário preserves VIEW access to plants/photos/journal/care guides forever, only blocking mutations + identification. | MEDIUM | §12 read-only catalog mode, `subscription_required` vs `read_only_mode` errors |
| **Toxicity warnings with WCAG-grade redundant signals + AI disclaimer** | PictureThis shows toxicity as a text line. Folhário mandates icon + color + text + striped border + SR alert + haptic + "confirme com veterinário" disclaimer, top of every care card. Safety-critical for pet owners + toddlers. | MEDIUM | §8/§17/§18; one-time first-view modal, persisted ack |
| **Single daily nudge (never per-reminder)** | Greg sends morning + afternoon pings per plant. Planta sends per-task. Result: users disable notifications within a week. Folhário sends ONE nudge per user per day (only when ≥1 reminder is due), deferred until first reminder creation. This preserves the permission. | MEDIUM | §15 + §14 (multi-device fan-out), push permission lifecycle |
| **Push permission deferred to first reminder creation** | Classic mistake: ask at signup → user denies → nothing can re-prompt. Folhário asks only when the user has just created something they NEED notifications for. | LOW | §1 non-negotiable, §16 Reminders Management, "first reminder save" trigger |
| **Curated pt-BR care-guide corpus (≥200 species)** | Every competitor uses machine-translated English copy for pt-BR. Folhário hand-curates 200+ species in real pt-BR before launch. Founder-owned, LAUNCH BLOCKER. | HIGH (content, not code) | §8 Track 1 + §24 launch blocker |
| **LGPD compliance as a first-class UX** | Most competitors bolt LGPD on as a cookie banner. Folhário treats it as a core flow: per-purpose consent gates, Art. 33 disclosure before first upload, 7-day deletion grace, per-consent revocation that never breaks catalog view. | HIGH | §13 full implementation + §23 AC-LGPD |
| **Mobile-first PWA, tablet-width on desktop** | Competitors either ship native-only (no PWA install) or build wide-screen desktop layouts that fragment attention. Folhário is ONE shape: a mobile app, installable via PWA, bottom nav on desktop too. | MEDIUM | §1 non-negotiable, §17 safe areas + responsive |
| **Cost-cap enforcement BEFORE provider call** | Not user-visible but enables the single-tier pricing promise. DB-driven caps (per-user daily + period, per-provider global USD ceiling) prevent runaway bills, which is why freemium competitors exist. | MEDIUM | §6 cost controls, §23 AC-COST |
| **Voice & brand: "Sunlit morning on a Brazilian veranda"** | Differentiation beyond features: warm humanist tone in pt-BR, Source Serif 4 + Plus Jakarta Sans, Paper Cream + Canopy Green, photography-first, Sage line-art illustrations, spring-physics motion, one perpetual micro-interaction. Competes with clinical wellness-app aesthetic via culture. | MEDIUM | §17 design system, §1 voice spec |
| **Offline-first with durable queue + idempotency** | Planta and PictureThis fail hard offline. Folhário queues photo adds, reminder-done actions, edits via IndexedDB with client-UUID idempotency. Read access to catalog + care guides stays usable in the garden. | HIGH | §10 offline queue, §23 AC-OFF |
| **Partner code trial (30 days)** | Acquisition lever for plant shops / garden centers / influencers. Late-entry allowed strictly within trial window. 14-day organic vs 30-day partner. | MEDIUM | §12 partner codes, §23 AC-SUB-003..007 |
| **Provider abstraction with graceful fallover + manual entry always available** | When Plant ID is down, Folhário routes to OpenAI-compat; when both are down, the UI offers manual plant entry. Competitors just fail. | MEDIUM | §1 non-negotiable #7, §6 fallover logic |

**Differentiators the PRD MAY not have emphasized enough** (for requirements phase):

- **Pix + Pix Automático support as billing-flow differentiator** — PRD lists "card + Pix" but doesn't call out whether Pix Automático (recurring Pix) is used. As of 2025, Stripe supports Pix and BCB rolled out Pix Automático for recurring billing. Worth confirming whether Pix here means (a) one-time Pix for each renewal or (b) Pix Automático. One-time Pix creates a manual billing cycle that may conflict with the dunning model (§12 "Stripe 4 retries over 7 days"). Recommendation: confirm with Stripe docs + BillingEvent handling.
- **pt-BR care-guide voice spec** — PRD commits to a "knowledgeable friend" voice but the differentiator only lands if the curated corpus delivers this consistently. 200 care guides × 7 fields × voice check is a content QA gate that should be explicit.
- **WCAG AA as ship blocker** — the PRD flags this as non-negotiable #9 but doesn't position it as a differentiator. Most plant apps fail AA (color-only toxicity indicators, low-contrast button states). Worth marketing.

---

### Anti-Features (Commonly Requested, Rightly Excluded)

All of these are explicitly OUT OF SCOPE in the PRD §1 anti-patterns and PROJECT.md "Out of Scope." Validation below.

| Anti-feature | Why commonly requested | Why problematic | Folhário's alternative |
|---|---|---|---|
| **Freemium tier (3 free IDs then paywall)** | Standard SaaS "free funnel" intuition; Blossom, PictureThis, PlantIn all use it | Dilutes the <2-min promise with paywall friction. Free users cost ID-provider dollars + LGPD compliance bill + support load without converting. Creates pressure to add dark patterns on the upgrade prompt. | Single paid tier with 14/30-day trial. PRD §1, validated by FTC 2024 study showing 76% of freemium apps use dark patterns |
| **Forced onboarding tour / coach marks carousel** | "Users are confused; walk them through it" | Tour completion correlates with churn, not retention. Users skip or resent it. The real fix is self-explanatory first screen. | Empty-home CTA "Identifique sua primeira planta" — ONE button, camera icon. If a user can't figure it out, the product is wrong, not the tutorial |
| **Dark patterns on cancel / delete** | Obvious retention lever; "hide cancel button" | FTC click-to-cancel rule (2024), Brazilian CDC equivalents, trust destruction. Leads to App Store 1-star reviews specifically about billing. | Clean Settings cancel flow, confirmation shows `current_period_end`, one-tap reactivate if they change their mind |
| **Auto-escalation / shaming on overdue reminders** | Duolingo-style "your streak is dying!" | Plant care is already anxiety-inducing for beginners. Shaming causes uninstall, not action. Plant death happens; shaming the user is cruel. | Overdue reminders stay visually distinct but don't escalate, don't auto-mute, don't auto-complete. §9 rule: "doesn't change visual weight as it ages" |
| **Fake high confidence numbers (e.g., always "98%")** | Competitors do it because beginners want certainty | Erodes trust the first time the plant is wrong. Violates LGPD Art. 20 spirit around explainable automated decisions. | Real confidence scores from provider, threshold at 0.30, top-3 with true %. Users learn to interpret them |
| **Hiding AI provenance on augmented care guides** | Cleaner UI; "users don't want to know" | Users who notice feel lied to. Regulatory risk (AI Act-adjacent scrutiny). Trust moat. | Permanent "Gerado por IA" badge on `source=augmented` rows, never removable |
| **Per-reminder notification times** | "I want fertilizer at 8am, watering at 6pm" | Adds UX complexity (per-reminder time picker), permission confusion, multiple daily pings → permission withdrawal | One global `User.notification_time_local` (default 09:00), editable in Settings, applies to all reminders |
| **Real-time chat / botanist consultation** | PictureThis sells this as premium | Outside the core loop (identify → catalog → care → remind). Requires human staff, SLA management, translation to pt-BR, 24/7 coverage | Care guides + curated corpus. If users want expert help, they can use other channels |
| **Travel-aware timezone handling** | "I'm in Paris but my plants are in São Paulo" | Traveling users aren't tending plants. Timezone math complexity multiplies edge cases. Fix is worse than problem | `User.timezone` editable in Settings, changes apply to FUTURE computations only. No retroactive shift |
| **Done/Snooze controls inside the push notification payload** | Fancy "rich notification" feature | Push is unreliable; deep-linking from payload actions is fragile; creates two sources of truth (payload vs Home list). Home list is simpler and always correct. | Push is a nudge to open the app; all actions in-app only |
| **Suggestions / prompts to create reminders on plants that have none** | "Users forget to set reminders" | Nagging. User-initiated only is a respect boundary. Empty plants without reminders may be deliberate (cactus, fake plant, seasonal dormancy) | Reminder creation is user-initiated from plant profile only |
| **Native iOS/Android apps (MVP)** | "PWAs are worse than native" | PWA ships faster + cheaper + installable on both platforms. iOS PWA push has improved. Native door kept open via architecture (adapters, per-device JWT, IANA tz). | PWA first, native later after validation |
| **On-device plant identification** | "Privacy + offline" | Current on-device models don't match cloud accuracy; beginners won't forgive wrong IDs to save a server round-trip. LGPD-wise, international transfer disclosure handles the legitimate concern | Cloud-only with Art. 33 consent gate + EXIF/GPS stripping |
| **Anonymous / guest accounts** | "Reduce signup friction" | Trial requires a real account to bind subscription state. Anonymous users create GDPR-adjacent headaches with no conversion | Real account required; Google OAuth for fastest signup |
| **Logout-all-devices** | Nice-to-have security | Per-device JWTs already revocable independently. Global invalidation adds a session-registry table for marginal value | Post-MVP |
| **Change-email flow** | Users switch emails over years | Credential management surface area increases (verification, takeover attacks, edge cases). Post-MVP | Manual support path if needed |
| **GPS / geolocation features** | "Climate-aware care recommendations" | LGPD data-minimization, EXIF GPS stripping is already in place; pulling geolocation back in contradicts the privacy-first stance | Users enter location/room manually; climate awareness via fixed SH seasonal tips |
| **Stock photo empty states** | "Fill the screen with something" | Brand discipline: Sage line art illustrations only. Stock photos break the brand atmosphere | Custom illustrations per empty state |
| **Wide-screen desktop layouts** | "Utilize the viewport" | Folhário is ONE shape across devices. Maintaining two layouts = double the design debt. Tablet-width centered is the mobile-first promise kept | Desktop = centered tablet with bg fill sides |
| **Emojis in UI copy** | "Warmer tone" | Brand guardrail — Lucide icons only. Emojis don't align with the humanist-but-clinical typography pairing | Lucide icons with 1.5px stroke, rounded caps |
| **Editor review queue for augmented care guides** | "AI output needs human approval" | Queue adds latency (users see "no care guide" for hours/days). Permanent "Gerado por IA" badge is the honest alternative. Review can happen async, out-of-band | Augmented guides go live immediately; permanent AI badge; flag system for corrections |

---

## Feature Dependencies

```
Account (§12)
  └─ Email verification (§12)
       └─ LGPD consent (§13)
            └─ Identification (§6)
                 ├─ Plant creation from result (§7)
                 │    └─ Photo journal (§7)
                 │    └─ Reminder creation (§9)
                 │         └─ Push permission prompt (§15)
                 │              └─ Daily nudge dispatch (§15)
                 └─ Care guide display (§8)
                      └─ Toxicity disclaimer modal (first view) (§8)

Subscription (§12) ──gates──> Identification (§6) AND Reminder delivery (§9)
                    ──preserves──> Catalog view (§7) AND Care guide view (§8)

Offline queue (§10) ──enables──> Reminder done/add-photo while offline
                     ──blocks──> New identification offline (clear error)

Curated care corpus (§8 Track 1) ──enables──> Care guide display without LLM calls
Runtime augmentation (§8 Track 2) ──fills gaps in──> Curated corpus (async, off critical path)

Cost caps (§6 cost controls) ──gate──> Provider dispatch (before any call)
Circuit breaker (§6) ──protects──> Provider dispatch (after N failures)
Provider abstraction (§6) ──enables──> Graceful fallover AND manual entry fallback

Multi-device sync (§14) ──requires──> Offline queue (§10) + per-device JWT (§12)

LGPD rights (§13)
  ├─ Export ──requires──> data-exports bucket + Inngest function
  ├─ Deletion ──requires──> step.sleepUntil(7d) + cancel path
  └─ Consent revocation ──preserves──> Catalog view (never breaks access)
```

### Dependency Notes

- **Email verification gates EVERYTHING** except Settings + resend. This is the <2-min clock's start point (§1 non-negotiable #1). Without verification, the user sees only the unverified blocker screen.
- **LGPD consent gates identification** (Art. 33 international transfer). First-ever identify requires consent modal before provider dispatch.
- **Subscription state (trialing/active) gates identification + reminders** but never gates catalog VIEW or care-guide VIEW. This is the "no data hostage" rule.
- **Push permission depends on first reminder creation**, not signup. This is the key differentiator against competitors who burn the permission at signup.
- **Curated corpus is a launch blocker** (§24) because runtime augmentation without a fallback means the first 200 users see "no care guide" on every identification.
- **Offline queue enables multi-device sync**: both rely on client-UUID idempotency and server-side LWW by server timestamp.
- **Cost caps must resolve BEFORE provider dispatch** (§23 AC-COST-003); this is the single business-model-enabling invariant.

### Conflicts

- **Freemium conflicts with <2-min promise** — paywall friction extends time-to-value. Picking one forces the other out.
- **Editor review queue conflicts with "care guide available on first view"** — async review adds hours/days of "no care guide" state.
- **Per-reminder times conflict with single daily nudge** — multiple wake times would mean multiple daily pushes, burning permission.
- **Travel-aware tz conflicts with simple UTC dispatcher** — retroactive shifts break `next_due_at` precomputation.

---

## MVP Definition

### Launch With (v1) — committed in PROJECT.md Active list

Minimum viable. Cannot validate the core hypothesis without these.

- [ ] Email + Google OAuth signup with LGPD consent flow — gates all else
- [ ] Email verification gate (email+password) — starts the <2-min clock
- [ ] Cloud plant identification (Plant ID + OpenAI-compat fallback, top-3, confidence ladder)
- [ ] Cost caps (per-user daily + period, per-provider USD ceiling) before provider dispatch
- [ ] LGPD consent gate for first identification (Art. 33)
- [ ] Meu Jardim catalog (plants, cover, room, acquisition date, notes, sort)
- [ ] Curated care guides (≥200 species, pt-BR, shipped pre-launch) — LAUNCH BLOCKER
- [ ] Runtime AI-augmented care guides with persistent "Gerado por IA" badge
- [ ] Toxicity warnings (redundant signals + disclaimer + one-time modal)
- [ ] Watering + fertilization reminders with advance rules
- [ ] Single daily push nudge (deferred permission, one per user-day)
- [ ] Photo journal per plant
- [ ] Multi-device sync (per-device JWT, independent push sub)
- [ ] Offline queue with client-UUID idempotency
- [ ] Stripe subscription (card + Pix), single tier, 14/30-day trial, webhook-driven state
- [ ] Read-only catalog mode on billing lapse (never hold data hostage)
- [ ] LGPD data export + 7-day-grace deletion + per-consent revocation
- [ ] Password reset + change password (email+password accounts)
- [ ] Partner code flow (signup + late entry in trial window)
- [ ] Age gate ≥13 (Art. 14)
- [ ] PWA shell (service worker, manifest, installable, app-update toast)
- [ ] Image handling (client compression, EXIF/GPS stripping, server reject defense)
- [ ] Design system (Paper Cream + Canopy Green, light + dark, WCAG AA)
- [ ] Bottom-nav-only navigation (4 tabs, tablet-width desktop)
- [ ] i18n layer day one (pt-BR only ships)

**Added by this research — requirements-phase decisions needed:**

- [ ] **Plant disease diagnosis — MVP yes or no?** (flag for explicit out-of-scope decision; this is the biggest feature gap vs. competitors)
- [ ] **Rate limit for email verification resend endpoint** (safety gap in §5 throttle spec)
- [ ] **Pix Automático vs. one-time Pix for renewals** (affects dunning + billing flow)
- [ ] **Photo capture guide overlay: static screen or camera-view overlay?** (affects ID accuracy)
- [ ] **Empty-state illustration spec per surface** (design system task)

### Add After Validation (v1.x)

Features to add once core is working and metrics (week-4 retention ≥40%, trial-to-paid ≥8%) clear or stall.

- [ ] **Disease diagnosis flow** — if user-research after launch shows the #1 feature request. Reuse `IdentificationProvider` abstraction with a new `purpose=diagnosis` budget row.
- [ ] **Light meter** — cheap camera-sensor feature; high perceived value. Add when validated demand exists.
- [ ] **Change-email flow** — when support ticket volume justifies
- [ ] **Logout-all-devices** — when a security incident or user request justifies
- [ ] **PostHog session replay** — currently off in MVP (§25 open question)
- [ ] **Admin UI for caps/budgets** — when DB writes become operationally painful
- [ ] **Editor review queue for augmented care guides** — only if factual-error complaints emerge
- [ ] **Per-plant notification preferences beyond mute** — only if users request
- [ ] **Dark-mode refinement / light-mode polish** — hand-tuned "veranda at dusk" already in spec; may need iteration
- [ ] **Notification throttles / quiet hours** — if complaints about 9am timing emerge

### Future Consideration (v2+)

Defer until PMF is established.

- [ ] **Native iOS/Android apps** — architecture already keeps the door open
- [ ] **Community features (sharing, social)** — outside core loop
- [ ] **Locales beyond pt-BR** — i18n layer is built, new locale files are cheap; content corpus is expensive
- [ ] **Weed identification**
- [ ] **Plant marketplace / commerce**
- [ ] **Real-time expert chat** — probably never (anti-feature)
- [ ] **AR features (plant-in-your-room preview, etc.)**
- [ ] **Climate/weather-aware adaptive schedules** (requires geolocation → LGPD regression)
- [ ] **Multi-user / household shared plants**
- [ ] **Plant "health score" tracking over time**

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Plant identification (provider abstraction + fallover) | HIGH | HIGH | P1 |
| Curated care guide corpus (200+ species) | HIGH | HIGH | P1 (content, launch blocker) |
| Meu Jardim catalog + plant profile | HIGH | MEDIUM | P1 |
| Watering/fertilization reminders + daily nudge push | HIGH | MEDIUM | P1 |
| Toxicity warnings with redundant signals | HIGH (safety) | MEDIUM | P1 |
| LGPD consent + export + deletion + grace period | HIGH (legal) | HIGH | P1 |
| Offline queue + multi-device sync | HIGH | HIGH | P1 |
| Stripe billing (card + Pix) + trial + read-only mode | HIGH | HIGH | P1 |
| Email verification gate + auth flows | HIGH | MEDIUM | P1 |
| Cost caps (per-user + per-provider) before dispatch | HIGH (business model) | MEDIUM | P1 |
| PWA shell + i18n layer + design system | HIGH | HIGH | P1 |
| Photo journal | MEDIUM | LOW | P1 (cheap, high emotional value) |
| Partner code 30-day trial | MEDIUM | LOW | P1 (acquisition lever) |
| Manual plant entry fallback | MEDIUM | LOW | P1 (required by non-negotiable #7) |
| Identification history view | MEDIUM | LOW | P1 |
| Disease diagnosis | HIGH | HIGH | **P2 (decide explicitly in requirements)** |
| Light meter | MEDIUM | LOW | P2 |
| Photo capture overlay during camera | MEDIUM | MEDIUM | P2 (accuracy impact) |
| Change-email flow | LOW | MEDIUM | P3 |
| Logout-all-devices | LOW | MEDIUM | P3 |
| Session replay | LOW | LOW | P3 |
| Admin UI for caps | LOW | MEDIUM | P3 |
| Editor review queue | LOW | HIGH | P3 (only if factual errors emerge) |
| Community / social | LOW (scope creep) | HIGH | P3/never |
| Expert chat | LOW (anti-feature) | HIGH | never |
| On-device ID | LOW | HIGH | never |
| Freemium tier | NEGATIVE | MEDIUM | never |

**Priority key:**
- P1: Must have for launch (committed in PRD + PROJECT.md Active)
- P2: Should have, add when possible post-launch
- P3: Nice to have, future consideration
- never: Anti-feature, documented out-of-scope

---

## Competitor Feature Analysis

| Feature | PictureThis | Planta | Greg | PlantIn | PlantNet | **Folhário** |
|---|---|---|---|---|---|---|
| Plant identification | 400k species, 98% claim | AI ID + Quick Add env detection | ML-personalized | 24k species, 99% claim | Citizen-science, regional flora | Plant ID + OpenAI-compat, top-3 with real confidence, min 0.30 |
| Care guides | Generic, thin pt-BR | 100+ variable algorithm, climate-aware | Home-environment-personalized | Full care tools, botanist chat | None | Curated 200+ pt-BR + AI-augmented w/ permanent badge |
| Reminders | Water tracker | Water + fertilize + mist + repot + clean | Water-first, custom plan, 8–9am + PM follow-up | Water + fertilize + moon calendar | None | Water + fertilize, single daily nudge at user-chosen time |
| Disease diagnosis | YES (photo-based) | YES ("Dr. Planta") | NO | YES | NO | **NOT IN MVP — decision pending** |
| Light meter | NO | YES | NO | YES | NO | NO (v1.x candidate) |
| Toxicity warnings | Text-only | Basic | NO prominent | YES | NO | **Redundant signals + disclaimer (differentiator)** |
| Photo journal | YES (premium) | YES | YES | YES (premium) | NO | YES (free in trial + paid) |
| Community | Forum + expert chat | Discussion community | Limited | Botanist chat | Contribution-based | **None (anti-feature)** |
| Pricing model | Freemium + trial + subscription | Freemium + trial + subscription | Freemium + trial + subscription | 3 free + subscription | Free | **Single paid tier, no freemium** |
| LGPD-ready pt-BR | No (translated) | No (translated) | No (translated) | No (translated) | No | **Yes (first-class)** |
| Pix payment | No | No | No | No | N/A | **Yes** |
| Offline catalog | Limited | Limited | Limited | Limited | Yes (cached) | **Offline queue + IndexedDB sync** |
| "No dark patterns on cancel" | Complaints filed | Complaints filed | Few complaints | Complaints filed | N/A | **Committed** |
| AI provenance visible | No | No | No | No | N/A | **Permanent Gerado por IA badge** |
| Honest confidence % | No | No | N/A | No | Yes | **Yes, with 0.30 floor** |
| PWA / installable | Native only | Native only | Native only | Native only | Native only | **PWA first (differentiator in BR market)** |

---

## Brazilian Market Specifics

These are expectations that will trip a US-native product entering the Brazilian beginner plant-parent segment:

1. **Pix is table stakes, not a feature.** Card-only checkout is a conversion killer. PRD covers this (§12).
2. **Pix Automático (recurring Pix) rolled out by BCB in 2025.** Whether Folhário uses it or falls back to per-cycle Pix affects the dunning flow. Clarify in requirements.
3. **NFS-e (electronic service invoice) is a legal requirement for paid services.** Stripe doesn't issue these. PRD §24 lists this as a launch blocker (correct); owner "TBD" means it's unresolved.
4. **pt-BR quality must be real, not machine-translated.** "Molhar" vs. "regar" vs. "aguar" matters; beginners notice. Founder-owned 200-species corpus is how Folhário wins here.
5. **LGPD enforcement intensifies in 2025–2026** per Chambers/IAPP sources, with 2026 ANPD priorities being children's data, AI/biometrics, and data scraping — all of which touch Folhário's surface. The PRD's comprehensive LGPD coverage is exactly right.
6. **Mutual adequacy decision EU↔Brazil (Jan 2026)** does not affect US-based provider calls (Plant ID, OpenAI) — Art. 33 international transfer consent is still required. PRD handles this.
7. **Age gate ≥13** (Art. 14) is stricter than GDPR 16 in some interpretations; PRD covers. Enforcement priority 2026.
8. **Brazilian beginners are price-sensitive.** Trial-to-paid targets (8% organic, 15% partner) are reasonable. Pricing decision is a launch blocker (§24).
9. **"Gerado por IA" as pt-BR phrasing is deliberate and culturally correct.** English would say "AI-generated"; pt-BR users recognize "Gerado por IA" as the standard regulatory phrase.
10. **Southern Hemisphere seasonal tips matter.** Care guides must invert SH seasons. PRD §8 commits to this.
11. **Brazilian WhatsApp culture** — users may expect a WhatsApp channel for support. Not in scope, but worth noting for v1.x (email-only support works but friction).

---

## Summary for Requirements Phase

**Strengths of PRD-committed feature set:**
- Honest AI positioning is a genuine competitive moat, not marketing fluff
- Single paid tier with no-hostage read-only mode is a trust differentiator competitors can't easily copy
- LGPD-first UX aligns with regulatory direction and Brazilian user expectations
- Anti-feature list is disciplined and well-reasoned
- Curated pt-BR care corpus is the hard-to-copy content moat

**The single biggest feature-scope question the PRD leaves ambiguous:**
- **Plant disease diagnosis** is present in every mainstream competitor. The PRD silently omits it. Requirements phase should make this an explicit decision: include in MVP (extend `IdentificationProvider`), defer to v1.x with a clear trigger, or out-of-scope with documented rationale.

**Minor requirements-phase clarifications:**
- Rate limiting the email verification resend endpoint (currently ambiguous)
- Pix vs. Pix Automático for recurring billing
- Photo capture overlay spec (static screen vs. camera-view overlay)
- Coach marks / contextual help policy (anti-pattern vs. legitimate inline help)
- Empty-state illustration spec for every screen

**Brazilian-market items not yet owned:**
- NFS-e issuance (§24, Owner TBD — launch blocker)
- Pricing BRL decision (§24, Owner TBD — launch blocker)
- DPO appointment (§24, Owner TBD — launch blocker)
- Privacy policy + ToS authoring in pt-BR (§24, Owner TBD — launch blocker)

---

## Sources

Competitive set surveyed via web search 2026-04-14:

- [PictureThis — App Store listing](https://apps.apple.com/us/app/picturethis-plant-identifier/id1252497129)
- [PictureThis Reviews (2026) — Product Hunt](https://www.producthunt.com/products/picturethis/reviews)
- [Planta — getplanta.com](https://getplanta.com/)
- [Planta Quick Add Tool launch (Garden Center Mag, 2026)](https://www.gardencentermag.com/news/planta-plant-identification-app-ai-quick-add-tool/)
- [Planta upgrade of plant ID tool (Pro Landscaper USA, April 2026)](https://www.prolandscapermagazine.com/us/2026/04/02/planta-launches-upgrade-of-plant-id-tool/)
- [Greg — greg.app](https://greg.app/)
- [Greg Support Center — reminder behavior](https://greg.app/support/)
- [PlantIn — Apps on Google Play](https://play.google.com/store/apps/details?id=com.myplantin.app&hl=en_US)
- [MyPlantIn — Best Plant Identification Apps 2026](https://myplantin.com/blog/best-plant-identification-apps)
- [MyPlantIn — Best Plant Care Apps 2026](https://myplantin.com/blog/best-plant-care-apps)
- [PlantNet — App Store](https://apps.apple.com/us/app/plantnet/id600547573)
- [PlantIn vs PictureThis — myplantin.com](https://myplantin.com/blog/plantin-vs-picturethis)
- [Blossom vs PlantIn — AppGrooves](https://appgrooves.com/compare/app-plantin-plant-identification-by-vortemol-limited/app-blossom-plant-identification-app-by-conceptiv-apps-llc)
- [CNN Underscored — Best Plant Identification Apps tested 2025](https://www.cnn.com/cnn-underscored/reviews/best-plant-identification-app)
- [FloraMate — floramateai.com](https://www.floramateai.com/)
- [Plantora — Google Play](https://play.google.com/store/apps/details?id=app.plantora.plantora&hl=en_US)

Dark patterns + FTC enforcement context:

- [FTC study finds dark patterns in majority of subscription apps (TechCrunch, July 2024)](https://techcrunch.com/2024/07/10/ftc-study-finds-dark-patterns-used-by-a-majority-of-subscription-apps-and-websites/)
- [FTC Click-to-Cancel Rule — Coulson P.C.](https://www.coulsonpc.com/coulson-pc-blog/dark-patterns-ftc-click-to-cancel-rule)
- [PlantIn complaints — JustUseApp 2026](https://justuseapp.com/en/app/1527399597/plantin-plant-identifier/reviews)

LGPD + Brazilian market context:

- [ICLG — Data Protection Laws and Regulations Brazil 2025–2026](https://iclg.com/practice-areas/data-protection-laws-and-regulations/brazil)
- [Chambers and Partners — Data Protection & Privacy 2026 Brazil](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/brazil)
- [LGPD Compliance Guide for SaaS — Complydog](https://complydog.com/blog/brazil-lgpd-complete-data-protection-compliance-guide-saas)
- [SecurePrivacy — Global Cookie Consent Trends 2026](https://secureprivacy.ai/blog/global-cookie-consent-trends-2026)
- [Stripe — Pix payments documentation](https://docs.stripe.com/payments/pix)
- [Stripe — A guide to Pix payments in Brazil](https://stripe.com/en-br/resources/more/pix-replacing-cards-cash-brazil)

PRD + project sources:

- `/Users/machado/Projects/folhario/docs/CAVE-PRD.md` (§1, §6–§16, §22, §23, §24, §25)
- `/Users/machado/Projects/folhario/.planning/PROJECT.md`

---

*Feature research for: Folhário MVP — plant identification + care-guide + reminder PWA, Brazilian beginner audience*
*Researched: 2026-04-14*
