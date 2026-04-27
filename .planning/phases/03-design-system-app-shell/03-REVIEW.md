---
phase: 03-design-system-app-shell
reviewed: 2026-04-27T18:30:00Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - eslint.config.mjs
  - next.config.ts
  - postcss.config.mjs
  - public/manifest.webmanifest
  - src/app/(app)/app-shell.tsx
  - src/app/(app)/catalog/page.tsx
  - src/app/(app)/identify/page.tsx
  - src/app/(app)/layout.tsx
  - src/app/(app)/page.tsx
  - src/app/(app)/profile/page.tsx
  - src/app/(app)/profile/profile-theme-toggle.tsx
  - src/app/(test)/modal-sheet/harness.tsx
  - src/app/(test)/modal-sheet/page.tsx
  - src/app/api/v1/health/connectivity/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/offline/offline-fallback.tsx
  - src/app/offline/page.tsx
  - src/app/sw.ts
  - src/messages/pt-BR.json
  - src/shared/i18n/format.ts
  - src/shared/motion/springs.ts
  - src/shared/motion/use-reduced-motion.ts
  - src/shared/online/use-online-status.ts
  - src/shared/theme/tokens.ts
  - src/shared/theme/use-theme.ts
  - src/shared/typography/scientific-name.tsx
  - src/shared/ui/app-update-toast.tsx
  - src/shared/ui/bottom-nav.tsx
  - src/shared/ui/button.tsx
  - src/shared/ui/capture-button.tsx
  - src/shared/ui/discard-summary-toast.tsx
  - src/shared/ui/empty-state.tsx
  - src/shared/ui/inline-error.tsx
  - src/shared/ui/modal-sheet.tsx
  - src/shared/ui/offline-banner.tsx
  - src/shared/ui/read-only-banner.tsx
  - src/shared/ui/select.tsx
  - src/shared/ui/skeleton.tsx
  - src/shared/ui/text-input.tsx
  - src/shared/ui/toggle.tsx
  - stylelint.config.mjs
  - tests/unit/app-update-toast.test.tsx
  - tests/unit/banned-patterns-snapshot.test.ts
  - tests/unit/breathing-loop.test.tsx
  - tests/unit/empty-state.test.tsx
  - tests/unit/format.test.ts
  - tests/unit/heartbeat-route-contract.test.ts
  - tests/unit/inline-error.test.tsx
  - tests/unit/manifest-shape.test.ts
  - tests/unit/messages-coverage.test.ts
  - tests/unit/scroll-restore.test.ts
  - tests/unit/setup-env.ts
  - tests/unit/skeleton-group.test.tsx
  - tests/unit/sw-skip-waiting.test.ts
  - tests/unit/use-online-status.test.tsx
  - tests/unit/use-theme.test.ts
  - tools/stylelint-plugins/keyframes-requires-reduced-motion.cjs
  - vitest.config.ts
findings:
  blocker: 1
  warning: 9
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-27T18:30:00Z
**Depth:** standard
**Files Reviewed:** 56
**Status:** issues_found

## Summary

Phase 03 ships the design system primitives, AppShell, theme infrastructure, online-status / SW update flow, and PWA manifest. The implementation reflects deep planning (extensive comment trail referencing prior code reviews and risk registers), and most contracts hold up under scrutiny. A small number of correctness defects nevertheless slipped through, concentrated in two areas:

1. **Scroll-restoration / focus-trap interaction in `AppShell`** — the scroll-save cleanup races with the layout-effect scrollTo, silently clobbering the previous route's saved scrollY when navigation interrupts an in-flight debounce. A second related defect leaves the synthetic-scroll consumer listener armed forever when `targetY` is non-zero but clamped to the same value as `currentY` (e.g., negative values from tampered sessionStorage).
2. **A11y attributes overridable via `{...rest}` in form primitives** — both `TextInput` and `Select` spread caller props AFTER computing `aria-invalid` / `aria-describedby`, which lets a consumer accidentally override the error-state ARIA contract. Given `CLAUDE.md` declares WCAG 2.1 AA a ship blocker, this is classified BLOCKER.

