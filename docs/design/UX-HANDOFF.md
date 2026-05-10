# UX Handoff — Folhário

Audience: product designer / UI designer taking the existing product surface and making it polished.  
Locale: pt-BR only.  
Primary device: phone PWA. Desktop keeps the app centered at tablet width; do not design a wide desktop layout.

## 1. Product Frame

Folhário helps Brazilian plant beginners go from "não sei que planta é essa" to "identificada, salva no Meu Jardim, com orientação de cuidado" in under 2 minutes after email verification.

Core loop:

```text
Criar conta -> verificar e-mail -> identificar/adicionar planta -> Meu Jardim
-> perfil da planta -> diário/cuidado/lembretes -> voltar ao Hoje
```

Current implementation status:

| Area                                                    |                                         Status | Designer implication                                    |
| ------------------------------------------------------- | ---------------------------------------------: | ------------------------------------------------------- |
| Auth, verification, password recovery                   |                                    Implemented | Redesign can be precise.                                |
| App shell, bottom nav, offline/update/read-only banners |                                    Implemented | Preserve mobile shell and 4-tab nav.                    |
| Home, manual catalog, plant profile, photo journal      |                                    Implemented | Main current product surface.                           |
| Identify by AI                                          |              Placeholder only; Phase 6 planned | Design full flow from spec, but mark as upcoming.       |
| Care guides                                             |                                Planned Phase 7 | Design from spec; not in app yet.                       |
| Reminders and daily task summary                        |                                Planned Phase 8 | Design from spec; current UI has placeholders.          |
| Offline mutation queue / needs attention                |                                Planned Phase 9 | Design from spec; current offline browse/banner exists. |
| Billing/read-only mode                                  | Stub/provider partly present; Phase 10 planned | Design from spec; banner exists.                        |
| Privacy & LGPD data rights                              |                               Planned Phase 11 | Design from spec; legal pages are stubs.                |

## 2. Design Principles

- Beginner language: friendly, concrete, no botany jargon.
- Honest AI: confidence is shown as a percentage; low confidence never becomes certainty.
- Safety first: toxicity must be visually prominent, text-visible, and paired with disclaimer copy.
- Permission timing: ask for push only after the first reminder is created.
- No data hostage: expired users can still view catalog/photos/care guides.
- Accessibility is not optional: WCAG 2.1 AA, 44px tap targets, focus visible, color never the only signal.
- Motion is restrained and honors `prefers-reduced-motion`.

## 3. Information Architecture

Implemented app tabs:

```text
Bottom navigation
├─ Início      /
├─ Catálogo    /catalog
├─ Identificar /identify
└─ Perfil      /profile
```

Nested implemented routes:

```text
/catalog/add
/catalog/:plantId
/catalog/:plantId/journal
/settings/account
/settings/notifications        placeholder
/settings/subscription         placeholder
/settings/privacy-lgpd         placeholder
/settings/needs-attention      placeholder
/settings/app-info             placeholder
```

Public routes:

```text
/auth/signup
/auth/check-email
/auth/login
/auth/forgot-password
/auth/reset?token=...
/auth/oauth-complete
/auth/verify-error?error=token_expired
/legal/terms
/legal/privacy
/offline
/not-found
```

Global shell behavior:

- Verified users see a centered max-width app shell with top banners, main content, bottom nav, SW update toast, and sonner toasts.
- Unauthenticated users are redirected to login.
- OAuth users missing age/legal acceptance are redirected to OAuth completion.
- Authenticated but unverified users see a full-viewport verification blocker, with no bottom nav.
- On tab route changes, focus moves to `<main>` and scroll is restored per route.

## 4. Journey Inventory

### J1. Email Signup And Verification

Status: implemented.

```text
/auth/signup
  -> submit email/password/age/legal/timezone/(partner code)
  -> /auth/check-email
  -> user opens verification email
  -> /auth/verify route validates token
  -> login or app
  -> if email not verified, full-screen blocker appears
```

States:

