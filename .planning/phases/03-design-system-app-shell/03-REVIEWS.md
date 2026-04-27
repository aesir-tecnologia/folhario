---
phase: 3
reviewers: [codex]
reviewed_at: 2026-04-26T22:13:48Z
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md, 03-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 3: Design System & App Shell

## Codex Review

_Model: gpt-5.5 (Codex CLI v0.125.0, reasoning: xhigh)_

## Summary

The five plans are unusually thorough and mostly coherent: dependencies are sequenced correctly, major research risks are acknowledged, and the phase goals are broadly covered. The strongest parts are the explicit Tailwind/Serwist/Motion landmine handling, TDD contracts for fragile behavior, and the final visual/a11y lockdown. The main risks are not architectural, but execution-level: several snippets have likely compile/runtime problems, some tests are fragile or mismatched to the actual browser/SW lifecycle, and the scope is heavy for a design-system phase.

## Strengths

- Clear wave ordering: tooling → theme/i18n → primitives → shell/PWA → E2E lockdown.
- Good handling of known incompatibilities: Tailwind v4 lint substitution, Serwist `register: false`, no monochrome manifest requirement, Docker visual baselines.
- Strong accessibility intent: route focus, skip link, modal trap, axe matrix, no color-only signals.
- Good security posture for this phase: cookie allowlists, heartbeat minimal response, guarded `SKIP_WAITING`.
- The plans preserve project constraints: no `@/*`, no barrel files, root layout owns theme cookie, Inngest/Auth/DB remain untouched.
- TDD is applied where behavior is easiest to regress: theme cookie, formatters, heartbeat, skeleton gate, SW message guard, app-update toast.

## Concerns

- **HIGH: Some proposed code likely will not compile as written.**  
  Examples: `read-only-banner.tsx` places `"use client"` after imports, which is invalid for a React client directive. `layout.tsx` imports `cookies` but does not use it. `empty-state.tsx` returns `ReactNode` from a component and uses `<img>` instead of Next image intentionally, but lint rules may object depending on Next config. Several JSX snippets rely on Tailwind v4 arbitrary utilities that `better-tailwindcss` may reject until configured.

- **HIGH: App Router route conflict/test route ambiguity.**  
  Plan 03 creates `src/app/(test)/modal-sheet/page.tsx`, which maps to `/modal-sheet`. That is fine technically, but the plan comment says the route group makes it “not a published path,” which is false. Route groups do not hide routes; `/modal-sheet` becomes publicly reachable unless gated. Either gate it or accept it explicitly.

- **HIGH: Offline/SW E2E expectations are shaky.**  
  `context.setOffline(true)` plus `page.goto("/offline")` tests the offline page directly, not the SW navigation fallback. It does not prove an uncached navigation falls back to `/offline`. Also service workers are disabled in development and may require production build + HTTPS-like localhost behavior; the tests need explicit SW readiness waits.

- **MEDIUM: Plan 04 icon generation uses solid placeholder PNGs.**  
  This satisfies manifest shape but not a meaningful install icon. It may pass tests while degrading PWA install quality. If founder assets are not available, use a simple generated Folhário mark rather than solid green squares.

- **MEDIUM: Scroll restoration tests and implementation may race.**  
  The app saves scroll on the current pathname via an effect tied to pathname. On navigation, the scroll event listener cleanup may happen before the final save. Relying on `waitForTimeout` in E2E is brittle. A route-click handler or `visibility/pagehide` style save path would be more reliable.

- **MEDIUM: `useOnlineStatus` test plan does not fully verify the stated 30s behavior.**  
  The implementation schedules the first ping at `0`, then `60s` after success. The plan says “30s when online → 60s after success”; `POLL_INITIAL = 30_000` exists but is unused. Either update the contract or use the initial interval after first mount.

- **MEDIUM: Theme controls mismatch the plan.**  
  The phase says Profile hosts a theme `Toggle`, but implementation uses a `Select`. That is probably the right UI for three states (`auto/light/dark`), but the plan should be consistent and not claim a binary Toggle.

- **MEDIUM: Stylelint `function-disallowed-list: linear-gradient` is too broad.**  
  The design ban is gradient text, not every gradient. The plan immediately needs an inline disable for skeleton shimmer, which is a sign the rule is over-scoped. Prefer banning gradient text patterns specifically (`background-clip:text`, `text-fill-color`) and allowing shimmer.

- **LOW: Too many atomic commits are mandated inside plans.**  
  RED/GREEN commits for every small unit can be good, but across five plans this may produce noisy history and slow execution. If GSD requires it, fine; otherwise group related TDD changes.

- **LOW: Some tests assert implementation details over behavior.**  
  Grep checks for exact strings/classes and mocked `motion.button` props are useful but brittle. Keep them where they guard critical contracts, but lean on rendered behavior for the rest.

## Suggestions

