# Screens — Folhário

All screens constrained to tablet-width on desktop (centered, bg fill sides). Mobile-first.

---

## 1. Auth

### 1.1 Login
- Email + password fields.
- OAuth button (Google min).
- Link to signup.
- Link to password recovery.
- States: idle, loading, error (invalid creds, network).

### 1.2 Signup
- Email + password + confirm password.
- OAuth button (Google).
- Age confirmation ≥13 checkbox.
- Optional expandable: "Tenho um código de parceiro" → input.
- T&C + privacy policy links (must accept).
- States: idle, validating code, invalid code inline error, loading, server error.

### 1.3 Password Recovery
- Email field → send reset link.
- States: idle, sent confirmation, error.

---

## 2. Home / Daily Summary

### 2.1 Empty State
Zero plants. Single full-bleed CTA: "Identifique sua primeira planta" + camera icon button. Nothing else visible — no tasks, no notifications, no nav.

### 2.2 Default State
One or more plants.
- Section: **Hoje** — today's tasks (reminders due today + overdue). Only plants with configured reminders surface.
- Section: **Notificações recentes** — in-app notification center for missed pushes. Each entry → plant/reminder deep link. Tap clears.
- Quick action: "Identificar planta" (camera button).
- Nav to Catalog.

### 2.3 Read-Only Mode
Banner top: "Sua assinatura expirou. Reative para identificar e receber lembretes." CTA → Settings → subscription. Catalog nav still works. Identify button → paywall prompt.

---

## 3. Identify

### 3.1 Picker
Camera/gallery picker. Multi-photo allowed. Static capture guide visible: photograph leaf, flower (if present), whole plant. "Mais fotos melhoram a precisão".

### 3.2 Loading
Spinner + "Identificando sua planta..." No progress bar (unknown duration).

### 3.3 Results
Top 3 cards ranked by confidence. Each card: thumbnail ref image, common name (pt-BR), scientific name, confidence %. Tap card → select. Button: "Nenhum destes — adicionar manualmente".

### 3.4 No Results / Low Confidence
Message: "Não conseguimos identificar esta planta." Guidance: retake photo tips. Button: "Tentar novamente". Button: "Adicionar manualmente".

### 3.5 Consent Gate (First Ever)
Modal before first identify: third-party providers disclosed (Plant ID, OpenAI-compat), international transfer (LGPD Art. 33), data usage. "Aceitar e continuar" / "Cancelar". Blocks flow until accepted.

### 3.6 Cap Reached
Message: "Você atingiu o limite de identificações de hoje. Tente novamente após [time]." Link to manual entry. No retry button.

### 3.7 Provider Unavailable
Message: "Identificação temporariamente indisponível. Tente novamente mais tarde." Button: "Tentar novamente" (photo retained locally while on screen). Link to manual entry.

### 3.8 Offline
Message: "Identificação requer conexão à internet." Dismissive; no retry queue.

### 3.9 Read-Only Paywall
Modal: "Reative sua assinatura para identificar novas plantas." CTA → Settings billing.

---

## 4. Catalog ("Meu Jardim")

### 4.1 Default
Grid or list (toggle optional). Each card: cover photo, name, nickname (if set), room/location. Sort control top: name A-Z, name Z-A, acquisition date (new first default), acquisition date old first, room. Tap card → Plant Profile.

### 4.2 Empty (unreachable in new flow)
User always has a plant by time they land here via nav. Still: "Seu jardim está vazio" + camera CTA fallback.

### 4.3 Read-Only
Same grid. Cards fully interactive for viewing. "Add plant" action hidden or disabled with tooltip.

---

## 5. Plant Profile

### 5.1 Default
- Cover photo + thumbnail gallery.
- Name + nickname (edit inline).
- Room/location (edit).
- Acquisition date (edit).
- Personal notes (edit).
- Care card preview (if available) → tap for full.
- Active reminders section → tap to manage.
- Photo journal timeline preview → tap for full.
- Identification history link (if applicable).
- Delete plant action (in overflow menu).

### 5.2 No Care Guide Yet
Care card section hidden entirely. Rest fully functional. Behind scenes: augmentation triggered.

