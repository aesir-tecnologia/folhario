// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 / §6 — Identification bounded-context events. Identification.failed
// includes the failure reason from the closed PRD §5 registry; the
// `provider.ceiling_reached` event is operator-facing (cost-ceiling alert
// path; PRD §11/§13). `cost_ceiling_reached` is INTERNAL-only as a failure
// reason and surfaces to clients as `provider_unavailable` (per PRD §5).

export const IdentificationEvents = {
  IdentificationSucceeded: "identification.succeeded",
  IdentificationFailed: "identification.failed",
  ProviderCeilingReached: "provider.ceiling_reached",
} as const;

export type IdentificationEventName =
  (typeof IdentificationEvents)[keyof typeof IdentificationEvents];

export interface IdentificationSucceededPayload {
  identificationId: string;
  userId: string;
  plantId: string | null;
  provider: string;
  model: string;
  selectedSpeciesId: string | null;
  latencyMs: number;
  succeededAt: string;
}

export type IdentificationFailureReason =
  | "timeout"
  | "provider_unavailable"
  | "cost_ceiling_reached"
  | "breaker_open"
  | "invalid_response";

export interface IdentificationFailedPayload {
  identificationId: string;
  userId: string;
  provider: string;
  failureReason: IdentificationFailureReason;
  latencyMs: number;
  failedAt: string;
}

export interface ProviderCeilingReachedPayload {
  provider: string;
  purpose: "identification" | "care_guide";
  utcDate: string;
  estimatedCostCents: number;
  capCents: number;
  reachedAt: string;
}
