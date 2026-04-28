---
phase: 04-iam-auth-verification-consent
plan: 05
subsystem: notifications
tags:
  [
    notif-01,
    notif-02,
    d-02,
    d-11,
    d-16,
    d-18,
    d-19,
    d-20,
    d-30,
    resend,
    react-email,
    inngest,
    paper-cream,
    pt-br,
  ]
dependency-graph:
  requires:
    - 04-03 (RESEND_API_KEY/RESEND_FROM_ADDRESS in serverEnv; @react-email/components + resend deps installed)
    - 04-04 (Inngest SDK singleton + per-context registry pattern; notifications/inngest/functions.ts exists with notifications-send-push stub)
  provides:
    - "src/contexts/notifications/domain/events.ts: extended with TemplateName + 3 props types + NotificationsEmailRequestedPayload discriminated union"
    - "src/contexts/notifications/application/send-email.ts: renderEmail() template registry resolving 'verification' | 'password-reset' | 'welcome-back' to React components (exhaustive switch)"
    - "src/contexts/notifications/infrastructure/email-templates/verification.tsx: pt-BR template with Paper Cream brand contract (Confirme seu e-mail para começar)"
    - "src/contexts/notifications/infrastructure/email-templates/password-reset.tsx: pt-BR template (Redefinir sua senha)"
    - "src/contexts/notifications/infrastructure/email-templates/welcome-back.tsx: pt-BR template for resolved Q1 anti-enumeration response (Você já tem uma conta no Folhário)"
    - "src/contexts/notifications/infrastructure/resend-adapter.ts: Resend SDK wrapper with D-20 dev console-log fallback"
    - "src/contexts/notifications/inngest/functions.ts: notifications-send-email (REAL) added beside notifications-send-push (STUB from Plan 04)"
  affects:
    - "Plan 06 (signup): emits inngest.send({name: 'notifications/email.requested', data: {template: 'verification', ...}}) for verification flow + same event with template: 'welcome-back' for resolved Q1 path"
    - "Plan 08 (password reset request): emits notifications/email.requested with template: 'password-reset' from inside the iam-password-reset-requested Inngest function (replaces Plan 04 stub)"
    - "Phase 12: swaps RESEND_FROM_ADDRESS from onboarding@resend.dev sandbox to a verified production domain (e.g. noreply@folhario.com.br) with SPF/DKIM/DMARC"
tech-stack:
  added: []
  patterns:
    - "RESEARCH.md Pattern 9 (React Email pt-BR template) — UI-SPEC §7 brand contract enforced via inline hex (no CSS variables, many email clients strip them)"
    - "RESEARCH.md Pattern 10 (Resend SDK + D-20 dev fallback) — single resendAdapter.send() entry; null SDK ⇒ stdout log + id 'dev-mode'"
    - "RESEARCH.md Pattern 3 (notifications-send-email Inngest function) — step.run('render-email') + step.run('send-resend') for retry memoization + retries: 3 for STRIDE T-04-05-07 mitigation"
    - "Template registry pattern — domain events.ts owns the TemplateName union + discriminated payload; application/send-email.ts owns the switch resolver; adding a new template requires (a) extend events.ts union + add props type, (b) create new .tsx, (c) extend renderEmail switch — no other touches"
    - "Inngest 4.x 2-arg createFunction(opts, handler) with triggers inside opts (continued from Plan 04's deviation; matches notifications-send-push stub)"
key-files:
  created:
    - "src/contexts/notifications/application/send-email.ts (32 lines, renderEmail registry)"
    - "src/contexts/notifications/infrastructure/email-templates/verification.tsx (132 lines)"
    - "src/contexts/notifications/infrastructure/email-templates/password-reset.tsx (135 lines)"
    - "src/contexts/notifications/infrastructure/email-templates/welcome-back.tsx (137 lines)"
    - "src/contexts/notifications/infrastructure/resend-adapter.ts (40 lines)"
    - "tests/unit/email-templates.test.ts (149 lines, 22 tests)"
    - "tests/integration/notifications-send-email.integration.test.ts (97 lines, 5 tests)"
  modified:
    - "src/contexts/notifications/domain/events.ts (added TemplateName + 3 props types + NotificationsEmailRequestedPayload union; existing NotificationsEvents/NotificationSentPayload/NotificationFailedPayload preserved)"
    - "src/contexts/notifications/inngest/functions.ts (1 → 2 functions; added notifications-send-email beside existing send-push stub)"
    - "tests/integration/inngest-serve.integration.test.ts (Rule 3 deviation — updated registry length 8→9 + alphabetical ID list to include notifications-send-email)"
