# Folhário — API Contract

**Version:** 1.0
**Date:** 2026-04-12
**Status:** Draft

Companion to `PRD-V1.1.md`. Defines cross-cutting REST API conventions, the canonical error code registry, and rate-limiting policy. Endpoint-level request and response shapes are not specified here — they are derived from the feature requirements in the PRD during implementation. This document covers only the rules that span multiple endpoints and cannot be decided ad-hoc per feature.

---

## 1. Conventions

**Transport and format**
- REST over HTTPS. JSON request and response bodies with `Content-Type: application/json`. Multipart is used only for image uploads (identification and photo journal).
- UTF-8 throughout.
- Field names are `snake_case`. Enum values are `lower_snake_case`.

**Versioning**
- URL-prefix versioning: `/v1/...`. Breaking changes require a new prefix (`/v2`). Additive changes (new optional fields, new endpoints) may ship under the current version without a bump.

**Authentication**
- JWT bearer tokens in the `Authorization: Bearer <token>` header, issued per device (§4.9 of the PRD).
- All endpoints require authentication unless explicitly marked public. Public endpoints are limited to: signup, login, OAuth callbacks, and the Stripe webhook receiver.
- Each device manages its own token lifecycle independently; revocation on one device does not affect others.

**Timestamps and dates**
- All timestamps are ISO-8601 in UTC with an explicit `Z` suffix (e.g., `2026-04-12T09:00:00Z`).
- Date-only fields use `YYYY-MM-DD`.
- The only exception is `Reminder.notification_time_local`, stored as `HH:MM` without a timezone and interpreted in device local time at fire time (§3.4.1).

**Pagination**
- List endpoints use opaque-cursor pagination. Request: `?cursor=<opaque>&limit=<N>`. Responses include a `next_cursor` that is null when the collection is exhausted.
- Default `limit` is 50; maximum is 200. Clients must not parse cursor values.

**Idempotency**
- Mutating endpoints (`POST`, `PATCH`, `DELETE`) accept an optional `Idempotency-Key` header. The server stores the first result for a given key and returns the same result on replay.
- The offline sync mechanism in §4.4 uses the client-generated UUID of each queued action as its `Idempotency-Key`. Replays arriving through the offline queue are deduped through the same mechanism as direct retries.

**Consistency**
- Writes are authoritative against the server at commit time. Reads across devices are eventually consistent (§4.9), and conflicts are resolved last-write-wins by server timestamp (§4.4). Clients must not assume read-your-writes across devices.

---

## 2. Error Code Registry

All error responses draw their `code` from the table below. Adding a new code requires updating this document; ad-hoc codes are not permitted. The transport shape of the error response (envelope fields, nesting) is left to implementation and is not fixed by this contract.

| Code | HTTP | Category | When |
|---|---|---|---|
| `unauthenticated` | 401 | Auth | Missing or invalid bearer token. |
| `token_expired` | 401 | Auth | JWT valid but past `exp`. Client should refresh. |
| `invalid_credentials` | 401 | Auth | Email/password mismatch at login. |
| `forbidden` | 403 | Auth | Authenticated but not authorized for the target resource. |
| `validation_failed` | 400 | Validation | Request body or query parameters fail schema validation. |
| `invalid_partner_code` | 400 | Validation | Partner code unknown or inactive at signup or in Settings (§4.2). Signup may proceed with the code cleared. |
| `not_found` | 404 | Data | Resource does not exist or is not visible to the current user. |
| `conflict` | 409 | Data | Concurrent modification or unique-constraint violation. |
| `consent_required` | 403 | LGPD | Processing activity requires a consent that has not been granted or has been revoked (§3.1.5, §4.6). Client should surface the consent prompt. |
| `deletion_in_progress` | 403 | LGPD | Account is inside the 7-day deletion grace period (§4.6.3). Only reactivation, cancel-deletion, and read-only LGPD endpoints remain reachable. |
| `subscription_required` | 402 | Subscription | Endpoint requires an `active` or `trialing` subscription and the current state is neither (§4.7.2, §4.7.3). |
| `read_only_mode` | 402 | Subscription | Mutation blocked because the app is in read-only catalog mode (§4.7.3). |
| `cap_hit` | 429 | Identification | Per-user daily or monthly identification cap reached (§4.8.1). |
| `provider_unavailable` | 503 | Identification | All configured providers are unavailable (cost ceiling, circuit breaker, or upstream outage). See §3.1.6, §4.8.2. This is the only identification-availability code returned to clients. |
| `cost_ceiling_reached` | — | Identification (internal) | Router-internal reason code. Logged on rejection per §3.1.5 and persisted in `Identification.failure_reason`, never returned to clients. Surfaced externally as `provider_unavailable` when no fallback provider remains. |
| `breaker_open` | — | Identification (internal) | Router-internal reason code for failure-based circuit breaker trips (§4.8.3). Same handling as `cost_ceiling_reached`. |
| `timeout` | 504 | Identification | Backend timed out waiting for a provider response (§3.1.6). |
| `webhook_signature_invalid` | 401 | Webhook | Stripe webhook signature verification failed (§4.7.5). The receiver responds 401 and does not enqueue a `BillingEvent`. |
| `rate_limited` | 429 | Rate limiting | Reserved. Not emitted by any MVP endpoint (see §3). |
| `internal_error` | 500 | Infrastructure | Unhandled server error. |

---

## 3. Rate Limiting

The MVP enforces usage limits exclusively at the application layer. There is **no edge or gateway rate limit** in MVP (§4.8.4).

- **Per-user identification caps** (§4.8.1) are enforced in backend application logic before any provider call. Over-cap requests return `cap_hit`.
- **Per-provider cost ceilings and failure-based circuit breakers** (§4.8.2, §4.8.3) operate inside the identification router and surface to clients as `provider_unavailable` when no fallback provider remains. Their internal reason codes (`cost_ceiling_reached`, `breaker_open`) are logged and persisted, never returned to clients.
- **All other endpoints** (catalog, reminders, photo journal, settings, LGPD rights, subscription management) have **no rate limit in MVP**. Abuse mitigation relies on the authenticated-accounts-only requirement (§4.2).
- The `rate_limited` error code is reserved for future use. It is not emitted by any MVP endpoint.

Edge rate limiting may be revisited post-MVP if abuse patterns emerge.
