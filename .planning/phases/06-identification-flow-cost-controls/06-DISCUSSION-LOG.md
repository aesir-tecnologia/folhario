# Phase 6: Identification Flow & Cost Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 06-identification-flow-cost-controls
**Mode:** `--auto`
**Areas discussed:** Provider routing and adapters, caps/budgets/counters/breakers, LGPD consent, Identify screen state machine, result confirmation and history, offline/read-only/telemetry/prerequisites

---

## Provider Routing and Adapters

| Option | Description | Selected |
|--------|-------------|----------|
| Provider adapter interface | Normalize Plant.id, OpenAI-compatible, and stub providers behind a server-side domain interface. | ✓ |
| Inline provider calls in route handler | Faster to write but breaks route-handler thinness and provider swap boundaries. | |
| Client-selected provider | Leaks backend policy and budget routing to the UI. | |

**User's choice:** Auto-selected recommended option.
**Notes:** Preserves the project-level Plant.id primary + OpenAI-compatible fallback decision.

---

## Caps, Budgets, Counters, and Circuit Breaker

| Option | Description | Selected |
|--------|-------------|----------|
| DB-backed atomic controls | Use IdentificationLimit, ProviderBudget, ProviderUsageCounter UPSERTs, advisory lock, and breaker table. | ✓ |
| In-memory counters | Simpler but unsafe across serverless instances. | |
| Provider dashboard-only controls | Does not satisfy pre-dispatch budget/cap requirements. | |

**User's choice:** Auto-selected recommended option.
**Notes:** Adds `cost_per_request_cents`, `last_alerted_at`, and `provider_circuit_breakers`.

---

## LGPD Consent and Provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Backend gate before dispatch | Check `identification_third_party` ConsentLog before cap/budget/provider work. | ✓ |
| Frontend-only consent modal | Easy to bypass and not auditable enough. | |
| Signup-time blanket consent | Conflicts with contextual Art. 33 transfer consent. | |

**User's choice:** Auto-selected recommended option.
**Notes:** Consent grant route is `/api/v1/iam/consents`; Identification stores policy version string.

---

## Identify Screen State Machine

| Option | Description | Selected |
|--------|-------------|----------|
| Single-route state machine | Replace the placeholder with explicit `/identify` states and inline results. | ✓ |
| Separate results route | Adds navigation overhead and more restore-state complexity. | |
| Wizard flow | Higher friction for the under-2-minute first-value promise. | |

**User's choice:** Auto-selected recommended option.
**Notes:** Covers consent, photo selection, upload, identifying, results, zero-results, cap, timeout, provider-unavailable, offline, and read-only.

---

## Result Confirmation and History

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm endpoint + history | Bottom sheet submits to confirm endpoint, creates Plant transactionally, links Identification, emits event, lists history. | ✓ |
| Direct client plant creation | Leaks orchestration and breaks atomic linking. | |
| Defer history | Fails IDENT-08/UI-12. | |

**User's choice:** Auto-selected recommended option.
**Notes:** Reuses Phase 5 `createPlant` identification branch.

---

## Offline, Read-Only, Telemetry, and Prerequisites

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit gates and telemetry | Block offline identify, show read-only paywall, keep history viewable, fire server-side privacy-clean telemetry. | ✓ |
| Queue offline identification | Conflicts with provider network and timing requirements. | |
| Client-side telemetry | Higher privacy risk and less authoritative. | |

**User's choice:** Auto-selected recommended option.
**Notes:** Auto-folded six todo matches into planning inputs, especially visual/E2E and service-worker-cache risks.

---

## Agent Discretion

- Exact provider request shapes after current docs are checked.
- Exact Tailwind compositions and component file splits.
- Provider timeout constants within the 30s per-call cap.
- Stub provider fixture data and provider cost seed refinements.
- Initial pt-BR copy polish within the contracts captured in `06-CONTEXT.md`.

## Deferred Ideas

- Care-guide rendering: Phase 7.
- Toxicity badge: Phase 7.
- Re-identification from an existing plant: post-MVP.
- Batch identification: post-MVP.
- Provider cost analytics dashboard: Phase 13.
