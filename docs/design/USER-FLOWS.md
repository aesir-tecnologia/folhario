# User Flows — Folhário

## 1. Signup & Trial Start
1. Landing → Signup screen.
2. Email+password OR OAuth (Google min).
3. Age confirmation ≥13 (block <13).
4. Optional "Tenho um código de parceiro" field.
   - Valid code → 30-day trial, partner linked.
   - Invalid → inline error, user clears to proceed with 14-day.
   - Absent → 14-day trial.
5. Capture timezone from device (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
6. Trial clock starts at account creation. `Subscription.status = trialing`.
7. Land on Home empty state.

## 2. First Identification (LGPD Consent Gate)
1. Home empty state → CTA "Identifique sua primeira planta".
2. First identify attempt ever → consent modal: third-party providers (Plant ID, OpenAI-compat), international transfer disclosure, LGPD Art. 33.
3. Block until consent granted. Store consent version on identification record.
4. Proceed to Identify flow.

## 3. Identify Plant
1. Open Identify → camera or gallery picker (multi-photo).
2. Static capture guide: leaf, flower, whole plant.
3. Submit → loading.
4. Backend checks per-user cap + provider ceiling.
5. Results: top 3 cards with confidence %.
6. User selects result → prompted to add to catalog (pre-filled name).
7. OR dismisses all → manual entry path.
8. Identification persisted in history regardless.

### 3a. Identify Failure Branches
- **Low confidence / no results above threshold:** "could not identify" + guidance to retake + manual entry link.
- **Cap hit (per-user):** message with reset time + manual entry link. No retry button.
- **Provider unavailable (cost ceiling / breaker / outage):** "temporarily unavailable" + manual entry + "Try again" (photo kept in IndexedDB while on screen; lost on leave).
- **Timeout / network drop:** same as provider unavailable.
- **Navigate away mid-request:** request completes server-side, persists to history, no restore UI.
- **Offline:** blocked with clear message (identify is cloud-only).

## 4. Add Plant to Catalog
### 4a. From identification
1. Select result → "Adicionar ao Meu Jardim" prompt.
2. Form: name (prefilled), photo (from identify), optional: nickname, room/location, acquisition date, notes.
3. Save → Plant Profile.

### 4b. Manual
1. Catalog or empty Identify result → "Adicionar manualmente".
2. Form: name (required), photo (at least one, required), optional fields.
3. Save → Plant Profile.

## 5. Room/Location Assignment
1. Form field shows: previously-used locations (user's own) + defaults (living room, balcony, bedroom, bathroom, kitchen, office, garden, other).
2. Free text allowed, becomes reusable.

## 6. View Catalog
1. Home → Catalog ("Meu Jardim").
2. Grid/list. Sort: name A-Z/Z-A, acquisition date new/old, location. Default: acquisition date newest.
3. Tap card → Plant Profile.

## 7. View Plant Profile
Photo, name, nickname, room, date, notes, care card link, photo journal, active reminders, identification history (if applicable), edit button.

## 8. Photo Journal Entry
1. Plant Profile → photo journal → add photo.
2. Capture/pick + optional note.
3. Save → timeline updated chronologically.

## 9. View Care Guide
1. Plant Profile → care card tap.
2. First care guide view ever → one-time toxicity AI disclaimer modal → acknowledge.
3. Full care guide: watering, light, soil, temp, humidity, toxicity (prominent), difficulty, seasonal tips, compatibility.
4. If draft (`source=augmented`, `status=draft`): "Gerado por IA — em revisão" badge on top.
5. Missing care guide: section hidden; runtime augmentation triggered async. Appears on next view if succeeds.

## 10. Create Reminder (Watering / Fertilization)
1. Plant Profile → "Adicionar lembrete".
2. Type: watering / fertilization.
3. Frequency: prefilled from care guide if available, editable.
4. Time of day: default 09:00, editable.
5. Advance rule: `from_scheduled` (default) or `from_acted`.
6. Save.
7. **First reminder ever → push permission prompt.**

## 11. Reminder Fire & Action
1. Push notification at `next_due_at`.
2. Actions: "Done" / "Snooze" (1h, 3h, tomorrow).
3. Done → ReminderLog entry + advance `next_due_at`.
4. Snooze → pushes current occurrence only.
5. Offline → queued (IndexedDB), synced on reconnect, idempotent.
6. Push delivery fails / no permission / device offline → entry in in-app notification center on next app open.

## 12. Daily Summary
1. Home default state → today's tasks (reminders due today + overdue).
2. Act on tasks inline.
3. Overdue stays until acted. No escalation, no auto-mute.

## 13. Identification History
1. Plant Profile → "Histórico de identificação" OR dedicated history screen.
2. List: date, photos, results returned, selected result (or manual correction).
3. Re-associate past identification with catalog entry.

## 14. Manual Correction
1. Identify result screen → "Não é nenhum destes" / edit → type plant name.
2. Persists with manual-correction flag.

## 15. Late Partner Code (Settings)
1. Settings → partner code field.
2. Only visible while `status=trialing` AND current time < `trial_end_date`.
3. Valid code → `trial_end_date = created_at + 30 days` (one write, no reset, no stack).
4. Invalid or expired window → field hidden or error.

## 16. Subscription Management
### 16a. Trial → Paid
- Trial ends + valid payment method → first charge → `active`.
- Trial ends + no payment → `expired` → read-only catalog mode.

### 16b. Add Payment Method
1. Settings → Subscription → "Adicionar forma de pagamento".
2. Stripe flow (card or Pix).
3. Stored on customer.

### 16c. Cancel
1. Settings → Subscription → Cancel.
2. Confirm: access ends at `current_period_end`.
3. Status → `canceled`, but full access until period end.

### 16d. Reactivate
1. Settings → Subscription → Reactivate (visible on `canceled`/`expired`).
2. Provide payment method → new subscription start (if `expired`).
3. Available during 7-day deletion grace period.

### 16e. Failed Payment (Dunning)
1. Renewal fails → `active` → `past_due`.
2. Stripe 4 retries over 7 days + email per attempt.
3. Recovered → `active`. Exhausted → `canceled` → read-only.

## 17. Read-Only Catalog Mode
Triggered: subscription not in `trialing`/`active`.
- Plants, photos, journal, care guides: VIEW only.
- Identify: blocked, paywall prompt.
- Reminders: paused, no push.
- New plants / new journal entries / edits: blocked.
- Settings: full access (payment update, reactivate, export, delete).

## 18. LGPD Data Export
1. Settings → Privacy & LGPD → "Exportar meus dados".
2. Triggers `DataExportRequest`.
3. Delivered as JSON download (async email or in-app).

## 19. Account Deletion
1. Settings → Privacy & LGPD → "Excluir minha conta".
2. Confirm modal: what's deleted, 7-day grace, cancellation path.
3. Triggers `DataDeletionRequest`.
4. Account suspended immediately (inaccessible), email sent.
5. User can cancel deletion within 7 days → restored.
6. After 7 days → hard delete. Backups purged within 30 days.

## 20. Consent Revocation
1. Settings → Privacy & LGPD → Manage consents.
2. Toggles per consent: identification transfer, push notifications, etc.
3. Revoking identification consent blocks future identifications but preserves existing catalog data.

## 21. Offline Sync Recovery
1. Reconnect → queued actions replay in chronological order.
2. Conflicts resolved: last-write-wins by server timestamp.
3. Plant deleted on server → discard queued actions for it → single summary toast → tap to expand modal listing discarded actions grouped by type.
4. Action fails 5 retries → moved to "needs attention" list in Settings → manual retry / discard.

## 22. Multi-Device
- Catalog syncs across devices (eventual, LWW).
- Each device has own push subscription.
- Reminder fires on every subscribed device; Done on one clears others on sync.
- Notification prefs (mute) global, not per-device.
- Per-device logout revokes only that device's token + push sub.

## 23. Settings — Needs Attention List
1. Settings → sync queue failures after 5 retries.
2. Per entry: retry / discard.
