# Phase 6: Identification Flow & Cost Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 06-identification-flow-cost-controls
**Mode:** power (32 questions answered async via 06-QUESTIONS.html / 06-QUESTIONS.json)
**Areas discussed:** Adapter & Connector Layout, Router & Provider Selection, Circuit Breaker, Counter & Cap Check, Hot-Reload Cache, Consent Modal UX & Wiring, Identify Screen & Capture UX, Results & Confidence Ladder, Persistence & Storage, History/Telemetry/Tests

---

## Adapter & Connector Layout

### Q-01: IdentificationProvider interface shape

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Single `identify()`, normalized response            | Static `costPerCallCents` only; smallest surface; matches StorageAdapter shape                    |          |
| (b) `identify()` + `estimateCost(input)`                | Dynamic per-call cost (OpenAI cost depends on photo count + tokens); accurate budget tracking     | ✓        |
| (c) `identify()` + `healthCheck()` + `costPerCallCents` | Adds half-open probe via healthCheck instead of real ID call; requires real health endpoints      |          |

**User's choice:** (b)
**Notes:** Dynamic cost feeds the atomic preflight reservation (Q-05 custom).

### Q-02: Connector file location

| Option                                                            | Description                                                                                       | Selected |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Context-local connectors                                       | `src/contexts/identification/infrastructure/providers/`; matches Phase 4 D-17 resend-adapter      |          |
| (b) Shared adapter directory                                       | `src/shared/adapters/plant-id.ts` etc.; matches storage precedent                                 |          |
| (c) Hybrid — interface in shared, connectors in context            | Interface-vs-impl boundary mirrored at the directory level                                        | ✓        |

**User's choice:** (c)

### Q-03: Provider response normalization

| Option                                          | Description                                                                                       | Selected |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Connector returns canonical shape           | Translation lives next to provider quirks; uniform data downstream                                |          |
| (b) Connector returns raw, normalizer in use-case | Tagged union; raw queryable via `Identification.results`                                          |          |
| (c) Connector returns canonical + raw alongside | Persist raw for audit; use canonical for filter/sort/UI                                           | ✓        |

**User's choice:** (c)
**Notes:** Belt + braces — filter on canonical, audit trail on raw.

---

## Router & Provider Selection

### Q-04: Provider ordering source

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Add `priority INT` column to `provider_budgets`      | Aligns SPEC text with schema; operator-tunable per CLAUDE.md hot-reload                           | ✓        |
| (b) Static config in `src/contexts/identification/config.ts` | No migration; order changes require redeploy                                                  |          |
| (c) Hardcode in router with DB enable/disable only       | Simplest; gives up runtime ordering                                                               |          |

**User's choice:** (a)

### Q-05: Pre-call cost-ceiling check

| Option                                                          | Description                                                                                       | Selected |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) SELECT counter inside same TX as increment                   | Strongest atomicity; long-tx held during 30s provider call                                        |          |
| (b) Read cached counter, increment after success                 | Race condition; rejected by COST-09 atomicity AC                                                  |          |
| (c) Atomic INSERT ON CONFLICT in pre-flight, rollback on skip    | Optimistic-then-rollback; satisfies COST-09 AC                                                    |          |
| (d) Custom — atomic preflight reservation                        | Conditional INSERT...ON CONFLICT...WHERE current+est <= cap, commit, then call provider outside TX | ✓        |

**User's choice:** Custom
**Notes (binding):** "Use a short atomic preflight reservation. In one short transaction, conditionally increment/reserve estimated cost only when current estimated_cost_cents + estimatedCost <= daily_cost_cap_cents, then commit and call the provider outside the transaction. If the reservation cannot be made, mark/skip the provider for the rest of the UTC day and try the next provider. This preserves atomic ceiling enforcement without holding a transaction during provider HTTP latency."

