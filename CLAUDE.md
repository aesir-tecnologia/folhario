<!-- GSD:project-start source:PROJECT.md -->

## Project

**Folhário**

Folhário is a plant identification, care-guide, and reminder PWA for Brazilian beginners who just bought their first plant and don't want to kill it. Users snap a photo, the app identifies the plant using cloud AI, files it in their personal catalog ("Meu Jardim"), shows a pt-BR care guide, and nudges them when it's time to water. Mobile-first PWA at launch, with every architectural decision kept native-compatible for a future app build.

**Core Value:** **A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.**

Reminders are the retention engine; without the <2-min first-value moment there's no retention to engineer.

### Constraints

- **Tech stack**: Next.js 16 App Router + React 19 + TS, PWA via `@serwist/next` — Single codebase for web/PWA now, native later; route handlers under `/api/v1` in same deploy.
- **Tech stack**: Supabase Postgres via Supavisor transaction-mode pooler, Drizzle ORM inside repositories only, `postgres-js` driver with `{ prepare: false }` mandatory — RLS as defense in depth; adapters keep auth/storage swappable.
- **Tech stack**: Inngest for all async work — events, cron, durable `step.sleepUntil` — no raw cron, no BullMQ. Free-tier `sleepUntil` cap is 7 days (exact size of LGPD deletion grace window); upgrade if budget allows headroom.
- **Tech stack**: Vercel hosting, deploys from GitHub Actions ONLY. Vercel git integration DISABLED so tests, migrations, and deploys share one pipeline. Preview env per PR with Supabase branch DB.
- **Locale**: pt-BR only at launch — `next-intl` mandatory day one, `<html lang="pt-BR">`, `date-fns-tz` for server-rendered user-local times, numbers/currency via `Intl.*` with `pt-BR` (`R$ 29,90`, `dd/MM/yyyy`, 24h).
- **Platform**: Mobile-first PWA, tablet-width centered on desktop (bg fills sides). No wide-screen design. Bottom-nav only, max 5 tabs (MVP uses 4).
- **Accessibility**: WCAG 2.1 AA = ship blocker — every state combines redundant cues, color never sole signal, focus ring global 3px Canopy @ 40% opacity offset 2px, `prefers-reduced-motion` honored, reading order matches visual order.
- **Compliance (LGPD)**: DPO appointed + privacy policy published before first identification — Art. 33 consent before first upload, Art. 18 data rights (export, correction, deletion, portability, consent revocation), 7-day deletion grace via Inngest durable sleep, ANPD breach notification within Art. 48 timeframes.
- **Performance**: Vercel function budgets for identification — total wall-clock 50s, per-call cap 30s, fallover requires ≥10s remaining budget, else short-circuit `provider_unavailable`.
- **Performance**: Images compressed client-side to ≤1MB, EXIF/GPS stripped client-side (server rejects GPS-bearing uploads as defense in depth `validation_failed`).
- **Budget**: Per-provider daily cost ceilings enforced in DB + atomic counters — default USD 5/day each for Plant ID + OpenAI-compat; operator alert email via Resend at 80%. Cap check executes BEFORE any `ProviderUsageCounter` increment or provider call.
- **Content**: ≥200 curated care guides shipped before MVP launch (founder-owned, LAUNCH BLOCKER).
- **Payments**: Single monthly tier, Stripe (card + Pix), 14-day organic / 30-day partner trial — Pricing TBD is a LAUNCH BLOCKER. `BillingProvider` adapter allows future swap to Pagar.me / Mercado Pago / Iugu.
- **Security**: Per-device JWT, no server sessions, narrow per-IP throttle on public auth endpoints — only place `rate_limited` 429 is emitted in MVP. Standard security headers via Next.js middleware. RLS on all user-owned tables, service-role key server-side only.
- **Data**: Timestamps ISO-8601 UTC with `Z`; exception: `User.notification_time_local` as `HH:MM` in `User.timezone`. `next_due_at` computed at create/advance, not at fire time.
- **Error codes**: Closed registry in PRD §5 — no ad-hoc error codes. `cost_ceiling_reached` and `breaker_open` are INTERNAL-only and surface as `provider_unavailable` to clients.
- **Observability**: Sentry (release = git SHA, source maps uploaded post-build from CI because Turbopack requires it), PostHog US cloud (lower latency from Brazil; international transfer basis documented in privacy policy + DPA via PostHog SCCs per LGPD Art. 33), SQL rollups via Inngest cron for identification quality metrics. `Sentry.setUser({ id })` only — never email.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)

```bash
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

<!-- /rtk-instructions -->