- Idle form.
- Submitting: submit button disabled; form has `aria-busy`.
- Validation/server error alert: invalid email/password, partner code, rate limit, generic network.
- Check-email success page uses same copy whether account was created or already existed.
- Verification blocker has resend button with states: Reenviar e-mail -> Enviando... -> Aguarde 60s -> ready announcement.
- Token expired: `/auth/verify-error` full-page error with CTA to request a new link.

Wireframe:

```text
┌─────────────────────────┐
│ Criar conta             │
│                         │
│ [E-mail              ]  │
│ [Senha               ]  │
│ ☐ Tenho 13 anos ou mais │
│ ☐ Aceito os Termos      │
│ ☐ Aceito a Privacidade  │
│ ▸ Código de parceiro    │
│                         │
│ [ Criar conta        ]  │
└─────────────────────────┘
```

### J2. Google OAuth Completion

Status: implemented completion screen; OAuth callback exists.

```text
Google auth -> /auth/callback -> if missing age/legal
  -> /auth/oauth-complete
  -> confirm age/legal/timezone/(partner code)
  -> /
```

States:

- Idle form with greeting copy.
- Submitting disabled.
- Invalid partner code shown inline alert.
- Rate limit/generic errors shown as alert.

Wireframe:

```text
┌─────────────────────────┐
│ Falta pouco             │
│ Bem-vindo! ...          │
│ ☐ Tenho 13 anos ou mais │
│ ☐ Aceito os Termos      │
│ ☐ Aceito a Privacidade  │
│ ▸ Código de parceiro    │
│ [ Confirmar e continuar]│
└─────────────────────────┘
```

### J3. Login / Logout

Status: implemented.

```text
/auth/login -> email/password -> /
/settings/account -> Sair deste aparelho -> /auth/login
```

States:

- Invalid credentials alert: "E-mail ou senha incorretos."
- Rate limit alert.
- Generic network alert.
- Login success refreshes app state; if unverified, user lands in verification blocker.

Wireframe:

```text
┌─────────────────────────┐
│ Entrar                  │
│ [E-mail              ]  │
│ [Senha               ]  │
│ [ Entrar             ]  │
│ Esqueci minha senha     │
│ Ainda não tem conta?    │
└─────────────────────────┘
```

### J4. Password Recovery

Status: implemented.

```text
/auth/forgot-password -> submit email
  -> success message, always generic
email link -> /auth/reset?token=...
  -> set new password
  -> /auth/login
```

States:

- Forgot form idle/submitting/error.
- Forgot success replaces the form.
- Reset missing token redirects to forgot-password.
- Reset invalid token length shows expired-link message.
- Reset client validation: password too short, passwords mismatch.
- Reset server errors: rate limit/generic.

Wireframes:

```text
┌─────────────────────────┐
│ Recuperar senha         │
│ [E-mail              ]  │
│ [ Enviar link ...    ]  │
└─────────────────────────┘

┌─────────────────────────┐
│ Definir nova senha      │
│ [Nova senha          ]  │
│ [Confirme a nova ... ]  │
│ [ Definir nova senha ]  │
└─────────────────────────┘
```

### J5. First Empty Home

Status: implemented; identify target is placeholder.

```text
/ with zero plants
  -> camera CTA to /identify
  -> manual link to /catalog/add
```

States:

- Empty home with centered headline, hint, breathing camera button, manual add link.
- Offline banner may appear above content.
- Read-only banner may appear above content when billing later marks user read-only.

Wireframe:

```text
┌─────────────────────────┐
│ [offline/read-only bar] │
│                         │
│ Identifique sua         │
│ primeira planta         │
│                         │
│ Use a câmera...         │
│                         │
│          (camera)       │
│                         │
│ Adicionar manualmente   │
├─────────────────────────┤
│ Início Catálogo Ident. Perfil │
└─────────────────────────┘
```

### J6. Manual Add Plant

Status: implemented.

```text
Home manual link or Catalog add
  -> /catalog/add
  -> choose photo, enter name, optional nickname/location/date/notes
  -> POST /api/v1/plants
  -> /catalog/:plantId
```

States:

