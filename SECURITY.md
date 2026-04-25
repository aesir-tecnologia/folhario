## SECURED

**Phase:** 1 — Foundation
**Threats Closed:** 44/44
**ASVS Level:** 1

### Threat Verification

| Threat ID | Category               | Disposition      | Evidence                                                                                    |
| --------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| T-01-01   | Information Disclosure | mitigate         | `.gitignore`, `.env.example`                                                                |
| T-01-02   | Tampering              | mitigate         | `.github/workflows/ci.yml`, `package.json`                                                  |
| T-01-03   | Repudiation            | mitigate         | `.husky/commit-msg`                                                                         |
| T-01-04   | Denial of Service      | mitigate         | `.nvmrc`, `.github/workflows/ci.yml`                                                        |
| T-01-05   | Tampering              | mitigate         | `eslint.config.mjs` line 1                                                                  |
| T-02-01   | Information Disclosure | mitigate         | `src/shared/config/errors.ts`                                                               |
| T-02-02   | Tampering              | mitigate         | `src/shared/config/server-env.ts`, `src/shared/config/client-env.ts`                        |
| T-02-03   | Information Disclosure | mitigate         | `.env.example`                                                                              |
| T-02-04   | Information Disclosure | mitigate         | `src/shared/config/client-env.ts`                                                           |
| T-02-05   | Information Disclosure | accept-delegated | Documented in `SECURITY.md`                                                                 |
| T-03-01   | Tampering / Spoofing   | mitigate         | `next.config.ts`                                                                            |
| T-03-02   | Tampering              | mitigate         | `next.config.ts`                                                                            |
| T-03-03   | Information Disclosure | mitigate         | `src/proxy.ts`                                                                              |
| T-03-04   | Information Disclosure | mitigate         | `public/robots.txt`                                                                         |
| T-03-05   | Tampering              | mitigate         | `src/proxy.ts`                                                                              |
| T-04-01   | Information Disclosure | mitigate         | `scripts/sync-supabase-env.sh`                                                              |
| T-04-02   | Denial of Service      | mitigate         | `scripts/sync-supabase-env.sh`                                                              |
| T-04-03   | Spoofing               | mitigate         | `supabase/config.toml`                                                                      |
| T-04-04   | Tampering              | mitigate         | `tests/integration/postgres-connection.integration.test.ts`                                 |
| T-04-05   | Dependency churn       | mitigate         | `package.json`                                                                              |
| T-05a-01  | Information Disclosure | mitigate         | `src/shared/telemetry/sentry-scrub.ts`                                                      |
| T-05a-02  | Tampering              | mitigate         | `src/shared/telemetry/sentry-scrub.ts`                                                      |
| T-05a-03  | Information Disclosure | mitigate         | `src/shared/telemetry/sentry-scrub.ts`                                                      |
| T-05b-01  | Information Disclosure | mitigate         | `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts` |
| T-05b-02  | Information Disclosure | accept           | Documented in `SECURITY.md`                                                                 |
| T-05b-03  | Denial of Service      | mitigate         | `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts` |
| T-05b-04  | Tampering              | mitigate         | `src/instrumentation.ts`                                                                    |
| T-05b-05  | Tampering              | accept-delegated | Documented in `SECURITY.md`                                                                 |
| T-06-01   | Information Disclosure | mitigate         | `src/shared/telemetry/posthog-client.ts`                                                    |
| T-06-02   | Information Disclosure | accept-delegated | Documented in `SECURITY.md`                                                                 |
| T-06-03   | Information Disclosure | mitigate         | `package.json`                                                                              |
| T-06-04   | Denial of Service      | mitigate         | `src/shared/telemetry/posthog-client.ts`                                                    |
| T-06-05   | Information Disclosure | mitigate         | `src/shared/telemetry/posthog-client.ts`, `src/shared/telemetry/posthog-server.ts`          |
| T-07-01   | Information Disclosure | mitigate         | `src/app/diag/layout.tsx`, `src/app/api/v1/diagnostics/ping/route.ts`                       |
| T-07-02   | Information Disclosure | accept           | Documented in `SECURITY.md`                                                                 |
| T-07-03   | Denial of Service      | mitigate         | `src/app/page.tsx`                                                                          |
| T-07-04   | Tampering              | mitigate         | `tests/integration/diagnostics-server-probe.integration.test.ts`                            |
| T-07-05   | Tampering              | mitigate         | `tests/e2e/sentry-local-mode.spec.ts`                                                       |
| T-08-01   | Information Disclosure | mitigate         | `.github/workflows/ci.yml`                                                                  |
| T-08-02   | Tampering              | mitigate         | `.github/workflows/ci.yml`                                                                  |
| T-08-03   | Denial of Service      | mitigate         | `.github/workflows/ci.yml`                                                                  |
| T-08-04   | Repudiation            | mitigate         | `.github/workflows/ci.yml`                                                                  |
| T-08-05   | Elevation of Privilege | mitigate         | `.github/workflows/ci.yml`                                                                  |
| T-08-06   | Repudiation            | mitigate         | `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`                                         |

### Unregistered Flags

none

SECURITY.md: /Users/machado/Projects/folhario/SECURITY.md