### Q-06: Remaining-budget calculation for fallover guard

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) `Date.now()` only                                    | Simple; no library overhead                                                                       |          |
| (b) AbortController + timer-based AbortSignal cascade    | Cleaner cancellation; more wiring                                                                 |          |
| (c) AbortController + computed `remainingMs()` via Date.now() | Both: signal for in-flight cancellation, Date.now() for fallover guard                       | ✓        |

**User's choice:** (c)

### Q-07: Failure recording timing per attempt

| Option                                                       | Description                                                                                       | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------- |
| (a) One Identification row per user request                   | Per-attempt traces in Sentry/PostHog; matches IDENT-08 wording                                    | ✓        |
| (b) One row per provider attempt + parent_request_id          | More detailed audit; schema churn; history-query complexity                                       |          |
| (c) One row + provider_attempts JSONB column                  | Full audit, inflates row size                                                                     |          |

**User's choice:** (a)

---

## Circuit Breaker

### Q-08: Breaker state location

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) DB-only — new `provider_breaker_states` table        | Survives Lambda recycling and concurrent invocations; 1 read per ID                               |          |
| (b) Hybrid — in-memory cache fronting DB                 | Saves a read on warm Lambda; eventual consistency between Lambdas during state flips              | ✓        |
| (c) Reuse `provider_usage_counters` with breaker columns | Mixes concerns; daily reset may be wrong if breaker should outlive UTC day                        |          |

**User's choice:** (b)

### Q-09: Breaker thresholds

| Option                                              | Description                                                                                       | Selected |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Aggressive — N=3, window=2min, cooldown=60s     | Trips fast, recovers fast; risk of flap                                                           |          |
| (b) Moderate — N=5, window=5min, cooldown=120s      | Balanced default for MVP traffic                                                                  | ✓        |
| (c) Conservative — N=10, window=10min, cooldown=300s | Risk: bleeds budget on bad provider before tripping                                                |          |

**User's choice:** (b)

### Q-10: Which failures count toward the breaker

| Option                                              | Description                                                                                       | Selected |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Provider faults only — timeout + 5xx + invalid_response | Cleanest signal                                                                           | ✓        |
| (b) Provider faults + 4xx                            | Risk: per-image rejects mask real provider issues                                                 |          |
| (c) Any non-success                                  | Trips on legitimate zero-result IDs; probably wrong                                                |          |

**User's choice:** (a)

---

## Counter & Cap Check

### Q-11: Atomic counter increment SQL

| Option                                                                  | Description                                                                                       | Selected |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) INSERT ... ON CONFLICT DO UPDATE SET request_count = request_count + 1 | Single statement, atomic; standard pattern; matches COST-09 wording                            | ✓        |
| (b) SELECT ... FOR UPDATE then UPDATE                                    | Higher latency under contention; equivalent correctness                                            |          |
| (c) Postgres advisory lock + read-modify-write                           | Highest overhead; overkill                                                                        |          |

**User's choice:** (a)

### Q-12: Cap-check window math

| Option                                                              | Description                                                                                       | Selected |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Repository helper `countIdentificationsInWindow`                 | Repo is the only Drizzle consumer (PRD §17 D-17)                                                  |          |
| (b) Use-case computes counts inline via injected tx                  | Mixes domain logic with SQL; violates D-17                                                        |          |
| (c) Domain service `check-cap(userId)` returning {allowed, reason, resetAt} | Highest abstraction; one extra layer                                                       | ✓        |

**User's choice:** (c)

### Q-13: Cap + counter + provider call ordering

| Option                                                                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Cap → Consent → TX{counter inc} → Provider → TX{row write}                                           | Best perf; weakest consistency (counter incremented if provider crashes)                          |          |
| (b) Cap → Consent → TX{counter inc + 'in_progress' row} → Provider → TX{update row}                       | Pre-write row; reconciler can mark failed; needs `'in_progress'` enum value                       | ✓        |
| (c) Cap → Consent → single TX{counter inc + provider call + row write}                                    | Strongest consistency; worst scaling (30s lock)                                                   |          |

