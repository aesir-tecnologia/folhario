# Phase 3 — UI Review

**Audited:** 2026-04-27
**Baseline:** `03-UI-SPEC.md` (PRD §17 design contract — Paper/Night Cream tokens, 6 typographic roles, 60/30/10 accent discipline)
**Screenshots:** Code-only audit. No live dev server detected (port 3000 / 5173 / 8080 idle or unrelated). Used the 20 committed Playwright Linux baselines under `tests/e2e/visual-snapshots.spec.ts-snapshots/` as the visual evidence surface (5 routes × {light, dark} × {no-preference, reduce}).

---

## Pillar Scores

| Pillar               | Score | Key Finding |
|----------------------|-------|-------------|
| 1. Copywriting       | 3/4   | All pt-BR routed via `next-intl`; `home.empty.manualLink` is shipped in pt-BR.json but never rendered (UI-SPEC line 173 secondary text-link omitted from Home placeholder). |
| 2. Visuals           | 2/4   | Bottom-nav active state ships only color + weight cues — Lucide icon stays outlined for both active and inactive (UI-SPEC line 452 demands "Filled icon + 3px top bar + 600-weight label"). |
| 3. Color             | 2/4   | Two cross-cutting banners use semantic tokens off their reserved-for list: OfflineBanner uses Overdue Rust (form-error/overdue only); ReadOnlyBanner mixes Honey Amber tint (medium-confidence bar fill ONLY) with Rust text. |
| 4. Typography        | 2/4   | Empty-state headlines render at the Title size (24/30 px) on every route, but UI-SPEC type-scale row 73 maps "Empty-state headlines" to the **Hero** role (32/38 px). Affects 4 routes. |
| 5. Spacing           | 3/4   | Strict 8 pt grid mostly honored; `py-3` (12 px) on Button/TextInput/Select/InlineError and `gap-3` on Toggle are off-grid (UI-SPEC line 46 restricts `space-3` to composed chip/pill primitives). |
| 6. Experience Design | 3/4   | State coverage solid: loading (Skeleton+300ms gate), error (InlineError CAUSE+RECOVERY+retry), empty (4 routes), focus (skip-link, mainRef route-change focus, focus ring globally wired), reduced-motion (3-layer enforcement), per-tab scroll restore, SW user-controlled update flow. CaptureButton breathing primitive present but not yet wired to the Home empty CTA (SC-3 deferred to Phase 5/6 per CONTEXT.md). |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Bottom-nav active icon not filled — UI-22 redundant-cue regression on the most-used navigation primitive.**
   - Impact: BLOCKER. UI-SPEC line 452 mandates 3 redundant cues for active tab; current state ships only color + label weight + 3 px top bar. A user with a moderate red-green deficiency or low contrast vision sees only the bar; the icon shape is identical to inactive tabs.
   - Fix: Swap `lucide-react` outline icons for the filled variant on the active tab. Lucide does not ship parallel filled icons by default; either (a) render the active icon with `fill="currentColor"` on a duplicate path, or (b) use lucide-react's recently-added "Solid" variants where available, or (c) add a small inline SVG set for the 4 nav glyphs that toggles `fill` based on `isActive` while keeping outline `strokeWidth={1.5}` matching D-05.
   - File: `src/shared/ui/bottom-nav.tsx:108-122`

2. **Empty-state headline size mismatch — every empty-state surface ships at Title size (24 px) instead of Hero size (32 px).**
   - Impact: BLOCKER for the design contract. The Home/Catalog/Identify/Offline screens are the four user-visible surfaces in Phase 3, and all four miss the Hero role spec'd in UI-SPEC line 73 ("Empty-state headlines, hero composition" → 32/38 px).
   - Fix: Change `text-2xl` (24 px) → `text-[2rem] leading-[2.375rem]` or define a Tailwind v4 `--text-hero: 2rem` token (with `clamp()` per UI-SPEC line 86 non-negotiable) and apply `text-hero` in `empty-state.tsx:85`. Profile page heading at `profile/page.tsx:11` correctly stays at Title (24 px) — it's a screen title, not a hero.
   - File: `src/shared/ui/empty-state.tsx:85`