decisions:
  - "Used Inngest 4.x 2-arg createFunction(opts, handler) with triggers inside opts — matches the notifications-send-push stub style locked in Plan 04 (which deviated from the plan's deprecated 3-arg samples). Preserves a single, consistent pattern across the entire registry."
  - "step.run('render-email') return is typed as JsonifyObject<{...}> by the Inngest 4.x type system (because step output is JSON-serialized for retry memoization). The React element survives in-process between step boundaries within a single execution; we re-cast the return as { react: ReactElement } after step.run so the resendAdapter signature is preserved. Documented inline in functions.ts."
  - "Skeleton template files (returning <Html lang=\"pt-BR\" />) shipped as part of Task 1's commit so renderEmail typechecks before Task 2's TDD RED writes failing assertions. Alternative was forward-declaring stubs only in the test file, but that would leave the registry uncompilable mid-task — non-atomic commits violate the per-task atomicity rule."
  - "Test render() imported from @react-email/components (which re-exports * from @react-email/render). The plan's code sample imports from @react-email/render directly, but that package isn't a direct dependency — only a transitive dep of @react-email/components. Importing from the components package keeps the dep tree honest."
metrics:
  duration_minutes: 8
  completed: 2026-04-28T04:43:28Z
  tasks_completed: 3
  files_changed: 9
  commits: 5
---

# Phase 4 Plan 05: Resend Onboarding (D-02) Summary

**One-liner:** Shipped Phase 4's transactional-email backbone per D-02 (Folhário-owned auth email pipeline; Supabase SMTP/templates explicitly NOT used). Three React Email pt-BR templates with the locked Paper Cream brand contract (verification, password-reset, welcome-back), the Resend SDK adapter with the D-20 dev console-log fallback, and the real `notifications-send-email` Inngest function consuming `notifications/email.requested` events. The Inngest registry grew from 8 (Plan 04 baseline) to exactly 9 = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11. The +1 in Plan 05 is `notifications-send-email`; in Plan 04 it was the `iam-password-reset-requested` stub (Plan 08 will replace that stub with real impl, keeping the registry at 9).

## What landed

### Task 1: Domain events + template registry + send-email use-case

| File | Purpose |
| --- | --- |
| `src/contexts/notifications/domain/events.ts` (extended) | Added `TemplateName = "verification" \| "password-reset" \| "welcome-back"`, the three props types, and the `NotificationsEmailRequestedPayload` discriminated union. Existing `NotificationsEvents`, `NotificationSentPayload`, `NotificationFailedPayload` preserved unchanged for downstream consumers. |
| `src/contexts/notifications/application/send-email.ts` (new) | `renderEmail(template, props)` switch with exhaustive `default: const exhaustive: never = template`. Imports the three template components and returns `{ react: ReactElement }`. |
| `src/contexts/notifications/infrastructure/email-templates/{verification,password-reset,welcome-back}.tsx` (skeletons) | Minimal `<Html lang="pt-BR" />` skeletons so `renderEmail` typechecks. Task 2 RED tests assert content; Task 2 GREEN fills in the brand contract. |

Acceptance criteria all PASS:
- 5 exports in events.ts (TemplateName + 3 props types + payload union).
- TemplateName has exactly the 3 string literals.
- send-email.ts imports all 3 template components.
- 3 case branches + 1 exhaustive `never` default.
- `pnpm typecheck` exits 0.

### Task 2: Three React Email templates with Paper Cream brand (TDD)