### 5.3 Draft Care Guide Available
Badge: "Gerado por IA — em revisão" on top of care card.

### 5.4 Read-Only
All fields visible, no edit affordances. Photo journal read-only. Add reminder / add journal entry hidden or disabled.

---

## 6. Care Guide

### 6.1 Default
Visual icons per dimension.
- Watering (frequency range + descriptive).
- Light (direct / indirect / shade + guidance).
- Soil.
- Temperature °C range.
- Humidity (low/med/high + tips).
- **Toxicity** — prominent top badge (icon + color + text). Disclaimer line always visible: "Informação gerada por IA — confirme com um veterinário."
- Difficulty (easy/med/hard visual scale).
- Seasonal tips (SH summer/winter).
- Plant compatibility reference block.

### 6.2 First-Ever View Modal
One-time toxicity disclaimer modal. Acknowledge → persisted.

### 6.3 Draft Badge
Top banner: "Gerado por IA — em revisão".

### 6.4 Missing (no care guide)
Screen not reachable. Care card section hidden on Plant Profile.

---

## 7. Reminders Management

### 7.1 List
All active reminders grouped by plant. Per entry: plant name, type (water/fertilize), frequency, next due, time of day, advance rule. Edit / delete.

### 7.2 Create / Edit
Form:
- Type: watering / fertilization.
- Frequency (prefilled from care guide).
- Time of day (default 09:00).
- Advance rule: `from_scheduled` (default) / `from_acted`.
- Save / cancel.

### 7.3 First Reminder Ever
On save → push permission prompt (browser-native).

### 7.4 Read-Only
List visible but scheduling paused notice. No edit.

---

## 8. Photo Journal

### 8.1 Timeline
Chronological list of photos per plant. Each entry: photo, date, optional note.

### 8.2 Add Entry
Photo picker + optional note textarea. Save.

### 8.3 Read-Only
Browse only. Add entry hidden.

---

## 9. Identification History

### 9.1 Per-User List
All past identifications. Each: date, thumbnails, results returned, selected result or "manual correction" or "failed: [reason]".

### 9.2 Detail
Full record: photos, provider results, confidence %, user selection. Action: re-associate with catalog entry.

---

## 10. Settings

### 10.1 Account
- Email (edit).
- Password (change).
- Timezone (IANA picker).
- Logout (this device).

### 10.2 Notification Preferences
- Global mute toggle.
- Per-plant mute (lists plants with reminders).
- Push permission status indicator.

### 10.3 Subscription & Billing
- Current plan + status (trialing / active / past_due / canceled / expired).
- Renewal date OR trial end date.
- Payment method (last 4 digits / Pix indicator) + "Atualizar".
- Partner code input — ONLY shown while `status=trialing` and wall-clock < `trial_end_date`.
- Cancel subscription button (confirms period end).
- Reactivate subscription (shown on `canceled` / `expired`).
- Billing history (list of invoices/charges).

### 10.4 Privacy & LGPD
- "Exportar meus dados" → triggers DataExportRequest → JSON.
- "Excluir minha conta" → confirm modal → 7-day grace.
- "Gerenciar consentimentos" — toggle list: identification transfer, push, etc.
- Privacy policy link.
- Terms of service link.
- DPO (Encarregado) contact info.

### 10.5 Needs Attention (Sync Failures)
- List of actions that failed 5+ retries.
- Per item: retry / discard.

### 10.6 App Info
- Version, open-source licenses, support link.

---

## Cross-Cutting States

### Offline Banner
Persistent top banner when offline. "Você está offline. Algumas ações serão sincronizadas quando a conexão voltar."

### Read-Only Mode Banner
Persistent banner across all screens when subscription not in trialing/active. CTA to Settings billing.

### Discard Summary Toast (post-sync)
On app open after sync with discarded actions: tappable toast → modal listing discarded actions grouped by type (e.g., "2 photo uploads, 1 note edit" for plant "Maria") with timestamps. Read-only. Dismiss.

### LGPD Consent Modal
Triggered contextually. Block until decided.

### Push Permission Prompt
Browser-native. Triggered on first reminder creation only.

### Toxicity Disclaimer Modal
One-time, first ever care guide view.
