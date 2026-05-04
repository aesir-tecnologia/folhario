---
phase: 06-identification-flow-cost-controls
plan: 08b
type: tdd
wave: 4
depends_on: ["06-08"]
files_modified:
  - src/contexts/identification/application/identify.ts
  - tests/integration/identification/identify-counter-and-ceiling.integration.test.ts
autonomous: true
requirements:
  - COST-04
  - COST-06
must_haves:
  truths:
    - "After a successful provider call, identify use-case calls atomicUpsertAndCheck on provider_usage_counters with cost = ProviderBudget.costPerRequestCents"
    - "Counter UPSERT runs OUTSIDE the main TX (per D-06: 'separate non-transactional call after success'); failure path does NOT increment (RESEARCH Pitfall 4)"
    - "After UPSERT, identify checks: estimatedCostCents / dailyCostCapCents >= alertThresholdPct/100 → emit provider.ceiling_reached Inngest event AND UPDATE provider_budgets.last_alerted_at = today"
    - "Debounce: if last_alerted_at == today, no second alert is emitted for the same provider+purpose+UTC-day"
    - "care_guide vs identification budgets are independent (COST-06): exhausting plant_id identification ceiling does not trigger care_guide alert and vice versa"
  artifacts:
    - path: "src/contexts/identification/application/identify.ts"
      provides: "Extended with counter UPSERT + 80% alert step (additive edit; existing TDD tests from 06-08 still pass)"
      contains: "atomicUpsertAndCheck"
    - path: "tests/integration/identification/identify-counter-and-ceiling.integration.test.ts"
      provides: "Counter increment + 80% alert + debounce + purpose-isolation coverage"
      min_lines: 200
  key_links:
    - from: "src/contexts/identification/application/identify.ts"
      to: "provider_usage_counters atomic UPSERT"
      via: "countersRepo.atomicUpsertAndCheck (06-05)"
      pattern: "atomicUpsertAndCheck"
    - from: "src/contexts/identification/application/identify.ts"
      to: "inngest.send({name: 'provider.ceiling_reached', ...})"
      via: "post-commit hook on threshold cross"
      pattern: "provider\\.ceiling_reached"
---

<objective>
TDD the counter UPSERT + 80% ceiling alert step that 06-08 deferred. This plan EDITS the same `src/contexts/identification/application/identify.ts` file from 06-08 to ADD steps 7-8 to the use-case body:

- **Step 7 (post-commit, success-only):** atomic UPSERT on `provider_usage_counters` with cost = ProviderBudget.costPerRequestCents. RUNS OUTSIDE the main TX per D-06 ("separate non-transactional call after success"). Failure path does NOT increment (RESEARCH Pitfall 4 — counter inversion bug).
- **Step 8 (post-commit, conditional):** if newTotalCents crosses 80% threshold AND `last_alerted_at < CURRENT_DATE`, emit `provider.ceiling_reached` Inngest event + UPDATE `provider_budgets.last_alerted_at` to today (D-23 debounce).

Purpose: The split keeps each TDD plan within ~40% context budget. The counter+alert logic is small (~30 lines of code) but its integration tests are heavy (~200 lines covering threshold-cross + debounce + cross-purpose isolation + failure-not-incremented). Splitting also means a regression in counter logic won't blow up the entire use-case test suite — 06-08's tests stay green and 06-08b's tests fail in isolation.

Output: Edited use-case (~30 LOC additive) + ~200-line integration test file covering 6 scenarios via RED→GREEN→REFACTOR.
</objective>