3. **Cross-cutting banners use semantic tokens outside their reserved-for list — color slop on OfflineBanner and ReadOnlyBanner.**
   - Impact: WARNING. Phase 3 is the only phase that authors the accent discipline contract; every later phase composes against these banners. Shipping them with Rust/Honey misuse establishes the pattern downstream phases will copy.
   - Fix:
     - `OfflineBanner` (offline-banner.tsx:22) → swap `bg-rust/10 text-rust` for `bg-trust/10 text-trust` (Trust Teal is UI-SPEC line 111's reserved Informational callouts color).
     - `ReadOnlyBanner` (read-only-banner.tsx:31) → drop `bg-honey/10` (medium-confidence bar fill ONLY per UI-SPEC line 108). Subscription expiry isn't on the closed reserved-for list; either add a new "Subscription read-only" semantic slot to PRD §17 or use a calmer Calm Slate text on Warm Ivory surface (no color signal beyond text + LockIcon, since Phase 10 owns the live wiring).
   - Files: `src/shared/ui/offline-banner.tsx:22`, `src/shared/ui/read-only-banner.tsx:31`

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths**
- 100% i18n via `next-intl`; zero hard-coded user-facing strings in component bodies. Every route uses `getTranslations(...)` server-side or `useTranslations(...)` in client components.
- 34-key pt-BR catalog covers nav, empty states (4 routes), theme toggle, app-update, offline (banner + page), readonly, sync.discardSummary, focus.skipToMain, error.generic, dialog.destructive — full surface area for Phase 3.
- Empty-state copy avoids banned patterns: no "Nada por aqui" apologies, no AI clichés, headlines welcoming ("Sua estante ainda está esperando a primeira planta.") not apologetic.
- Inline error contract enforced at the type level: `cause`, `recovery`, `retry` are `Required<>` props in `inline-error.tsx:17-21`.

**Findings**
- **WARNING — Dead i18n key `home.empty.manualLink`.** `src/messages/pt-BR.json:15` ships the value `"Adicionar manualmente"` per UI-SPEC line 173, but `src/app/(app)/page.tsx` only renders the EmptyState single CTA — no secondary text link is composed. Either UI-SPEC line 173 (which lists `manualLink` as a Home placeholder element) is contradicted by line 211 (empty-state primitive: "Exactly ONE Canopy primary CTA. No secondary button."), or the contract intends a tertiary text-link below the primary CTA. Resolve by either deleting the unused key or extending the EmptyState API with an optional `secondaryLink` slot specifically scoped to the Home placeholder. Files: `src/messages/pt-BR.json:15`, `src/app/(app)/page.tsx:6-13`.
- **INFO — `dialog.destructive.confirm` ships generic copy.** pt-BR.json line 87 has `"Confirmar"`, but UI-SPEC line 232 mandates `"{verb specific to action}"` like `Excluir planta` — never generic. The current value is acceptable as a Phase 3 placeholder, but Phase 4+ consumers MUST override.

### Pillar 2: Visuals (2/4)

**Strengths**
- Empty-state primitive enforces the 4-part composition (sage illustration + serif headline + slate hint + ONE Canopy CTA) at the API level — `EmptyStateProps` has no `secondaryCta` prop, locking the contract by typing.
- All empty-state SVG illustrations carry `aria-hidden="true"` (PlaceholderLeafSvg in empty-state.tsx:38).
- Lucide stroke width 1.5 honored on every icon import (`bottom-nav.tsx:120`, `offline-banner.tsx:24`, `read-only-banner.tsx:33`, `select.tsx:42`, `modal-sheet.tsx:71`, `capture-button.tsx:53`).
- Visual hierarchy works in light mode (snapshot: clear focal point on Identifique sua primeira planta hero, Canopy primary CTA is the only saturated element).
- Modal sheet ships drag handle (visual only) + labelled close button BOTH visible per UI-SPEC line 568 ("tap-scrim allowed only IN ADDITION to dismiss affordance"). `modal-sheet.tsx:57-73`.

**Findings**
- **BLOCKER — Bottom-nav active icon NOT filled.** UI-SPEC line 257 + line 452 require "Canopy active filled-Lucide icon" + "Filled icon + 3 px top bar + 600-weight label (3 cues)". Implementation at `bottom-nav.tsx:120` renders `<Icon strokeWidth={1.5} size={28} />` for both active and inactive states; the Lucide outline icon never swaps to a filled variant. The active visual signal collapses to color (`text-canopy` vs `text-slate`) + weight (`font-semibold` vs default) + the 3 px slider — verifiable in `tests/e2e/visual-snapshots.spec.ts-snapshots/visual-snapshot-light-no-preference-1-chromium-linux.png` where the four icons read identically as outlines. UI-22 wants color to be never the sole signal; weight + bar do clear that bar, but the spec explicitly enumerates the filled-icon cue and the implementation drops it.
- **WARNING — Empty-state placeholder leaf SVG is ad-hoc.** `empty-state.tsx:29-45` ships a generic leaf path that renders identically across Home/Catalog/Identify/Offline. The user sees the same illustration on 4 different surfaces — the centered-stack composition compounds this monotony. Per Brand Asset Checklist (UI-SPEC line 608), founder assets are pending; placeholder is acceptable for Phase 3 sign-off but should be tracked as a launch-blocker until per-screen `empty-home.svg`, `empty-catalog.svg`, `empty-identify.svg`, `offline.svg` ship.

### Pillar 3: Color (2/4)

**Token usage tally (from grep):**

| Class | Count |
|-------|-------|
| `bg-canopy` | 10 |
| `text-ivory` | 9 |
| `text-forest` | 9 |
| `text-slate` | 8 |
| `bg-ivory` | 6 |
| `text-rust` | 5 |
| `border-hairline` | 4 |
| `text-canopy` | 3 |
| `border-rust` | 3 |
| `bg-paper` | 3 |
| `bg-hairline` | 3 |
| `border-canopy` | 2 |
| `text-sage` | 1 |
| `bg-rust` | 1 |
| `bg-poppy` | 1 |
| `bg-honey` | 1 |
| `bg-forest` | 1 |
| `ring-canopy` | 1 |

**Strengths**
- All colors flow from CSS custom properties in `globals.css:19-94`; both light (Paper Cream `#FBF7EF`) and dark (Night Cream `#1A1613`) palettes are authored, not inverted.
- Hybrid dark-mode resolution via `@custom-variant dark` at `globals.css:5-10` uses both `[data-theme=dark]` (manual) + `prefers-color-scheme: dark` (auto) — flash-free first paint per D-03.
- No hardcoded hex outside the two `<meta name="theme-color">` tags in `layout.tsx:54-55` (intentional — manifest fallback per OFF-09).
- Stylelint banned-pattern enforcement is wired (per Plan 03-01 SUMMARY): pure black/white hex + gradient-text + backdrop-filter all caught at lint time.
- 60/30/10 distribution honored on visible screens: `bg-paper` is the dominant background, `bg-ivory` cards/sheets are secondary, `bg-canopy` only appears on primary CTAs and the bottom-nav active indicator (closed reserved-for list).

**Findings**
- **BLOCKER — OfflineBanner uses Overdue Rust outside its reserved-for list.** `offline-banner.tsx:22` → `bg-rust/10 text-rust`. UI-SPEC line 138 reserves Rust strictly for "Form validation strokes / icons / helper text + overdue reminder section." An offline banner is informational. UI-SPEC line 111 maps "Informational callouts, LGPD strip, 'Gerado por IA' chip" to Trust Teal. Fix: swap to `bg-trust/10 text-trust` (and adjust dark counterparts).
- **BLOCKER — ReadOnlyBanner mixes Honey Amber surface tint with Rust text.** `read-only-banner.tsx:31` → `bg-honey/10 px-4 py-2 text-sm text-rust`. UI-SPEC line 108 reserves Honey Amber for "Medium-confidence bar fill ONLY"; UI-SPEC line 138 reserves Rust for form-error/overdue. The banner currently composes two semantic tokens that are exclusive of subscription-state copy. Subscription expiry is not on the closed reserved-for list at all. Suggested resolution: extend PRD §17 with a "Subscription read-only" slot (likely Trust Teal too, since it's an informational call to action, not an error), or render with neutral Calm Slate text on Warm Ivory with the LockIcon as the lone color cue. Phase 10 wires the prop — fix here so Phase 10 doesn't inherit the misuse.
- **INFO — Dark-mode contrast on Canopy Sprout buttons.** Inspecting `visual-snapshot-dark-no-preference-1-chromium-linux.png`: the "Identificar planta" button uses Canopy Sprout `#6FAE8A` (6.9 : 1 vs Night Cream per spec) for fill + `text-ivory` (which resolves to Embered Surface `#231E1A` in dark). Spec line 240 says Primary button label in dark should be "Night Cream" — the implementation uses `text-ivory` which resolves to `#231E1A` (Embered Surface, the secondary color), not Night Cream `#1A1613`. The visual difference is sub-perceptible (both are near-black warm) but this is a token hygiene issue. Verify the contrast ledger holds for `#6FAE8A` vs `#231E1A` (likely ≥7:1 due to large luminance gap, but the spec assumes Night Cream).

### Pillar 4: Typography (2/4)

**Type scale tally:**
| Class | Count | Maps to |
|-------|-------|---------|
| `text-2xl` (24 px) | 3 | Title (per spec) |
| `text-base` (16 px) | 9 | Body / Button |
| `text-sm` (14 px) | 11 | Section label / Metadata |
| `text-xs` (12 px) | 1 | (NOT in spec scale) |

**Family/weight tally:**
| Class | Count |
|-------|-------|
| `font-semibold` (600) | 12 |
| `font-medium` (500) | 3 |
| `font-serif` | 3 |
| `font-sans` | 1 |

**Strengths**
- Two families (`Source_Serif_4` + `Plus_Jakarta_Sans`) loaded via `next/font/google` with `subsets: ["latin", "latin-ext"]` (`layout.tsx:11-21`) — self-hosted, SW-cacheable, `display: swap`.
- Three weights observed (500 / 600; 400 implicit on body), matching spec's "two families at three weights".
- Source Serif 4 only appears on `<h1>` and `<h2>` headlines (`empty-state.tsx:85`, `profile/page.tsx:11`, `modal-sheet.tsx:62`) — never bleeds into buttons or form fields per UI-SPEC line 82 non-negotiable.
- All buttons use `font-semibold` (600) per UI-SPEC line 78 Button role.
- No emoji in UI copy (ESLint banned-imports rule wired in Plan 01).

**Findings**
- **BLOCKER — Empty-state headline at 24 px (Title) instead of 32 px (Hero).** UI-SPEC line 73 maps "Empty-state headlines, hero composition" to Hero role at **32 / 38 px, Source Serif 4, weight 500**. Implementation at `empty-state.tsx:85` uses `text-2xl font-medium` (24 / 32 px). This affects 4 of the 5 Phase 3 visible surfaces (Home/Catalog/Identify/Offline). Profile (`profile/page.tsx:11`) correctly stays at Title (24 px) because it's a screen title, not a hero composition. Confirmed visually in `visual-snapshot-light-no-preference-1-chromium-linux.png`: "Identifique sua primeira planta" reads conspicuously smaller than the hero spec.
- **WARNING — `text-xs` used on bottom-nav labels.** `bottom-nav.tsx:116` → `text-xs` (12 px). UI-SPEC type scale doesn't define a 12 px slot; Body minimum is 16 px (line 76 non-negotiable: "Default reading text. Minimum 16 px regardless of viewport"). Bottom-nav labels are arguably secondary metadata, but 12 px is below the body floor. Either define a "Nav label" slot in the type scale or scale up to `text-sm` (14 px Metadata).
- **WARNING — No `clamp()` on hero-class headlines.** UI-SPEC line 86 non-negotiable: "Use clamp() for headlines; line-height stays 1.4–1.55." Implementation uses fixed Tailwind size classes — clipping under largest Dynamic Type / browser zoom is the failure mode the rule guards against. Acceptable for Phase 3 if a Tailwind v4 `--text-hero: clamp(...)` token is wired in `globals.css @theme`, but no such token exists today.
- **INFO — Tracking +2% / +4% from spec is unset.** UI-SPEC line 78 mandates +2% tracking on buttons and +4% on the Section-label slot. No `tracking-*` Tailwind utility in the codebase (`grep tracking-` returns 0 hits). Spec deviation is small (Plus Jakarta Sans default tracking is near-neutral) but the 14 px Section-label uppercase + tracking pair is unused — defer to Phase 5+ if no such labels render in Phase 3.

### Pillar 5: Spacing (3/4)

**Spacing class tally (top entries):**
| Class | Count | Notes |
|-------|-------|-------|
| `px-6` (24 px) | 7 | ✓ on grid |
| `px-4` (16 px) | 7 | ✓ on grid |
| `py-3` (12 px) | 5 | ⚠ 12 px reserved for chip/pill primitives only |
| `py-2` (8 px) | 4 | ✓ on grid |
| `gap-4` (16 px) | 3 | ✓ on grid |
| `gap-2` (8 px) | 3 | ✓ on grid |
| `gap-1` (4 px) | 3 | ✓ on grid (icon-to-label only) |
| `py-8` (32 px) | 2 | ✓ on grid |
| `px-5` (20 px) | 2 | ✓ on grid (mobile outer gutters) |
| `gap-3` (12 px) | 1 | ⚠ same off-grid issue |

**Strengths**
- Strict 8 pt grid honored in 90 %+ of declarations.
- `px-5` mobile outer gutters confirmed at `empty-state.tsx:73` and `profile/page.tsx:9` per UI-SPEC line 48.
- Capture button uses arbitrary `w-[72px] h-[72px] min-h-[72px]` — `space-18` (72 px) is documented as the capture-button diameter and the arbitrary value is intentional (`capture-button.tsx:50`).
- Bottom-nav arbitrary `min-h-[56px]` matches `space-14` 56 px content + safe-area inset (`bottom-nav.tsx:107`).
- Modal sheet `rounded-t-[24px]` matches `space-6` 24 px top-corner radius geometric token (`modal-sheet.tsx:54`).
- Toggle min-h-[44px] honors the 44 px tactile floor exception (UI-SPEC line 58).

**Findings**
- **WARNING — `py-3` (12 px) on Button/TextInput/Select/InlineError.** UI-SPEC line 46 restricts `space-3 / 12 px` to "composed chip / pill primitives." All four primitives use `py-3` for visual centering inside `min-h-[48px]` — but with `min-h-[48px]` already enforcing the height floor, the inner padding could collapse to `py-2` (8 px) on grid without changing the rendered button height. Files: `empty-state.tsx:58,66`, `inline-error.tsx:27`, `text-input.tsx:51`, `select.tsx:35`.
- **WARNING — `gap-3` (12 px) on Toggle.** `toggle.tsx:24` uses `gap-3` between the track and the label. Spec restricts 12 px to chip/pill primitives. Toggle is neither. Fix: `gap-2` (8 px) or `gap-4` (16 px).
- **INFO — `pb-[80px]` on `<main>`.** `app-shell.tsx:153`. Acceptable — bottom-nav 56 px content + ~24 px safe-area inset = ~80 px reserved space; this is a layout escape hatch, not a token violation. Could be expressed as `pb-20` (80 px on Tailwind's default `space-20`).

### Pillar 6: Experience Design (3/4)

**State coverage scan:**
- Loading: `Skeleton` + `SkeletonGroup` (300 ms gate, 120 ms fade-in, motion-reduce 80 ms fallback) — `skeleton.tsx`. ✓
- Error: `InlineError` (CAUSE + RECOVERY + retry path enforced at type level, `role="alert"`) — `inline-error.tsx`. ✓
- Empty: 4 routes compose `EmptyState`; offline page also composes it. ✓
- Disabled: Button passes through `disabled` via `ButtonHTMLAttributes` spread (`button.tsx:16`). No visual disabled style declared though — addressing this is owner of Phase 4 form composition.
- Confirmation for destructive: `dialog.destructive.cancel`/`confirm` keys in pt-BR.json:85-87 + `Button variant="destructive"` (Urgent Poppy fill, modal-only) wired; no live destructive flow in Phase 3 per CONTEXT.md.

**Strengths**
- Three-layer reduced-motion enforcement per D-08 verified: `useReducedMotion()` hook at `motion/use-reduced-motion.ts`, Tailwind `motion-reduce:transition-none` on bottom-nav indicator (`bottom-nav.tsx:104`), Stylelint custom rule `keyframes-requires-reduced-motion` at `tools/stylelint-plugins/`. Plus the `@media (prefers-reduced-motion: reduce)` block at `globals.css:158-164` that disables `animate-shimmer` via CSS.
- Capture-button correctly OMITS the `animate` prop under reduced-motion (`capture-button.tsx:40-43`) instead of forcing `scale: 1` — addresses the GPU-layer-burn pitfall called out in UI-20.
- Skip-to-main link is the first focusable element in `(app)` shell (`app-shell.tsx:138-143`); pt-BR copy "Ir para o conteúdo principal" wired.
- Programmatic focus-on-route-change logic ignores hash-only navigation via `prevPathnameRef` guard (`app-shell.tsx:48-53`) — UI-03 hash-only pitfall handled.
- Per-tab scroll restore uses three layers: `useLayoutEffect` restore on tab change + debounced 150 ms save listener + `pagehide`/`visibilitychange` immediate-save fallback for bfcache and tab-hide cases. Both the synthetic-scroll consume-once race (`app-shell.tsx:81-87`) and the cleanup-clobber-on-navigation race (`app-shell.tsx:108-126`) are explicitly handled via comments.
- SW user-controlled update flow: `skipWaiting: false` + `SKIP_WAITING` postMessage guard + `controlling`-event reload — never auto-reload mid-session per OFF-10. Plan 05 SUMMARY confirms 3 SKIP_WAITING contract tests pass.
- Online detection combines `navigator.onLine` + `online`/`offline` events + 30 s heartbeat against `/api/v1/health/connectivity` (URL contract test-locked) — captive-portal-resilient per D-30.
- Modal sheet exposes `onCloseAutoFocus` for callers to restore focus to a stored invokerRef — per Plan 05 fix for Radix's triggerRef-only restore.
- `axe-core/playwright` matrix runs over 5 routes × 4 mode combos per Plan 05 — gates `serious` + `critical` violations.
- All composed primitives respect WCAG 2.1 AA — `bg-canopy` × `text-ivory` light = 12.9 : 1 (Forest Ink contrast); `text-rust` body in InlineError = 5.6 : 1 ledger value.

**Findings**
- **WARNING — CaptureButton breathing loop primitive ships, but the Home empty-CTA does NOT activate it.** UI-SPEC SC-3 + line 244 explicitly demand "3.2 s 1.00→1.02 breathing loop on Home empty (SC-3)". Today, Home renders a flat `<a>` styled like a button (`empty-state.tsx:55-61`) — no `<CaptureButton breathing>` instance. CONTEXT.md line 86 acknowledges Phase 5 wires this on Home, but UI-SPEC SC-3 calls for it in Phase 3. Cross-reference: `breathing-loop.test.tsx` exists but only tests the primitive in isolation, not its placement.
- **WARNING — Modal sheet drag handle is visual-only.** `modal-sheet.tsx:57-60` ships a `36×4 px` Hairline bar but Radix Dialog has no drag-to-dismiss listener. Spec line 248 says "drag handle (tap-scrim only in addition)" — the drag handle is meant to be functional. Either wire a touch listener (Framer Motion `motion.div` with drag constraints) or document this as visual-only and rely on the close button + scrim tap.
- **INFO — Toggle primitive used in Profile is actually a Select segmented control.** Plan 04 SUMMARY notes: "MEDIUM 7 codex review — NOT a binary Toggle." UI-SPEC line 33 specifies "Toggle" but D-13 surfaces a 3-state auto/light/dark which only fits Select. Implementation correct, spec wording slightly outdated.

---

## Files Audited

**Component primitives (`src/shared/ui/`):**
- `app-update-toast.tsx`, `bottom-nav.tsx`, `button.tsx`, `capture-button.tsx`, `discard-summary-toast.tsx`, `empty-state.tsx`, `inline-error.tsx`, `modal-sheet.tsx`, `offline-banner.tsx`, `read-only-banner.tsx`, `select.tsx`, `skeleton.tsx`, `text-input.tsx`, `toggle.tsx`

**App shell + routes (`src/app/`):**
- `layout.tsx`, `globals.css`, `(app)/layout.tsx`, `(app)/app-shell.tsx`, `(app)/page.tsx`, `(app)/catalog/page.tsx`, `(app)/identify/page.tsx`, `(app)/profile/page.tsx`, `(app)/profile/profile-theme-toggle.tsx`, `offline/page.tsx`, `offline/offline-fallback.tsx`

**Theme + motion + i18n (`src/shared/`):**
- `theme/tokens.ts`, `theme/use-theme.ts`, `motion/springs.ts`, `motion/use-reduced-motion.ts`, `i18n/format.ts`, `online/use-online-status.ts`, `typography/scientific-name.tsx`

**Translations + manifest:**
- `src/messages/pt-BR.json`, `public/manifest.webmanifest`

**Visual evidence (Playwright committed Linux baselines):**
- `tests/e2e/visual-snapshots.spec.ts-snapshots/` — 20 PNGs spanning 5 routes × {light, dark} × {no-preference, reduce}. Inspected: Home light, Home dark, Catalog light, Profile light, Profile dark, Offline light.

**No live dev server detected** — port 3000 / 5173 idle; port 8080 hosts an unrelated SearXNG instance. Audit relied on committed Playwright baselines as visual surface.

---

## Registry Audit

`components.json` not present (D-01 commits to raw Tailwind v4 + bespoke primitives). UI-SPEC Registry Safety table line 583 declares "no shadcn / no third-party registries; direct npm deps only." Registry vetting gate not applicable. Direct npm deps (Radix UI primitives, sonner, motion, lucide-react) reviewed via Plan SUMMARYs and confirmed pinned at `package.json`.

**Registry audit: 0 third-party blocks checked, no flags.**