**RED commit `3b045a8`** — `tests/unit/email-templates.test.ts` with 22 tests across the three templates:
- `<html lang="pt-BR">` rendered.
- Locked headlines: "Confirme seu e-mail para começar", "Redefinir sua senha", "Você já tem uma conta no Folhário".
- User email + CTA URL rendered in body.
- `color-scheme: light dark` + `supported-color-schemes: light dark` meta tags for dark-mode email clients.
- Plain-text URL fallback below CTA (UI-SPEC §7 accessibility): "Se o botão não funcionar, copie e cole este link no navegador: …".
- Paper Cream `#FBF7EF` + Canopy Green `#1F4D35` hex values inline.
- Welcome-back additionally asserts "você já tem uma conta" copy.

19/22 tests failed against the Task 1 skeletons (3 trivially passed because `<Html lang="pt-BR">` was already there).

**GREEN commit `979bea0`** — three templates filled per UI-SPEC §7 visual contract:

| Color token | Hex | Used for |
| --- | --- | --- |
| Paper Cream | `#FBF7EF` | Outer body background |
| Warm Ivory Surface | `#FFFDF7` | Inner card bg + CTA label |
| Forest Ink | `#143424` | Headline color |
| Calm Slate | `#5A6358` | Body copy color |
| Canopy Green | `#1F4D35` | CTA button bg + plain-text URL link |
| Trust Teal | `#2B6F7A` | LGPD footer strip |

Font fallback stacks (web fonts unreliable in email clients):
- Headlines: `'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif`
- Body: `'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`

22/22 tests pass. `pnpm typecheck` exits 0.

### Task 3: Resend adapter + notifications-send-email Inngest function (TDD)

**RED commit `c29dcb9`** — `tests/integration/notifications-send-email.integration.test.ts` with 5 tests:
1. Dev fallback: `RESEND_API_KEY=""` → `console.log("[resend-dev] would send", ...)` + returns `{id: "dev-mode"}`.
2. Registry length is exactly 9 after Plan 05 (was 8 in Plan 04).
3. `registry.map(f => f.id())` includes `"notifications-send-email"`.
4. Notifications context owns exactly 2 functions: `notifications-send-email` (real) + `notifications-send-push` (stub).
5. `notifications-send-email` configured with `retries: 3` (RESEARCH.md Pattern 3 + STRIDE T-04-05-07).

