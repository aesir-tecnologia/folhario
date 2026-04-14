# Architecture Research — Folhário

**Domain:** Consumer PWA (plant identification + care guide + reminder) on Next.js App Router + Supabase + Inngest, DDD-lite bounded contexts in a single deploy
**Researched:** 2026-04-14
**Confidence:** HIGH on pattern validation; MEDIUM on cross-context read shape (ecosystem has multiple defensible variants); HIGH on Inngest choreography (verified against current docs)

---

## Executive Validation of PRD §3

The PRD commits to seven contexts, Inngest-for-async, thin-query-services-for-sync, route-handlers-as-thin-adapters, and per-context folder-as-module. This research **validates** that structure against real-world ecosystem practice and fills in the implementation-level details the PRD intentionally leaves open.

**Verdict:** The structure is sound. The main risks are not structural, they are disciplinary: (1) context leakage through shared Drizzle tables, (2) temptation to call repositories across context boundaries, (3) Inngest events becoming RPC-in-disguise, (4) route handlers growing beyond the "validate → use-case → HTTP map" rule. ARCHITECTURE gates in PR review are cheaper than a refactor.

One concrete addition beyond the PRD: **a dedicated `src/shared/contracts/` directory** for cross-context type contracts (event payload shapes + query-service DTOs) that neither context owns. Without this, either IAM or Catalog ends up owning types both import, which recreates the coupling DDD is trying to avoid.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Client (PWA, React, TS)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐    │
│  │ React Router │  │ IndexedDB    │  │ Service Worker (Workbox) │    │
│  │ (App Router) │  │ offline queue│  │ + web-push subscription  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────┘    │
└─────────┼──────────────────┼─────────────────────────┼───────────────┘
          │ HTTPS (JWT)      │                         │
          ▼                  ▼                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│               Next.js Route Handlers  /api/v1/*                       │
│   (thin adapters: Zod validate → use-case → http-map → Response)      │
│                                                                       │
│   Middleware: JWT verify, CORS, Sentry, rate-limit public endpoints   │
└────────┬─────────────────────────────────────────────┬───────────────┘
         │                                             │
         │ in-process function calls                   │ inngest.send()
         ▼                                             ▼
┌──────────────────────────────────────────┐  ┌──────────────────────┐
│          src/contexts/{ctx}/             │  │      Inngest          │
│                                          │  │   (events, cron,      │
│  ┌────────────────────────────────────┐  │  │   step.sleepUntil)    │
│  │  domain/        — entities, VOs,   │  │  │                       │
│  │                   aggregates, DE   │  │  │ care-guide/augment    │
│  │  application/   — use cases,       │◄─┼──┤ iam/process-deletion  │
│  │                   ports, DTOs      │  │  │ iam/generate-export   │
│  │  infrastructure/— repo impls,      │  │  │ billing/process-wh    │
│  │                   provider adapts  │  │  │ billing/trial-ending  │
│  │  api/           — HTTP mappers,    │  │  │ reminders/dispatch    │
│  │                   schemas (Zod)    │  │  │ notifications/send-*  │
│  │  inngest/       — event handlers   │  │  │                       │
│  └────────────────┬───────────────────┘  │  │ sync endpoint:        │
│                   │ via port interfaces   │  │ /api/inngest (POST)   │
└───────────────────┼───────────────────────┘  └──────┬───────────────┘
                    │                                  │
                    ▼                                  │
┌──────────────────────────────────────────────────────┼───────────────┐
│                    src/shared/                       │               │
│                                                      │               │
│  db/ (Drizzle schema, migrations, client factory)    │               │
│  events/ (event catalogue + payload types + sender)◄─┘               │
│  adapters/ (Supabase Auth, Storage, Resend, Stripe, Plant ID, LLM)   │
│  contracts/ (cross-context DTOs, query-service interfaces)           │
│  config/ (env parsing, feature flags)                                │
│  telemetry/ (Sentry, PostHog wrappers, structured logger)            │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase (single project)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐    │
│  │ Postgres    │  │ Auth (GoTrue)│ │ Storage (private buckets)   │    │
│  │ + RLS       │  │              │ │ plant-photos,               │    │
│  │ (def-in-dep)│  │              │ │ plant-thumbnails,           │    │
│  │             │  │              │ │ data-exports                │    │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘    │
│                                                                       │
│  Runtime connection: Supavisor txn pooler (port 6543, prepare:false)  │
│  Migration connection: direct (port 5432)                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Context Ownership Matrix

This is the authoritative mapping of "which context owns which data, emits what, consumes what." It extends PRD §3 with the **query services** each context must expose (sync reads other contexts need) and the **foreign-key discipline** rule.

| # | Context | Tables it OWNS (writes) | Tables it READS via query service | Emits | Consumes | Exposes query service |
|---|---------|-------------------------|------------------------------------|-------|----------|----------------------|
| 1 | **IAM** | `User`, `ConsentLog`, `PartnerStore`, `DataExportRequest`, `DataDeletionRequest`, `PushSubscription`* | — | `user.signed_up`, `user.consent_granted`, `user.consent_revoked`, `user.deletion_requested`, `user.deleted`, `data_export.requested` | `subscription.status_changed` (to toggle access mode cache), `identification.succeeded` (count toward first-value metric) | `getUserProfile(userId)`, `getActiveConsents(userId, purpose)`, `getUserTimezoneAndNotificationTime(userId)`, `isDeletionInProgress(userId)` |
| 2 | **Catalog** | `Plant`, `PhotoEntry` | `Species` (read-only via Species&Care service) | `plant.created`, `plant.deleted`, `photo.added` | `identification.succeeded` (prefill flow), `user.deletion_requested` (hard-delete on wake) | `getPlant(plantId, userId)`, `listUserPlants(userId, sort)`, `getPlantCountForUser(userId)` |
| 3 | **Species & Care** | `Species`, `CareGuide` | — | `care_guide.augmented`, `care_guide.published`, `species.flagged` | `identification.succeeded` (triggers augmentation when `flag_reason=missing_care_guide`) | `getSpeciesRef(speciesId)`, `getCareGuide(speciesId, locale)`, `hasCareGuide(speciesId, locale)` |
| 4 | **Identification** | `Identification`, `ProviderBudget`, `ProviderUsageCounter`, `IdentificationLimit` | — | `identification.succeeded`, `identification.failed`, `provider.ceiling_reached` | `user.consent_granted` (unlocks identify), `subscription.status_changed` (switches per-user cap to trialing/active tier) | `getUserIdentificationHistory(userId, cursor)`, `getDailyUserCount(userId, date)` |
| 5 | **Reminders** | `Reminder`, `ReminderLog` | `Plant` (to validate ownership + to iterate user's reminder set via query service) | `reminder.created`, `reminder.completed`, `daily_reminder_summary.due` | `plant.created` (no-op for MVP but hook is free), `plant.deleted` (cascade delete its reminders), `subscription.status_changed` (pause/resume scheduling) | `listDueReminders(userId, beforeUtc)`, `hasAnyReminder(userId)` |
| 6 | **Billing** | `Subscription`, `BillingEvent` | — | `subscription.status_changed`, `payment.failed`, `trial.ending`, `billing.webhook.received` | `user.signed_up` (provision trial subscription) | `getSubscriptionStatus(userId)`, `isInReadOnlyMode(userId)`, `getActiveCapTier(userId)` |
| 7 | **Notifications** | `PushSubscription`* (see note) | — | `notification.sent`, `notification.failed` | `daily_reminder_summary.due`, `care_guide.augmented`, `subscription.status_changed`, `payment.failed`, `trial.ending`, `user.signed_up` (email verification), any email-trigger event | — (write-side only) |

\* **`PushSubscription` ownership note.** The PRD §3 row places `PushSubscription` under Notifications. That is correct for MVP — Notifications is the only context that reads/deletes it (on 410/404). IAM does NOT need it; the session/JWT flow is independent. One row per device keyed `(user_id, device_id)`.

### Aggregate boundary rules

1. **One context writes a table. Period.** Other contexts that need that data go through the owning context's query-service module, not Drizzle.
2. **Cross-context reads return DTOs, not aggregates.** Query services live in `src/contexts/{ctx}/application/queries/` and return plain objects typed from `src/shared/contracts/`. They never return domain entities with methods. This is the Martin Fowler "interface segregation per consumer" flavor of CQRS-lite.
3. **Foreign keys that cross contexts are advisory, not enforced-in-domain.** `Plant.species_id` points into Species & Care, `Identification.plant_id` points into Catalog. Drizzle schema defines them for DB integrity, but Catalog's `Plant` aggregate treats `species_id` as an opaque ID reference and goes through the query service when it needs the species name/thumbnail.
4. **No repository imports another context's repository.** Use-cases compose via application services / query services. Lint this with an ESLint import-restriction rule (concrete config below in Patterns §6).

---

## Recommended Project Structure

```
src/
├── app/                              # Next.js App Router (UI + route handlers)
│   ├── (public)/                     # unauth routes (login, signup, recovery)
│   ├── (app)/                        # authed shell (home, catalog, identify…)
│   │   ├── layout.tsx                # reads session → passes down; bottom nav
│   │   └── ...
│   └── api/
│       └── v1/
│           ├── auth/                 # → imports IAM use-cases
│           ├── plants/               # → imports Catalog use-cases
│           ├── identifications/      # → imports Identification use-cases
│           ├── reminders/            # → imports Reminders use-cases
│           ├── billing/              # → imports Billing use-cases
│           ├── webhooks/stripe/      # → imports Billing webhook use-case
│           └── inngest/route.ts      # single Inngest handler, imports from every ctx/inngest/
│
├── contexts/
│   ├── iam/
│   │   ├── domain/
│   │   │   ├── user.ts               # User aggregate + invariants
│   │   │   ├── consent-log.ts
│   │   │   ├── data-deletion-request.ts
│   │   │   ├── errors.ts             # ConsentRequired, DeletionInProgress
│   │   │   └── events.ts             # re-exports from shared/events
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   │   ├── user-repository.ts          # interface
│   │   │   │   ├── consent-repository.ts
│   │   │   │   └── auth-provider.ts            # interface wrapping Supabase Auth
│   │   │   ├── use-cases/
│   │   │   │   ├── sign-up.ts
│   │   │   │   ├── verify-email.ts
│   │   │   │   ├── request-deletion.ts
│   │   │   │   ├── cancel-deletion.ts
│   │   │   │   ├── grant-consent.ts
│   │   │   │   ├── revoke-consent.ts
│   │   │   │   └── request-data-export.ts
│   │   │   └── queries/              # exposed to other contexts
│   │   │       ├── get-user-profile.ts
│   │   │       └── get-active-consents.ts
│   │   ├── infrastructure/
│   │   │   ├── drizzle-user-repository.ts
│   │   │   ├── drizzle-consent-repository.ts
│   │   │   └── supabase-auth-provider.ts
│   │   ├── api/
│   │   │   ├── schemas.ts            # Zod request schemas
│   │   │   ├── handlers.ts           # called from src/app/api/v1/auth/…/route.ts
│   │   │   └── error-map.ts          # domain error → HTTP
│   │   └── inngest/
│   │       ├── process-deletion.ts   # uses step.sleepUntil
│   │       └── generate-export.ts
│   │
│   ├── catalog/
│   │   └── (same shape)
│   ├── species-care/
│   │   └── (same shape; inngest/augment-care-guide.ts)
│   ├── identification/
│   │   └── (same shape)
│   ├── reminders/
│   │   └── (same shape; inngest/dispatch.ts is the 5-min cron)
│   ├── billing/
│   │   └── (same shape; inngest/process-webhook.ts + inngest/trial-ending-notifier.ts)
│   └── notifications/
│       └── (same shape; inngest/send-email.ts + inngest/send-push.ts)
│
└── shared/
    ├── db/
    │   ├── schema/                   # Drizzle schema split by context for locality
    │   │   ├── iam.ts
    │   │   ├── catalog.ts
    │   │   ├── species-care.ts
    │   │   ├── identification.ts
    │   │   ├── reminders.ts
    │   │   ├── billing.ts
    │   │   ├── notifications.ts
    │   │   └── index.ts              # re-export all tables (one Drizzle schema)
    │   ├── client.ts                 # drizzle() factory + postgres-js w/ prepare: false
    │   ├── migrations/               # drizzle-kit output
    │   └── tx.ts                     # transaction helper (unit-of-work)
    ├── events/
    │   ├── catalogue.ts              # Zod schemas for every event payload
    │   ├── types.ts                  # TS types derived from catalogue
    │   ├── sender.ts                 # thin wrapper around inngest.send()
    │   └── names.ts                  # const strings, e.g. EVENTS.IDENTIFICATION_SUCCEEDED
    ├── contracts/
    │   ├── iam.ts                    # DTOs from IAM query services
    │   ├── catalog.ts
    │   ├── species-care.ts
    │   ├── identification.ts
    │   ├── reminders.ts
    │   └── billing.ts
    ├── adapters/
    │   ├── supabase-storage.ts       # signed-URL helpers
    │   ├── resend.ts                 # transactional email sender
    │   ├── stripe-billing-provider.ts  # implements BillingProvider
    │   ├── plant-id-provider.ts      # implements IdentificationProvider
    │   ├── openai-vision-provider.ts # implements IdentificationProvider
    │   ├── llm-care-guide-provider.ts# implements CareGuideProvider
    │   └── web-push-sender.ts
    ├── config/
    │   └── env.ts                    # Zod-parsed env
    └── telemetry/
        ├── sentry.ts
        ├── posthog.ts
        └── logger.ts
```

### Structure rationale

- **`src/contexts/{ctx}/{domain,application,infrastructure,api,inngest}/`** — matches PRD §2 exactly. Five folders not four: the `inngest/` sibling to `api/` is important because Inngest handlers are a **second adapter port**, co-equal with HTTP. Putting them alongside `api/` makes that symmetry visible and makes it hard to accidentally import the HTTP layer from inside an Inngest handler (or vice versa).
- **Drizzle schema split by context, single `drizzle` schema.** One physical Postgres schema (`public`), one Drizzle schema module, but the table definitions themselves live in `src/shared/db/schema/{context}.ts`. This gives you the locality benefit of "Catalog's tables are near Catalog" without the foot-gun of multiple Postgres schemas (RLS policies, search_path, backups, introspection all get harder). The `index.ts` re-export is the Drizzle client's single source.
- **`src/shared/contracts/`** — types that cross boundaries. Neither context defines them in its domain (would force the consumer to depend on the producer's domain module). Both import from `shared/contracts/`.
- **`src/shared/events/`** — one `events/` module owns the event catalogue so both the producing and consuming context see the same Zod schema. Zod validation on receive is non-negotiable: Inngest events can be replayed across deploys with stale payload shapes.
- **`src/app/api/v1/*/route.ts` is 10 lines long.** Each route file imports the handler from `contexts/{ctx}/api/handlers.ts` and wires it to the Web Request/Response. The import direction is strict: `app/` → `contexts/{ctx}/api/` → `contexts/{ctx}/application/` → `contexts/{ctx}/domain/`. Never the reverse, never skipping layers.
- **Inngest route at `src/app/api/inngest/route.ts`** imports from every context's `inngest/` folder. This is the ONE place in the codebase that touches all contexts at once, and it is allowed because Inngest's `serve({ functions: [...] })` contract requires it. Treat it as configuration, not application code.

---

## Architectural Patterns

### Pattern 1 — Thin Route Handler (validate → use-case → HTTP map)

**What:** Route handler does three things and only three things: Zod-validate the request, invoke the use-case, map the result (or error) to an HTTP response. No branching business logic, no Drizzle, no Inngest client.

**When:** Every route handler in `app/api/v1/`.

**Example:**

```typescript
// src/app/api/v1/identifications/route.ts
import { runIdentifyPlant } from '@/contexts/identification/api/handlers'