- Idle: large dashed photo area, fields, submit.
- Photo selected: preview image and "Trocar foto".
- Client validation: photo required, name required, invalid date. If 2+ errors, summary appears with links to invalid fields.
- Submitting: button label "Adicionando..." and disabled.
- Server validation maps to field errors.
- Compression/network/server failure: toast "Não conseguimos adicionar agora..."
- Read-only: banner active; fields disabled; submit hidden.

Wireframe:

```text
┌─────────────────────────┐
│ Adicionar planta        │
│ ┌─────────────────────┐ │
│ │  Foto da planta     │ │
│ │  Toque para adicionar│ │
│ └─────────────────────┘ │
│ [Nome                ]  │
│ [Apelido             ]  │
│ [Local combobox      ]  │
│ [Data                ]  │
│ [Notas               ]  │
│ [Adicionar à estante ]  │
└─────────────────────────┘
```

### J7. Catalog Browsing And Sorting

Status: implemented.

```text
/catalog
  -> empty state if no plants
  -> otherwise header + sort + add CTA + grid
  -> tap plant card -> /catalog/:plantId
```

States:

- Empty: one CTA to identify.
- Loading/hydration: 6 skeleton cards after 300ms.
- Default: responsive grid, 2 columns mobile, 3 tablet, 4 at wider CSS breakpoint within app width behavior.
- Sort options: recent, old, name A-Z, name Z-A, location. Reordering is announced via live region.
- Read-only: add action hidden, grid remains interactive.

Wireframe:

```text
┌─────────────────────────┐
│ MEU JARDIM  8 plantas   │
│ [Ordenar por v] [+Planta]│
│                         │
│ ┌───────┐ ┌───────┐     │
│ │photo  │ │photo  │     │
│ │Name   │ │Name   │     │
│ │Loc    │ │Loc    │     │
│ └───────┘ └───────┘     │
├─────────────────────────┤
│ Início Catálogo Ident. Perfil │
└─────────────────────────┘
```

### J8. Plant Profile

Status: implemented, with future reminders/history placeholders.

```text
/catalog/:plantId
  -> view cover and thumbnail strip
  -> tap photo -> lightbox
  -> tap fields -> inline edit
  -> journal link -> /catalog/:plantId/journal
  -> overflow -> delete sheet
```

States:

- Initial loading: title skeleton + cover skeleton.
- Default: cover, thumbnails, inline fields, reminders placeholder, journal preview, ID history placeholder.
- Inline field read -> editing -> saving -> read. Empty required name shows inline error.
- Save failure: field reverts to pre-edit value; optional alert copy if provided.
- Location edit uses combobox suggestions: prior user locations + defaults + free text.
- Lightbox: full-screen photo overlay, close button, swipe/arrow navigation, index indicator.
- Read-only: all edit affordances and delete menu hidden; fields render as plain text.
- Not found/unauthorized: server returns 404/not-found.

Wireframe:

```text
┌─────────────────────────┐
│ <                    ⋮  │
│ ┌─────────────────────┐ │
│ │     cover photo      │ │
│ └─────────────────────┘ │
│ [thumb][thumb][thumb]   │
│ Nome                    │
│   Samambaia             │
│ Apelido                 │
│   Maria                 │
│ Localização             │
│   Sala                  │
│ Adicionada em           │
│   10/05/2026            │
│ Notas                   │
│   ...                   │
│ LEMBRETES ATIVOS        │
│ Você ainda não tem...   │
│ DIÁRIO DE FOTOS  Ver tudo│
│ HISTÓRICO...            │
└─────────────────────────┘
```

Delete sheet:

```text
┌─────────────────────────┐
│        drag handle      │
│ Excluir Maria?          │
│ Isso vai apagar...      │
│ [Cancelar]              │
│ [Excluir planta]        │
└─────────────────────────┘
```

### J9. Photo Journal

Status: implemented.

```text
/catalog/:plantId/journal
  -> timeline newest first
  -> + Foto opens bottom sheet
  -> choose photo + optional note
  -> optimistic timeline update
  -> success closes sheet
```

States:

