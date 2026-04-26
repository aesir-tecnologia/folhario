---
phase: 3
slug: design-system-app-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `03-RESEARCH.md` §Validation Architecture. The planner copies test files and acceptance criteria into PLAN tasks; this file is the authoritative gate for Nyquist Dimension 8.

---

## Test Infrastructure

| Property               | Value                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **Framework (unit)**   | Vitest 4.1.4 (project: `unit`)                                                       |
| **Framework (e2e)**    | Playwright 1.59.1 (Chromium only)                                                    |
| **Framework (axe)**    | `@axe-core/playwright` (NEW — Wave 0 install) running inside Playwright e2e          |
| **Config (unit)**      | `vitest.config.ts` (root) with `tests/unit/setup-env.ts` setupFile                   |
| **Config (e2e)**       | `playwright.config.ts` (root) with `webServer: pnpm start`, port 3000                |
| **Config (lint)**      | `eslint.config.mjs` (extend) + `stylelint.config.mjs` (NEW)                          |
| **Quick run command**  | `pnpm test:unit && pnpm lint && pnpm lint:styles`                                    |
| **Full suite command** | `pnpm test:unit && pnpm test:integration && pnpm test:e2e`                           |
| **Estimated runtime**  | quick ~10 s · full ~3–5 min (visual snapshots dominant)                              |
| **Snapshot baselines** | `tests/e2e/__screenshots__/{spec}/{test}-{platform}.png` — generated via Docker recipe to match CI rendering (Open Risk #5 resolution) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit && pnpm lint && pnpm lint:styles` (~10 s). TDD-eligible files must be green.
- **After every plan wave:** Run `pnpm test:unit && pnpm test:integration && pnpm test:e2e` (~3–5 min). Full Playwright matrix including visual snapshots + axe.
- **Before `/gsd:verify-work`:** Full suite green INCLUDING visual snapshots (re-baseline only with explicit human sign-off). axe blocking violations zero. Stylelint + ESLint zero errors. Manual PWA install on iOS Safari + Android Chrome with screenshots in summary.
- **Max feedback latency:** 10 s on per-task commit; 5 min on per-wave merge.

---

## Per-Task Verification Map

> The planner populates this table per PLAN task. One row per task. Test Type ∈ {unit | integration | e2e-visual | e2e-axe | e2e-functional | declarative}. `File Exists` reflects whether the test file already exists or is delivered by Wave 0.

| Task ID    | Plan | Wave | Requirement | Threat Ref   | Secure Behavior                                                      | Test Type      | Automated Command | File Exists | Status     |
| ---------- | ---- | ---- | ----------- | ------------ | -------------------------------------------------------------------- | -------------- | ----------------- | ----------- | ---------- |
| _populated by gsd-planner_ |  |  |  |  |  |  |  |  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## TDD-Eligible Files (Vitest unit project)

Reference for the planner — copy these into `<acceptance_criteria>` blocks verbatim. Source: `03-RESEARCH.md` §Validation Architecture → TDD-eligible table.

| Test file                                         | Covers Req | Acceptance criteria summary                                                                                                                                          |
| ------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/use-online-status.test.ts`            | UI-24      | Heartbeat hits `/api/v1/health/connectivity` literally; offline after 1 failed ping; backoff to 60 s after success; never `/api/v1/diagnostics/ping` (CI-stub gated). |
| `tests/unit/skeleton-group.test.tsx`              | UI-17      | `null` for first 300 ms; children after 300 ms; clears timer on unmount; reduced-motion → static block + 80 ms `opacity` transition.                                 |
| `tests/unit/format.test.ts`                       | UI-23      | `formatCurrencyBRL(2990) === "R$ 29,90"`; `formatDate("2026-04-26") === "26/04/2026"`; `formatTime → "14:30"` (no AM/PM); `formatDateTime` composite; tz arg honored. |
| `tests/unit/use-theme.test.ts`                    | UI-02      | Returns `'auto'` when no cookie; Server Action writes `folhario_theme=dark`; no explicit `revalidatePath` call (Open Risk #4).                                         |
| `tests/unit/sw-skip-waiting.test.ts`              | OFF-10     | `message` event with `data.type === "SKIP_WAITING"` invokes `self.skipWaiting()`; other types ignored.                                                               |
| `tests/unit/empty-state.test.tsx`                 | UI-18      | Renders illustration (aria-hidden), headline, hint, exactly 1 button; throws/lint-fails when given >1 CTA.                                                           |
| `tests/unit/inline-error.test.tsx`                | UI-19      | Requires cause+recovery+retry props (TS + runtime); does NOT use Urgent Poppy color class; `role="alert"` present.                                                   |
| `tests/unit/scroll-restore.test.ts`               | UI-14      | Saves `scrollY` to `sessionStorage[pathname]` debounced; restores in `useLayoutEffect` on tab change; ignores hash-only changes.                                     |
| `tests/unit/breathing-loop.test.tsx`              | UI-20      | Without reduced-motion: capture button has `animate={{ scale: [1,1.02,1] }}`; with reduced-motion: `animate` prop entirely absent (not just stopped).               |
| `tests/unit/banned-patterns-snapshot.test.ts`     | UI-25      | Snapshot rule walks `src/shared/ui/**/*.tsx`; asserts no `#000`, `#FFF`, `linear-gradient`, `Inter`, `Times`, `Georgia` literals; every spring component imports `useReducedMotion`. |
| `tests/unit/heartbeat-route-contract.test.ts`     | UI-24      | Imports `src/app/api/v1/health/connectivity/route.ts` GET; responds 200 with `{ ok: true, timestamp: <ISO> }`; `Cache-Control: no-store` header set.                |
| `tests/unit/manifest-shape.test.ts`               | OFF-09     | `name === "Folhário"`; `theme_color === "#FBF7EF"` (NOT `#FFFFFF`); icons array contains 192/512/maskable; `lang === "pt-BR"`. Monochrome NOT required (Open Risk #2 resolved). |
| `tests/unit/messages-coverage.test.ts`            | UI-23      | Reads `src/messages/pt-BR.json`; asserts every key listed in CONTEXT.md §Specifics is present and non-empty.                                                          |

## Visual Snapshot Files (Playwright)

| Test file                                       | Covers Req      | Acceptance criteria summary                                                                                                                                                                                                                  |
| ----------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/visual-snapshots.spec.ts`            | UI-01..UI-25    | Each route in `['/', '/catalog', '/identify', '/profile', '/offline']` × each `[colorScheme, reducedMotion]` in 4 combos. **20 snapshots minimum.** Date/time fields masked via `mask: [page.locator('[data-snapshot-mask="true"]')]`. |
| `tests/e2e/sw-update-toast.spec.ts`             | OFF-10          | Dispatch SW `waiting` event; sonner toast renders with `app.update.label` text + `app.update.cta` button; click calls `messageSkipWaiting`; `controlling` event triggers `location.reload()`.                                                |
| `tests/e2e/bottom-nav-scroll-restore.spec.ts`   | UI-14           | Navigate `/`, scroll y=400, click Catalog (scroll y=200), click Home → `window.scrollY ~ 400` within 1 px.                                                                                                                                  |
| `tests/e2e/horizontal-scroll-guard.spec.ts`     | UI-21           | For each Phase 3 route: `documentElement.scrollWidth <= documentElement.clientWidth + 1` (subpixel tolerance).                                                                                                                              |
| `tests/e2e/offline-fallback.spec.ts`            | OFF-09          | `context.setOffline(true)`; navigate to uncached URL; `/offline` page renders empty-state primitive structure (illustration + headline + hint + CTA).                                                                                       |

## A11y Files (axe via Playwright)

| Test file                                 | Covers Req           | Acceptance criteria summary                                                                                                                                                                                                                                                  |
| ----------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/axe-placeholder-pages.spec.ts` | UI-03 + UI-22 + D-33 | For each route × theme × motion-preference combo: `AxeBuilder({page}).analyze()`, filter to `serious` + `critical`, assert empty. Warn-log moderate violations to stdout (do not fail).                                                                                       |
| `tests/e2e/axe-modal-focus-trap.spec.ts`  | UI-22                | Open modal sheet; tab through all focusable elements; assert focus cycles inside Dialog (does not escape); close Dialog; assert focus returns to invoker.                                                                                                                    |
| `tests/e2e/axe-route-focus-move.spec.ts`  | UI-03                | Navigate `/` → `/catalog` via bottom-nav; `document.activeElement === document.querySelector('main')` after navigation.                                                                                                                                                      |
| `tests/e2e/axe-skip-to-main.spec.ts`      | UI-22                | Press Tab on initial load; first focused element is the skip-link with `focus.skipToMain` translation; clicking it moves focus to `<main>`.                                                                                                                                  |

## Declarative / Manual Review (NOT automated)

| Item                                                    | Why declarative                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/globals.css` `@theme` block                    | Visual token correctness — code review against PRD §17 token table.                                                                            |
| `public/manifest.webmanifest` icon array correctness    | Beyond shape (icons exist, dimensions match) — manual verification on installed PWA + Lighthouse PWA audit.                                    |
| `src/app/layout.tsx` font loader configuration          | Code review of `next/font/google` invocation.                                                                                                  |
| `next.config.ts` extension wrappers                     | Already established by Phase 1 (`withSentryConfig(withSerwist(withNextIntl(nextConfig)))`).                                                    |
| `pnpm icons:generate` script execution                  | Local-only (CI never re-runs). Outputs committed.                                                                                              |
| Stylelint + ESLint custom rule code                     | No meta-tests; the rules' EFFECT is tested by `tests/unit/banned-patterns-snapshot.test.ts`.                                                   |

---

## Wave 0 Requirements

These must exist BEFORE any RED → GREEN → REFACTOR TDD task can run. The planner MUST schedule a Wave 0 plan (or Wave 1 plans with explicit `depends_on: []` ordering) covering:

- [ ] `tests/unit/setup-env.ts` extension — mock `window.matchMedia` for SSR-safe `useReducedMotion` testing (current setup-env doesn't include matchMedia mock).
- [ ] `playwright.config.ts` extension — enable per-test `colorScheme` + `reducedMotion` parameterization OR document `await page.emulateMedia()` pattern in shared fixture.
- [ ] `stylelint.config.mjs` (NEW) — banned-pattern rules wired into `pnpm lint:styles` script + `lint-staged` CSS entries.
- [ ] `eslint.config.mjs` extension — add custom rule files + `eslint-plugin-better-tailwindcss@4.4.1` (NOT `eslint-plugin-tailwindcss`; Open Risk #1 resolved).
- [ ] `tests/e2e/__screenshots__/` baseline generation — first run with `pnpm test:e2e --update-snapshots` via Docker (Open Risk #5); commit as initial baselines (one-time human-supervised step).
- [ ] `src/app/api/v1/health/connectivity/route.ts` (NEW route) — required before `useOnlineStatus` heartbeat tests can pass.
- [ ] `src/app/globals.css` — populate with `@import "tailwindcss"` + `@theme` blocks BEFORE wiring `eslint-plugin-better-tailwindcss` (the plugin throws if entryPoint CSS is empty, per Open Risk #7).
- [ ] `package.json` script entries — `lint:styles`, `icons:generate`, `visual:baseline:docker` (Open Risk #5 recipe).
- [ ] `lint-staged` config — extend so CSS files run Stylelint and TS/TSX run ESLint.
- [ ] `@axe-core/playwright` package install + Playwright fixture wiring.

---

## Manual-Only Verifications

| Behavior                                              | Requirement | Why Manual                                                                                                | Test Instructions                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PWA installable on iOS Safari (`Add to Home Screen`)  | OFF-09      | iOS PWA install flow can't be automated in Playwright (no WebKit + Safari install UI).                    | On iPhone Safari, navigate to dev URL; tap Share → Add to Home Screen; launch from home; verify standalone display, theme color matches Paper Cream / Night Cream depending on system theme.                                                                     |
| PWA installable on Android Chrome (`Install app`)     | OFF-09      | Android install banner triggers off site engagement heuristics — not deterministic in test.               | On Android Chrome, navigate to dev URL; if install prompt does NOT appear after 30 s, manually trigger via menu → Install app; launch from home; verify standalone display + theme color.                                                                        |
| Lighthouse PWA audit passes                           | OFF-09      | Lighthouse runs interactively; CI integration deferred.                                                   | Open Chrome DevTools → Lighthouse tab → PWA category; assert score ≥ 0.9 and no manifest errors.                                                                                                                                                                 |
| First-paint flash check (light → dark or vice-versa) | UI-02       | Flash visibility is human-perception bound; subjective threshold.                                         | Set system preference to dark; cold-load app; visually confirm no light-theme flash before dark theme paints. Repeat with manual `data-theme="light"` cookie set + system preference dark; confirm light theme paints first (no system-pref flash).            |
| Founder brand asset delivery review                   | D-35        | Asset quality (line weight, fill discipline, currentColor usage) is a human-art review, not automatable. | Founder delivers `logo.svg`, `empty-{home,catalog,identify,profile}.svg`, `offline.svg` (optional `404.svg`, `error.svg`); review each: single color, currentColor stroke, 1.5 px stroke width, no fills. Replace inline placeholders (Open Risk #3 resolution). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (10 items above)
- [ ] No watch-mode flags (Vitest `--run` mode only; Playwright never `--ui`)
- [ ] Feedback latency < 10 s on quick command, < 5 min on full
- [ ] Open Risks #1, #2, #3 user-resolved (recorded above)
- [ ] `nyquist_compliant: true` set in frontmatter after planner verifies coverage

**Approval:** pending — planner sets `nyquist_compliant: true` and `wave_0_complete: true` once PLAN tasks are mapped and Wave 0 plan exists.