export const POST = runIdentifyPlant
// That's the whole file.
```

```typescript
// src/contexts/identification/api/handlers.ts
import { z } from 'zod'
import { createIdentification } from '../application/use-cases/create-identification'
import { mapErrorToResponse } from './error-map'
import { getAuthedUser } from '@/shared/adapters/auth-middleware'

const BodySchema = z.object({
  photo_urls: z.array(z.string().url()).min(1).max(5),
  idempotency_key: z.string().uuid(),
})

export async function runIdentifyPlant(req: Request): Promise<Response> {
  try {
    const user = await getAuthedUser(req)          // throws Unauthenticated
    const body = BodySchema.parse(await req.json()) // throws ValidationFailed
    const result = await createIdentification({
      userId: user.id,
      photoUrls: body.photo_urls,
      idempotencyKey: body.idempotency_key,
    })
    return Response.json(result, { status: 200 })
  } catch (err) {
    return mapErrorToResponse(err)
  }
}
```

**Trade-offs:** Adds one indirection layer vs. "everything in route.ts." The payoff is that identical use-cases can be driven from Inngest handlers, background jobs, or CLI scripts without touching HTTP concerns. For MVP this feels like ceremony; by milestone 3 it is why the refactor never happens.

---

### Pattern 2 — Repository + Port Interface (Drizzle behind a seam)

**What:** Every use-case depends on an interface (`UserRepository`, `PlantRepository`, `IdentificationRepository`) defined in `application/ports/`. The Drizzle implementation lives in `infrastructure/`. Tests construct the use-case with an in-memory fake; production wires the Drizzle impl.

**When:** Every persistent aggregate. MANDATORY — this is the seam that lets you test without mocking Drizzle, and the seam that makes "swap to a different DB adapter" a real option rather than a lie.

**Example:**

```typescript
// src/contexts/catalog/application/ports/plant-repository.ts
import { Plant } from '../../domain/plant'