- Empty: one CTA "Adicionar primeira foto".
- Default timeline: full-width photo, date, optional note.
- Add sheet idle: dashed picker, note textarea, submit, cancel.
- Photo required error shown inline.
- Submitting: optimistic entry inserted; submit disabled.
- Success: temp entry replaced, sheet closes.
- Non-OK/network failure: optimistic entry rolled back, sheet stays open, error toast, same idempotency key retained for retry except 409 rotates key.
- Read-only: add button hidden; empty CTA has no action.

Wireframe:

```text
┌─────────────────────────┐
│ Maria — Diário     +Foto│
│ ┌─────────────────────┐ │
│ │       photo          │ │
│ └─────────────────────┘ │
│ 10/05/2026              │
│ Brotinho novo           │
│ ┌─────────────────────┐ │
│ │       photo          │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

Add sheet:

```text
┌─────────────────────────┐
│ Nova foto               │
│ ┌─────────────────────┐ │
│ │ Toque para adicionar │ │
│ └─────────────────────┘ │
│ Anotação (opcional)     │
│ [Como ela está hoje? ]  │
│ [Adicionar]             │
│ [Cancelar]              │
└─────────────────────────┘
```

### J10. Settings Account

Status: implemented. Other settings sections are placeholders.

```text
/settings -> /settings/account
/settings/account
  -> view email
  -> change password if email/password account
  -> OAuth-only notice otherwise
  -> edit timezone
  -> logout this device
```

States:

- Password change client errors: new password too short, mismatch.
- Password server error: current password incorrect, rate limited, generic.
- Success: small "OK." status, fields reset.
- Timezone read mode -> edit mode -> save -> refresh.
- Invalid timezone error.
- Placeholder settings sections show title/body and "Voltar para configurações".

Wireframe:

```text
┌─────────────────────────┐
│ Configurações           │
│ PREFERÊNCIAS DA CONTA   │
│ ┌─────────────────────┐ │
│ │ Conta               │ │
│ │ E-mail user@...     │ │
│ │ Senha               │ │
│ │ [Atual] [Nova] ...  │ │
│ │ [Salvar nova senha] │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Fuso horário        │ │
│ │ America/Sao_Paulo   │ │
│ │ Alterar fuso        │ │
│ └─────────────────────┘ │
│ Sair deste aparelho     │
└─────────────────────────┘
```

### J11. Profile Tab

Status: implemented placeholder plus theme selector.

```text
/profile -> heading + explanatory hint + appearance control
```

States:

- Theme options: automatic, light, dark.
- This is not the final account hub; settings account is the real account screen today.

Wireframe:

```text
┌─────────────────────────┐
│ Perfil                  │
│ Aqui ficarão suas...    │
│ Aparência               │
│ [Automático|Claro|Escuro]│
└─────────────────────────┘
```

### J12. Identify Flow

Status: currently placeholder; full flow planned Phase 6.

Current screen:

```text
/identify
  online -> "Em breve" + hint to add manually
  offline -> "Identificação requer conexão à internet."
```

Current wireframe:

```text
┌─────────────────────────┐
│                         │
│ Em breve                │
│ Esta é a etapa onde...  │
│                         │
└─────────────────────────┘
```

Planned journey:

```text
/identify
  -> camera/gallery picker
  -> first-ever LGPD consent modal
  -> upload 1-N photos
  -> loading
  -> top 3 results
  -> select result
  -> add to catalog form prefilled
  -> plant profile