The remaining warnings cover real but lower-impact defects: a parallel-timer race in `useOnlineStatus`, missing cleanup + missing remove-listener API in `AppUpdateToast`, swallowed promise rejections in two transition callsites, missing email validation on cookie write, and `EmptyState` + `discard-summary-toast` typing weaknesses that allow the no-op render path. No security vulnerabilities, no hardcoded credentials, no injection vectors found.

## Blocker Issues

### CR-01: `TextInput` and `Select` allow consumers to silently override error-state ARIA attributes

**File:** `src/shared/ui/text-input.tsx:45-54`, `src/shared/ui/select.tsx:30-36`

**Issue:** Both primitives compute accessibility attributes (`aria-invalid`, `aria-describedby`) from the `error` prop, then spread `{...rest}` AFTER those attributes. JSX attribute order is significant: a later attribute of the same name overrides an earlier one. Any consumer who passes `aria-invalid` or `aria-describedby` (which are NOT destructured out of `rest`) silently overrides the computed value, decoupling AT announcements from the visible error state.

This is a WCAG 2.1 AA concern — `CLAUDE.md` lists 2.1 AA as a "ship blocker". The error helper text is wired via `id={errorId}` and tied to the input by `aria-describedby={errorId}`; if a caller passes a different `aria-describedby`, screen readers will not announce the validation cause. UI-22's "redundant-cue" contract collapses.

The pattern is also internally inconsistent: `text-input.tsx` *does* place `onFocus`/`onBlur` AFTER the spread on purpose (so the local handlers win and forward), proving the author understood spread ordering. The aria attrs were placed before the spread by oversight.

**Fix:** Move the computed aria attrs AFTER the spread so they always win. (`id`, `autoComplete`, `className`, `error` are already destructured out, so no other spread fallout.)

```tsx
// src/shared/ui/text-input.tsx — lines 45-54
<input
  id={inputId}
  autoComplete={autoComplete}
  className={`bg-ivory border-[1.5px] ${strokeClass} rounded-lg px-4 py-3 text-base text-forest min-h-[48px] ${className ?? ""}`.trim()}
  {...rest}
  aria-invalid={Boolean(error)}
  aria-describedby={errorId}
  onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
  onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
/>
```

```tsx
// src/shared/ui/select.tsx — lines 30-36
<select
  id={selectId}
  className={`appearance-none w-full bg-ivory border-[1.5px] ${strokeClass} rounded-lg px-4 py-3 pr-10 text-base text-forest min-h-[48px] ${className ?? ""}`.trim()}
  {...rest}
  aria-invalid={Boolean(error)}
  aria-describedby={errorId}
>
```

Add a Vitest case for each primitive: render with `aria-invalid={false}` AND `error="X"` and assert the rendered element has `aria-invalid="true"` and `aria-describedby` matching the error id.

## Warnings

### WR-01: `AppShell` scroll-save cleanup clobbers the OLD pathname's saved scrollY when navigation interrupts a pending debounce

**File:** `src/app/(app)/app-shell.tsx:108-126`

**Issue:** The debounced scroll-save effect (lines 108-126) attempts to flush a pending save in cleanup by reading `window.scrollY` at cleanup time:

```ts
return () => {
  if (timer) clearTimeout(timer);
  if (pending) saveScroll(pathname, window.scrollY);
  window.removeEventListener("scroll", onScroll);
};
```

The comment block on lines 98-107 explicitly identifies this concern ("by the time React runs effect cleanups, the useLayoutEffect restore for the new pathname has already called window.scrollTo(0, ...), so reading window.scrollY here returns the NEW route's restored position … that would clobber the OLD pathname's correctly saved Y") and claims the `pending` flag mitigates it. **It does not.** `pending` only gates *whether* to write; the value being written is still `window.scrollY` read at cleanup time, which has already been overwritten by the useLayoutEffect for the new pathname.

Reproduction trace:

1. User on `/catalog` at `scrollY=500`. `onScroll` fires → `pending=true`, timer scheduled for T+150ms.
2. User taps `/identify` at T+50ms (before timer fires).
3. React commits the `/identify` route. `useLayoutEffect` (lines 66-95) reads `restoreScroll("/identify")=0` → `window.scrollTo(0, 0)`. `window.scrollY` is now 0.
4. Effect cleanups run for the previous commit. The save-effect cleanup reads `window.scrollY` (=0) and calls `saveScroll("/catalog", 0)`, overwriting the legitimate 423 with 0.