export interface PlantRepository {
  findById(id: string, userId: string): Promise<Plant | null>
  listByUser(userId: string, sort: PlantSort): Promise<Plant[]>
  save(plant: Plant): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
```

```typescript
// src/contexts/catalog/infrastructure/drizzle-plant-repository.ts
import type { PlantRepository } from '../application/ports/plant-repository'
import { db } from '@/shared/db/client'
import { plants } from '@/shared/db/schema/catalog'
import { and, eq } from 'drizzle-orm'
import { Plant } from '../domain/plant'

export class DrizzlePlantRepository implements PlantRepository {
  async findById(id: string, userId: string): Promise<Plant | null> {
    const [row] = await db
      .select()
      .from(plants)
      .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    return row ? Plant.fromRow(row) : null
  }
  // ...
}
```

**Trade-offs:** Upfront cost per aggregate (~30 lines of interface + impl per table). Payoff: unit tests run in milliseconds against in-memory fakes, integration tests run against real Postgres, and the domain layer never imports Drizzle, which is the whole point of the seam.

---

### Pattern 3 — Cross-Context Read via Query Service (no aggregate leak)

**What:** When Context A needs data owned by Context B, it calls a function in B's `application/queries/` module that returns a plain DTO from `shared/contracts/`. The DTO is the public contract. B's `Plant` aggregate is NOT exported.

**When:** Every sync read across contexts. E.g., Reminders needs to know whether a plant belongs to a user before creating a reminder for it; Identification needs User.timezone + notification_time_local when associating an identification with a reminder.

**Example:**

```typescript
// src/shared/contracts/catalog.ts
export type PlantSummary = {
  id: string
  userId: string
  name: string
  speciesId: string | null
}
```

```typescript
// src/contexts/catalog/application/queries/get-plant-summary.ts
import type { PlantSummary } from '@/shared/contracts/catalog'
import type { PlantRepository } from '../ports/plant-repository'

export function makeGetPlantSummary(plants: PlantRepository) {
  return async (plantId: string, userId: string): Promise<PlantSummary | null> => {
    const plant = await plants.findById(plantId, userId)
    return plant
      ? { id: plant.id, userId: plant.userId, name: plant.name, speciesId: plant.speciesId }
      : null
  }
}
```

```typescript
// src/contexts/reminders/application/use-cases/create-reminder.ts
import type { PlantSummary } from '@/shared/contracts/catalog'
type GetPlantSummary = (plantId: string, userId: string) => Promise<PlantSummary | null>

export function makeCreateReminder(deps: {
  reminders: ReminderRepository
  getPlantSummary: GetPlantSummary   // query service injected, NOT PlantRepository
  getUserSchedule: GetUserSchedule   // from IAM query service
}) {
  return async (input: CreateReminderInput): Promise<Reminder> => {
    const plant = await deps.getPlantSummary(input.plantId, input.userId)
    if (!plant) throw new PlantNotFound()
    // ...
  }
}
```

**Trade-offs:** Slightly more composition glue in the DI wiring file (one per context, at `src/contexts/{ctx}/composition.ts`). In exchange, Catalog can change its `Plant` aggregate internals without Reminders breaking — only the `PlantSummary` DTO is the contract. This is the discipline that makes the monolith splittable later.

**Why not "thin service layer that wraps a repository"?** Because a "service" becomes a dumping ground the moment any consumer needs a slightly different shape. Query functions per-consumer stay tiny and single-purpose. This is the "one query function per read pattern" approach of read-side CQRS, scaled down for a greenfield monolith.

---

### Pattern 4 — Inngest Event Choreography (async, durable, idempotent)

**What:** Contexts communicate asynchronously by emitting domain events via `inngest.send()`. Subscribers are Inngest functions in the consumer's `inngest/` folder. Each subscriber is idempotent by construction — it re-reads state, checks if work is already done, then acts.

**When:** Any cross-context state change that doesn't need to block the HTTP request. Fire-and-forget is the default.

**Event flow catalogue (MVP):**

```
signup (HTTP POST /auth/signup)
  ↓ IAM.sign-up use-case writes User row
  ↓ emits  user.signed_up
        ├──► notifications/send-email → "verify your email"
        └──► billing/provision-trial (new function) → writes Subscription row,
             emits subscription.status_changed{status:trialing}
                    └──► notifications/send-email → "welcome + trial"

verify email (GET /auth/verify?token=…)
  ↓ IAM.verify-email marks user verified
  ↓ emits  user.email_verified
        └──► (MVP: no subscribers; the <2-min clock starts here in PostHog)

consent granted (POST /consents)
  ↓ IAM.grant-consent writes ConsentLog
  ↓ emits  user.consent_granted{purpose, version}
        └──► (no subscribers in MVP; Identification reads consents synchronously via IAM query service at identify time)

identify plant (POST /identifications)
  ↓ Identification.create-identification
    • sync: check per-user cap via self-read, check consent via IAM query service
    • sync: atomic increment ProviderUsageCounter, invoke provider
    • sync: write Identification row, return top-3 to user
  ↓ emits  identification.succeeded{userId, speciesId, identificationId}
        ├──► species-care/augment-care-guide
        │    • only acts if CareGuide missing/incomplete for species
        │    • checks care_guide budget; exits if exhausted
        │    • writes CareGuide row source=augmented
        │    • emits  care_guide.augmented{speciesId, userId}
        │           └──► notifications/send-push (if user muted: noop)
        └──► (Catalog is PASSIVE on identify; the confirm-into-catalog step is
              a separate POST /plants with identification_id in body)

reminder created (POST /reminders, first ever for user)
  ↓ Reminders.create-reminder writes Reminder row
  ↓ (client-side, separately) asks for browser push permission
  ↓ client POSTs /push/subscribe → Notifications writes PushSubscription

reminders cron (every 5 min)
  ↓ reminders/dispatch Inngest function (cron: */5 * * * *)
  ↓ query: for each user with any Reminder due or overdue where subscription in (trialing, active)
           and daily_reminder_summary not yet emitted for today in user's tz
  ↓ advance next_due_at for auto-advanced entries (NO: per PRD §9, advance happens on Done, not on dispatch)
  ↓ emits  daily_reminder_summary.due{userId}  ONCE per user per day
        └──► notifications/send-push
             • fetches all user's PushSubscription rows
             • sends one nudge per device
             • deletes rows that return 410/404

stripe webhook (POST /webhooks/stripe)
  ↓ Billing.handle-webhook (sync in route handler):
    1. verify signature → fail: 401 no row no enqueue
    2. insert BillingEvent UNIQUE(event_id) → violation: 200 dedup
    3. inngest.send('billing.webhook.received', {billingEventId})
    4. return 200
  ↓ billing/process-webhook Inngest function:
    • load BillingEvent
    • transition Subscription state machine
    • emits  subscription.status_changed{userId, from, to}
        ├──► reminders/toggle-pause (no-op handler: next dispatch reads live status)
        ├──► iam/update-access-mode-cache (no-op in MVP)
        └──► notifications/send-email (dunning / cancellation / reactivation)

account deletion (POST /account/delete)
  ↓ IAM.request-deletion:
    • insert DataDeletionRequest, set User.deletion_requested_at
    • emits  user.deletion_requested{userId, graceEndsAt}
  ↓ iam/process-deletion Inngest function:
    await step.sleepUntil('grace', graceEndsAt)    // durable, 7 days
    if (await isCancelled(userId)) return          // silent exit
    step.run('delete-photos', …)
    step.run('delete-plants', …)     // via Catalog use-case (event-triggered, not import)
    step.run('delete-identifications', …)
    step.run('delete-reminders', …)
    step.run('delete-user-row', …)
    emits  user.deleted
        └──► notifications/send-email

data export
  ↓ IAM.request-data-export emits data_export.requested{requestId, userId}
  ↓ iam/generate-export:
    step.run('gather-json', async () => {…})
    step.run('gather-photos', async () => {…})    // stream to zip in Supabase Storage
    step.run('write-signed-url', …)
    update DataExportRequest.status = ready
    emits  data_export.ready{requestId}
        └──► notifications/send-email (link to signed URL)
```

**Idempotency discipline:**

- Every Inngest handler must be safe to run twice. Use `step.run('name', …)` with stable names so Inngest memoizes each step's result.
- For state transitions, read state first, skip if already in target state, then act. Do NOT rely on "I just emitted this event so it hasn't been processed yet."
- Stripe webhook idempotency is enforced at the database UNIQUE constraint on `BillingEvent.event_id`. Everything downstream reads that row, so replay is safe.

**Example — the 7-day deletion function:**

```typescript
// src/contexts/iam/inngest/process-deletion.ts
import { inngest } from '@/shared/events/sender'
import { composeIamDeletionFlow } from '../composition'

export const processDeletion = inngest.createFunction(
  { id: 'iam-process-deletion', retries: 3 },
  { event: 'user.deletion_requested' },
  async ({ event, step }) => {
    const { userId, graceEndsAt } = event.data

    await step.sleepUntil('grace-period', new Date(graceEndsAt))

    const deletion = composeIamDeletionFlow()
    const cancelled = await step.run('check-cancelled', () =>
      deletion.isCancelled(userId),
    )
    if (cancelled) return { status: 'cancelled' }

    await step.run('delete-photos',         () => deletion.deletePhotos(userId))
    await step.run('delete-plants',         () => deletion.deletePlants(userId))
    await step.run('delete-identifications',() => deletion.deleteIdentifications(userId))
    await step.run('delete-reminders',      () => deletion.deleteReminders(userId))
    await step.run('delete-consents',       () => deletion.deleteConsents(userId))
    await step.run('delete-user',           () => deletion.deleteUser(userId))

    await step.sendEvent('emit-deleted', {
      name: 'user.deleted',
      data: { userId },
    })
    return { status: 'completed' }
  },
)
```

`step.sleepUntil` is durable across deploys and redeploys — Inngest checkpoints the wake time and resumes on a fresh serverless invocation. This is specifically why the PRD picked Inngest over BullMQ or cron-scanning a table. ([Inngest: sleepUntil reference](https://www.inngest.com/docs/reference/functions/step-sleep-until))

**Trade-offs:** Async means "the UI cannot wait for the result." For Folhário this is fine everywhere except the identify flow itself, which is HTTP-sync on purpose. Subtle trap: resist the urge to emit an event and then immediately query for its side effect in the same request — that races. If you need the result, make it a direct use-case call, not an event.

---

### Pattern 5 — Provider Abstraction with Router + Breaker + Budget Gate

**What:** Three providers in Folhário (Plant ID, OpenAI-compat vision, Stripe) each hide behind a port interface. The **router** is a thin class living in `src/contexts/identification/application/provider-router.ts` that walks a configured provider list, gating each call on budget, counter, and breaker state.

**When:** Identification and care-guide augmentation follow the router pattern. Billing is single-provider in MVP (Stripe) but sits behind the `BillingProvider` port so a swap to Pagar.me/Iugu doesn't touch use-cases.

**Example — identification router:**

```typescript
// src/contexts/identification/application/ports/identification-provider.ts
export interface IdentificationProvider {
  name: 'plantid' | 'openai-vision'
  identify(input: {
    images: Buffer[]
    maxResults: number
    language: string
    minConfidence: number
  }): Promise<IdentificationResult[]>
}
```

```typescript
// src/contexts/identification/application/provider-router.ts
import type { IdentificationProvider } from './ports/identification-provider'
import type { BudgetGate } from './ports/budget-gate'
import type { CircuitBreaker } from './ports/circuit-breaker'

export class IdentificationRouter {
  constructor(
    private providers: IdentificationProvider[],  // ordered by priority
    private budget: BudgetGate,
    private breaker: CircuitBreaker,
    private clock: () => number,
    private totalWallClockMs = 50_000,
    private perCallMs = 30_000,
    private minSlackMs = 10_000,
  ) {}

