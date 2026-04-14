# Design System: Folhário
**Project ID:** 14551939502586528786
**Source of truth:** `docs/PRD-V1.1.md`
**Target device:** Mobile PWA (pt-BR), evolving toward native
**Accessibility baseline:** WCAG 2.1 AA — color is never the sole signal

## 1. Visual Theme & Atmosphere

Folhário feels like a **sunlit morning on a Brazilian veranda** — a well-loved gardening notebook opened on a wooden table, next to a terracotta pot. The aesthetic is **warm, grounded, and quietly confident**. Not a clinical plant-tech app, not a minty wellness app, and never a botany textbook.

The mood is **airy and generous**, not dense. Screens breathe: the empty state of "Identifique sua primeira planta" should feel like an invitation into a hobby, not a task list waiting to be cleared. Photography-first — the user's own plant photos are the hero of most screens; the UI steps back to frame them.

**Atmospheric adjectives:** warm, humanist, tactile, reassuring, unhurried, honest. The product speaks to a beginner who just bought a fern at the flower market; every surface should feel like a knowledgeable friend explaining, never lecturing.

## 2. Color Palette & Roles

The palette is drawn from **cerrado soil, canopy shade, and terracotta pottery** — a Brazilian warmth that reads beginner-friendly without being childish. Two variants ship as one system: **light (sunlit veranda, default)** and **dark (veranda-at-dusk)**. Both are first-class — every screen is designed and reviewed in both variants before it ships. Folhário declares `color-scheme: light dark` and follows the system preference, with a manual override in Settings.