**User's choice:** (b)

---

## Hot-Reload Cache

### Q-14: Cache location

| Option                                       | Description                                                                                       | Selected |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Module-level Map per Lambda instance      | Simple; no infra dependency                                                                       | ✓        |
| (b) Vercel KV or Upstash Redis                | Stronger consistency; out of CLAUDE.md tech stack                                                 |          |
| (c) No cache — DB read every request          | Eliminates staleness; ~2 extra reads per request                                                  |          |

**User's choice:** (a)

### Q-15: Cache TTL value

| Option                                  | Description                                                                                       | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) 60 seconds                           | Bounded staleness; minimal hit-rate cost                                                          |          |
| (b) 300 seconds (5 min)                  | Higher hit rate; possibly too slow for emergency provider disable                                 |          |
| (c) Configurable via env (default 60s)   | Operator can dial to 0 for emergency without redeploy                                             | ✓        |
| (d) N/A                                  | Skip if Q-14 = no-cache                                                                            |          |

**User's choice:** (c)

---

## Consent Modal UX & Wiring

### Q-16: Modal trigger placement

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Gate at Identify CTA tap (before camera/picker)      | Cleanest mental model — committing to identification, not exploring                               | ✓        |
| (b) Gate at submit (after photos chosen)                 | Risk of bait-and-switch feel                                                                      |          |
| (c) Gate at Identify screen entry                        | Most explicit; arguably too aggressive                                                            |          |

**User's choice:** (a)

### Q-17: Provider naming in disclosure

| Option                                                            | Description                                                                                       | Selected |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Real names — "Plant.id (Kindwise) e provedor compatível com OpenAI" | Maximum transparency; vendor swap requires copy update + re-consent                          | ✓        |
| (b) Generic — "provedores de IA terceirizados nos EUA e Europa"    | Future-vendor flexibility; weaker on transparency                                                 |          |
| (c) Real names + "or equivalent successors" clause                 | Future-proofed; clunky read-aloud copy                                                            |          |

**User's choice:** (a)
**Notes (binding):** Vendor swap MUST trigger `policy_version` bump and re-consent — that's the LGPD-correct posture, not a friction to engineer around.

### Q-18: Consent grant submission endpoint

| Option                                                       | Description                                                                                       | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Reuse `/api/v1/iam/consent` endpoint                      | Zero new endpoints; consent logic in one place                                                    | ✓        |
| (b) New dedicated `/api/v1/identifications/consent` endpoint  | Cleaner separation; one extra pass-through route                                                  |          |
| (c) Inline grant — POST /v1/identifications carries grant_consent | Coupled flow; consent grant as side effect                                                    |          |

**User's choice:** (a)

---

## Identify Screen & Capture UX

### Q-19: Photo capture flow

| Option                                              | Description                                                                                       | Selected |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Single batch picker + thumbnails strip           | Familiar mental model                                                                             | ✓        |
| (b) Capture-then-confirm sequential loop             | More guided, slower                                                                               |          |
| (c) Always allow N from start, default to 1          | Hybrid; balances casual vs careful users                                                          |          |

**User's choice:** (a)

### Q-20: Loading state messaging

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Single skeleton with brand copy "Identificando…"     | Honest about uncertainty; PRD §17 anti-fake-precision                                             | ✓        |
| (b) Multi-stage messages with skeleton                   | More feedback; risk of stage-2 visibly stalling                                                   |          |
| (c) Skeleton + cancel button after 10s                   | More user agency; client/server divergence per IDENT-14                                            |          |

**User's choice:** (a)

### Q-21: Manual correction surface

| Option                                                       | Description                                                                                       | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Inline "Não é nenhuma destas?" link under top-3 results   | Good for partial-confidence cases                                                                 |          |
| (b) Only on zero-results screen                               | Cleaner; loses correction when results are wrong                                                  |          |
| (c) Both — under results AND on zero-results                  | Most flexibility; biggest UI surface                                                              | ✓        |