Per-tab scroll restoration (D-23, UI-14) silently breaks for the most common navigation pattern (tab tap mid-scroll-debounce). The `pagehide`/`visibilitychange` listener (lines 131-133) does not cover this — the page is not being hidden.

**Fix:** Capture `window.scrollY` inside `onScroll` into a ref (or closure variable) and save THAT captured value in cleanup, not a re-read of `window.scrollY`:

```ts
useEffect(() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let lastScrollY = window.scrollY;
  function onScroll() {
    lastScrollY = window.scrollY;
    if (timer) clearTimeout(timer);
    pending = true;
    timer = setTimeout(() => {
      saveScroll(pathname, lastScrollY);
      pending = false;
      timer = null;
    }, 150);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    if (timer) clearTimeout(timer);
    if (pending) saveScroll(pathname, lastScrollY);
    window.removeEventListener("scroll", onScroll);
  };
}, [pathname]);
```

Add a Vitest unit case that simulates a `scroll` event on `/catalog` (sets scrollY to 423), changes `pathname` to `/identify` (which causes the layout effect to scrollTo 0), and asserts `sessionStorage.getItem("scroll:/catalog")` is `"423"`, not `"0"`.

### WR-02: `useOnlineStatus` parallel-timer race when `handleOnline` fires during an in-flight ping

**File:** `src/shared/online/use-online-status.ts:38-69`

**Issue:** `schedule()` and `handleOnline()` race when the window 'online' event fires after the `setTimeout` callback has begun (i.e., during `await ping()` but before the async function resumes):

1. Timer fires → `await ping()` is in flight.
2. Network reconnects → `handleOnline` fires → `setOnline(true)`, `clearTimeout(timer)` (no-op; the timer already fired), `schedule(POLL_AFTER_RECONNECT)` overwrites `timer` with a new pending timeout.
3. `ping()` resolves. Code does NOT check whether a new schedule is already in flight (only `cancelled` is checked, which is false until unmount). It calls `setOnline(ok)` (potentially overwriting the `setOnline(true)` from `handleOnline`) and then `schedule(...)` (creating yet another timer that races with the one set by `handleOnline`).

Net effect: two `setTimeout` chains run in parallel, doubling the heartbeat traffic, and the `online` state can flip-flop unpredictably as the two chains' setOnline calls interleave.

**Fix:** Track a generation/epoch counter. `handleOnline` increments the counter; the post-await callback aborts if its captured generation no longer matches:

```ts
useEffect(() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let generation = 0;

  // ...

  function schedule(delay: number) {
    if (cancelled) return;
    const myGen = ++generation;
    timer = setTimeout(async () => {
      const ok = await ping();
      if (cancelled || myGen !== generation) return;
      setOnline(ok);
      schedule(ok ? POLL_AFTER_SUCCESS : POLL_AFTER_RECONNECT);
    }, delay);
  }

  function handleOnline() {
    setOnline(true);
    if (timer) clearTimeout(timer);
    schedule(POLL_AFTER_RECONNECT);
  }
  // ...
}, []);
```

### WR-03: `AppUpdateToast` registers Serwist event listeners with no cleanup, no remove-listener API

**File:** `src/shared/ui/app-update-toast.tsx:60-81`

**Issue:** The `useEffect` dependency array `[t, createSource, reload]` causes the effect to re-run if any of those references change. Each run constructs a NEW `source` via `createSource()`, attaches a NEW `waiting` listener (which itself attaches a NEW `controlling` listener on first fire), and calls `source.register()`. There is no cleanup function and the `AppUpdateSource` interface (lines 34-38) deliberately exposes only `addEventListener` — no `removeEventListener`.

Practical impact:
- React 18+ Strict Mode mounts every effect twice in development. Two `Serwist` instances are constructed; both attach `waiting` listeners; both eventually call `register()`. On a real `waiting` event, the toast can fire twice and the `controlling` handler chain can call `reload()` twice.
- In production, if `useTranslations` ever returns a new reference (e.g., locale switch, future React internals), the effect re-runs and stacks more listeners on the underlying SW registration without removing the old ones.
- Silent failure mode: `source.register()` is invoked unconditionally on every effect run; multiple registrations attempted on the same scope can produce console warnings / errors that the void-ed promise (line 80) swallows.

