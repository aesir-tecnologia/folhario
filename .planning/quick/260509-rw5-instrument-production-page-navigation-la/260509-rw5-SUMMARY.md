---
quick_id: 260509-rw5
status: complete
completed: 2026-05-09
---

# Summary

Added production-safe timing instrumentation for page-navigation latency hotspots.

## Changes

- Added `timeServer()` in `src/shared/telemetry/server-timing.ts`.
- Instrumented proxy Supabase session refresh, IAM session/user lookups, Supabase auth calls, catalog DB list/count queries, cover URL signing batches, and individual storage signed URL calls.
- Timing logs avoid PII and raw object keys. Page paths normalize UUID segments to `/:id`.

## Usage

- Default: logs spans slower than `250ms`.
- `FOLHARIO_TIMING_THRESHOLD_MS=100` changes the slow-span threshold.
- `FOLHARIO_TIMING_LOGS=1` logs every instrumented span during focused production testing.

Example log:

```text
[timing] supabase.auth.getUser duration_ms=312.4 readOnly=true
```

## Verification

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- Local warning: current Node is `v24.14.1`; repo expects `>=22 <23`.
