# Accessibility & Responsiveness — Folhário

## Baseline
**WCAG 2.1 Level AA.** Ship blocker, not aspirational.

## Semantic HTML
- Native semantic tags throughout (`<button>`, `<nav>`, `<main>`, `<header>`, `<section>`, `<article>`, `<form>`, proper heading hierarchy).
- ARIA attributes only where native semantics insufficient. No redundant ARIA.
- Single `<h1>` per screen. Don't skip heading levels.
- Landmark regions for main content, nav, complementary.

## Font Scaling
- Respects browser + OS font-size up to **200%** without layout breakage.
- No fixed-px typography. Use rem/em.
- No fixed-height containers that clip text.

## Contrast
- Body text: ≥ **4.5:1**.
- Large text (18.66px bold / 24px regular): ≥ **3:1**.
- Meaningful UI elements (icons, focus rings, borders conveying state): ≥ **3:1**.
- Toxicity badges, cap-reached states, draft badges, overdue indicators — all verified.

## Keyboard Navigation
- Every interactive element reachable + operable via keyboard.
- Logical tab order (DOM order).
- Visible focus indicators on ALL focusable elements. Never `outline: none` without replacement.
- Modals: focus trap, return focus on close, ESC dismisses.
- Skip-to-content link at top of page.

## Touch Targets
- Min **44×44 px** for all tap targets.
- Spacing between adjacent targets to prevent mis-tap.

## Color Not Sole Signal
Every state indicator combines multiple cues:
- **Toxicity:** icon + colored badge + text (per §3.3.2).
- **Overdue reminders:** icon + color + text label ("Atrasado").
- **Cap-reached state:** icon + text explanation.
- **Draft care guide:** badge icon + text "Gerado por IA — em revisão".
- **Confidence %:** numeric % + text + color (never color alone).
- **Subscription status:** text label always present.
- **Offline / Read-only banners:** icon + text.

## Forms
- Labels programmatically associated with inputs (`<label for>` or wrapping).
- Error messages associated via `aria-describedby`.
- Required fields marked with `aria-required` + visual indicator + text.
- Inline validation errors announced to screen readers via live region.
- Autocomplete attributes on email, password, name fields.

## Image Alt Text

### UI Images
All UI images (icons, illustrations, logos) carry meaningful alt text or `alt=""` if purely decorative.

### User-Uploaded Photos (Exempt from Auto-Captioning in MVP)
No AI auto-captioning. BUT: must expose programmatic accessible name from surrounding context. **No empty or filename-based alt text allowed.**

Rules:
- **Catalog cards:** plant's `name` + `nickname` (if present). E.g., "Samambaia (Maria)".
- **Photo journal entries:** plant name + entry date in user locale. E.g., "Foto de Maria, 12 de abril de 2026".
- **Identification result thumbnails:** provider-returned common name.
- **Plant profile cover photo:** plant name + nickname.

## Screen Reader Announcements
- Live regions for async state changes (identification results, sync completion, discard summary).
- `aria-live="polite"` for non-critical updates.
- `aria-live="assertive"` for errors and blocking states.
- Loading states announced ("Identificando sua planta").

## Modals & Dialogs
- `role="dialog"` with `aria-labelledby` + `aria-describedby`.
- Focus trap inside modal.
- Return focus to trigger on close.
- Background scroll locked while open.
- ESC closes.
- Click-outside optional (not for critical modals like LGPD consent).

## Motion & Animation
- Respect `prefers-reduced-motion`. Disable non-essential animations.
- No critical info conveyed only through animation.

## Language
- `<html lang="pt-BR">`.
- Dynamic content marked with lang attribute if not pt-BR (e.g., Latin scientific names: `<i lang="la">`).

## Disclaimer Prominence
Toxicity AI disclaimer ("Informação gerada por IA — confirme com um veterinário") is text-visible and announced to screen readers. Not hidden behind a tooltip or icon.

---

## Responsiveness

### Breakpoints
- **Mobile-first.** Primary target phones (320px–480px).
- **Tablet:** up to ~768px.
- **Desktop:** app layout constrained to **tablet-like max-width, centered, with bg fill on sides.** The app is NOT designed for wide-screen desktop.

### Fluid Layouts
- No horizontal scrolling.
- Grid/list in catalog reflows: ~2 cols mobile, ~3 cols tablet.
- Forms single-column on mobile.

### Orientation
- Portrait primary.
- Landscape supported but not optimized.

### PWA Manifest
- Installable to home screen.
- Display mode: `standalone`.
- Theme color matches brand.
- Icons at all required sizes.

### Offline UX
- Cached catalog + care guides browsable.
- Clear offline banner.
- Queued actions indicated where relevant.

### Viewport
- `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- User scaling NOT disabled (`maximum-scale` not set).

### Images
- Responsive sizes (srcset / sizes).
- Thumbnails for list views, full images for detail.
- Lazy loading for off-screen images.

### Touch vs. Pointer
- Hover states ONLY supplementary. Never sole interaction trigger.
- Touch-friendly tap areas on all interactive elements.