**User's choice:** (c)

### Q-22: Read-only paywall surface

| Option                                                      | Description                                                                                       | Selected |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) ModalSheet with literal copy + reactivate CTA            | Phase 5 D-21 hides mutating affordances; Phase 6 surfaces explicit paywall on Identify only       | ✓        |
| (b) Inline read-only banner replaces capture controls        | Less interruptive; less attention-grabbing                                                        |          |
| (c) Full-page redirect to subscription paywall               | Most heavy-handed                                                                                 |          |

**User's choice:** (a)

---

## Results & Confidence Ladder

### Q-23: ConfidenceLadder component location & API

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) `src/shared/ui/confidence-ladder.tsx`, prop = number | Self-contained; thresholds in one place                                                           | ✓        |
| (b) `src/shared/ui/confidence-ladder.tsx`, prop = level enum | Caller controls; risk of inconsistent thresholding                                            |          |
| (c) Context-local at `src/contexts/identification/ui/`   | Bounded-context discipline; potential duplication for Phase 7                                     |          |

**User's choice:** (a)

### Q-24: Results layout on the Identify screen

| Option                                              | Description                                                                                       | Selected |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Vertical card stack (one per result)             | Standard mobile pattern                                                                           |          |
| (b) Top-result hero + 2 alternative cards            | Asymmetric hierarchy; risk of nudging users away from #2/#3                                       |          |
| (c) Equal-prominence vertical cards (no hero)        | Honors "no fake confidence" while keeping ranking visible via the ladder                          | ✓        |

**User's choice:** (c)

### Q-25: Selection → Plant create flow

| Option                                              | Description                                                                                       | Selected |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) One-tap "Adicionar" → straight to plant profile  | Fastest; matches <2-min core value promise                                                        |          |
| (b) Intermediate confirmation sheet                  | Captures location at creation time; one extra step                                                | ✓        |
| (c) Pre-filled add-plant page                        | Reuses Phase 5 manual-add; risk of feeling redundant                                              |          |

**User's choice:** (b)
**Notes (binding):** The whole purpose of the intermediate sheet is to capture LOCATION at creation time. Without it, users skip setting location and catalog grouping degrades.

---

## Persistence & Storage

### Q-26: Identification photo upload route

| Option                                                                    | Description                                                                                       | Selected |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Single multipart POST /v1/identifications with all photos              | Atomic; fewer round-trips; longer single request                                                  | ✓        |
| (b) Pre-upload via existing /v1/photos/upload, POST identifications with photo_urls[] | Reuses Phase 2; multiple round-trips; orphan risk                                       |          |
| (c) Context-specific /v1/identifications/photos pre-upload + JSON identifications POST | Adds infra; cleanest separation                                                          |          |

**User's choice:** (a)

### Q-27: Identification.photo_urls persistence shape

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Store {bucket}/{key} refs; sign at history-screen read time | Matches Phase 5 D-20                                                                      | ✓        |
| (b) Store full bucket+key+ext in JSON                    | Self-describing; needs JSON.parse at read                                                         |          |
| (c) Dedicated identification_photos bucket               | Cross-flow when selection→Plant needs to reference                                                |          |

**User's choice:** (a)

### Q-28: Server-side EXIF/GPS guard reuse

| Option                                                       | Description                                                                                       | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Call rejectGpsMetadata per photo inside the use-case      | Identical to create-plant.ts pattern                                                              |          |
| (b) Centralize in route handler before reaching the use-case  | Splits validation across layers                                                                   |          |
| (c) New shared helper validateIdentificationPhotos(photos[])  | Wraps rejectGpsMetadata + size + MIME for the 1..N batch; reusable                                | ✓        |

**User's choice:** (c)

---

## History, Operator Alert, Tests & Telemetry