- Gate `/modal-sheet` with an env flag or `notFound()` outside test mode, or document it as a deliberate internal test route.
- Fix client directive placement in every client component before execution. `"use client"` must be the first statement.
- Replace the offline fallback E2E with: register SW online, navigate to a cached route, go offline, navigate to an uncached app route, assert fallback content renders.
- Make `useOnlineStatus` either use `POLL_INITIAL = 30_000` or change the spec to “immediate first ping, then 60s after success.”
- Change Profile theme control wording from Toggle to Select/segmented control.
- Narrow the Stylelint gradient ban to text-gradient patterns so skeleton shimmer does not need a disable.
- Use a generated placeholder icon with a simple leaf/letter mark instead of solid-color PNGs.
- Add one explicit route-surface check confirming `/modal-sheet` is unavailable in production if gated.
- Before execution, run a dry TypeScript review of all pasted snippets; several issues are syntactic rather than conceptual.

## Risk Assessment

**Overall risk: MEDIUM.**  
The architecture and sequencing are strong, and the plans do achieve the phase goal if corrected during execution. Risk is mainly from implementation friction: App Router route behavior, SW/offline testing, Tailwind/Stylelint strictness, and a few invalid snippets. These are fixable before or during execution, but left uncorrected they could cause avoidable churn in Waves 4-5.

---

## Consensus Summary

Only one reviewer (Codex / gpt-5.5) was invoked for this review (per `--codex` flag); the items below reflect that single reviewer's prioritization rather than multi-reviewer consensus. Re-run `/gsd:review --phase 3 --gemini --claude` (or `--all`) to triangulate.

### Agreed Strengths

_(Single-reviewer run — strengths reported by Codex.)_

- Wave ordering is correct: tooling → theme/i18n → primitives → shell/PWA → E2E lockdown.
- Known incompatibilities are addressed up front: Tailwind v4 lint substitution, Serwist `register: false`, manifest with no monochrome icon, Docker visual baselines.
- Strong a11y posture: route focus, skip link, modal trap, axe matrix, no color-only signals.
- Reasonable security posture for a frontend phase: cookie allowlists, minimal heartbeat response, guarded `SKIP_WAITING`.
- Project constraints preserved: no `@/*`, no barrel files, root layout owns theme cookie, Inngest/Auth/DB untouched.
- TDD applied where regression risk is highest: theme cookie, formatters, heartbeat, skeleton gate, SW message guard, app-update toast.

### Agreed Concerns

_(Single-reviewer run — Codex's prioritized concerns, in severity order.)_

1. **HIGH — Snippet-level compile/runtime defects.** `read-only-banner.tsx` places `"use client"` after imports (invalid as a directive); `layout.tsx` imports `cookies` without using it; some Tailwind v4 arbitrary utilities may be rejected by `eslint-plugin-better-tailwindcss` until configured. Sweep all pasted snippets before execution.
2. **HIGH — `/modal-sheet` route surface.** Plan 03 places the modal demo under a route group `(test)`. Route groups do not hide the URL — `/modal-sheet` is publicly reachable. Either gate it (env flag or `notFound()` outside test mode) or document it as a deliberate internal route.
3. **HIGH — Offline/SW E2E coverage is shaky.** `context.setOffline(true)` + `page.goto("/offline")` tests the page directly, not the SW navigation fallback. Tests need explicit SW readiness waits, production build, and a navigation to an uncached route to actually exercise the fallback.
4. **MEDIUM — Manifest icons are solid-color placeholders.** Passes shape tests, fails install quality. Use a simple generated Folhário mark instead.
5. **MEDIUM — Scroll restoration is race-prone.** Effect-based save tied to pathname can drop the last save on navigation. Prefer a click-time save or `pagehide`/`visibilitychange` path; remove `waitForTimeout` reliance from E2E.
6. **MEDIUM — `useOnlineStatus` 30s/60s contract drift.** Implementation schedules first ping at `0`, then `60s` after success; `POLL_INITIAL = 30_000` is defined but unused. Either wire it up or update the contract.
7. **MEDIUM — Theme control mismatch.** Phase text says Profile hosts a `Toggle`; implementation uses a `Select`. Three-state (`auto/light/dark`) wants a Select/segmented; update plan wording to match.
8. **MEDIUM — Stylelint `function-disallowed-list: linear-gradient` is over-scoped.** The design ban is gradient *text*, not all gradients (skeleton shimmer needs gradients). Narrow the rule to `background-clip:text` / `text-fill-color` patterns so shimmer does not need an inline disable.
9. **LOW — Atomic-commit volume.** RED/GREEN commits per micro-unit may produce noisy history and slow execution; group related TDD changes where GSD permits.
10. **LOW — Tests assert implementation details over behavior.** Grep-for-exact-string and mocked `motion.button` props are brittle; keep them only where they guard critical contracts.

### Divergent Views

_(Not applicable — single-reviewer run.)_
