---
status: partial
phase: 03-design-system-app-shell
source: [03-VERIFICATION.md]
started: 2026-04-27T18:45:00Z
updated: 2026-04-27T18:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Install PWA on iOS Safari via "Add to Home Screen"

expected: Standalone app launches from home screen; theme color (#FBF7EF light / #1A1613 dark) matches the system preference; pt-BR copy renders; Source Serif 4 + Plus Jakarta Sans visible.
result: [pending]

### 2. Install PWA on Android Chrome via "Install app"

expected: Standalone app launches from home screen; theme color matches system preference; pt-BR copy renders.
result: [pending]

### 3. Lighthouse PWA audit

expected: Score ≥ 0.9 with no manifest errors. Validates manifest icons, display=standalone, scope=/, theme color in <head>.
result: [pending]

### 4. First-paint flash check (no light flash before dark, and vice-versa)

expected: Cold-load with system preference dark renders Night Cream first paint (no Paper Cream flash). Cold-load with folhario_theme=light cookie + system dark renders Paper Cream first paint.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