**Fix:** Either widen `AppUpdateSource` to include `removeEventListener` (and write the corresponding cleanup), OR memoize the source instance at module scope and treat the effect as a singleton-mount with strictly empty deps `[]` and an idempotent guard. If keeping the current shape, at minimum:

```ts
useEffect(() => {
  if (typeof navigator !== "undefined" && !("serviceWorker" in navigator)) return;

  const source = createSource();
  const waitingHandler = () => {
    source.addEventListener("controlling", () => reload());
    toast(t("label"), { /* ... */ });
  };
  source.addEventListener("waiting", waitingHandler);
  void source.register();

  return () => {
    source.removeEventListener?.("waiting", waitingHandler);
  };
}, [t, createSource, reload]);
```

…and add `removeEventListener?` to `AppUpdateSource`. Also add a Strict-Mode-double-mount unit test that asserts `addEventListener("waiting", …)` is called exactly once across the rendered lifecycle.

### WR-04: `AppShell` synthetic-scroll consumer listener can stay armed forever, eating the user's next real scroll

**File:** `src/app/(app)/app-shell.tsx:66-95`, `src/shared/ui/bottom-nav.tsx:38-42`

**Issue:** The capture-phase listener is installed under the condition `currentY !== clampedTarget`. The subsequent `window.scrollTo(0, targetY)` uses the UNCLAMPED `targetY` from `restoreScroll`. Two failure cases:

1. **Negative scrollY in sessionStorage** (tampered or corrupted): `restoreScroll` returns the negative value because `Number.parseInt("-5", 10) || 0` evaluates to `-5` (truthy). `clampedTarget = Math.min(-5, maxY)` = `-5`. `currentY` (e.g., 0) `!== -5`, so the listener installs. `scrollTo(0, -5)` is interpreted by browsers as `scrollTo(0, 0)` — already at 0, no scroll event fires. The `consumeOnce` listener stays registered until cleanup. The user's next actual scroll on this route is silently swallowed (`event.stopImmediatePropagation()` prevents the scroll-save effect from seeing the event, AND the cleanup will remove the listener at unmount but not before).

2. **`targetY > maxY` AND `currentY === maxY`** (returning to a route whose document is now shorter than when scroll was saved): `clampedTarget = maxY`. `currentY === clampedTarget` early-returns and skips listener install — OK in this case.

The early-return guard checks against `clampedTarget`, but the actual `scrollTo` argument is `targetY`. They should agree. Defense-in-depth: also reject negative values in `restoreScroll`.

**Fix:**

```ts
// src/shared/ui/bottom-nav.tsx — line 41
export function restoreScroll(pathname: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  const raw = sessionStorage.getItem(scrollKey(pathname));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
```

```ts
// src/app/(app)/app-shell.tsx — line 89
window.scrollTo(0, clampedTarget);  // not targetY
```

### WR-05: `void setTheme(next)` swallows server-action rejection in `ProfileThemeSelect`

**File:** `src/app/(app)/profile/profile-theme-toggle.tsx:24-30`

**Issue:** `startTransition(() => { void setTheme(next); })` discards any rejection from the server action. If `setTheme` throws (network failure, future allowlist tightening, cookie-store error), the optimistic `setValue(next)` already committed local state but the cookie was never written. Next render of root layout reads the OLD cookie → `<html data-theme>` snaps back to old value while the local state stays on `next` until next remount. User sees a contradictory UI with no error indication.

**Fix:** Catch the rejection and either roll back local state, surface a sonner toast, or both. Minimal:

```tsx
startTransition(async () => {
  try {
    await setTheme(next);
  } catch {
    setValue(value); // rollback
    toast(t("error.generic.title"));
  }
});
```

(Note that wrapping `await` inside `startTransition` is supported in React 19; the callback can return a Promise.)

### WR-06: `void source.register()` swallows registration errors in `AppUpdateToast`

**File:** `src/shared/ui/app-update-toast.tsx:80`