```

Planned states:

- Consent required: modal blocks flow; accept continues, cancel returns to picker.
- Offline: blocked, no queue.
- Read-only/subscription required: paywall modal with CTA to billing settings.
- Cap hit: no retry button; show reset time and manual entry link.
- Provider unavailable/timeout: retry available; manual fallback available; photo retained only while on screen.
- No/low confidence: retake tips and manual fallback.
- Navigate away mid-request: request may complete server-side and persist to history, but no in-flight restore UI.

Picker wireframe:

```text
┌─────────────────────────┐
│ Identificar planta      │
│ Dicas para uma boa foto │
│ • folha de perto        │
│ • flor, se tiver        │
│ • planta inteira        │
│ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │foto │ │foto │ │ +   │ │
│ └─────┘ └─────┘ └─────┘ │
│ [Usar câmera]           │
│ [Escolher da galeria]   │
│ [Identificar]           │
└─────────────────────────┘
```

Results wireframe:

```text
┌─────────────────────────┐
│ Encontramos estas...    │
│ ┌─────────────────────┐ │
│ │ img  Jiboia         │ │
│ │      Epipremnum...  │ │
│ │      85% confiança  │ │
│ │      [Selecionar]   │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ result 2            │ │
│ └─────────────────────┘ │
│ Nenhuma destas — adicionar│
└─────────────────────────┘
```

### J13. Care Guide

Status: planned Phase 7.

```text
Plant profile -> care card -> care guide
first-ever care-guide view -> toxicity disclaimer modal
```

States:

- Care card hidden when guide missing.
- Draft guide shows "Gerado por IA — em revisão".
- Toxicity badge always prominent, not hidden.
- First-ever toxicity disclaimer modal requires acknowledgement.

Wireframe:

```text
┌─────────────────────────┐
│ Guia de cuidados        │
│ [Toxicidade badge]      │
│ Informação gerada...    │
│ Rega        1x semana   │
│ Luz         Indireta    │
│ Solo        ...         │
│ Temperatura 18-28 °C    │
│ Umidade     Média       │
│ Dificuldade Fácil       │
│ Dicas por estação       │
│ Compatíveis             │
└─────────────────────────┘
```

### J14. Reminders And Daily Summary

Status: planned Phase 8; plant profile has a "Criar lembrete" placeholder link to settings notifications.

```text
Plant profile -> Criar lembrete
  -> create/edit form
  -> first reminder triggers push permission prompt
Home -> Hoje due/overdue list
tap reminder -> mark done or snooze
```

States:

- No reminder prompt shown until user opens the reminder action.
- Create/edit fields: type, frequency, time, advance rule.
- First reminder save: in-app primer then browser-native permission.
- Overdue reminders visually distinct with text label "Atrasado".
- No push/no device offline: no delivered push; Home due list remains source of truth.
- Read-only: reminder list viewable, scheduling paused notice, no edits.

Home daily summary wireframe:

```text
┌─────────────────────────┐
│ Hoje                    │
│ ┌─────────────────────┐ │
│ │ Maria • Rega        │ │
│ │ Atrasado            │ │
│ │ [Feito] [Adiar]     │ │
│ └─────────────────────┘ │
│ Notificações recentes   │
│ ...                     │
│                  camera │
└─────────────────────────┘
```

Reminder form wireframe:

```text
┌─────────────────────────┐
│ Novo lembrete           │
│ Tipo [Rega v]           │
│ Frequência [7 dias]     │
│ Horário [09:00]         │
│ Calcular próxima data...│
│ (•) Data agendada       │
│ ( ) Data em que marquei │
│ [Salvar lembrete]       │
└─────────────────────────┘
```

### J15. Billing And Read-Only Mode

Status: planned Phase 10; subscription provider/read-only banner exists.

```text
trialing/active -> full app
past_due/canceled/expired -> read-only catalog mode
Settings subscription -> checkout/update/cancel/reactivate
```

User-facing read-only behavior:

- Persistent banner: "Sua assinatura expirou. Reative para identificar e receber lembretes."
- Catalog/photos/journal/care guides remain viewable.
- Identify blocked with paywall modal.
- Add/edit/delete/journal add blocked.
- Reminders paused.
- Settings remains fully accessible.

Subscription wireframe:

```text
┌─────────────────────────┐
│ Assinatura e cobrança   │
│ Plano: Mensal           │
│ Status: Em teste        │
│ Seu teste termina em... │
│ Forma de pagamento ...  │
│ [Atualizar pagamento]   │
│ Código de parceiro      │
│ [Cancelar assinatura]   │
│ Histórico de pagamentos │
└─────────────────────────┘
```

### J16. Privacy / LGPD

Status: planned Phase 11; legal pages are public stubs showing current version.

```text
Settings -> Privacy & LGPD
  -> export data
  -> delete account
  -> manage consents
  -> links to privacy/terms and DPO contact