5/5 failed against the Plan 04 baseline (resend-adapter.ts didn't exist; functions.ts had only 1 entry).

**GREEN commit `8595d64`** — Resend adapter + extended functions.ts:

`src/contexts/notifications/infrastructure/resend-adapter.ts`:
```typescript
const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;
export const resendAdapter = {
  async send(params) {
    if (!resend) {
      console.log("[resend-dev] would send", { from, to, subject });
      return { id: "dev-mode" };
    }
    const { data, error } = await resend.emails.send(params);
    if (error) throw new Error(`resend.send failed: ${error.message}`);
    if (!data) throw new Error("resend.send returned no data");
    return { id: data.id };
  },
};
```

No `try { ... }` wrap around `.emails.send()` (RESEARCH.md anti-pattern line 807).

`src/contexts/notifications/inngest/functions.ts`:
```typescript
const notificationsSendEmail = inngest.createFunction(
  { id: "notifications-send-email", retries: 3, triggers: [{ event: "notifications/email.requested" }] },
  async ({ event, step }) => {
    const data = event.data as NotificationsEmailRequestedPayload;
    const rendered = (await step.run("render-email", async () => renderEmail(data.template, data.props))) as { react: ReactElement };
    const result = await step.run("send-resend", async () => resendAdapter.send({ from: serverEnv.RESEND_FROM_ADDRESS, to: data.to, subject: data.subject, react: rendered.react }));
    return { messageId: result.id };
  },
);

const notificationsSendPush = inngest.createFunction(
  { id: "notifications-send-push", triggers: [{ event: "notifications/push.requested" }] },
  async () => ({ status: "not_implemented" }),
);

export const notificationsFunctions = [notificationsSendEmail, notificationsSendPush];
```

5/5 integration tests pass. Full regression suite stays green (see Tests).

## Tests

| Suite | Tests | Status | Delta from Plan 04 |
| --- | --- | --- | --- |
| unit + unit-dom | 520 | PASS | +22 (3 templates × 7 + welcome-back × 8 = 22) |
| integration | 96 | PASS | +5 (notifications-send-email integration test) |
| **total** | **616** | **PASS** | **+27** |

Plan 04 baseline was 91+498=589. After Plan 05: 96+520=616. Math holds.

`pnpm typecheck` exits 0. `pnpm lint` exits 0 errors (58 warnings, all pre-existing — 0 new from this plan; consistent with Plan 04 SUMMARY's lint posture).

## Deviations from plan

### Rule 3 — Updated Plan 04 inngest-serve integration test for new registry topology

**Found:** `tests/integration/inngest-serve.integration.test.ts:31` asserted `registry).toHaveLength(8)` and `:42-54` asserted the exact alphabetical 8-ID list. Plan 05 grows the registry to 9 by adding `notifications-send-email`, so both assertions break.

**Fix:** Updated length 8→9 and inserted `"notifications-send-email"` between `"iam-process-deletion"` and `"notifications-send-push"` in the alphabetical list. Plan 04's test header comment already anticipated this growth.

**Files affected:** `tests/integration/inngest-serve.integration.test.ts`. Bundled into the Task 3 GREEN commit `8595d64` (single logical change: registry topology update).

### Rule 1 — Inngest 4.x type model wraps step.run output as JsonifyObject

**Found:** Initial typecheck failed:
```
src/contexts/notifications/inngest/functions.ts(29,9): error TS2741: Property 'type' is missing in type 'JsonifyObject<{ key: string | null; props: unknown; }>' but required in type 'ReactElement<...>'
```

Inngest's TS types model `step.run` output as JSON-serialized (because step memoization persists across retries). A `ReactElement`'s internal `type` field doesn't survive the JsonifyObject transform.

**Fix:** Re-cast the rendered return as `{ react: ReactElement }` after the `step.run` boundary. The React element does survive in-process between step boundaries within a single execution tick; we just re-tag the type. Documented inline in `functions.ts`.

**Files affected:** `src/contexts/notifications/inngest/functions.ts`. Bundled into Task 3 GREEN commit `8595d64`.

### Rule 1 — `@react-email/render` is a transitive, not direct, dep

**Found:** Plan code sample imports `render` from `@react-email/render`. Running the test threw `Cannot find package '@react-email/render'` because the project's direct dep is `@react-email/components` (which re-exports `* from "@react-email/render"`).

**Fix:** Imported `render` from `@react-email/components` instead. Same symbol, honest dep tree.

**Files affected:** `tests/unit/email-templates.test.ts`. Bundled into Task 2 RED commit `3b045a8`.

### No Rule 4 (architectural) decisions raised

The Inngest 4.x signature ambiguity, the JsonifyObject typing, and the @react-email/render import were all mechanical fixes — no architecture decision required.

## Plan acceptance criteria — diff

| Criterion | Outcome |
| --- | --- |
| `events.ts` exports 5 types matching grep regex | PASS (5/5) |
| TemplateName has 3 expected string literals | PASS |
| `send-email.ts` imports 3 template components | PASS |
| renderEmail switch has 3 cases + 1 exhaustive never default | PASS |
| 3 templates use `<Html lang="pt-BR">` | PASS (3/3) |
| 3 templates contain `#FBF7EF` (Paper Cream) | PASS (3/3) |
| Test file has at least 21 `it(...)` cases | PASS (22) |
| Test file has 0 placeholder `expect(true).toBe(true)` | PASS |
| `pnpm test:unit tests/unit/email-templates.test.ts` exits 0 | PASS (22/22) |
| Adapter has `[resend-dev] would send` log | PASS |
| Adapter has 0 try/catch around `resend.emails.send` | PASS |
| Adapter has at least 1 `throw new Error` | PASS (2) |
| functions.ts exports `notifications-send-(email\|push)` (≥2 matches) | PASS (4 matches) |
| functions.ts uses `step.run("(render-email\|send-resend)"` for both stages | PASS (2) |
| functions.ts has `retries: 3` | PASS (1 match) |
| Integration test asserts `toHaveLength(9)` | PASS (1 match) |
| Integration test has 0 placeholder asserts | PASS |
| `pnpm test:integration tests/integration/notifications-send-email.integration.test.ts` exits 0 | PASS (5/5) |
| `pnpm typecheck` exits 0 | PASS |

## Anti-enumeration math (D-11 / D-16)

| Plan | Registry length | What changed |
| --- | --- | --- |
| Plan 04 | 8 | 7 PRD §3 MVP stubs + iam-password-reset-requested stub (+1 anti-enumeration add) |
| Plan 05 | 9 | + real notifications-send-email (the 8th MVP function realized; the iam stub is the +1 add) |
| Plan 08 | 9 | iam-password-reset-requested stub replaced with real impl; count unchanged |

After Phase 4: registry contains exactly 9 = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11.

## Founder review checklist for pt-BR copy refinements (D-30)

The following copy was Claude-drafted per D-30 — founder reviews + refines during execution:

**Verification email:**
- Subject: "Confirme seu e-mail para começar — Folhário"
- Headline: "Confirme seu e-mail para começar"
- Body above CTA: "Olá! Você está a um clique de identificar e cuidar das suas plantas no Folhário. Confirme seu e-mail ({userEmail}) para liberar o app."
- CTA: "Confirmar e-mail"
- Body below CTA: "O link expira em 24 horas. Se não foi você, ignore este e-mail."
- Footer: "Você está recebendo este e-mail porque criou uma conta no Folhário."

**Password-reset email:**
- Subject: "Redefinir sua senha — Folhário"
- Headline: "Redefinir sua senha"
- Body above CTA: "Recebemos um pedido para redefinir a senha da conta {userEmail}. Se foi você, clique no botão abaixo. O link expira em 1 hora."
- CTA: "Redefinir senha"
- Body below CTA: "Se não foi você, ignore este e-mail — sua senha continua a mesma."
- Footer: "Você está recebendo este e-mail porque sua conta no Folhário pediu redefinição de senha."

**Welcome-back email (resolved Q1 anti-enumeration):**
- Subject: "Bem-vindo de volta ao Folhário"
- Headline: "Você já tem uma conta no Folhário"
- Body above CTA: "Recebemos uma nova solicitação de cadastro com {userEmail}, mas você já tem uma conta conosco. Para entrar, redefina sua senha pelo link abaixo."
- CTA: "Redefinir senha"
- Body below CTA: "Se não foi você quem tentou criar uma conta, pode ignorar este e-mail — a sua conta segue intacta."
- Footer: "Você está recebendo este e-mail porque alguém tentou criar uma conta no Folhário com este e-mail."

These same strings are mirrored in `src/messages/pt-BR.json` under `email.{verification,passwordReset,welcomeBack}.*` (Plan 03 output) — refinements should update both the JSON and the .tsx files (or migrate templates to `getTranslations()` if founder wants the JSON to be the single source of truth post-review).

## Notes for downstream Phase 4 plans

1. **Plan 06 (signup endpoint)** emits `inngest.send({ id: \`email-verification/\${token.id}\`, name: "notifications/email.requested", data: { template: "verification", to, subject, props: { url, userEmail } } })`. The signup-with-already-registered-email path (resolved Q1) emits the same event with `template: "welcome-back"` and `props: { resetUrl, userEmail }` — response is 200 in both paths, indistinguishable to the caller.

2. **Plan 08 (password reset request)** the real `iam-password-reset-requested` Inngest function (replacing Plan 04's stub) looks up the user, mints a hashed reset token, and emits `notifications/email.requested` with `template: "password-reset"`. Phase 4's anti-enumeration semantics (D-11) require this to be async — the public `/api/v1/iam/password/reset-request` endpoint just returns 200 immediately.

3. **`pnpm inngest:dev -u http://localhost:3000/api/inngest`** discovers all 9 registered functions when the Next.js dev server is running. With `RESEND_API_KEY=""` (default in `.env.local`), the `notifications-send-email` function will log to stdout via `[resend-dev] would send` instead of hitting the Resend API — useful for end-to-end dev iteration without burning quota.

4. **Phase 12 production cutover** swaps `RESEND_FROM_ADDRESS` from `onboarding@resend.dev` (sandbox sender, restricted to the Resend account owner's verified email) to a verified production domain (e.g. `noreply@folhario.com.br`) with SPF/DKIM/DMARC. Templates need no changes — the from-address is purely an env var.

5. **Adding a new template later** (e.g. trial-ending in Phase 10) requires:
   - Add the props type to `src/contexts/notifications/domain/events.ts`
   - Extend the `TemplateName` union and `NotificationsEmailRequestedPayload` discriminated union
   - Create `src/contexts/notifications/infrastructure/email-templates/{name}.tsx`
   - Extend the `renderEmail` switch in `src/contexts/notifications/application/send-email.ts`
   - No changes to the adapter, the Inngest function, the registry, or any consumer.

6. **One Playwright E2E spec optionally hits Resend sandbox** per D-29. Not in scope for this plan — that test lands when the signup flow does (Plan 06) and the verification redirect lands (Plan 07). The integration test here only exercises the dev console-log fallback path.

## Self-Check

Verified file existence:
- `src/contexts/notifications/domain/events.ts` — FOUND (extended)
- `src/contexts/notifications/application/send-email.ts` — FOUND
- `src/contexts/notifications/infrastructure/email-templates/verification.tsx` — FOUND
- `src/contexts/notifications/infrastructure/email-templates/password-reset.tsx` — FOUND
- `src/contexts/notifications/infrastructure/email-templates/welcome-back.tsx` — FOUND
- `src/contexts/notifications/infrastructure/resend-adapter.ts` — FOUND
- `src/contexts/notifications/inngest/functions.ts` — FOUND (2 functions: send-email + send-push)
- `tests/unit/email-templates.test.ts` — FOUND (22 tests)
- `tests/integration/notifications-send-email.integration.test.ts` — FOUND (5 tests)

Verified commits exist (`git log --oneline`):
- `355b6d9` feat(04-05): domain events + template registry + render orchestration
- `3b045a8` test(04-05): add failing tests for 3 React Email templates (RED gate)
- `979bea0` feat(04-05): implement 3 React Email templates with Paper Cream brand (GREEN gate)
- `c29dcb9` test(04-05): add failing integration test for notifications-send-email (RED gate)
- `8595d64` feat(04-05): Resend adapter + notifications-send-email Inngest function (GREEN gate + Rule 3 deviation)

Verified test counts:
- unit + unit-dom: 520/520 passing (was 498)
- integration: 96/96 passing (was 91)
- typecheck: clean
- lint: 0 errors (warnings only — all pre-existing)

Verified topology assertions:
- `registry.length === 9` (asserted by both `inngest-serve.integration.test.ts` and `notifications-send-email.integration.test.ts`)
- `notificationsFunctions` length 2: `["notifications-send-email", "notifications-send-push"]`
- `pnpm typecheck` exits 0
- `pnpm exec vitest run` returns 616/616 PASS

## TDD Gate Compliance

Both Task 2 and Task 3 followed RED → GREEN strictly:

| Task | RED commit | GREEN commit | Status |
| --- | --- | --- | --- |
| 2 | `3b045a8` test(04-05) — 19/22 fail | `979bea0` feat(04-05) — 22/22 pass | PASS |
| 3 | `c29dcb9` test(04-05) — 5/5 fail | `8595d64` feat(04-05) — 5/5 pass | PASS |

No REFACTOR commits needed — the GREEN implementations were directly aligned with UI-SPEC §7 and RESEARCH.md Patterns 9-10.

## Self-Check: PASSED
