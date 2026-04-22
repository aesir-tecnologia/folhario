# Phase 1: Foundation - Discussion Log (Power Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 01-foundation
**Mode:** power (30 questions generated upfront; 29 answered, 1 Claude's Discretion)
**Sections:** Tooling & Scaffold, TypeScript & Code Style, Folder Structure & Error Registry, PWA & i18n, Local Supabase Dev, Observability (Sentry + PostHog), Security Headers, CI Pipeline, Env Management

---

## Tooling & Scaffold

### Q-01 — Node version pin
| Option | Description | Selected |
|---|---|---|
| Node 22 LTS (.nvmrc + engines) | Current LTS as of 2026 | ✓ |
| Node 20 LTS (.nvmrc + engines) | Previous LTS | |
| No pin, document minimum in README | Lightweight, drift risk | |

**Notes:** "make sure you create the .nvmrc file locally"

### Q-02 — pnpm version activation
| Option | Description | Selected |
|---|---|---|
| Corepack + packageManager field | Node-native, auto-installs via Corepack | ✓ |
| Global pnpm, documented minimum | Manual install step | |
| Volta for the whole toolchain | Extra tool, strongest reproducibility | |

### Q-03 — Linter & formatter
| Option | Description | Selected |
|---|---|---|
| ESLint (Next flat config) + Prettier | Mainstream, two tools | ✓ |
| Biome (lint + format single tool) | Fast Rust, smaller rule set | |
| ESLint + typescript-eslint strict + Prettier | Strictest, slower | |

### Q-04 — Git hooks & commit linting
| Option | Description | Selected |
|---|---|---|
| Husky + lint-staged (no commitlint) | Pre-commit only | |
| Husky + lint-staged + commitlint | Conventional Commits enforced | ✓ |
| simple-git-hooks + lint-staged | Lighter than Husky | |
| No hooks, rely on CI | Less friction | |

### Q-05 — Task runner / script convention
| Option | Description | Selected |
|---|---|---|
| npm scripts only | Zero new deps | ✓ |
| npm scripts + justfile | Cleaner multi-step recipes | |
| npm scripts + turbo | Build caching, forward-looking | |

---

## TypeScript & Code Style

### Q-06 — TS strictness flags
| Option | Description | Selected |
|---|---|---|
| Locked minimum only (strict + noUncheckedIndexedAccess) | Simplest | ✓ |
| + exactOptionalPropertyTypes + noImplicitOverride | More subtle bugs caught | |
| + noPropertyAccessFromIndexSignature too | Strictest reasonable | |

### Q-07 — Path aliases in tsconfig
| Option | Description | Selected |
|---|---|---|
| Single alias `@/*` → `src/*` | Next.js default | |
| Per-root aliases `@contexts/*` + `@shared/*` | Highlights architectural split | ✓ |
| Both | Flexible | |

### Q-08 — Barrel files per context
| Option | Description | Selected |
|---|---|---|
| No barrels — direct imports | Safest, best tree-shaking | ✓ |
| Barrel at context root only | Thin public API per context | |
| Barrels at every layer | Most ergonomic imports | |

---

## Folder Structure & Error Registry

### Q-09 — Bounded-context scaffold depth at Phase 1
| Option | Description | Selected |
|---|---|---|
| Empty folders with .gitkeep only | Just the shape | ✓ |
| Folders + README.md per context | Onboarding doc | |
| Folders + README + layer-marker stub files | Strongest guardrail | |

### Q-10 — Error-code registry shape
| Option | Description | Selected |
|---|---|---|
| TypeScript `enum` | Familiar, has footguns | |
| `as const` object + string-literal union | Tree-shakeable, ESM-friendly | ✓ |
| Discriminated union per code | Richest typing, verbose | |

### Q-11 — Error response body shape
| Option | Description | Selected |
|---|---|---|
| `{ error: { code, message, details? } }` | Nested | ✓ |
| `{ code, message, details? }` | Flat | |
| RFC 7807 problem+json | Standards-based | |

### Q-12 — Location of the error-code registry
| Option | Description | Selected |
|---|---|---|
| `src/shared/errors/{registry.ts, response.ts}` | Own module | |
| `src/shared/config/errors.ts` | Co-located with config | ✓ |
| `src/shared/telemetry/errors.ts` | Bundled with Sentry config | |

---

## PWA & Internationalization

### Q-13 — Serwist setup depth at Phase 1
| Option | Description | Selected |
|---|---|---|
| Skeleton — registered SW, no precache | Least churn for Phase 3 | ✓ |
| Basic — fallback /offline route | Minimal offline | |
| Full runtime caching rules ready | Risk of premature decisions | |

### Q-14 — Web app manifest at Phase 1
| Option | Description | Selected |
|---|---|---|
| Minimal placeholder (name, display, theme_color) | Smallest footprint | ✓ |
| Full structure, placeholder assets | Less churn | |
| No manifest at Phase 1 | Defer entirely | |

### Q-15 — next-intl routing strategy
| Option | Description | Selected |
|---|---|---|
| No locale prefix (single-locale) | Cleanest URLs, v2 migration cost | |
| `as-needed` prefix (default locale hidden) | Clean + no migration | ✓ |
| Always prefix (`/pt-BR/...`) | Most explicit, uglier now | |

---

## Local Supabase Dev Environment

### Q-16 — Supabase CLI version pinning
| Option | Description | Selected |
|---|---|---|
| Pin via `supabase/config.toml` + README install cmd | Manual install step | |
| npm devDependency (`supabase` package) | Locked in lockfile | ✓ |
| No pin | Fragile | |

### Q-17 — DB seed convention at Phase 1
| Option | Description | Selected |
|---|---|---|
| Empty `supabase/seed.sql` stub | Phase 2 fills | |
| Per-context seed files | Forward-looking structure | |
| No seed file at Phase 1 | Defer entirely | ✓ |

### Q-18 — How the app reads local Supabase URLs
| Option | Description | Selected |
|---|---|---|
| Manual — README copy from `supabase status` | Fragile | |
| Automated script `scripts/sync-supabase-env.sh` | Reproducible | ✓ |
| `supabase gen` CLI-native flow | Depends on CLI features | |

---

## Observability — Sentry + PostHog

### Q-19 — Local-dev Sentry strategy
| Option | Description | Selected |
|---|---|---|
| Disabled locally; CI-only verification | Matches PRD §20 strictly | ✓ |
| Enabled locally in `folhario-dev` project | Eyeball-friendly | |
| Opt-in via `SENTRY_ENABLED_LOCAL=true` | Best of both | |

### Q-20 — Local-dev PostHog strategy
| Option | Description | Selected |
|---|---|---|
| Disabled locally; CI-only verification | Mirrors Q-19a | ✓ |
| Enabled locally in `folhario-dev` | Instant feedback | |
| Opt-in via `POSTHOG_ENABLED_LOCAL=true` | Flag-gated | |

### Q-21 — PostHog autocapture setting
| Option | Description | Selected |
|---|---|---|
| Disable autocapture — explicit events only | Smallest payload, safest LGPD | ✓ |
| Enable autocapture with strict masking | Click graph without content | |
| Enable autocapture default | Highest LGPD risk | |

### Q-22 — Sentry PII scrubbing implementation
| Option | Description | Selected |
|---|---|---|
| SDK built-ins + minimal `beforeSend` | Simplest | ✓ |
| Centralized custom scrubber module | Unit-testable | |
| Server-side data scrubbing (dashboard config) | Not code-reviewable | |

---

## Security Headers Middleware

### Q-23 — CSP strategy at Phase 1
| Option | Description | Selected |
|---|---|---|
| Strict CSP with per-request nonce | Highest security, highest complexity | |
| Report-only CSP with loose policy | Collect violations, tighten later | |
| Skip CSP at Phase 1 | Defer | ✓ |

**Notes:** "CSP is a bitch! defer to as late as possible"

### Q-24 — Header set at Phase 1
| Option | Description | Selected |
|---|---|---|
| Minimum — HSTS + XFO + nosniff | Ship quickly | ✓ |
| Full set + Referrer-Policy + Permissions-Policy | Best practice | |
| Full set + CSP | Most defense-in-depth | |

**Notes:** "defer this to the very end if possible" → expanded header set deferred to hardening pass

---

## CI Pipeline Design

### Q-25 — Postgres image for integration tests
| Option | Description | Selected |
|---|---|---|
| postgres:17-alpine (match ROADMAP SC3) | Current stable, matches local Supabase | ✓ |
| postgres:16-alpine (match INFRA-12 + PRD) | Matches existing spec wording | |
| Match local Supabase exactly (15) | Per older CLI versions | |

**Notes:** "local supabase uses postgres 17 too. make sure to lock the version locally. also make sure to only enable the needed features." → Doc fix required: INFRA-12 bumps to `postgres:17-alpine`.

### Q-26 — Playwright browsers in CI smoke
| Option | Description | Selected |
|---|---|---|
| Chromium only | Fastest, covers most traffic | ✓ |
| Chromium + WebKit | Catches iOS issues | |
| All three | Most thorough, more flake | |

### Q-27 — What does the Phase 1 Playwright smoke actually assert?
| Option | Description | Selected |
|---|---|---|
| Dedicated `/__diag` + `/api/v1/_diagnostics/ping` | Testable, clean separation | ✓ (Claude's Discretion) |
| Home page + dev-only hidden button | Avoids permanent diag routes | |
| Network-interception only | Tests the mock, not the integration | |

**Notes:** "I don't know, you figure it out" → Claude chose option (a) as most testable + aligned with D-19/D-20 CI-only posture. Routes gated to CI/preview only.

### Q-28 — CI caching + concurrency
| Option | Description | Selected |
|---|---|---|
| pnpm + Playwright caches only | Standard | |
| Caches + concurrency group per PR | Cancels superseded runs | ✓ |
| Minimal caching; no concurrency | Slower CI | |

---

## Env Management

### Q-29 — Typed env validation
| Option | Description | Selected |
|---|---|---|
| @t3-oss/env-nextjs + Zod | Typed, validated, extra dep | |
| Custom `src/shared/config/env.ts` with Zod | No extra dep, full control | ✓ |
| Raw `process.env` with runtime assertions | Fragile | |

### Q-30 — .env.example scope at Phase 1
| Option | Description | Selected |
|---|---|---|
| All PRD §20 vars with dummy values | Forward-looking | ✓ |
| Only Phase 1 vars | Matches wired services | |
| No .env.example; README documents | Less expressive | |

---

## Claude's Discretion Items

- **Q-27** (Playwright smoke design) — user explicitly delegated. Claude selected dedicated diagnostics routes (Option a).
- Node 22 exact patch version
- pnpm exact version in `packageManager` field
- Exact `package.json` scripts
- Zod schemas in `src/shared/config/env.ts`
- commitlint config (default `@commitlint/config-conventional`, no custom rules)

## Deferred Ideas (moved to CONTEXT.md `<deferred>` section)

- CSP (user directive)
- Expanded security headers (`Referrer-Policy`, `Permissions-Policy`)
- Playwright WebKit + Firefox
- Full PWA manifest with Paper Cream icons (Phase 3)
- Offline shell + precache + app-update toast (Phase 3)
- Inngest / Resend / Stripe onboarding (Phases 4, 10)
- Drizzle schema, migrations, adapters (Phase 2)
- Vercel + deploy pipeline + Supabase branch DBs (Phase 12)
- Sentry source-map upload (config now, upload in Phase 12 deploy workflow)
- Explicit `Sentry.setUser({ id })` wiring (Phase 4 when auth lands)
