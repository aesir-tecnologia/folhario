# Phase 6: Identification Flow & Cost Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 06-identification-flow-cost-controls
**Mode:** --auto (fully autonomous — no AskUserQuestion calls; Claude selected recommended options for all areas)
**Areas discussed:** Provider adapter interface & router, Per-user cap tracking, Circuit breaker state storage, LGPD consent check + version tracking, Identify screen UX, Result selection & plant creation, Identification history screen, Budget ceiling alert, Offline + read-only gates, Telemetry

---

## Provider Adapter Interface & Router

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript interface at domain level, concrete providers in infrastructure | Stateless providers, router at application layer handles budget+breaker checks and failover logic | ✓ |
| Router embedded inside each provider | Providers know about each other — tight coupling | |

**Auto-selected:** TypeScript interface + stateless providers + separate router class
**Notes:** Router receives remaining wall-clock time from route handler to enforce ≥10s remaining budget before fallover. `IDENTIFICATION_PROVIDER_MODE=stub` respects Phase 1 requirement.

---

## Per-User Cap Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| COUNT on `identifications` table per user/day/period | No new table; atomicity via PostgreSQL advisory lock per user | ✓ |
| Dedicated user cap counter table with atomic UPSERT | More explicit but adds a table; Phase 2 didn't seed it | |

**Auto-selected:** COUNT query on existing `identifications` table + `pg_try_advisory_xact_lock` per user for COST-09 serialization
**Notes:** `IdentificationLimit` rows read with 30s in-process TTL cache to satisfy COST-10 (DB tuning without redeploy).

---

## Circuit Breaker State

| Option | Description | Selected |
|--------|-------------|----------|
| New `provider_circuit_breakers` table (DB-backed, survives redeploys) | Reliable on Vercel serverless; no in-memory state loss | ✓ |
| In-memory state per process | Resets on Vercel redeploy/cold-start — breaks breaker semantics | |
| Add columns to `provider_budgets` | Breaker is per-provider, budgets are per-(provider,purpose) — mismatch | |

**Auto-selected:** New `provider_circuit_breakers` table seeded at migration time
**Notes:** Thresholds: 5 consecutive failures in 10-minute window → open. 60s cooldown → half-open. First success in half-open → closed. Budget exhaustion (`cost_ceiling_reached`) does NOT count as a failure for breaker purposes.

---

## LGPD Consent Check + Version Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Backend check first, return `consent_required` 403, frontend shows modal | Consent gate is authoritative on the server; frontend reacts to 403 code | ✓ |
| Frontend checks consent state before calling identification endpoint | Race condition risk; consent state could be stale | |

**Auto-selected:** Backend check at use-case step 0; frontend shows modal on `consent_required` 403
**Notes:** `POST /api/v1/iam/consents` is the consent grant endpoint (reuses existing IAM consent pattern from Phase 4). `Identification.consentVersion` stores `policy_versions.version` string at request time.

---

## Identify Screen UX

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page state machine (idle→picking→uploading→identifying→results) | No route navigation during flow; results inline; Phase 5 placeholder replaced | ✓ |
| Separate `/identify/results` route | Back-button semantics are awkward for identification flow | |

**Auto-selected:** Single page `/identify` with client-side state machine; results rendered inline
**Notes:** Static capture guide shows in idle+picking states. 2×2 grid with Lucide plant icons as placeholders. Multi-photo: 1-5 photos. 48s AbortController timeout (leaves 2s overhead under 50s wall-clock budget).

---

## Result Selection & Plant Creation

| Option | Description | Selected |
|--------|-------------|----------|
| `POST /api/v1/identifications/{id}/confirm` — atomic TX: createPlant + update identification.plant_id | Single TX; Phase 5 createPlant use-case's `source:'identification'` branch ready | ✓ |
| Two separate calls (create plant then PATCH identification) | Non-atomic; plant could be created without identification link on failure | |

**Auto-selected:** Single `confirm` endpoint with atomic TX using Phase 5 createPlant use-case
**Notes:** Result selection opens a ModalSheet with pre-filled name (editable). "Não é nenhuma delas" triggers manual correction flow via `POST /api/v1/identifications/{id}/correct`.

---

## Identification History Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Two surfaces: per-plant at `/catalog/{plantId}/identifications` + global at `/identify/history` | Wires Phase 5 placeholder; global history serves the re-associate use case | ✓ |
| Per-plant only | Global history inaccessible for identifications that weren't linked to a plant | |

**Auto-selected:** Both surfaces; same API endpoint with optional `?plantId=` filter
**Notes:** 24h signed URLs for photo thumbnails (same pattern as Phase 5 D-20). Re-associate CTA for success rows with `plantId = null`.

---

## Claude's Discretion

- Exact Tailwind compositions for confidence ladder bar states
- Provider timeout values per provider (within 30s per-call cap)
- Plant.id API request shape + OpenAI-compat system prompt for identification
- `cost_per_request_cents` seed values (suggested: 2 cents Plant.id, 3 cents OpenAI-compat)
- Species name matching strategy for manual correction (normalized lowercase exact)
- Capture guide illustration assets (Lucide icons as placeholders)
- Exact error state pt-BR copy strings
- AbortController vs Promise.race for 48s timeout
- File splits within identification context directories

## Folded Todos (score ≥ 0.4)

- **dev-mode service-worker unregister** — Phase 6 Serwist NetworkOnly setup for identification routes; dev-mode stale cache could interfere.
- **Offline + axe + bottom-nav E2E failure cluster** — Phase 6 offline gate (IDENT-20) could inherit E2E flakiness if unresolved.

## Deferred Ideas

- Re-identification from plant profile ("Identificar novamente") — post-MVP
- Batch identification / multi-plant session — post-MVP
- Species search without a photo — Phase 7 or post-MVP
- Provider cost analytics dashboard — Phase 13
- Fix gsd-sdk wave misreport — pure tooling (reviewed, not folded)
- Replace vite-tsconfig-paths plugin — pure tooling (reviewed, not folded)