### Light variant — core surfaces
- **Paper Cream (#FBF7EF)** — primary app background. A warm, slightly yellow off-white that evokes aged paper and soft daylight. Never pure white.
- **Warm Ivory Surface (#FFFDF7)** — card and sheet backgrounds, one nudge brighter than Paper Cream to create gentle elevation without heavy shadow.
- **Hairline Beige (#E8E1D0)** — 1px dividers, input strokes at rest, subtle section separators.

### Light variant — botanical primaries
- **Canopy Green (#1F4D35)** — the brand's anchor. Used for primary buttons, top-nav accents, active tab indicators, the logo mark, and any element that should read as "Folhário speaking." Carries 9.1:1 contrast on Paper Cream.
- **Forest Ink (#143424)** — headline text and high-emphasis labels. Reads as near-black but carries the same green undertone as Canopy, so the whole UI feels tonally unified. 12.9:1 on Paper Cream.
- **Calm Slate (#5A6358)** — body secondary text, placeholder text, metadata rows (acquisition date, room labels), inactive bottom-nav icons, disabled states. 5.9:1 on Paper Cream. This is the only approved muted-text color; nothing lighter is ever used for body copy on Paper Cream.
- **Understory Sage (#8AA593)** — **decorative only.** Empty-state line-art illustrations, the "empty slot" glyph on catalog cards, plant photo-frame accents, and icons inside icon-left rows where an adjacent text label carries the meaning. 2.5:1 on Paper Cream — never used as the sole information channel, never used for text, never used for state-bearing UI graphics like active/inactive nav indicators.

### Light variant — warm accents
- **Terracotta Clay (#C96F4A)** — the secondary brand color. Used sparingly for **delight moments**: the "add to catalog" success flourish, partner-trial badges, streak celebrations, the flower icon in the capture guide, bottom-nav badge dots. Evokes a garden pot; never used for errors or warnings. 3.4:1 on Paper Cream — badge and large-glyph use only, never for body text.
- **Honey Amber (#D4A340)** — medium-confidence identification bar fill. 2.2:1 on Paper Cream — **bar fill only, never text, never borders, never outlines**. Always paired with an adjacent Forest Ink percentage label.

### Light variant — system signals
- **Urgent Poppy (#C73E1D)** — **toxicity warnings and destructive-confirmation actions only**. Paired with a filled paw-or-child icon **and** the literal word "Tóxico" **and** a striped left border accent so the signal survives color-blindness and grayscale rendering. See §4 Components → Toxicity Badge. 4.7:1 on Paper Cream; Warm Ivory label on Urgent Poppy fill is 5.0:1.
- **Overdue Rust (#A14A2C)** — the **"requires your attention"** signal. Used for overdue-reminder indicators on Home / Today's tasks **and** for form-validation errors. These two uses share one meaning: *something the user must attend to before moving on.* Urgent Poppy is reserved for **safety**; Overdue Rust is reserved for **attention**. The two never appear on the same screen, so users learn the distinction without ambiguity. 5.6:1 on Paper Cream.
- **Trust Teal (#2B6F7A)** — informational callouts, the LGPD disclaimer strip, the "Gerado por IA" chip, and the first-view care-guide modal. Deliberately cool and trustworthy — separates "information about the system" from "information about the plant." 5.4:1 on Paper Cream.

### Dark variant — veranda-at-dusk

The dark palette is a warm charcoal reflection of the light palette, not an inverted grayscale. The metaphor shifts from "sunlit morning" to "the same veranda after dark, lit by a lantern." Every light token has a dark-mode counterpart with an identical semantic role; do not introduce tokens that exist in only one variant.

**Dark core surfaces**
- **Night Cream (#1A1613)** — primary app background. Warm charcoal carrying the same red-yellow undertone as Paper Cream. Never pure black.
- **Embered Surface (#231E1A)** — card and sheet backgrounds, one nudge brighter than Night Cream for gentle elevation.
- **Hairline Umber (#3A332B)** — 1px dividers, input strokes at rest, elevated-surface borders. In dark mode, shadows are invisible on near-black backgrounds — elevation is communicated with a 1px Hairline Umber border on Embered Surface instead of the shadow tokens used in light mode.

**Dark botanical primaries**
- **Canopy Sprout (#6FAE8A)** — Canopy Green lightened for dark-mode primary buttons, links, active tab indicators, and the logo mark. 6.9:1 on Night Cream. Primary button labels are **Night Cream on Canopy Sprout fill** (6.9:1) — the brand feel stays anchored in green without breaking contrast.
- **Moonpaper (#F2EADB)** — headline text and high-emphasis labels. The dark-mode counterpart to Forest Ink; preserves the warm undertone rather than going bone-white. 15.0:1 on Night Cream.
- **Lantern Slate (#B8B0A5)** — body secondary text, placeholder text, metadata rows, inactive bottom-nav icons, disabled states. 8.4:1 on Night Cream.
- **Dusk Sage (#A6BFAE)** — decorative-only counterpart to Understory Sage. Empty-state line art, "empty slot" glyph, icons with adjacent text labels. Never text, never the sole information channel.

**Dark warm accents**
- **Terracotta Glow (#E08B66)** — delight moments, nav-badge dots. Verified ≥ 5:1 on Night Cream.
- **Honey Lantern (#E8BC5E)** — medium-confidence bar fill. Bar-fill only; paired with an adjacent Moonpaper percentage label.

**Dark system signals**
- **Urgent Blossom (#E8593A)** — toxicity warnings and destructive-confirmation actions. Verified ≥ 5:1 on Night Cream; Night Cream label on Urgent Blossom fill verified ≥ 4.5:1.
- **Overdue Copper (#C96A44)** — the shared "requires attention" signal, used for overdue reminders and form-validation errors. Verified ≥ 5:1 on Night Cream.
- **Trust Mist (#5BA5B0)** — informational callouts, AI-provenance chip, LGPD disclaimer strip. Verified ≥ 5:1 on Night Cream.

### Confidence ladder (Honest AI requirement, PRD §2)
Identification result cards carry a **visual confidence ladder** that combines color, a filled-bar glyph, a percentage label, and a spoken screen-reader announcement — four redundant signals:
- **High (≥70%):** Canopy Green bar (Canopy Sprout in dark), 3 filled segments, crisp percentage in Forest Ink (Moonpaper in dark). Screen readers announce "Confiança alta, <n>%."
- **Medium (40–69%):** Honey Amber bar (Honey Lantern in dark), 2 filled segments, percentage label, supporting copy "Pode ser...". Screen readers announce "Confiança média, <n>%."
- **Low (threshold–39%):** Calm Slate bar (Lantern Slate in dark), 1 filled segment, with supporting copy "Pode ser..." instead of a definitive name. Screen readers announce "Confiança baixa, <n>%."

### Accent discipline (critical)
Folhário deliberately carries a six-color semantic palette because the domain forces distinguishable **safety** (Urgent Poppy / Urgent Blossom), **attention** (Overdue Rust / Overdue Copper), **confidence** (Honey Amber / Honey Lantern), **delight** (Terracotta Clay / Terracotta Glow), **AI-provenance** (Trust Teal / Trust Mist), and **brand** (Canopy Green / Canopy Sprout) channels — a PRD §4.10 redundant-signal requirement, not a stylistic indulgence. **Canopy Green / Canopy Sprout is the only brand accent.** All other colors are system signals and must never appear in decorative, marketing, or onboarding contexts. A CTA is never Terracotta. A button is never Honey Amber. A background panel is never Trust Teal. When in doubt, ask: "does this color carry meaning, or is it decoration?" — if decoration, it is the brand green, a neutral surface, or (only for illustration) Understory Sage / Dusk Sage.

### Contrast ledger
Every approved foreground/background pairing and its measured WCAG 2.1 contrast ratio. Any pairing not listed here is unapproved until verified. AA floors: 4.5:1 for normal text, 3:1 for large text and UI graphics.

**Light variant (backgrounds: Paper Cream #FBF7EF unless noted)**

| Pair | Ratio | Use |
|---|---|---|
| Forest Ink on Paper Cream | 12.9:1 | headlines, high-emphasis body |
| Canopy Green on Paper Cream | 9.1:1 | primary buttons, links, active indicators, body emphasis |
| Calm Slate on Paper Cream | 5.9:1 | body secondary, metadata, placeholder |
| Overdue Rust on Paper Cream | 5.6:1 | attention text, form-error helper |
| Trust Teal on Paper Cream | 5.4:1 | informational text, AI-provenance chip |
| Urgent Poppy on Paper Cream | 4.7:1 | destructive text, toxicity label |
| Warm Ivory on Canopy Green | 9.1:1 | primary button label |
| Warm Ivory on Urgent Poppy | 5.0:1 | destructive / toxicity badge label |
| Warm Ivory on Forest Ink | 12.9:1 | pressed-state button label |
| Terracotta Clay on Paper Cream | 3.4:1 | **large glyph / badge accent only** — never body text |
| Understory Sage on Paper Cream | 2.5:1 | **decorative only** — never text, never a UI-state graphic |
| Honey Amber on Paper Cream | 2.2:1 | **bar fill only** — never text, never borders |

**Dark variant (backgrounds: Night Cream #1A1613 unless noted)**

| Pair | Ratio | Use |
|---|---|---|
| Moonpaper on Night Cream | 15.0:1 | headlines, high-emphasis body |
| Lantern Slate on Night Cream | 8.4:1 | body secondary, metadata, placeholder |
| Canopy Sprout on Night Cream | 6.9:1 | primary buttons, links, active indicators |
| Night Cream on Canopy Sprout | 6.9:1 | primary button label |
| Urgent Blossom on Night Cream | ≥ 5:1 | destructive / toxicity label |
| Overdue Copper on Night Cream | ≥ 5:1 | attention text, form-error helper |
| Trust Mist on Night Cream | ≥ 5:1 | informational text, AI-provenance chip |
| Terracotta Glow on Night Cream | ≥ 5:1 | delight accents, nav-badge dot |
| Night Cream on Urgent Blossom | ≥ 4.5:1 | destructive / toxicity badge label |
| Dusk Sage on Night Cream | ≥ 4.5:1 | **decorative only** — policy, not contrast-limited |
| Honey Lantern on Night Cream | ≥ 7:1 | **bar fill only** — never text, never borders |

Measured values are re-verified whenever a token changes; any new pair must be added to this ledger before it ships.

## 3. Typography Rules

Two families, chosen for warmth, pt-BR diacritic quality, and a clear editorial-vs-interface split:

- **Headlines & plant names — Source Serif 4 (variable):** A humanist reading serif by Frank Grießhammer at Adobe, designed for long-form legibility with warm, subtly-swelling terminals. Used for screen titles, plant common names on the profile screen, and the hero welcome on Home. Source Serif 4 gives Folhário its "well-loved gardening notebook" feel — the literary warmth that says *knowledgeable friend*. Weight 500–600 for titles.
- **Interface & body — Plus Jakarta Sans (variable):** Used everywhere else: buttons, form labels, care-card body copy, metadata, navigation. A humanist geometric sans with friendly, warm terminals that avoid the "default tech app" feel of Inter. Chosen for pt-BR diacritic rendering, screen legibility at 14–16px, and comfortable scaling up to 200% per WCAG AA font-scaling. Weight 400 for body, 500 for labels, 600 for button text.

**Deliberate font choices (load-bearing):** Source Serif 4 and Plus Jakarta Sans are both intentional overrides of the usual "editorial modern-serif + geometric sans" defaults. Source Serif 4 wins over Fraunces/Instrument Serif because its optical-size variable axis renders pt-BR diacritics (ã, õ, ç, á) cleanly at small body-title sizes and carries literary warmth without fashion-serif connotations. Plus Jakarta Sans wins over Geist/Satoshi because its humanist geometry handles Portuguese accent stacking better at 14–16px and its friendly terminals reinforce the "knowledgeable friend" voice. Do not substitute Inter, generic serifs, or system fonts without revisiting the brand brief.

**Never mix Source Serif 4 into buttons or form fields** — it belongs to the editorial voice, not the interface voice.

**Letter-spacing character:** Source Serif 4 at default tracking (its optical sizing handles the rest). Plus Jakarta Sans body at default; Plus Jakarta Sans buttons and all-caps section labels at +2% tracking for a calm, unhurried feel. No condensed or ultra-tight tracking anywhere — the system never feels rushed.

**Type scale (mobile):**
- Hero headline: Source Serif 4 32/38, weight 500
- Screen title: Source Serif 4 24/30, weight 500
- Section label: Plus Jakarta Sans 14/18, weight 600, uppercase, +4% tracking
- Body: Plus Jakarta Sans 16/24, weight 400
- Metadata / caption: Plus Jakarta Sans 14/20, weight 400, Calm Slate (Lantern Slate in dark)
- Button: Plus Jakarta Sans 16/20, weight 600

All type respects browser font-size up to 200% **and** native Dynamic Type / Android font-scale to the largest accessibility setting without clipping, truncation, or horizontal scroll. Line-height is generous (1.4–1.55) to support readers scaling up. Fixed-height containers must grow to fit scaled text; any text block that would clip is a bug, not a design decision.

## 4. Component Stylings

### Iconography
Folhário's icon system is **Lucide**, 1.5px stroke, rounded line caps, never filled unless a filled variant is specifically approved (toxicity paw-and-child, bottom-nav active state). Default sizes: **24px** in body content and care-card rows, **20px** inside buttons, **18px** inside badges and chips, **28px** for bottom-nav items. The empty-state line-art illustrations are custom but drawn with the same 1.5px stroke and rounded caps so illustration and iconography read as one family. Emoji are never used as icons. Mixing icon sets (Heroicons, Phosphor, Material) within the same screen is forbidden.

### Buttons
- **Primary (Canopy Green fill, Warm Ivory label):** Softly rounded corners (8px radius — "pebble-smooth"), 48px tall on mobile (well above the 44px touch-target minimum). No gradient, no drop shadow at rest — flat and confident. On press, a gentle inward darken to Forest Ink. Icon-left patterns use 20px Lucide icons with 8px gap to label. Dark mode: Canopy Sprout fill, Night Cream label.
- **Secondary (transparent fill, Canopy Green label, Canopy Green 1.5px stroke):** Same geometry as primary, used for non-committal actions like "Editar" or "Mais tarde." Dark mode: Canopy Sprout label and stroke.
- **Tertiary / text link (Canopy Green label, no border):** Inline actions inside body copy, e.g., "adicionar manualmente." Dark mode: Canopy Sprout label.
- **Destructive (Urgent Poppy fill, Warm Ivory label):** **Used only in confirmation dialogs** — never as a primary screen action. The destructive action always appears *secondary* to the safe "Cancelar" option in layout order. Dark mode: Urgent Blossom fill, Night Cream label.
- **Capture button (Identify screen):** A circular 72px Canopy Green button (Canopy Sprout in dark) with a Warm Ivory / Night Cream camera glyph, floating above the capture-guide illustration. The one exception to the rounded-rectangle geometry used everywhere else — its pure-circular form signals "the one thing to do" on an empty Home.

### Cards & containers
- **Plant card (catalog):** Warm Ivory Surface background (Embered Surface in dark), 16px radius ("generously rounded, hand-held"), a whisper-soft diffused shadow in light mode (`0 2px 12px rgba(20, 52, 36, 0.06)`) **or** a 1px Hairline Umber border in dark mode (shadows vanish on near-black), and a 4:5 portrait photo area at the top. Card padding 16px.
- **Care-card section (plant profile):** Full-width, Paper Cream background (Night Cream in dark), Hairline Beige / Hairline Umber dividers between dimensions (light, water, humidity, toxicity). Each dimension is an icon-left row — icons at 24px Understory Sage (Dusk Sage in dark), label in Forest Ink / Moonpaper Plus Jakarta Sans 16 weight 500, supporting line in Calm Slate / Lantern Slate Plus Jakarta Sans 14.
- **Modal sheet (bottom sheet):** 24px top-corner radius, Warm Ivory Surface / Embered Surface, a dimmed Forest Ink / Night Cream overlay at 50% opacity behind it (raised from 40% to meet modal-scrim legibility on warm surfaces). Light mode: `0 -8px 32px rgba(20, 52, 36, 0.12)` shadow. Dark mode: 1px Hairline Umber top border, no shadow. Drag handle 36×4px Hairline Beige / Hairline Umber at top center.

**Modal sheet behavior:** focus is trapped inside the sheet while it is open; the first focusable element receives focus on open; focus returns to the trigger element on close. Android hardware back and iOS swipe-down both dismiss, with an unsaved-changes confirmation if any field inside has been edited. The sheet must expose a visible close affordance (drag handle + labelled "Fechar" button) — "tap-the-scrim-to-dismiss" is allowed only in addition to the visible affordance, never as the only way out.

### Inputs / forms
- **Text input:** Warm Ivory Surface / Embered Surface background, 8px radius, 1.5px Hairline Beige / Hairline Umber stroke at rest, 1.5px Canopy Green / Canopy Sprout stroke on focus. The focus ring is the global 3px ring defined in §5 — inputs do not carry their own focus treatment. Label floats above the field in Plus Jakarta Sans 14 weight 600 Forest Ink / Moonpaper. Error state: 1.5px Overdue Rust / Overdue Copper stroke **plus** a filled alert icon **plus** a helper line in Overdue Rust / Overdue Copper — three redundant signals.
- **Select / dropdown:** Same geometry as text input, with a chevron in Calm Slate / Lantern Slate.
- **Toggle (notification preferences, consents):** Track 52×32, knob 28×28, Canopy Green / Canopy Sprout when on, Hairline Beige / Hairline Umber when off. Includes an adjacent ON/OFF text label for screen-reader and color-blind clarity — per PRD §4.10, color is never the only signal.

**Input behavior (non-negotiable):**
1. **Validate on blur, not on keystroke.** The user is never corrected mid-word.
2. **Semantic input types + autocomplete:** every field declares the correct `type` (`email`, `tel`, `number`, `url`) and a correct `autocomplete` token (`email`, `tel-national`, `postal-code`, `name`, `given-name`, `street-address`, `new-password`) so the OS can offer autofill and render the right keyboard. Forgetting `autocomplete` is a bug.
3. **Error copy format: cause + recovery.** "CEP inválido — use o formato 00000-000," not "Campo inválido." Never rely on color or icon alone to convey the problem.
4. **On submit, auto-focus the first invalid field** and announce the error via `role="alert"` / `aria-live="polite"` so screen-reader users are told what failed and where.
5. **Multi-error summary:** when more than one field is invalid, show a summary block above the form with anchor links to each offending field, in addition to inline per-field errors.
6. **Draft preservation:** forms longer than three fields auto-save draft state locally so accidental dismissal never loses input.

### Toxicity badge (non-negotiable composition)
Per PRD §3.3.2 and §4.10, the toxicity warning must be unmistakable. The standard composition:
1. **Filled rounded-rectangle badge** (8px radius), Urgent Poppy / Urgent Blossom background, Warm Ivory / Night Cream text.
2. **Filled paw + child silhouette icon** on the left at 18px.
3. **Literal text "Tóxico para pets e crianças"** in Plus Jakarta Sans 14 weight 600.
4. **3px striped accent border** on the left edge of the parent care-card block — diagonal Urgent Poppy / Urgent Blossom stripes on Warm Ivory Surface / Embered Surface, so the warning is visible even if the badge itself is scrolled off-screen.
5. **Mandatory disclaimer line directly below:** "Informação gerada por IA — confirme com um veterinário" in Plus Jakarta Sans 14 Calm Slate / Lantern Slate.
6. **Screen-reader label:** the badge exposes `role="alert"` and reads "Alerta de toxicidade. Tóxico para pets e crianças. Informação gerada por IA — confirme com um veterinário." on focus — the full phrase, never just "aviso."
7. **Haptic pattern:** on first reveal of a toxicity badge within a session, emit the native warning-notification haptic (iOS `UINotificationFeedbackGenerator.warning`, Android `HapticFeedbackConstants.REJECT`). Subsequent reveals within the same session are silent to avoid fatigue.

This composition is the only approved treatment; no screen may invent alternatives.

### Confidence result card (Identify results)
A Warm Ivory Surface / Embered Surface card, 16px radius, whisper-soft shadow in light / 1px Hairline Umber border in dark. Top-left: reference thumbnail (64×64, 8px radius). Top-right: **confidence ladder** — the three-segment bar described in §2 — above the percentage label. Below: common name (Source Serif 4 20 weight 500) and scientific name (Plus Jakarta Sans 14 italic Calm Slate / Lantern Slate). Tap target covers the whole card. The card's `accessibilityLabel` combines common name, scientific name, and confidence announcement in one utterance.

### Notification / system chips
- **"Gerado por IA — em revisão"** (draft care guide): Trust Teal / Trust Mist 1px stroke, Trust Teal / Trust Mist label, Paper Cream / Night Cream background, 999px pill radius, 8px icon-gap. Lives at the top of the care-guide screen.
- **"Cap atingido"** (identification cap reached): Overdue Rust / Overdue Copper 1px stroke, Overdue Rust / Overdue Copper label, Paper Cream / Night Cream background, with the reset time on the second line.

### Bottom navigation
Folhário's only navigation pattern. One shape across mobile, installed PWA, and native.
- **Item count:** maximum 5, current v1.1 uses 4 (Home, Catálogo, Identificar, Perfil). Never exceed 5 — overflow belongs in Perfil, not in the nav.
- **Item composition:** Lucide icon **plus** text label, always. Icon-only navigation is forbidden. Icon 28px, label Plus Jakarta Sans 12/14 weight 500, +2% tracking.
- **Active state:** Canopy Green / Canopy Sprout icon (filled Lucide variant) + Forest Ink / Moonpaper label bumped to weight 600 + 3px Canopy Green / Canopy Sprout top-indicator bar flush with the bar's top edge. Inactive: Calm Slate / Lantern Slate icon (stroke variant) + Calm Slate / Lantern Slate label.
- **Height:** 56px of content height + `env(safe-area-inset-bottom)` padding so iOS home-indicator and Android gesture bar are respected. Scroll views reserve an equivalent bottom content inset so lists never hide behind the nav.
- **Badge:** 8px Terracotta Clay / Terracotta Glow dot in the top-right of the icon, no numerals. The badge clears the moment the destination is visited. Badges are decorative nudges, not counters.
- **State preservation:** switching tabs preserves scroll position and filter state per tab. Returning to a tab restores its last screen; it never resets to the tab root unless the user pulls to refresh.
- **Back-stack integrity:** Android hardware back and iOS swipe-back respect the navigation stack within the active tab. The nav never silently jumps the user to Home or resets an unrelated tab.
- **Destructive separation:** sign-out and "Excluir conta" live at the bottom of the Perfil tab, visually and spatially separated from normal settings — never reachable from the nav bar itself.

### Native accessibility
Folhário's PWA is the default target but the brand promises a native evolution, and the design system must carry native-quality accessibility from day one.

**Dynamic Type / Android font-scale.** Every text element uses a scaled type ramp that honors the OS accessibility text size up to the largest setting. Fixed pixel heights on text containers are forbidden; containers grow to fit scaled text. Section labels at 14px and metadata at 14px are the floor — nothing smaller. Test screens at both the smallest and the largest accessibility text sizes before shipping.

**VoiceOver / TalkBack labels.** Icon-only buttons and state-bearing graphics must expose a meaningful spoken label:
- Capture button: "Identificar planta, botão."
- Confidence ladder: "Confiança <alta|média|baixa>, <n>%" (never "três barras verdes").
- Toxicity badge: the full phrase specified above, with `role="alert"`.
- Bottom-nav items: "<Label>, aba, <selecionado|não selecionado>."
- Plant card in the catalog: "<Nome comum>, <nome científico>, adicionada em <data>."
Reading order must match visual order. Decorative illustrations (empty-state line art, veranda scenes) are marked `accessibility hidden`.

**Haptics.** Native-bound haptic patterns are defined per interaction:
- Capture-button tap → light impact (iOS `UIImpactFeedbackGenerator.light`).
- Toxicity-badge first reveal per session → warning notification.
- First plant added, care-streak milestone → success notification, once.
- Destructive-confirmation confirm tap → medium impact.
- Transient errors (network failure, validation) → **no haptic** — haptic noise on non-critical errors trains users to ignore the system.

**Escape routes.** Modal sheets, multi-step flows, and the capture confirmation all expose a visible Cancel affordance. iOS swipe-back and Android hardware back must never leave the user in a state with no way out.

**Reduced motion.** Honored globally — see §5 Motion.

### Loading states
Skeletal shimmer blocks that match the exact geometry of the final content — **never circular spinners**. A loading catalog card shows a 4:5 Hairline Beige / Hairline Umber photo block, a 60%-width title line, and a 40%-width metadata line. Shimmer animates left-to-right over 1.4s in Warm Ivory Surface / Embered Surface at 40% opacity.

**Timing threshold (non-negotiable):** skeletons render only after a **300ms delay**. Operations that resolve faster skip shimmer entirely and fade content in over 120ms — flashing a shimmer on cached responses looks unserious. Shimmer disappears the moment content resolves; it never becomes decorative.

**Reduced motion:** under `prefers-reduced-motion: reduce`, the shimmer sweep is disabled and the skeleton becomes a static Hairline Beige / Hairline Umber block with no animation. Content still fades in, but over 80ms instead of 120ms.

### Empty states
Every empty state is a composed invitation, not a "Nada por aqui" apology. Each one carries: (1) a soft illustrative element (terracotta pot, sprouting leaf, watering can — Understory Sage / Dusk Sage line art drawn in the same 1.5px stroke family as the Lucide icon set, never stock photos), (2) a welcoming headline in Source Serif 4 ("Sua estante ainda está esperando a primeira planta."), (3) a supporting hint in Calm Slate / Lantern Slate, and (4) exactly one Canopy Green / Canopy Sprout primary action. Empty Home, empty Catálogo, empty Reminders, and empty Identification History each get their own tailored composition — never a generic shell reused across screens.

### Error states
Inline and calm, never a full-screen red wall. Network failure on identification: a Warm Ivory Surface / Embered Surface card with an Understory Sage / Dusk Sage cloud-off icon, a headline in Forest Ink / Moonpaper ("Não consegui conectar agora."), a Calm Slate / Lantern Slate supporting line with **cause + recovery** phrasing, and a Canopy Green / Canopy Sprout "Tentar de novo" primary button. Urgent Poppy / Urgent Blossom is **never** used for transient errors — it belongs to toxicity warnings exclusively. Field-level validation errors use the Overdue Rust / Overdue Copper treatment defined under Inputs above. Every error exposes a clear retry or edit path — "algo deu errado" with no next step is forbidden.

## 5. Layout Principles

### Whitespace strategy
Folhário is **deliberately spacious**. Vertical rhythm uses a strict **8pt grid** — every spacing value is a multiple of 8 (4 is allowed only for tight icon-to-label gaps). Section gaps on Home and Plant Profile are 32px; card-to-card gaps in the catalog grid are 16px; padding inside cards is 16px.

Empty states are the most spacious surfaces in the app — they are opportunities to welcome, not negative space to apologize for. The Home empty state centers the circular capture button with at least 96px of clearance on all sides.

### Grid & alignment
- **Mobile viewport (default target):** single-column, 20px outer gutters. The catalog is a 2-column grid at ≤375px and a 3-column grid from 600px upward.
- **Vertical alignment:** baseline-oriented. Headlines and body copy align to the same left edge; icon-left rows align icon-center to label-baseline.
- **Photography:** full-bleed edge-to-edge on Plant Profile hero; 4:5 aspect ratio on catalog cards; 16:9 on Home's Today's tasks preview strip.

### Focus & keyboard
Folhário is fully operable by keyboard and switch control. Every interactive element — buttons, cards, chips, inputs, toggles, nav items, the circular capture button — carries the **global focus ring**: a **3px Canopy Green (Canopy Sprout in dark) ring at 40% opacity**, offset 2px outside the element's bounding box, with an 8px corner radius that matches the element's shape. The 40% opacity is the minimum that clears the 3:1 UI-graphic contrast floor on both Paper Cream and Night Cream — do not lower it to 20%.

Tab order matches visual reading order top-to-bottom, left-to-right. Modal sheets trap focus inside the sheet until dismissed (see §4 Modal sheet). After any route change, focus moves programmatically to the main content region so screen-reader users hear the new screen's title rather than the old focus context.

### Hero composition
Hero sections (onboarding, first-capture invitation, marketing landings) follow a strict anti-generic recipe:

- **Asymmetric, never centered.** The headline hangs left-aligned with ragged-right breaks; the primary visual (plant photo or illustrated veranda scene) sits offset right or bleeds beyond the right gutter.
- **Source Serif 4 headline breaks over 2–3 lines** at 32–40px, weight 500. No all-caps, no letter-spacing tricks, no gradient text.
- **Exactly one primary CTA** in Canopy Green / Canopy Sprout. No "Saiba mais" secondary link, no "Ver demo" tertiary. The one action is the whole point.
- **Inline plant thumbnail as signature move:** a small circular 40px plant photo may sit inline between headline words as visual punctuation ("Cuide das suas [photo] plantas sem medo"). This is the only approved decorative flourish — use sparingly, never twice in the same hero, and never overlapping the type. The inline thumbnail occupies its own inline-flow box; it is not a violation of the "no overlapping text and imagery" rule in §6 because it is not a background image with text laid over it.
- **No scroll arrows, no "role para baixo", no bouncing chevrons.** Composition pulls the user down, not prompts.
- **Photo and type never overlap** — they occupy distinct spatial zones, and the photo never hosts white text on top of it.

### Elevation model
Mostly flat. Only two elevation levels exist:
- **Level 1 (cards, top nav on scroll):**
  - Light: whisper-soft diffused shadow, `0 2px 12px rgba(20, 52, 36, 0.06)`.
  - Dark: 1px Hairline Umber border on Embered Surface.
- **Level 2 (modals, bottom sheets, toast):**
  - Light: `0 8px 32px rgba(20, 52, 36, 0.12)`.
  - Dark: 1px Hairline Umber border + a 50% Night Cream scrim behind the surface.

No heavy drop shadows, no neumorphic effects, no glassmorphism. In light mode, depth is communicated through **surface color shift** (Paper Cream → Warm Ivory Surface) more than through shadow. In dark mode, shadows are invisible on near-black — depth is communicated by surface shift (Night Cream → Embered Surface) plus the 1px border.

### Motion
Unhurried and mechanical-free. Folhário's motion language is **spring-physics, not easing-curve** — weighty and organic, never bouncy-cartoonish.

- **Primary interactions** (button press, sheet reveal, tab switch): spring `stiffness: 120, damping: 18, mass: 1`. Enter lands in ~240ms, exit in ~180ms, but via spring — never a linear ease.
- **Capture button press:** spring scale `1.00 → 1.03 → 1.00`. The one tactile bounce in the entire system, rewarding the hero moment.
- **Empty-state capture button breathing loop:** slow `scale 1.00 → 1.02` pulse over 3.2s, infinite, ease-in-out. This is the **only** perpetual micro-interaction in the app — Folhário is unhurried, not busy. No shimmering cards, no pulsing dots, no floating elements elsewhere.
- **Staggered orchestration:** catalog grid and care-card dimension rows reveal with a **60ms cascade delay** per item — opacity `0 → 1` and translateY `8px → 0`. Never mount lists instantly.
- **Celebration moments** (first plant added, care streak milestone): a brief Terracotta Clay / Terracotta Glow accent flourish — the only time that color dances. Scoped to a single element, ≤600ms, never full-screen confetti.
- **Performance discipline:** animate exclusively via `transform` and `opacity`. Never `top`, `left`, `width`, `height`. No backdrop-filter animations. Grain or noise textures must be static pseudo-elements, never animated.
- **Reduced motion (`prefers-reduced-motion: reduce`):** the perpetual capture-button breathing loop stops at its rest size, shimmer animations become static blocks (§4 Loading states), the 60ms cascade stagger collapses to an instant opacity fade over 120ms, spring transitions become a 120ms linear crossfade, and the Terracotta celebration flourish becomes a 200ms color tint with no scale or translation. Motion is never the sole indicator of a state change; every animated transition is mirrored by an instantaneous variant that preserves the same information.

### Safety of scale & responsive discipline
Every text block respects 200% browser zoom **and** native Dynamic Type / Android font-scale at the largest accessibility setting, without clipping or horizontal scroll. Touch targets are 44×44 minimum; primary actions are 48×48; touch targets maintain ≥8px spacing between each other to prevent mis-taps.

**Safe areas.** Full-height surfaces use `min-h-[100dvh]` — **never** `h-screen`, because iOS Safari's dynamic viewport jump breaks the capture screen otherwise. Top padding honors `env(safe-area-inset-top)` and bottom padding honors `env(safe-area-inset-bottom)`. The circular capture button sits 24px above `env(safe-area-inset-bottom)`. The bottom navigation reserves `env(safe-area-inset-bottom)` inside its own padding (see §4 Bottom navigation). Scroll containers add matching top and bottom content insets so content never hides behind fixed chrome.

**Responsive rules.** Mobile PWA is the default target, but the product must survive every viewport:
- Horizontal scroll on mobile is a **critical failure**, never a feature. The only horizontal scroll allowed is the Home "Today's tasks" strip, which is gesture-scoped with a right-edge fade mask, a `scroll-snap-type: x mandatory` behavior, and `overscroll-behavior-x: contain` so it never intercepts vertical scroll.
- Below 600px the catalog is 2 columns; 600–899px is 3 columns; ≥900px (tablet / installed PWA) is 4 columns with the outer gutter expanding to 32px.
- The 375 / 600 / 900 breakpoint ladder is chosen so the 4:5 catalog card lands a whole number of columns at every tier (2 / 3 / 4). Do not substitute the generic 768 / 1024 ladder — it produces awkward half-cards.
- Headlines scale with `clamp()`; body text stays at a minimum of 16px regardless of viewport.
- Desktop PWA (macOS/Windows install) keeps the bottom-nav pattern rather than growing a sidebar — Folhário is one shape across devices.

**Localization plumbing.** The root document declares `lang="pt-BR"` so VoiceOver/TalkBack use Portuguese pronunciation and screen readers announce diacritics correctly. Body copy may use `hyphens: auto` to wrap long scientific names cleanly; headlines do not hyphenate. Numbers, dates, and currency are formatted via `Intl.*` with the `pt-BR` locale — no hard-coded separators.

---

## 6. Anti-Patterns (Banned)

These patterns are **forbidden** in any Folhário screen. They are not stylistic preferences — they are brand-coherence guardrails. Any design that contains one of these is rejected regardless of origin or urgency.

**Visual slop**
- No emojis anywhere in UI copy, labels, buttons, or empty states. Plant iconography uses Lucide at 1.5px stroke.
- No pure black (`#000000`). Use Forest Ink `#143424` in light mode and Night Cream `#1A1613` in dark mode for the deepest surfaces.
- No neon, outer glow, or drop-shadow fakery beyond the two elevation levels defined in §5.
- No glassmorphism, frosted-blur panels, or neumorphism.
- No gradient headline text. No gradient buttons. Flat fills only.
- No overlapping text and imagery — every element owns its spatial zone. (The inline plant-thumbnail exception in §5 Hero composition is the only approved inline-flow use of imagery within type.)
- No mixed icon sets within a screen. Lucide is the only family.

**Typography slop**
- **No Inter.** Plus Jakarta Sans is the interface font, full stop.
- No generic serifs (`Times New Roman`, `Georgia`, `Garamond`, `Palatino`). Source Serif 4 is the only approved editorial face.
- No all-caps headlines. Uppercase is reserved for 14px section labels at +4% tracking.
- No `LABEL // 2026` or `SYSTEM // V1.1` formatting — it is a lazy AI convention, not design typography.
- No condensed or ultra-tight tracking. Folhário never reads as "rushed."
- No fixed-height text containers that clip when the user scales text up.

**Color slop**
- Terracotta Clay, Honey Amber, Urgent Poppy, Overdue Rust, and Trust Teal (and their dark-mode counterparts) are **semantic signals only**. Never use them for decorative CTAs, backgrounds, or marketing accents.
- No secondary accent "just to add warmth." If a screen feels cold, add Paper Cream / Night Cream surface area and a real plant photo, not another color.
- Urgent Poppy / Urgent Blossom is **never** used for form errors, network failures, or generic "something went wrong" states. It belongs to toxicity warnings and destructive-confirmation actions exclusively.
- No dark-mode palette derived by simply inverting light-mode tokens. Dark mode is the veranda-at-dusk variant defined in §2, not a CSS filter.
- No contrast pair that isn't listed in §2's contrast ledger.

**Layout slop**
- No centered hero sections with headline + subtitle + button stacked vertically on axis. Heroes are asymmetric (see §5).
- No 3-equal-card "Recursos" / "Features" row. Use a 2-column zig-zag or a single hero feature block instead.
- No bouncing chevrons, no "role para baixo", no scroll-hint arrows, no "Swipe down."
- No floating AI-chatbot bubble in the corner.
- No sidebar navigation on mobile or desktop. The bottom nav is the only nav.
- No fixed chrome without safe-area padding. No content hidden behind the bottom nav.

**Content slop**
- **No fabricated data.** Never invent "99.8% de precisão", "50.000 plantas catalogadas", "4.9★ na App Store", or any metric not explicitly provided. Use `[metric]` placeholders or omit entirely.
- No fake system-metrics dashboard blocks ("SYSTEM PERFORMANCE", "KEY STATISTICS", "BY THE NUMBERS").
- No AI copywriting clichés: "Eleve seu jardim", "Desbloqueie o potencial", "Revolucione seu cuidado", "Next-gen", "Seamless", "Unleash." Folhário speaks like a friend, not a pitch deck.
- No generic placeholder names ("Maria Silva", "João Santos", "Acme Plantas"). If a name is needed, use first-name-only pt-BR ("Clara", "Rafael") and make it clearly illustrative.
- No broken Unsplash hotlinks. Use local assets, `picsum.photos`, or SVG illustrations.

**Interaction slop**
- No custom mouse cursors.
- No pulsing, shimmering, or floating animations beyond the single capture-button breathing loop defined in §5.
- No "tap anywhere to dismiss" without a visible dismiss affordance.
- No confetti explosions. The celebration flourish is a single Terracotta Clay / Terracotta Glow accent, nothing more.
- **No interaction depends on hover.** Desktop PWA users see a whisper-light surface shift on hover as decorative amplification, but every behavior is reachable by tap and by keyboard. Hover is never load-bearing.
- No perpetual animation without a reduced-motion fallback. No motion used as the sole indicator of a state change.
- No haptic feedback on transient errors or non-critical events — haptic noise trains users to ignore the system.

---

## 7. Notes for screen design
When designing a new Folhário screen, always reference:
1. The **atmosphere** ("warm Brazilian veranda, airy, humanist") — not just "plant app."
2. The **exact hex values** in §2, especially Canopy Green (#1F4D35) / Canopy Sprout (#6FAE8A), Paper Cream (#FBF7EF) / Night Cream (#1A1613), and Urgent Poppy (#C73E1D) / Urgent Blossom (#E8593A). Both variants, always.
3. The **typography pairing** — Source Serif 4 for editorial, Plus Jakarta Sans for interface, never the reverse.
4. The **contrast ledger** in §2 — any new foreground/background pair is unapproved until measured and added to the ledger.
5. The **toxicity badge composition rule** verbatim whenever a care guide or plant profile is in scope.
6. The **confidence ladder** whenever identification results are in scope.
7. **WCAG 2.1 AA:** color is never the only signal; touch targets ≥44px with ≥8px spacing; 200% font scaling and native Dynamic Type; every focusable element carries the global focus ring (§5); every icon-only control carries an `accessibilityLabel`; every motion has a reduced-motion fallback.
8. **Dark mode parity:** every screen is designed and reviewed in both light and dark before it ships. A screen that exists only in light is incomplete.
9. The **Anti-Patterns list in §6** — every screen must be cross-checked against it before being accepted. A single hit is a rejection.