```

States:

- Export requested: async email/in-app ready state.
- Delete confirmation: explains immediate suspension, 7-day grace, permanent deletion.
- Deletion in progress: account mostly inaccessible; cancel deletion path only.
- Consent revocation: blocks future affected activity, preserves existing catalog.

Wireframe:

```text
┌─────────────────────────┐
│ Privacidade e dados     │
│ Exportar meus dados     │
│ Baixe uma cópia...      │
│ [Exportar]              │
│                         │
│ Gerenciar consentimentos│
│ [ ] Envio de fotos...   │
│ [ ] Notificações push   │
│                         │
│ Excluir minha conta     │
│ [Excluir conta]         │
│ Política | Termos | DPO │
└─────────────────────────┘
```

### J17. Offline And Sync Recovery

Status: offline banner/page/cache implemented; mutation queue planned Phase 9.

Implemented:

- Top offline banner in app shell.
- `/offline` fallback with retry reload CTA.
- Identify placeholder shows offline-blocked status.
- Current add/journal mutations are not yet a full offline queue; they fail with toasts or block depending on flow.

Planned:

- Queue mutating actions in IndexedDB with idempotency key.
- Replay chronological on reconnect.
- Last-write-wins for stale field edits.
- Drop actions for deleted plants, then show discard-summary toast and detail modal.
- After 5 failed retries, show Settings -> Needs attention.

Discard modal wireframe:

```text
┌─────────────────────────┐
│ Ações descartadas       │
│ As seguintes ações...   │
│ • Foto • Maria • 09:30  │
│ • Nota • Maria • 09:35  │
│ [Entendi]               │
└─────────────────────────┘
```

### J18. Utility, Legal, And Placeholder Screens

Status: implemented as simple stubs/fallbacks.

These screens are easy to overlook, but they shape first impressions during account setup, legal review, and network failures.

Check-email page:

```text
┌─────────────────────────┐
│        envelope icon     │
│ Verifique seu e-mail.   │
│ Enviamos uma mensagem...│
│ [Já confirmou? Entrar]  │
└─────────────────────────┘
```

Unverified blocker:

```text
┌─────────────────────────┐
│        envelope icon     │
│ Verifique seu e-mail... │
│ Enviamos um link para   │
│ user@email.com          │
│ [Reenviar e-mail]       │
│ Sair                    │
└─────────────────────────┘
```

Verify/reset expired:

```text
┌─────────────────────────┐
│ Link expirado.          │
│ Solicite um novo link...│
│ [Solicitar novo link]   │
└─────────────────────────┘
```

Settings placeholder section:

```text
┌─────────────────────────┐
│ Configurações           │
│ PREFERÊNCIAS DA CONTA   │
│ ┌─────────────────────┐ │
│ │ Assinatura e cobrança│ │
│ │ Em breve...         │ │
│ │ Voltar para configurações│
│ └─────────────────────┘ │
└─────────────────────────┘
```

Offline fallback page:

```text
┌─────────────────────────┐
│        leaf icon         │
│ Você está offline.      │
│ Verifique sua conexão...│
│ [Tentar novamente]      │
└─────────────────────────┘
```

Legal stub pages:

```text
┌─────────────────────────┐
│ Termos de uso           │
│ Em construção. Versão...│
└─────────────────────────┘

