---
created: 2026-04-27T18:30:00.000Z
title: Fix gsd-sdk phase-plan-index wave misreport (defaults checkpoint plans to wave 1)
area: tooling
files:
  - (gsd-sdk repo — phase-plan-index handler)
---

## Problem

`gsd-sdk query phase-plan-index "03"` reports plan `03-05` in **wave 1** even though:

- `.planning/phases/03-design-system-app-shell/03-05-PLAN.md` frontmatter explicitly sets `wave: 5` and `depends_on: ["03-01", "03-02", "03-03", "03-04"]`.
- `.planning/ROADMAP.md` Phase 3 plan list places it under **"Wave 5 _(blocked on Wave 4 completion; checkpoint:human-action for visual baselines)_"**.
- Plan frontmatter also has `autonomous: false` (visual-snapshot baseline gen requires a human checkpoint).

Reproduce:

```bash
gsd-sdk query phase-plan-index "03" | jq '.waves'
# {
#   "1": ["03-01", "03-05"],   <-- 03-05 should be in "5"
#   "2": ["03-02"],
#   "3": ["03-03"],
#   "4": ["03-04"]
# }
```

The other four plans (03-01..04) are reported correctly. Only 03-05 is misplaced. Common pattern across both is: 03-05 has `autonomous: false` while 03-01..04 are `autonomous: true` — the handler may be defaulting `wave` to 1 when some sibling field can't be parsed, or applying a "non-autonomous plans go to wave 1" rule incorrectly.

## Impact

`/gsd:execute-phase 03 --wave 1` would have spawned `gsd-executor` against `03-05` in parallel with `03-01`, which would have:

1. Violated the explicit `depends_on` (Wave 2/3/4 artifacts don't yet exist).
2. Skipped the required human-checkpoint Docker visual-baseline run.
3. Produced a SUMMARY.md against missing infrastructure.

In `--auto` mode this would silently corrupt the phase. The orchestrator can only catch it if the operator cross-references ROADMAP.md and per-plan frontmatter manually (which `/gsd:execute-phase 03 --wave 1` did on 2026-04-27 — only 03-01 was actually executed).

## Investigation steps

1. Locate the `phase-plan-index` handler in the gsd-sdk repo.
2. Compare its YAML parsing path with how the other plan-index handlers parse `wave:`.
3. Add a unit/snapshot test that pins the exact (wave, autonomous, depends_on) reported for each Phase-3 plan against a fixture matching the current `.planning/phases/03-design-system-app-shell/` layout.
4. Particularly check whether the handler treats `wave: 5  # ...` (with a YAML inline comment) differently from `wave: 5` — though grep here shows none of the plans use inline comments on the `wave:` line.

Until fixed, callers must validate the SDK's `waves` map against the source `wave:` frontmatter field. Trust the file, not the SDK.