  async identify(input: IdentifyInput): Promise<RouterOutcome> {
    const deadline = this.clock() + this.totalWallClockMs

    for (const provider of this.providers) {
      if (this.clock() + this.minSlackMs > deadline) {
        return { kind: 'failed', reason: 'provider_unavailable' }
      }
      if (this.breaker.isOpen(provider.name)) continue

      // Atomic increment BEFORE dispatch; rollback on provider failure is NOT needed
      // because a spent budget slot is the correct semantic (provider was attempted).
      const budgetOk = await this.budget.tryConsume({
        provider: provider.name,
        purpose: 'identification',
      })
      if (!budgetOk) {
        await this.breaker.onCeiling(provider.name)
        continue
      }

      try {
        const result = await withTimeout(
          provider.identify(input),
          Math.min(this.perCallMs, deadline - this.clock()),
        )
        this.breaker.onSuccess(provider.name)
        return { kind: 'success', provider: provider.name, results: result }
      } catch (err) {
        this.breaker.onFailure(provider.name)
        // log failure reason, try next provider
      }
    }
    return { kind: 'failed', reason: 'provider_unavailable' }
  }
}
```

**Placement of the three concerns:**

- **Budget gate** — lives inside the router, consults `ProviderBudget` + atomically increments `ProviderUsageCounter` in one Postgres transaction (`INSERT … ON CONFLICT UPDATE SET request_count = request_count + 1, estimated_cost_cents = estimated_cost_cents + $x RETURNING …`). The returned row tells you if you crossed the ceiling.
- **Circuit breaker** — in-memory per-instance struct (Map<provider, BreakerState>). Ephemeral is acceptable because Vercel functions are short-lived and the cost ceiling is DB-backed. Do NOT persist breaker state; it's a latency optimization, not a correctness mechanism.
- **Cost ceiling** — also the budget gate's job. The `purpose` discriminator (`identification` vs `care_guide`) is the key: two separate rows, two separate counters. Care-guide augmentation hitting its ceiling NEVER affects identification, which matches PRD §6.

**Per-user cap** (separate from per-provider ceiling) lives ONE layer above the router, in `create-identification` use-case:

```typescript
export function makeCreateIdentification(deps: Deps) {
  return async (input: Input): Promise<Outcome> => {
    const consent = await deps.iam.getActiveConsents(input.userId, 'identification_third_party')
    if (!consent) throw new ConsentRequired()

    const tier = await deps.billing.getActiveCapTier(input.userId)     // 'trialing' | 'active'
    const limits = await deps.repo.getLimits(tier)
    const usage = await deps.repo.getUserUsage(input.userId, tier.periodStart, tier.periodEnd)
    if (usage.daily >= limits.dailyCap || usage.period >= limits.periodCap) {
      throw new CapHit({ resetAt: usage.dailyResetAt })
    }

    const outcome = await deps.router.identify({ images: input.images, /* … */ })
    await deps.repo.saveIdentification(Identification.from(outcome, input))

    if (outcome.kind === 'success') {
      await deps.events.send('identification.succeeded', { userId: input.userId, /* … */ })
    }
    return outcome
  }
}
```

Note the ordering: **consent → cap → router**. The router is the last gate because it's the most expensive check (budget DB write + provider network call). Cap-hit gets rejected before any provider-side increment happens, which matches PRD §6's "NO provider call, NO Identification row, NO counter increment" rule.

**Trade-offs:** The router adds ~150 lines that you could otherwise just inline. The payoff is that swapping/adding a provider is a config change (add a row to the provider list) instead of a source dive. For MVP you'll thank yourself the first time Plant ID has an outage.

---

### Pattern 6 — Lint-enforced Context Boundaries

**What:** ESLint `no-restricted-imports` rule that forbids:
1. `app/` importing from `contexts/*/application/` directly (must go through `contexts/*/api/`).
2. `contexts/A/*` importing from `contexts/B/infrastructure/` or `contexts/B/domain/`.
3. `contexts/*/domain/` importing from `shared/db/`, `shared/adapters/`, `drizzle-orm`, or any `contexts/*/infrastructure/`.
4. `contexts/*/inngest/` importing from `contexts/*/api/`.

**When:** Day one of the codebase. Retrofitting is an order of magnitude harder.

**Why it matters:** DDD boundaries that aren't mechanically enforced decay in months. A lint rule is a machine-checkable architecture. Ship this in `eslint.config.js` before the first use-case lands.

---

### Pattern 7 — RLS as Defense in Depth, Not Primary Authorization

**What:** All authorization lives in the application layer — use-cases check `plant.userId === currentUser.id` and throw `NotFound` (never `Forbidden`, to avoid ID enumeration). Postgres RLS is the belt under the suspenders: a second wall that stops a use-case bug from spilling user A's data to user B.

**Connection model:**

- **Supabase `anon` key** — never used server-side. Only the PWA itself, for the Auth SDK's token handling if you choose to use it; otherwise not used at all.
- **Supabase `service_role` key** — used by Next.js route handlers and Inngest functions. It **bypasses RLS**. This is intentional: the app is the trusted subject. RLS policies still exist as a safety net for the specific scenario "someone obtains the service-role key and queries directly" — that's a compromise, but narrower than "every SQL bug ships user data."
- **Drizzle client** — connects via the service-role-keyed `DATABASE_POOL_URL` (Supavisor txn pooler, port 6543, `prepare: false`). This is an important gotcha:

```typescript
// src/shared/db/client.ts
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { env } from '@/shared/config/env'

const client = postgres(env.DATABASE_POOL_URL, {
  prepare: false,  // REQUIRED for Supavisor transaction mode
  max: 10,
})

export const db = drizzle(client, { schema })
```

Transaction-mode Supavisor does not keep a session between statements, which means prepared statements break with "prepared statement already exists" errors under load. `prepare: false` opts Drizzle into the mode Supavisor actually supports. ([Supabase troubleshooting: Disabling Prepared statements](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL), [Drizzle + Supabase docs](https://orm.drizzle.team/docs/connect-supabase))

**RLS policy shape (template):**

```sql
alter table plants enable row level security;

create policy "plants_owner_select" on plants
  for select
  using (user_id = auth.uid());

create policy "plants_owner_all" on plants
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

The app connects with service role and these policies are **bypassed** in normal operation. They matter only if (a) you introduce Supabase RPC / PostgREST client direct reads later, or (b) the service-role key is ever misused. For MVP they cost nothing to write and remove an entire class of "how did that user see another user's plant" incidents.

**When to bypass RLS deliberately:** The Inngest deletion handler needs to delete rows across many tables — this uses service role, no additional ceremony. The Stripe webhook handler needs to insert `BillingEvent` before the user's session exists — service role. Data export needs to read across every user-owned table — service role. These are all "the app is authoritative," not "the user is authoritative."

---

## Data Flow Reference

### Request flow — identify plant (happy path)

```
[PWA: camera → Zod validate client-side → POST /api/v1/identifications]
     │                                            body: {photo_urls[], idempotency_key}
     ▼
[Next.js middleware: JWT verify, rate limit (not this route), Sentry breadcrumb]
     ▼
[app/api/v1/identifications/route.ts → contexts/identification/api/handlers.ts]
     │   Zod parse
     ▼
[use-case: createIdentification]
     ├─(query)→ IAM.getActiveConsents(userId, 'identification_third_party')
     ├─(query)→ Billing.getActiveCapTier(userId)
     ├─(read )→ IdentificationRepository.getUserUsage(userId, window)
     ├─(read )→ IdentificationRepository.getLimits(tier)
     ├─(call )→ IdentificationRouter.identify(images)
     │            ├─ budget gate: atomic SQL increment ProviderUsageCounter
     │            ├─ breaker check per provider
     │            ├─ Plant ID adapter call (http)
     │            │   or fallover to OpenAI vision
     │            └─ returns IdentificationResult[]
     ├─(write)→ IdentificationRepository.save(row)
     └─(emit )→ events.send('identification.succeeded', {…})   // fire-and-forget
     ▼
[http map: success → 200 + top-3 JSON ; errors → cap_hit 429 | provider_unavailable 503]
     ▼
[PWA renders result cards]
```

### Async fanout — after identification.succeeded

```
identification.succeeded  (emitted by Identification)
     │
     ├──► species-care/augment-care-guide
     │       • read Species row (flag_status, existing CareGuide)
     │       • if has complete CareGuide: return (noop)
     │       • budget gate: consume care_guide counter for chosen provider
     │       • if gate fails: log cost_ceiling_reached, return
     │       • call CareGuideProvider.augment(species, missing_fields, 'pt-BR')
     │       • upsert CareGuide row source=augmented, bump version
     │       • set Species.flag_status=resolved, resolved_by='augmentation'
     │       • emit care_guide.augmented{speciesId, userId}
     │
     └──► (no other subscribers)

care_guide.augmented
     │
     └──► notifications/send-push
             • fetch user's PushSubscription rows
             • (MVP policy: NO push on augmentation — only daily reminder nudge)
             • in MVP this handler is a no-op for this event;
               kept wired for future "your care guide is ready" UX
```

### Sync query fanout — when listing plants with care info

```
GET /api/v1/plants (authed)
     ▼
[catalog/api/handlers → listUserPlants use-case]
     ├─(read )→ PlantRepository.listByUser(userId, sort)
     │           returns Plant[] (Catalog's aggregate)
     │
     │   for each plant, the UI needs species common name + toxicity chip:
     │
     ├─(query)→ SpeciesCare.getSpeciesRef(speciesIds)       // batched DTO
     └─(query)→ SpeciesCare.hasCareGuide(speciesIds, locale) // batched DTO
     ▼
[http map: JSON with PlantSummary[] + nested SpeciesRef DTO]
```

Note the **batching**: the query service takes an array of IDs. N+1 queries across contexts is the first scaling cliff in a "thin query service" architecture; design the signatures batched from day one.

---

## Build Order (with explicit dependency rationale)

This is not the roadmap (the orchestrator owns that) — this is the dependency graph the roadmap must respect.

```
         ┌───────────────────────────────────────────┐
         │ M0: Foundation (no context yet)            │
         │ - Repo layout, ESLint boundaries           │
         │ - Drizzle schema bootstrap, migrations     │
         │ - src/shared/{db, events, contracts, ...}  │
         │ - Supabase local + CI pipeline             │
         │ - Inngest dev server wired                 │
         └─────────────────┬─────────────────────────┘
                           ▼
         ┌─────────────────────────────────────────┐
         │ M1: IAM  (THE spine — blocks everything)│
         │ - User, ConsentLog, PartnerStore        │
         │ - signup + email verify gate            │
         │ - JWT middleware                        │
         │ - DataDeletionRequest + inngest sleep   │
         │ - DataExportRequest                     │
         └──┬──────────────┬──────────────┬───────┘
            │              │              │
            ▼              ▼              ▼
    ┌──────────────┐  ┌──────────┐  ┌──────────────┐
    │ M2: Billing  │  │ M3: Catalog │ M4: Species   │
    │ (needs User +│  │ (needs User)│ & Care        │
    │  subscription│  │ Plant,      │ (indep data,  │
    │  state for   │  │ PhotoEntry, │  but prefill  │
    │  cap tier)   │  │ storage     │  needs User)  │
    └──────┬───────┘  │  adapter)   │               │
           │          └──────┬──────┘ ┌─────────────┘
           │                 │        │
           └─────┬───────────┘        │
                 ▼                    │
         ┌──────────────────────┐    │
         │ M5: Identification   │◄───┘
         │ - needs IAM.consent  │    (reads Species ref for display,
         │ - needs Billing.tier │     but does NOT write Species/CareGuide —
         │ - router + budget    │     augmentation is Species&Care's job)
         │ - Plant ID adapter   │
         │ - OpenAI adapter     │
         └──────┬───────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ M6: Reminders                     │
         │ - needs Catalog.Plant (query svc) │
         │ - needs IAM.timezone (query svc)  │
         │ - needs Billing.status (pause)    │
         │ - inngest cron                    │
         └──────┬───────────────────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ M7: Notifications                 │
         │ - needs Reminders events          │
         │ - needs IAM email                 │
         │ - Resend + web-push adapters      │
         │ - PushSubscription                │
         │ - Inngest send-email + send-push  │
         └───────────────────────────────────┘
```

**Reasoning per edge:**

- **IAM first, always.** Every other context reads User. Zero contexts are meaningful without accounts. Signup + email verify + JWT middleware is the smallest thing you can ship first and have a working deployment.
- **Billing before Identification,** because `IdentificationLimit` is keyed by subscription tier and there is no sane way to answer "what's this user's daily cap?" without a subscription row. Even if Billing is a stub that always returns `trialing`, you need the contract.
- **Catalog before Identification** only weakly — you could technically build Identification first and have it write rows without a Plant FK. But the prefill-from-identify UX flow is the core <2-min promise, and you can't demo that without a Catalog target. So Catalog lands before Identification even though it doesn't import from Identification.
- **Species & Care can build in parallel with Catalog.** They share no code. The only touch point is Catalog's `listUserPlants` calling `SpeciesCare.getSpeciesRef` for display enrichment — easy to stub while Species & Care is in flight.
- **Identification depends on Species & Care only weakly** — it reads `Species` for display in results and to write `species_id` on saved identifications. This read can be a stub during Species & Care development.
- **Reminders is last before Notifications** because it needs Catalog's `Plant` query service, IAM's user schedule query service, and Billing's status. Three dependencies. Any earlier and you're stubbing three contexts at once.
- **Notifications comes last** because it only consumes events. Build it after the events it consumes exist. The MVP's single real notification (daily reminder nudge) depends on Reminders dispatching `daily_reminder_summary.due`.

**What can parallelize within this order:**

- M2 (Billing) and M3 (Catalog) can run in parallel after M1. Different aggregates, no shared code.
- M4 (Species & Care) can start as soon as M1 ships.
- Inside M5, the two provider adapters (Plant ID, OpenAI vision) can be written in parallel by two people — they're separate files behind the same interface.

**Launch blockers the build order must accommodate:**

- The ≥200 curated care guides corpus (PRD §8 Track 1) is a content task running in parallel with engineering, not gated on Species & Care being code-complete. The seed file just needs the `CareGuide` schema locked — which is M0 territory.
- DPO + privacy policy + Stripe pricing — business blockers, do not gate code. Build with placeholder copy; swap before first prod deploy.

---

## Keeping the Native Door Open

PRD §1 requires "every architectural decision keeps the native door open." The architecture above accomplishes this by five specific choices, each of which would be a regret to undo later:

1. **REST under `/api/v1` with versioned URLs.** A native app will consume the exact same endpoints, byte for byte. No server-rendered state. No session cookies — JWT bearer only.
2. **Per-device JWT, no server sessions** (PRD §14). A native app is just another device with its own token and its own PushSubscription row. The "device_id" column in PushSubscription is already per-device, not per-user.
3. **Provider abstractions for identification / care / billing.** A native app that directly hits Stripe or Plant ID would be a security disaster. The server-side provider layer means native clients talk to your API, not to third parties. This is the only sustainable model.
4. **IANA timezones captured at signup, stored on User.** Every native runtime (iOS, Android, desktop) exposes IANA timezones. Any tz handling that assumed browser-only would break. PRD §9 already commits to this and the architecture honors it end-to-end — the reminders dispatcher reads `User.timezone`, not the request.
5. **Offline queue via idempotency key on mutating endpoints.** A native app will have its own offline queue. Accepting a client UUID as `Idempotency-Key` on every mutating endpoint means the native client replays queued actions the same way the PWA does — no new server code.

**What to explicitly NOT do** because it would close the native door:

- No cookies as the auth mechanism. Bearer token only.
- No Next.js server actions for mutations that a native client would also need. Route handlers under `/api/v1/` only.
- No Supabase Auth client-side only. Wrap it in an `AuthProvider` port so a native client can use the same adapter or swap to OAuth PKCE flow.
- No CSRF tokens on mutating routes. Bearer token auth makes CSRF moot; don't design a defense that assumes browser context.

---

## Scaling Considerations

Folhário is a consumer app for Brazilian plant beginners. Hypothetical ceiling at MVP + 6 months is probably 5k-50k DAU. Don't over-engineer.

| Scale | What's fine | First bottleneck | Action |
|-------|-------------|------------------|--------|
| 0–1k users | Everything above. One Vercel project, one Supabase project. Inngest free tier. | none | ship |
| 1k–10k users | Same architecture. | `listUserPlants` without batched Species query (N+1); reminders/dispatch cron full-scan | add composite index `(user_id, is_active)` on Reminder; batch the Species query from Catalog |
| 10k–100k DAU | Same architecture, maybe split Supavisor connection pool tuning. | identification provider ceiling ($5/day each) becomes real money; ProviderUsageCounter row contention under spike | raise per-provider ceilings via DB write; shard ProviderUsageCounter by hour instead of day if contention bites (unlikely); add Postgres read replicas if read latency slides |
| 100k+ DAU | Reconsider splitting contexts into separate deploys. | Route handler cold starts on Vercel if spikey traffic; Inngest step fan-out if reminders/dispatch processes all users in one function | pre-warm Vercel; partition reminders/dispatch by user hash into N parallel functions; consider extracting Identification to a dedicated service sized for the provider latency profile |

**The architecture is designed to split later.** Because every cross-context touch point is either an Inngest event or a query-service call (never a direct table read), extracting Identification into its own deploy is a matter of:
1. Run its code behind its own URL.
2. Point the main app's provider router stub at it via HTTP.
3. Replace the in-process `events.send()` call in `createIdentification` with a call to the extracted service's HTTP surface.

That's mechanical, not architectural. But it's almost certainly premature for Folhário — the monolith is cheaper to operate and reason about until real scale shows up.

---

## Anti-Patterns (Folhário-specific)

### Anti-Pattern 1: Drizzle in route handlers

**What people do:** Inline `db.select().from(plants).where(...)` in `app/api/v1/plants/route.ts`. "It's simpler."
**Why it's wrong:** The route handler now knows both HTTP (Request/Response) and persistence (table shape). You cannot unit test it without spinning up Postgres. You cannot reuse the logic from an Inngest handler. Every PRD change ripples through route handlers.
**Instead:** Route handler calls `contexts/{ctx}/api/handlers.ts` which calls a use-case which depends on a `Repository` port. The `drizzle-orm` import only appears in files under `infrastructure/`.

### Anti-Pattern 2: Context A reaches into Context B's repository

**What people do:** Reminders imports `PlantRepository` to check plant ownership. "Catalog and Reminders are basically the same thing, who cares."
**Why it's wrong:** You've coupled the Reminders context to Catalog's persistence-layer contract. Any change to `PlantRepository` (new method signature, different return shape) breaks Reminders without a Reminders-side test catching it. The bounded context is fiction at that point.
**Instead:** Reminders depends on a function type `GetPlantSummary = (plantId, userId) => Promise<PlantSummary | null>` and Catalog provides an implementation via its query-service module. `PlantSummary` is a `shared/contracts/catalog.ts` DTO, not the `Plant` aggregate.

### Anti-Pattern 3: Events as RPC

**What people do:** Emit `plant.created` and then, in the same request handler, block on a response event `plant.care_guide_loaded` before returning 200. "It's async communication."
**Why it's wrong:** That's request/response wearing an event-bus hat. You now have the worst of both: network latency, retry semantics you don't want, AND coupling between caller and callee. Inngest is not a synchronous RPC framework.
**Instead:** If the caller needs an answer, make it a direct in-process use-case call through a query service. If the caller does NOT need an answer (which is almost always true for real events), emit the event and return immediately.

### Anti-Pattern 4: Rolling breaker or budget state in-memory only

**What people do:** Circuit breaker state as a module-scoped `Map`. "Vercel functions are warm for a while, it'll mostly work."
**Why it's wrong:** That's true of the **breaker** (it's a latency optimization, losing state just means re-attempting a cold provider), but it is NOT true of the **budget counter**. If budget state is in memory, two concurrent Vercel functions will both blow through the $5/day ceiling because neither sees the other's increment.
**Instead:** Breaker in memory is fine. Budget counter MUST be in Postgres with `INSERT … ON CONFLICT UPDATE SET count = count + 1 RETURNING` — atomic, durable, visible across every instance.

### Anti-Pattern 5: Reading Subscription inside Reminders' cron without a query service

**What people do:** `reminders/dispatch` cron directly joins `Subscription` via Drizzle to filter paused users. "It's just SQL."
**Why it's wrong:** Reminders now knows Billing's schema. Change `Subscription.status` enum, break Reminders.
**Instead:** The cron calls `Billing.getPauseSet()` or iterates users and calls `Billing.isInReadOnlyMode(userId)` (batched). SQL stays inside Billing's repo.

### Anti-Pattern 6: Using `anon` key server-side

**What people do:** Import `createClient` from `@supabase/supabase-js` with the anon key in a route handler. "The user's JWT will be attached automatically."
**Why it's wrong:** You'll end up with two parallel authorization worlds (RLS via JWT for some queries, service-role for others). Consistency is gone; reasoning is gone; debugging is a nightmare.
**Instead:** Server-side database access goes through the Drizzle client configured with service-role-keyed `DATABASE_POOL_URL`. Authorization is the use-case's job. RLS is defense in depth against that bug, not the primary wall.

### Anti-Pattern 7: Forgetting `prepare: false` on postgres-js

**What people do:** Default postgres-js config with Supavisor transaction mode. Works in dev. In prod under load: "prepared statement s17 already exists" errors cascading.
**Why it's wrong:** Supavisor txn mode does not keep a session between statements, so prepared statements collide across reused pooler-assigned connections.
**Instead:** `postgres(url, { prepare: false })` for the runtime pool. Migrations run through the direct connection (port 5432) where prepared statements are fine. ([Supabase: Disabling Prepared statements](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL))

### Anti-Pattern 8: Inngest function that isn't idempotent

**What people do:** `reminders/dispatch` emits `daily_reminder_summary.due` on every cron tick, relying on "the Inngest event concurrency key" to deduplicate.
**Why it's wrong:** Inngest retries, and cron ticks can overlap during redeploys. You'll send two push nudges on some days.
**Instead:** Inside the handler, record a `ReminderDispatchLog` row keyed `(user_id, local_date)` with a unique constraint. Insert before emitting. If the insert conflicts, skip. This is the pattern for "once per user per day."

---

## Integration Points

### External Services

| Service | Integration Pattern | Gotchas |
|---------|---------------------|---------|
| Supabase Postgres | Drizzle via Supavisor txn pooler (port 6543, `prepare: false`). Direct connection (port 5432) for migrations only. | Prepared statements off; migrations need their own env var pointing at direct URL. |
| Supabase Auth | Port interface `AuthProvider` in IAM; implementation in `shared/adapters/supabase-auth-provider.ts`. Server uses service role to admin-manage users (verify email, delete). | Email verification link includes a token; handle the callback server-side, don't trust client-claimed verification state. |
| Supabase Storage | Port interface `StorageProvider`; implementation issues signed URLs with short TTL. Private buckets only. | Never return storage URLs without signing them. Data export zip streamed into `data-exports` bucket from Inngest function. |
| Inngest | Single `/api/inngest` route exports all functions via `serve({ functions })`. One `INNGEST_SIGNING_KEY` per env. | Function handlers must be pure — any closure over request state breaks durability. Use `step.run` generously. |
| Stripe | `BillingProvider` port + `stripe-billing-provider.ts` impl. Webhook handler in `contexts/billing/api/handlers.ts`, registered at `/api/v1/webhooks/stripe`. | The three-step webhook path (verify → insert BillingEvent → enqueue Inngest) is sync in the route handler because Stripe's retry semantics need a fast 200. NO async work in the route handler itself. |
| Plant ID | `IdentificationProvider` port; impl in `shared/adapters/plant-id-provider.ts`. Mode gate via `IDENTIFICATION_PROVIDER_MODE=stub\|real`. | Plant ID API keys are per-environment; CI uses stub mode unconditionally. Real calls ONLY from preview/prod. |
| OpenAI-compatible vision | Same interface, swappable base URL. | Prompt + model pinned in source via `LLM_MODEL`, versioned with deploy. Don't use "latest" — reproducibility lost. |
| Resend | `EmailSender` port; impl wraps Resend SDK. Only called from `notifications/*` Inngest handlers, never from route handlers. | Sandbox domain in preview; real domain needs DNS + SPF + DKIM before live. |
| PostHog (EU) | `Analytics` port; impl wraps PostHog JS for browser + server SDK for server events. | EU host mandatory for LGPD. Don't swap to US. |
| Sentry | Via Next.js SDK. Source maps uploaded from `deploy-production.yml` CI. | PII scrubbing configured in `src/shared/telemetry/sentry.ts` per PRD §13 rules. Identification route bodies dropped entirely in `beforeSend`. |
| web-push + VAPID | Port `PushSender`; impl wraps `web-push` lib. Only called from `notifications/send-push`. | Subscription delete on 410/404 is mandatory (PRD §15); this is self-healing pruning. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Catalog ↔ Species & Care | Sync: query service `getSpeciesRef(ids)`, `hasCareGuide(speciesId)`. Async: Catalog consumes `identification.succeeded` (indirectly, via the confirm-into-catalog flow) | Catalog treats `species_id` as opaque FK. Batched reads. |
| Identification ↔ Species & Care | Async event `identification.succeeded` triggers `species-care/augment-care-guide`. Sync: Identification reads `Species` ref for display via query service. | No write from Identification into Species or CareGuide — augmentation is owned by Species & Care. |
| Identification ↔ IAM | Sync: `getActiveConsents`, `getUserSchedule`. Async: `user.consent_granted` is emitted but Identification does not consume it (reads live consent at request time). | Consent revocation is live; don't cache. |
| Identification ↔ Billing | Sync: `getActiveCapTier(userId)` → `trialing\|active`. | The tier drives which `IdentificationLimit` row to read. |
| Catalog ↔ IAM | Sync: none needed at runtime. Async: Catalog consumes `user.deletion_requested` (triggers delete via the Inngest process-deletion function, NOT direct). | Catalog doesn't import IAM anything at runtime. |
| Reminders ↔ Catalog | Sync: `getPlantSummary(plantId, userId)` at reminder creation. Async: Reminders consumes `plant.deleted` to cascade-delete reminders. | `Plant.id` is the join key; Reminders stores it, never the Plant aggregate. |
| Reminders ↔ IAM | Sync: `getUserTimezoneAndNotificationTime(userId)` at schedule-compute time. | Called by the `advance_next_due_at` use-case, not by the cron directly. |
| Reminders ↔ Billing | Async: consumes `subscription.status_changed`. Sync: the dispatch cron calls `Billing.isInReadOnlyMode(userId)` (batched). | Pause = "skip this user's entries in dispatch." No data mutation needed. |
| Notifications ↔ everyone | Consumes events only. Writes only `PushSubscription`, `ReminderDispatchLog` (if introduced per anti-pattern 8). | Notifications is a pure consumer. |
| Billing ↔ IAM | Async: Billing consumes `user.signed_up` to provision a trial subscription. Sync: none. | Billing writes `Subscription` row after signup event; the signup HTTP response returns before that row exists. Client UX must not depend on Subscription being present immediately. |

---

## Architectural Risks & Debt to Monitor

These are the things that will bite if ignored. Not blockers — watch items.

1. **Query service N+1.** Every cross-context read path should have a batched variant. Add `listPlantsWithSpecies` as a single Catalog query that internally calls `Species.getSpeciesRefs(ids)` batched. Monitor with PostHog: if any HTTP route takes >1 round-trip per entity returned, it's a query that needs batching.

2. **Inngest at-least-once delivery.** Every handler must be idempotent. Spot-check: can I invoke this handler twice in a row with the same event payload and get the same final state? If not, fix before landing. Create a test harness that runs each handler twice and asserts convergence.

3. **Event schema drift.** As the app evolves, event payloads will change. Zod-validate every payload on receive AND on send. A failed validation on receive should fail the function (Inngest retries), not silently drop. Consider adding `event_version` to every payload from day one so you can handle old events in the handler.

4. **Budget counter hot row.** `ProviderUsageCounter` has at most 4 rows per day (2 providers × 2 purposes). Under real traffic, two rows take 99% of writes. Postgres handles this fine up to a few hundred writes/sec per row; beyond that, consider sharding by hour. Not a day-one worry; monitor via Supabase slow-query dashboard.

5. **Circuit breaker ghost state across Vercel cold starts.** The in-memory breaker loses state when a function instance cycles. That's a feature (self-healing) but means the breaker is not a strong guarantee, only an optimization. The budget gate is the correctness mechanism; the breaker just prevents burning budget on a known-dead provider.

6. **Inngest function registration drift.** Every new function must be added to the `serve({ functions: [...] })` call in `src/app/api/inngest/route.ts`. Forgetting = silent no-op in prod. Add an integration test that hits `/api/inngest` and asserts the function list matches an expected set.

7. **Drizzle schema per-context fragmentation.** The "split by context" rule is a documentation choice, not a DB choice. All tables live in one Postgres schema (`public`). If someone adds a Drizzle relation that crosses context boundaries (`relations(plant, ({ one }) => ({ species: one(species) }))`), lint won't catch it. Code review must. The rule: Drizzle relations inside one context file are fine; cross-file relations are not, even though Drizzle allows them.

8. **The `notifications` context being "too passive."** Because it only consumes events and has no interesting domain logic, it's tempting to skip the context boundary entirely and put the Resend/web-push calls in an `adapters/` file directly. Resist — the context boundary is where push-permission policy, muting, and per-device fanout live. These ARE domain rules, even though the aggregate is thin.

9. **Route handlers in `app/api/v1/` drifting away from 10 lines.** Add a CI rule: any file under `app/api/v1/` longer than 20 lines requires a PR comment explaining why. If route.ts grows, it's absorbing logic that belongs in `contexts/{ctx}/api/`.

10. **RLS policies going stale.** Because the app bypasses RLS via service role in normal operation, RLS policy bugs are invisible until someone needs them. Add a once-per-CI "RLS smoke test" that connects with the anon key and asserts each table rejects access. This catches "we forgot to add the policy for the new table."

---

## Sources

- **Inngest — Sleep until (`step.sleepUntil`)** — durable sleep semantics, max 1-year duration, free tier limit 7 days (covers Folhário's 7-day deletion grace exactly). Verified against current docs. [inngest.com/docs/reference/functions/step-sleep-until](https://www.inngest.com/docs/reference/functions/step-sleep-until)
- **Inngest — Steps & multi-step functions** — `step.run` memoization and retry-safety semantics. [inngest.com/docs/learn/inngest-steps](https://www.inngest.com/docs/learn/inngest-steps)
- **Inngest — Sleeps feature page** — durability across serverless cold starts and redeploys. [inngest.com/docs/features/inngest-functions/steps-workflows/sleeps](https://www.inngest.com/docs/features/inngest-functions/steps-workflows/sleeps)
- **Supabase — Disabling prepared statements** — Supavisor transaction-mode incompatibility with pg prepared statements; `prepare: false` requirement for postgres-js. [supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL)
- **Supabase — Supavisor FAQ** — connection pooler modes (transaction vs session), port 6543 vs 5432. [supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
- **Drizzle ORM — Supabase guide** — Drizzle + postgres-js configuration against Supavisor, `prepare: false`. [orm.drizzle.team/docs/connect-supabase](https://orm.drizzle.team/docs/connect-supabase)
- **Supabase — Connect to your database** — direct vs pooler connection strings, when to use each. [supabase.com/docs/guides/database/connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- **Folhário PRD (source of truth)** — `docs/CAVE-PRD.md` §2 (tech stack), §3 (bounded contexts), §4 (data model), §5 (API rules), §6 (identification), §8 (care guides), §9 (reminders), §12 (auth & subscription), §13 (LGPD), §14 (multi-device), §15 (push), §20 (CI/CD), §21 (security).

**Confidence breakdown:**
- Event catalogue, Inngest patterns, durable sleep: **HIGH** (verified against current docs; PRD is explicit).
- Supavisor + Drizzle gotchas: **HIGH** (officially documented as a trap).
- Query-service shape, contract module, lint-enforced boundaries: **MEDIUM** (opinionated pattern chosen over competing DDD variants; the ecosystem has 3-4 reasonable answers here and this is the one most defensible for Folhário's size and roadmap).
- Build order: **HIGH** (derived mechanically from the ownership matrix; dependencies are concrete).
- Native-door-open checklist: **HIGH** (consistent with PRD §1 non-negotiable and multi-device section §14).

---
*Architecture research for: Folhário MVP*
*Researched: 2026-04-14*
