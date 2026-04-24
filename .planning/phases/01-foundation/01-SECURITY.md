---
phase: 01
slug: foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-24
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Developer laptop -> committed repo | Secrets must not cross this boundary | Secrets |
| CI environment -> dependency registry | Lockfile integrity prevents supply-chain drift | Dependencies |
| Upstream eslint-config-next API -> local config | Verified via create-next-app output spike | Build Configuration |
| Route handlers -> clients | Internal error codes must redact to `provider_unavailable` | Internal State |
| Boot process -> runtime | Env vars must pass schema before any downstream code runs | Environment Variables |
| Server code -> client bundle | `client-env.ts` must never pull server-only parsing into the browser | Environment Variables |
| `.env.example` -> git history | File cannot leak real secrets | Secrets |
| Browser -> page response | Security headers mitigate client-side attacks | User Data |
| Service worker scope -> browser | SW must not register across origins | Service Worker |
| Diagnostics routes -> production web | Multi-layer refusal (env guard + robots.txt) | Diagnostics |
| API routes / static assets -> headers | next.config.ts headers() with source '/(.*)' covers these | HTTP Traffic |
| Docker host -> container network | Ports 54321/54322/54323 exposed on localhost only | Database / Local Traffic |
| Script -> `.env` file | Must never overwrite production credentials | Secrets |
| Integration test -> cloud Supabase | MUST refuse `supabase.co` hostnames | Database Traffic |
| App runtime -> Sentry ingest | All user data in events crosses here; scrub rules are the last defense | User Data / PII |
| Sentry breadcrumbs | Automatic trail — must not accumulate PII | PII |
| User identity -> Sentry context | Only `id` allowed; email/username/ip never leave | User Identity |
| Sentry SDK init -> runtime | `sendDefaultPii: false` prevents CVE-2025-65944-class header leaks | Headers / PII |
| Empty DSN -> transport disabled | Must be a hard gate, not best-effort | Telemetry |
| `src/instrumentation.ts` imports | Must not swallow real init errors | Telemetry Initialization |
| Browser -> PostHog US cloud | International transfer (LGPD Art. 33) | Analytics / Usage Data |
| Server runtime -> PostHog US cloud | Inngest events + diagnostics | Server Events |
| Client bundle -> env parsing | MUST NOT include server-env parsing | Environment Variables |
| Production environment -> diagnostics routes | MUST refuse (serve 404) to minimize attack surface | Diagnostics |
| CI environment -> Sentry / PostHog | MUST succeed (events required for OBS-01/02 verification) | Telemetry |
| Search-engine crawler -> `/__diag` | robots.txt Disallow + env guard both apply | Crawler Traffic |
| Vitest server-probe -> mocked SDKs | Pure function call; no network I/O | Mocked Test Traffic |
| CI runner -> Postgres service container | Service-container credentials are ephemeral per job | CI Credentials |
| CI runner -> Sentry/PostHog ingest | Secrets live in GitHub repo secrets, never in source | Telemetry |
| Build artifact -> Playwright report | Report uploaded as actions/upload-artifact | CI Reports |
| Planning docs -> scope truthfulness | REQUIREMENTS.md + ROADMAP.md edits must reflect the shipped reality | Planning Documents |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | `.env` / `.env.example` | mitigate | `.gitignore` | closed |
| T-01-02 | Tampering | `pnpm-lock.yaml` | mitigate | CI lockfile checks | closed |
| T-01-03 | Repudiation | Git commit history | mitigate | Husky `commit-msg` | closed |
| T-01-04 | Denial of Service | Node version mismatch | mitigate | `.nvmrc` and CI config | closed |
| T-01-05 | Tampering | `eslint-config-next@16` API | mitigate | Validation spike | closed |
| T-02-01 | Information Disclosure | Error handling | mitigate | `errorResponse` redaction | closed |
| T-02-02 | Tampering | Env variables | mitigate | Zod schema parsing | closed |
| T-02-03 | Information Disclosure | `.env.example` | mitigate | Example sanitization test | closed |
| T-02-04 | Information Disclosure | Client bundle env | mitigate | Split module architecture | closed |
| T-02-05 | Information Disclosure | `error.details` | accept-delegated | Route handlers assume responsibility | closed |
| T-03-01 | Tampering / Spoofing | Security headers | mitigate | `next.config.ts` | closed |
| T-03-02 | Tampering | Service worker | mitigate | Scope and dev mode constraints | closed |
| T-03-03 | Information Disclosure | Locale prefix | mitigate | Proxy exclusion | closed |
| T-03-04 | Information Disclosure | `/__diag` route | mitigate | `robots.txt` disallow | closed |
| T-03-05 | Tampering | Proxy security logic | mitigate | Acceptance criteria grep | closed |
| T-04-01 | Information Disclosure | `sync-supabase-env.sh` | mitigate | Targeting `.env.local` | closed |
| T-04-02 | Denial of Service | Docker sync | mitigate | Guarded entry via `docker info` | closed |
| T-04-03 | Spoofing | Postgres version | mitigate | `config.toml` pinning | closed |
| T-04-04 | Tampering | Cloud Supabase DB URL | mitigate | Integration test throw | closed |
| T-04-05 | Dependency churn | `postgres` | mitigate | Shipped in `dependencies` | closed |
| T-05a-01 | Information Disclosure | Sentry SDK | mitigate | `sentry-scrub.ts` and set lookup | closed |
| T-05a-02 | Tampering | Sentry paths | mitigate | Regex constraints on paths | closed |
| T-05a-03 | Information Disclosure | Sentry cases | mitigate | `isScrubKey` lowercase processing | closed |
| T-05b-01 | Information Disclosure | Sentry headers | mitigate | `sendDefaultPii: false` | closed |
| T-05b-02 | Information Disclosure | Sentry release tag | accept | Deployed with `$GITHUB_SHA` | closed |
| T-05b-03 | Denial of Service | Sentry outages | mitigate | Empty DSN gating | closed |
| T-05b-04 | Tampering | Sentry init errors | mitigate | Removing try/catch block | closed |
| T-05b-05 | Tampering | Sentry envelopes | accept-delegated | Server-side boundaries | closed |
| T-06-01 | Information Disclosure | PostHog defaults | mitigate | `autocapture: false` & profiles config | closed |
| T-06-02 | Information Disclosure | PostHog cross-border | accept-delegated | Privacy policy updates via LGPD | closed |
| T-06-03 | Information Disclosure | PostHog pre-1.0 | mitigate | Exclusion of `@posthog/next` | closed |
| T-06-04 | Denial of Service | PostHog outages | mitigate | Client init via `useEffect` | closed |
| T-06-05 | Information Disclosure | PostHog env bundles | mitigate | `posthog-*.ts` constraints | closed |
| T-07-01 | Information Disclosure | Production routes | mitigate | Multi-layer 404 guards | closed |
| T-07-02 | Information Disclosure | CSRF diagnostics | accept | Non-issue in stub mode / deferred | closed |
| T-07-03 | Denial of Service | WebServer CI | mitigate | Root probe mitigation | closed |
| T-07-04 | Tampering | Sentry/PostHog SDKs | mitigate | CI validation assertions | closed |
| T-07-05 | Tampering | Local Sentry | mitigate | Testing config for empty DSNs | closed |
| T-08-01 | Information Disclosure | CI Build logs | mitigate | GH Actions auto redaction | closed |
| T-08-02 | Tampering | CI dependencies | mitigate | Frozen lockfile | closed |
| T-08-03 | Denial of Service | Runaway CI tests | mitigate | Timeouts via CI | closed |
| T-08-04 | Repudiation | Source map tokens | mitigate | Exclusion from CI | closed |
| T-08-05 | Elevation of Privilege | GH Actions | mitigate | Pull requests trigger limitation | closed |
| T-08-06 | Repudiation | Docs divergence | mitigate | Consistency assertions | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-05 | Route handlers MUST NOT pass raw error objects into `details`; responsibility is at the callsite. | gsd-security-auditor | 2026-04-24 |
| AR-02 | T-05b-02 | Sentry release tag leaking branch/PR names: Git SHA is public info for public repos. | gsd-security-auditor | 2026-04-24 |
| AR-03 | T-05b-05 | Forged Sentry envelope bypassing scrub: Sentry-side auth uses NEXT_PUBLIC_SENTRY_DSN (project-scoped). Abuse mitigated by Sentry server-side rate limits. | gsd-security-auditor | 2026-04-24 |
| AR-04 | T-06-02 | International transfer to PostHog US without LGPD basis: LGPD Art. 33 basis via PostHog SCCs is published in privacy policy (launch blocker). | gsd-security-auditor | 2026-04-24 |
| AR-05 | T-07-02 | Diagnostics POST endpoint exposed without CSRF protection: Phase 1 has no cross-origin cookie surface; CSRF lands Phase 4 with JWT. Diagnostics routes are stub-mode-only. | gsd-security-auditor | 2026-04-24 |

*Accepted risks do not resurface in future audit runs.*

*If none: "No accepted risks."*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-24 | 44 | 44 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-24