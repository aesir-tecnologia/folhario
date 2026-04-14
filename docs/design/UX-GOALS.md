# UX Goals — Folhário

## Audience
Beginners/hobbyists. Home gardening. Buy plants on impulse. Google "why fern dying". No botany vocab. Forget to water.

## Tone
Knowledgeable friend. Not textbook. pt-BR only.

## Non-Negotiables

1. **Simple language always.** No jargon. No Latin unless paired with common name.
2. **Value in <2 min.** Signup → first photo → identified → in catalog = the aha. No onboarding tour, no tutorial gates.
3. **Safety first.** Toxicity for pets/kids = visually prominent. Icon + colored badge + text. Never buried. Always paired with disclaimer: AI-sourced, confirm with vet.
4. **Honest AI.** Show confidence %. Never present guess as certainty. Draft care guides marked "Gerado por IA — em revisão".
5. **i18n day one.** Every string through i18n layer. No hardcoded text. Ships pt-BR only but infra multi-locale ready.
6. **Never hold data hostage.** Expired/canceled/past_due = read-only catalog mode. Plants, photos, journal, care guides still viewable. Only cost-driving (identify) + engagement (reminders) gated.
7. **Request permissions contextually.** Push permission prompted ONLY when user creates first reminder. Never at signup, first visit, or first identify.
8. **Trust cost honesty.** Cap-hit and provider-unavailable states always offer manual entry fallback. No dead ends.
9. **Mobile-first PWA.** Desktop = tablet-width centered with bg fill. No wide-screen desktop design.
10. **Accessibility = WCAG 2.1 AA baseline.** Not aspirational. Ship blocker.

## Core Loop
Identify → Catalog → Care → Remind. Reminders are the retention engine. Everything else serves this loop.

## Anti-Patterns
- No freemium gating. Single tier.
- No forced onboarding flow.
- No dark patterns on cancel/delete.
- No auto-escalation on overdue tasks (no shaming).
- No mocking confidence ("95% sure!" when it's 30%).
- No hiding AI provenance.