<feature>
  <name>identify use-case — counter UPSERT + 80% ceiling alert (extends 06-08)</name>
  <files>src/contexts/identification/application/identify.ts, tests/integration/identification/identify-counter-and-ceiling.integration.test.ts</files>
  <read_first>
    - src/contexts/identification/application/identify.ts (the version produced by 06-08)
    - src/contexts/identification/infrastructure/db/provider-usage-counters.ts (built in 06-05 — atomicUpsertAndCheck)
    - src/contexts/identification/infrastructure/db/provider-budgets.ts (built in 06-05 — updateLastAlertedAt)
    - src/contexts/identification/domain/events.ts (existing — ProviderCeilingReachedPayload)
    - tests/integration/setup-identification.ts (resetProviderUsageCounters + resetLastAlertedAt helpers from 06-02)
    - .planning/phases/06-identification-flow-cost-controls/06-CONTEXT.md (D-06 ordering, D-23 alert debounce)
    - .planning/phases/06-identification-flow-cost-controls/06-RESEARCH.md (Pitfall 4 lines 678-682; Pattern 5 lines 561-584)
  </read_first>
  <behavior>
    Test cases (RED phase: write all 6 before implementing):

    **Counter increment on success (D-06):**
    1. Successful identify with stub provider → counter row exists for `(provider='stub', purpose='identification', utc_date=today)` with `request_count=1, estimated_cost_cents=2` (stub uses plant_id's cost; verify by checking the budget row for stub vs plant_id — use-case looks up budget by `routerResult.result.provider`)
    2. Two consecutive successful identifies → counter `request_count=2, estimated_cost_cents=4`

    **Failure does NOT increment (RESEARCH Pitfall 4):**
    3. Stub provider configured to throw → router fails → counter table has ZERO rows for today (`SELECT count(*) FROM provider_usage_counters WHERE utc_date=today`)

    **80% alert (D-23 + COST-04):**
    4. Pre-seed counter at 79% of cap (`provider_usage_counters` row with estimated_cost_cents = floor(0.79 * dailyCap)); successful identify increments to 81% (or whatever crosses 80%) → `inngest.send` is called with `{name: 'provider.ceiling_reached', data: {provider, purpose: 'identification', utcDate, estimatedCostCents, capCents}}`; `last_alerted_at` is UPDATED to today
    5. After test 4 setup AND a second successful identify same day → NO second `inngest.send` call (debounced via `last_alerted_at`); counter still increments

    **Purpose isolation (COST-06):**
    6. Pre-seed counter for `(provider='plant_id', purpose='care_guide')` at 90% of cap; successful identification call → no alert emitted for `care_guide` (the use-case only checks the `identification` purpose budget)
  </behavior>
  <implementation>
    Implementation outline — EDIT the existing `identify.ts` to add steps 7+8 inside the `postCommit` callback. The pattern: counter UPSERT is `defaultDb` (NOT `tx`) because D-06 says "separate non-transactional call after success" — this lets the main TX commit BEFORE the counter increments, so a counter UPSERT failure doesn't roll back the Identification row.

    Inside `postCommit`, BEFORE the existing PostHog/inngest blocks:

    ```typescript
    // Step 7: Counter UPSERT (success path only — RESEARCH Pitfall 4)
    if (routerResult.ok) {
      try {
        const budget = await budgetsRepo.findByProviderAndPurpose(defaultDb, routerResult.result.provider, "identification");
        if (budget) {
          const upsert = await countersRepo.atomicUpsertAndCheck(defaultDb, {
            provider: routerResult.result.provider,
            purpose: "identification",
            utcDate,
            costCents: budget.costPerRequestCents ?? 2,
          });
          // Step 8: 80% alert with last_alerted_at debounce (D-23)
          const alertThresholdCents = Math.floor(budget.dailyCostCapCents * (budget.alertThresholdPct / 100));
          if (upsert.newTotalCents >= alertThresholdCents) {
            const todayLastAlerted = budget.lastAlertedAt; // YYYY-MM-DD or null
            if (!todayLastAlerted || todayLastAlerted < utcDate) {
              await budgetsRepo.updateLastAlertedAt(defaultDb, routerResult.result.provider, "identification", utcDate);
              await inngest.send({
                name: "provider.ceiling_reached",
                data: {
                  provider: routerResult.result.provider,
                  purpose: "identification",
                  utcDate,
                  estimatedCostCents: upsert.newTotalCents,
                  capCents: budget.dailyCostCapCents,
                } satisfies ProviderCeilingReachedPayload,
              });
            }
          }
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { surface: "identify-counter-upsert" } });
      }
    }
    ```

    The counter and alert sit INSIDE `postCommit` so:
    - The main TX commits the Identification row first (audit trail honest)
    - If counter UPSERT throws, Sentry captures but doesn't roll back the Identification row
    - Alert emission is best-effort (Inngest events are durable; one missed event during a network blip is acceptable for an operator alert)

    The `lastAlertedAt` field (DATE column) is read from the `budget` snapshot the use-case fetched. To ensure a fresh read (not a stale Drizzle cache), the use-case re-fetches `budget` inside `postCommit` BEFORE the threshold check rather than relying on a value captured upstream. This is more correct for tight test 5 (between two consecutive identifies, the field has just been written).

    Refinement: the `postCommit` callback already runs once per request. The counter UPSERT is therefore once per successful request. The threshold check fires the alert at most once per UTC day per (provider, purpose) due to the `last_alerted_at` write — even with a multi-process Vercel function fleet, two concurrent requests both seeing `last_alerted_at < today` will both attempt the UPDATE; the second one finds `last_alerted_at = today` and the `IS DISTINCT FROM` predicate makes it a no-op (or it succeeds with a same-value write — both are idempotent). Inngest event de-dup is NOT in this plan; if two events fire on the same day the operator may receive two emails — acceptable per RESEARCH §State of the Art line 932 ("step.sleepUntil deferred — date column is one comparison, not perfectly de-duped"). Document this in SUMMARY.

    The TDD cycle:
    - **RED:** Write all 6 tests in `tests/integration/identification/identify-counter-and-ceiling.integration.test.ts`. They all fail (no counter step in identify.ts yet from 06-08). Commit `test(06-08b): add failing tests for counter UPSERT and 80% alert`.
    - **GREEN:** Edit identify.ts to add the counter+alert step inside `postCommit`. Commit `feat(06-08b): wire counter UPSERT and 80% ceiling alert into identify use-case`.
    - **REFACTOR:** If `postCommit` body grows past ~80 lines, extract `runCounterUpsertAndAlert(routerResult)` as a private helper. Otherwise skip.
  </implementation>
</feature>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Use-case → counters table | Atomic UPSERT (Postgres ON CONFLICT); idempotent on retry |
| Use-case → provider_budgets.last_alerted_at | UPDATE with ISO date; idempotent (writing same value is a no-op) |
| Use-case → Inngest event bus | Operator alert; payload contains numeric cost data — no PII |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-08b-01 | T (Tampering) | Counter inflation via failure-path increment | mitigate | Wrap step 7 in `if (routerResult.ok)`; test 3 verifies failure path leaves counter unchanged |
| T-06-08b-02 | T | Counter inflation via concurrent UPSERT | mitigate | atomicUpsertAndCheck uses ON CONFLICT DO UPDATE — Postgres atomicity guarantees no lost writes (proven in 06-05 task 2) |
| T-06-08b-03 | I (Information Disclosure) | provider.ceiling_reached event payload | accept | Numeric cost cents + provider name + UTC date — no PII; operator-facing |
| T-06-08b-04 | D (Denial of Service) | Excess alert emails on multi-process race | accept | Two emails on the same day is acceptable — better than missing the alert. Bounded by N processes; in practice ≤ 2 emails per day per provider |
| T-06-08b-05 | E (Elevation) | budget.lastAlertedAt read from stale cache | mitigate | Re-fetch budget INSIDE postCommit just before threshold check — eliminates stale-cache window for the debounce |
| T-06-08b-06 | T | care_guide budget exhausting identification ceiling | mitigate | Use-case only fetches and increments the `identification` purpose budget; test 6 verifies care_guide budget at 90% does NOT trigger an identification alert |

</threat_model>

<verification>
- 6 integration tests pass against local Supabase
- `pnpm exec tsc --noEmit` clean
- All 16 of 06-08's existing tests STILL pass (no regression)
- Test 4 verifies BOTH `inngest.send` was called with `provider.ceiling_reached` AND `provider_budgets.last_alerted_at` was UPDATEd
- Test 5 verifies the second alert is debounced (single inngest call across two sequential identifies on the same day)
- Test 3 verifies counter table has ZERO rows on the failure path (inverse of Pitfall 4)
</verification>

<success_criteria>
- COST-04 (80% ceiling → operator alert) covered by test 4
- COST-06 (purpose isolation) covered by test 6
- Counter UPSERT runs ONLY on success (RESEARCH Pitfall 4 mitigated by test 3)
- Inngest event payload matches the ProviderCeilingReachedPayload type (existing in domain/events.ts)
- No regression in 06-08's existing 16 tests
</success_criteria>

<output>
After completion, create `.planning/phases/06-identification-flow-cost-controls/06-08b-SUMMARY.md`. SUMMARY MUST note:
1. TDD commits (test, feat, optional refactor)
2. Test count (6) + confirmation that 06-08's 16 tests still pass
3. Counter UPSERT runs OUTSIDE main TX (per D-06)
4. Alert debouncing semantics: best-effort de-dup via `last_alerted_at` DATE; multi-process races CAN produce up to N emails per day, bounded by Vercel function concurrency. Acceptable per RESEARCH §State of the Art note. If de-dup hardening becomes necessary post-launch, add Inngest `step.run` idempotency key to the consumer (Phase 7+).
5. Reminder for plan 06-12 (Inngest functions): `notifyCeiling` is the consumer of `provider.ceiling_reached`; that plan implements the Resend dispatch.
</output>