### Q-29: History screen pagination

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Cursor pagination (matches Phase 2 D-36 + Phase 5 D-12) | Established pattern; possibly overkill for typical user volume                                | ✓        |
| (b) Last-30-days window + 'Ver mais'                     | Volume-friendly; no cursor complexity for typical users                                            |          |
| (c) Single page — no pagination                          | MVP volume bounded; simplest                                                                      |          |

**User's choice:** (a)

### Q-30: 80% cost-alert idempotency mechanism

| Option                                                              | Description                                                                                       | Selected |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Add alert_sent_at column to provider_usage_counters              | One DB column; no new table                                                                       | ✓        |
| (b) Separate provider_cost_alerts table                              | Audit-friendly; new table to maintain                                                             |          |
| (c) Inngest event idempotency key                                    | Free-tier idempotency window — verify before relying                                              |          |

**User's choice:** (a)

### Q-31: Provider stub strategy under IDENTIFICATION_PROVIDER_MODE

| Option                                                            | Description                                                                                       | Selected |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) Two stub connectors that read scenario from request header/env | Predictable; couples test-only branching into the codebase                                        |          |
| (b) MSW HTTP intercepts in tests; real connectors against intercepts | Higher fidelity; MSW dep only in test bundle                                                  |          |
| (c) Per-test injected mock connectors via __setProviderForTests test seam | Mirrors Phase 5 D-27 pattern; integration tests inject deterministic mocks                | ✓        |

**User's choice:** (c)

### Q-32: PostHog event firing layer

| Option                                                  | Description                                                                                       | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| (a) All three server-side via posthog-node              | Matches Phase 5 D-28/29 server-only pattern; privacy-clean                                        | ✓        |
| (b) Started client-side, succeeded + cap_hit server-side | More accurate funnel start; two transports                                                        |          |
| (c) All client-side from results/error screens           | Doesn't fire if user closes tab mid-request                                                       |          |

**User's choice:** (a)

---

## Claude's Discretion

Areas Claude has flexibility on (within the locks above):

- Exact Drizzle column ordering inside the `provider_breaker_states` migration
- Sonner toast copy strings for failure paths (initial pt-BR drafts; founder reviews per Phase 4 D-30 pattern)
- Internal field names of the canonical `NormalizedResult` shape (kept in `src/contexts/identification/domain/`)
- TanStack Query `staleTime` for the identification-history list query (suggested 30s)
- Tailwind class compositions for capture guide visual states
- Skeleton sub-component variants inside the loading state per D-20
- Connector retry policy on transient 5xx (suggested zero retry — let breaker count consecutive failures)
- File splits inside `src/contexts/identification/{domain,application,infrastructure,api,inngest}/` provided D-01..D-03 contracts and D-08 breaker schema are preserved
- Per-photo size/MIME limits in `validateIdentificationPhotos` helper (suggested: reuse Phase 2 limits)
- PostHog event property shapes per D-32 (privacy-clean — no email, no plant identifiers)

---

## Deferred Ideas

- Operator dashboard for budget tuning — Phase 6 ships DB-only configuration
- `provider_attempts` jsonb audit column (Q-07 option c) — rejected; could augment later if breaker tuning needs deeper post-hoc analysis
- Per-attempt history rows (Q-07 option b: parent_identification_id) — rejected; could revisit if user-facing "show me every attempt" feature requested
- Cancel button on loading state (Q-20 option c) — rejected; client/server divergence per IDENT-14
- Cross-Lambda shared cache (Q-14 option b: Vercel KV / Upstash Redis) — rejected; out of CLAUDE.md tech stack
- Healthcheck endpoint for breaker probes (Q-01 option c) — rejected; real provider call is the safest signal
- MSW intercept-based connector tests (Q-31 option b) — could augment unit-test layer if integration-test gaps surface
- Pre-upload `/v1/identifications/photos` route (Q-26 option b/c) — rejected; helper from D-28 already extracted should the optimization be wanted later