┌─────────────────────────┐
│ Política de Privacidade │
│ Em construção. Versão...│
└─────────────────────────┘
```

404:

```text
┌─────────────────────────┐
│ 404                     │
│ Página não encontrada   │
└─────────────────────────┘
```

## 5. Screen Inventory

| Screen               | Route                   |                  Status | Primary job                       | Empty                 | Loading                 | Error                         |
| -------------------- | ----------------------- | ----------------------: | --------------------------------- | --------------------- | ----------------------- | ----------------------------- |
| Signup               | `/auth/signup`          |             Implemented | Create account and legal consent  | n/a                   | submit disabled         | alert                         |
| Check email          | `/auth/check-email`     |             Implemented | Tell user to verify               | n/a                   | n/a                     | n/a                           |
| Unverified blocker   | app layout              |             Implemented | Block app until verified          | n/a                   | resend sending/cooldown | cooldown/generic silent       |
| Login                | `/auth/login`           |             Implemented | Start session                     | n/a                   | submit disabled         | alert                         |
| Forgot password      | `/auth/forgot-password` |             Implemented | Request reset                     | success replaces form | submit disabled         | alert                         |
| Reset password       | `/auth/reset`           |             Implemented | Set new password                  | n/a                   | submit disabled         | alert / expired page          |
| OAuth completion     | `/auth/oauth-complete`  |             Implemented | Complete age/legal fields         | n/a                   | submit disabled         | alert                         |
| Home empty           | `/`                     |             Implemented | First plant CTA                   | main state            | n/a                     | banners only                  |
| Home bridge          | `/`                     |             Implemented | Show plant count and catalog link | n/a                   | server render           | auth redirect                 |
| Identify placeholder | `/identify`             | Implemented placeholder | Explain upcoming identify         | n/a                   | n/a                     | offline status                |
| Catalog              | `/catalog`              |             Implemented | Browse/sort plants                | empty CTA             | skeleton grid           | auth redirect                 |
| Add plant            | `/catalog/add`          |             Implemented | Manual plant creation             | n/a                   | submit disabled         | field errors/toast            |
| Plant profile        | `/catalog/:id`          |             Implemented | View/edit plant                   | empty sections        | skeleton                | not-found / field save revert |
| Lightbox             | modal                   |             Implemented | Inspect photos                    | n/a                   | n/a                     | n/a                           |
| Delete plant         | bottom sheet            |             Implemented | Confirm destructive action        | n/a                   | deleting label          | toast via mutation            |
| Photo journal        | `/catalog/:id/journal`  |             Implemented | Track growth photos               | empty CTA             | query hydration         | toast                         |
| Journal add          | bottom sheet            |             Implemented | Add photo/note                    | n/a                   | optimistic submit       | inline + toast                |
| Settings account     | `/settings/account`     |             Implemented | Account/password/timezone/logout  | n/a                   | submit disabled         | alerts                        |
| Settings other       | `/settings/*`           |             Placeholder | Future settings section           | n/a                   | n/a                     | invalid route 404             |
| Profile tab          | `/profile`              |             Placeholder | Theme selector                    | n/a                   | n/a                     | n/a                           |
| Offline fallback     | `/offline`              |             Implemented | Recover from offline navigation   | n/a                   | n/a                     | n/a                           |
| Legal pages          | `/legal/*`              |                    Stub | Versioned legal text              | under construction    | n/a                     | n/a                           |
| 404                  | not-found               |       Implemented basic | Missing route fallback            | n/a                   | n/a                     | static message                |

## 6. State And Transition Patterns

### Forms

```text
idle -> client validation fail -> error
idle -> submitting -> success route/state
idle -> submitting -> server field error -> error
idle -> submitting -> network/server failure -> toast/alert
```

Rules:

- Keep labels visible.
- Errors use text plus visual cue.
- For multi-error add-plant, use a summary block with field links.
- Disabled buttons must retain readable contrast.

### Inline Edit Fields

```text
read -> tap/keyboard -> editing
editing -> blur/Enter -> saving -> read
editing -> Escape -> read
saving -> failure -> error-revert -> read/tap to retry
```

Design needs:

- Read affordance should be subtle but discoverable.
- Saving state is text ("Salvando..."), not a spinner.
- Read-only removes button affordance entirely.

### Bottom Sheets

Used for delete confirm and journal add. Behavior:

- Scrim + sheet from bottom.
- Visible close affordance and cancel action.
- Destructive sheet uses `alertdialog`, cancel appears before destructive action.
- Focus trapped and returned on close.

### Lightbox

Behavior:

- Full-screen dark overlay.
- Top-right close 44px.
- Swipe left/right on touch; arrow keys on keyboard.
- No wrap at ends.
- Captions are optional; index shown for multiple photos.

### Global Banners And Toasts

- Offline banner: top, status role, icon + text.
- Read-only banner: top, status role, icon + text.
- App update toast: bottom center, persistent until user taps "Atualizar".
- Discard summary toast: planned; tap opens details modal.

## 7. User-Perspective Error Handling

| Situation                                | User sees                                               | User can do                                  |
| ---------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Invalid login                            | "E-mail ou senha incorretos."                           | Correct fields, retry, recover password.     |
| Auth rate limit                          | "Muitas tentativas..."                                  | Wait.                                        |
| Signup existing email                    | Same check-email path                                   | Check inbox; no account existence leaked.    |
| Invalid partner code                     | Inline/alert says code invalid, standard trial possible | Remove code or retry.                        |
| Unverified email                         | Full-screen blocker                                     | Resend email after cooldown, logout.         |
| Expired verification/reset token         | Calm full-page expired-link message                     | Request new link.                            |
| Add plant missing photo/name             | Inline field errors, possible summary                   | Fill missing fields.                         |
| Add plant upload/compression/server fail | Toast                                                   | Retry submit.                                |
| Journal add missing photo                | Inline sheet error                                      | Pick photo.                                  |
| Journal upload fail                      | Toast, sheet remains open                               | Retry without losing selection.              |
| Plant field save fail                    | Field reverts                                           | Retry edit.                                  |
| Plant not found                          | 404                                                     | Navigate elsewhere.                          |
| Offline globally                         | Top banner                                              | Continue browsing cached content; reconnect. |
| Offline identify                         | Inline blocked status                                   | Reconnect or add manually.                   |
| Provider unavailable planned             | Full identify error                                     | Retry or add manually.                       |
| Cap hit planned                          | Full identify error with reset time                     | Add manually; no retry.                      |
| Read-only mode planned                   | Persistent banner/paywall/block copy                    | Reactivate; browse existing data.            |
| Deletion in progress planned             | Account suspended state                                 | Cancel deletion during grace period.         |

## 8. Copy Anchors

Use existing pt-BR strings as the baseline. Key current copy:

- Home: "Identifique sua primeira planta"; "Adicionar manualmente".
- Catalog: "Meu Jardim"; "Adicionar planta"; "Ordenar por".
- Add plant: "Foto da planta"; "Como você chama essa planta?"; "Adicionar à minha estante".
- Plant profile: "LEMBRETES ATIVOS"; "DIÁRIO DE FOTOS"; "HISTÓRICO DE IDENTIFICAÇÃO".
- Journal: "Nova foto"; "Como ela está hoje?"; "Adicionar".
- Offline: "Você está offline. Algumas ações serão sincronizadas quando a conexão voltar."
- Read-only: "Sua assinatura expirou. Reative para identificar e receber lembretes."

Voice:

- Say "planta", "local", "quanto de sol".
- Avoid unnecessary Latin; when shown, pair with common name.
- Avoid blame in reminders; "Atrasado" is enough.
- Use "gerado por IA" only where provenance is required.

## 9. Designer Checklist

- Design every implemented screen above at 320px, 390px, and tablet-width max container.
- Include dark mode variants if changing colors; current app supports theme switching.
- Provide error, empty, loading, read-only, and offline variants for every affected screen.
- Keep bottom nav visible on verified app screens; never show it on auth or unverified blocker screens.
- Preserve single primary CTA in empty states.
- Preserve cancel-before-destructive order in delete/delete-account confirmations.
- For upcoming flows, mark specs as Phase 6+ designs and do not assume implementation already exists.
- Validate long pt-BR strings, 200% text size, and 44px touch targets.

## 10. Source Map For Follow-Up

Primary implemented source:

- `src/app/(public)/auth/*/page.tsx`
- `src/contexts/iam/api/components/*form.tsx`
- `src/app/(app)/app-shell.tsx`
- `src/shared/ui/bottom-nav.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/identify/_identify-placeholder.tsx`
- `src/app/(app)/catalog/**`
- `src/app/(app)/settings/**`
- `src/messages/pt-BR.json`

Product/design specs:

- `docs/design/USER-FLOWS.md`
- `docs/design/SCREENS.md`
- `docs/design/BEHAVIOR.md`
- `docs/design/COPY.md`
- `docs/design/UX-GOALS.md`
- `docs/design/ACCESSIBILITY.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