**Issue:** Same pattern as WR-05 — `void source.register()` discards any rejection. Serwist's `register()` can fail (insecure context, SW MIME-type error, network error fetching `/sw.js`, scope/registration conflict). A failed registration silently means the user never sees the update toast and never gets the bf-cache `controlling` reload — defeating OFF-10's purpose. No telemetry path either.

**Fix:** At minimum, catch and report to Sentry:

```ts
void source.register()?.catch?.((err) => {
  if (typeof window !== "undefined") {
    // Sentry.captureException is set up in next.config.ts; defer to it.
    import("@sentry/nextjs").then((m) => m.captureException(err)).catch(() => {});
  }
});
```

Or treat registration failure as a hard error in dev (`if (process.env.NODE_ENV !== "production") throw err`).

### WR-07: `EmptyState` admits an inert no-op render when neither `ctaHref` nor `ctaOnClick` is provided

**File:** `src/shared/ui/empty-state.tsx:20-28, 54-90`

**Issue:** `EmptyStateProps` declares both `ctaHref?` and `ctaOnClick?` as optional with no XOR constraint. The component renders an `<a>` if `ctaHref` is set; otherwise a `<button>` with `onClick={ctaOnClick}` — which can be `undefined`, producing a button that does nothing on tap. Since UI-18 (per the comment block on lines 4-10) mandates "EXACTLY ONE Canopy primary CTA", a non-functional CTA defeats the contract. The unit test in `tests/unit/empty-state.test.tsx` only verifies single-CTA cardinality, not that the CTA is functional.

This is also caller-error-bait: a developer who simply forgets one of the two props gets a fully rendered EmptyState that fails silently in QA.

**Fix:** Use a discriminated-union prop type so TS rejects the no-op case at compile time:

```ts
export type EmptyStateProps = {
  headline: string;
  hint: string;
  ctaLabel: string;
  illustrationSrc?: string;
} & ({ ctaHref: string; ctaOnClick?: never } | { ctaOnClick: () => void; ctaHref?: never });
```

Add a runtime guard for runtime-prop callers (server components passing `ctaHref` from translations):

```ts
if (!ctaHref && !ctaOnClick) {
  throw new Error("EmptyState requires either ctaHref or ctaOnClick");
}
```

### WR-08: Auto-generated form-element IDs collide when two primitives on the same page share a label

**File:** `src/shared/ui/text-input.tsx:31`, `src/shared/ui/select.tsx:20`, `src/shared/ui/toggle.tsx:19`

**Issue:** All three primitives derive `id` from the `label` prop via `label.toLowerCase().replace(/\s+/g, "-")`. Two same-label primitives on the same page produce duplicate IDs, which:
- Breaks `<label htmlFor>` correctness — the second control's label points back at the first control. Tap label → focuses wrong control.
- Breaks `aria-describedby` references when the second control has an error: both error helpers share the same id, AT can't disambiguate.
- Violates HTML5 unique-id rule.

The fallback (`id ?? ...`) puts the burden on the caller to know about the collision risk. This is a foot-gun for code that loops over a list of fields.

**Fix:** Use `useId()` from React when no `id` is provided:

```tsx
import { useId } from "react";
// inside component
const reactId = useId();
const inputId = id ?? reactId;
```

`useId()` produces stable, server-safe unique IDs; this is its canonical use case.

### WR-09: `discard-summary-toast` `ctaLabel` / `onClick` are independently optional but only useful as a pair

**File:** `src/shared/ui/discard-summary-toast.tsx:15-32`

**Issue:** The interface allows passing `ctaLabel` without `onClick` or `onClick` without `ctaLabel`. The runtime check `ctaLabel && onClick` silently drops the `action` if either is missing — caller has no signal that their toast lost its CTA. Minor caller-error trap.

**Fix:** Use a discriminated-union type to require both-or-neither:

```ts
export type DiscardSummaryToastProps =
  | { label: string; ctaLabel?: never; onClick?: never }
  | { label: string; ctaLabel: string; onClick: () => void };
```

## Info

(none — info-level items either rolled up into warnings above or judged not worth flagging at standard depth.)

---

*Reviewed: 2026-04-27T18:30:00Z*
*Reviewer: Claude (gsd-code-reviewer)*
*Depth: standard*
