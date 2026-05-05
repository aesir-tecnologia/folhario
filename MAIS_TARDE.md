# MAIS_TARDE — DEPLOY.md audit + Supabase cloud setup script

Resume context for the deploy-pipeline work-in-progress. Nothing committed.

---

## What the session covered

1. Reviewed `DEPLOY.md` Section 3 (Supabase cloud projects).
2. Audited the entire `DEPLOY.md` against `.github/workflows/ci.yml`, `package.json`, `CLAUDE.md`, and `src/shared/config/server-env.ts`.
3. Applied a large set of inline fixes to `DEPLOY.md`.
4. Designed and built an interactive Section-3 setup script.

---

## Files changed (uncommitted)

- `DEPLOY.md` — extensive rewrite of Sections 1, 2, 3, 4, the secrets inventory, the first-time-setup checklist, the setup instructions, the rollback section, and the notes block. See "DEPLOY.md fixes applied" below.
- `scripts/setup-supabase-cloud.ts` — new file (~400 lines). Interactive driver for Section 3.
- `package.json:30` — added `"db:setup-cloud": "tsx --env-file-if-exists=.env.local scripts/setup-supabase-cloud.ts"`.

---

## DEPLOY.md fixes applied (audit findings)

Severity tags use my session shorthand. Each was applied inline.

**Critical / pipeline-blocking**

- **C1 / H4** — `deploy-preview.yml` trigger reframed to `branches-ignore: [main]` + job-level `if` guard requiring `event.workflow_run.event == 'pull_request'` and a non-empty `pull_requests[0]`. Concurrency group renamed to `deploy-preview-pr-…` to avoid the empty-interpolation collision. (`DEPLOY.md:41-58`)
- **C2** — Same guard handles fork PRs and the `push` to `main` CI run, which would otherwise fire the preview workflow with no PR number.
- **C3** — Both preview and production deploys now capture the deployment URL into `$GITHUB_OUTPUT` instead of hand-waving "capture the returned URL." (`DEPLOY.md:73-80`, `:104-110`)
- **C4 / M4** — Production smoke and Inngest sync now hit `${{ steps.deploy.outputs.url }}` (the deployment URL), not a hardcoded `folhario.vercel.app`. Added a checklist item to claim the production alias. (`DEPLOY.md:112`, `:131`, `:151`)
- **C5 / M7 / M8** — Sentry source-map upload corrected to `.vercel/output` with `--url-prefix '~/_next'`; org/project passed via `env:`; Sentry release step gated on `if: success()`. Flagged that the exact source-map subpath under `.vercel/output` may need verification depending on Turbopack config. (`DEPLOY.md:114-128`)
- **C6 / C7** — Removed the "vercel pull injects env" misconception throughout. Preview workflow now explicitly sources `.vercel/.env.preview.local` after `vercel pull` so `pnpm db:setup` can see `DATABASE_URL`. Production note clarifies build-only consumption. (`DEPLOY.md:60-72`, `:99-100`)

**High**

- **H1** — Added a caveat that `test:e2e:smoke` (the four specs `security-headers pwa-smoke legal-links horizontal-scroll-guard`) was written for the local Postgres+stub setup; running them against a real preview/production Supabase project hasn't been validated. Same caveat repeated for prod. (`DEPLOY.md:88`, `:113`)
- **H2** — Preview `RESEND_API_KEY` set to `ci-build-placeholder` instead of "leave blank" because `serverEnv` validates it under `NODE_ENV=production` even on preview deploys.
- **H3** — Production migration step now exports both `DATABASE_URL` and `DATABASE_POOL_URL` (both = direct URL from `PROD_DATABASE_DIRECT_URL`) to satisfy `serverEnv` import-time validation.
- **H5** — Cleanup uses `vercel list --json | jq -r '.[].url'` instead of regex parsing.
- **H6** — `vercel promote` syntax corrected: `--token`, optional `--scope <team-slug>`. Note added that the deployment must be in the production target.

**Medium / low**

- M1–M3 — Section 3 explains pooler-vs-direct mapping, bootstrap sets both `DATABASE_URL` and `DATABASE_POOL_URL` to the direct URL, service-role key flagged server-only, `?pgbouncer=true` moved into Section 3.
- M5 — `environment: production` framed as a job-level gate, not a step.
- M6 — `pnpm dlx vercel@latest` instead of `pnpm add -g vercel`. Vercel login step added.
- L1 — `gh secret set` uses `printf '%s' "<value>" | gh secret set NAME` everywhere.
- L3 — Rollback explicitly states Drizzle has no auto-generated down-migrations; every destructive migration must ship a hand-written paired down migration.
- L4 — "Free plan allows 2 projects" softened to "verify before assuming."
- L5 — Concurrency note clarified for CI vs deploy-preview.

**Still open**

- Phase-number references at `DEPLOY.md:281` and `:295` ("Phase 1", "Phase 4", "Phase 12") were left in place. Marco may want to scrub or link to ROADMAP.md.

---

## Interactive script — `scripts/setup-supabase-cloud.ts`

### Plan file

`/Users/machado/.claude/plans/create-an-interactive-script-radiant-zebra.md` — full design doc with verification steps. Approved via plan mode.

### Decisions confirmed in session

- **Language:** TypeScript via `tsx` (matches `scripts/migrate.ts` style).
- **Apply mode:** Print first, then prompt before pushing to Vercel/GH (default no — explicit yes pushes).
- **Bootstrap:** Prompt to run `pnpm db:setup` against each project (default yes).

### Behavior

1. Preflight: asserts `./node_modules/.bin/supabase`, `vercel`, `gh`, `psql` (unless `--skip-verify`), `.vercel/project.json`, `gh auth status`, and an active Supabase login (probed via `supabase projects list`).
2. Discovers Supabase projects, renders a numbered table, prompts for which is production / preview (or accepts `--prod-ref=<ref>` / `--preview-ref=<ref>`).
3. Reads DB passwords with raw-mode echo suppression. Never logged, never persisted to disk.
4. Fetches anon + service-role keys via `supabase projects api-keys`.
5. Constructs deterministic URLs:
   - pooler: `postgres://postgres.<ref>:<encoded-pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - direct: `postgres://postgres:<encoded-pw>@db.<ref>.supabase.co:5432/postgres`
6. Verifies each with `psql` (using `PGPASSWORD` env, not URL-embedded password, to avoid `ps` leakage). On failure, prompts to paste the URL from the Supabase dashboard as a fallback.
7. Prints a masked summary table and writes `.vercel/cloud-setup-summary.md` (gitignored — `.vercel` is in `.gitignore:47`).
8. Prompts to push these env vars to Vercel preview + production (default no):
   - `DATABASE_URL`, `DATABASE_POOL_URL` → pooler URL
   - `NEXT_PUBLIC_SUPABASE_URL` → `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
     Each push runs `vercel env ls` to detect existing values and `vercel env rm --yes` first if present (since `vercel env add` errors on existing keys).
9. Prompts to push `PROD_DATABASE_DIRECT_URL` to GH Actions (default no). Repo slug auto-detected from `git config --get remote.origin.url`.
10. Prompts to run `pnpm db:setup` against production then preview (default yes). Spawns with `DATABASE_URL` and `DATABASE_POOL_URL` both set to the project's direct URL (because `serverEnv` validates both at import time).
11. Prints a final ✓/✗ checklist.

### Flags

- `--dry-run` — collect inputs, print summary, never push or bootstrap.
- `--skip-bootstrap` — skip the `pnpm db:setup` prompts.
- `--skip-verify` — skip psql probes (allows running without postgres client installed).
- `--prod-ref=<ref>` / `--preview-ref=<ref>` — skip the picker.
- `--help` / `-h`.

### Important implementation notes

- Does NOT import `serverEnv` (which is the project-wide pattern) — that schema parses `process.env` at import time and would fail before the script can do its work. Inlined a tiny `z.url()` validator instead.
- `VERCEL_TOKEN` is read from env (loaded via `tsx --env-file-if-exists=.env.local`). If missing, the script prompts and offers to append to `.env.local`.
- Idempotent: re-running with same answers is a no-op (Vercel rm-then-add overwrites; Drizzle migrations are idempotent).

### Verification done in session

- `rtk pnpm typecheck` — clean (after switching deprecated `z.string().url()` → `z.url()` for zod 4.3.6).
- `rtk pnpm lint` — clean (only an unrelated existing warning in `add-plant-form.tsx:286`).
- `pnpm db:setup-cloud --help` — prints usage.
- `pnpm db:setup-cloud --bogus` — exits 1 with `unknown flag: --bogus`.

### Verification NOT yet done — for next session

- Real `--dry-run` against the actual Supabase account. **This is the next thing to run.** Marco said both projects are already created.
- Confirm `supabase projects list --output json` returns the schema the script expects (`{id, name, organization_id, region, created_at}`). If the field is named `ref` instead of `id` in CLI 2.95, the Zod parse will fail with a useful message.
- Confirm `supabase projects api-keys --output json` returns `[{name, api_key}]` with `anon` and `service_role` entries.
- Confirm the deterministic pooler hostname `aws-0-<region>.pooler.supabase.com` resolves for both projects. If not, the script will fall back to manual URL paste — which works but defeats some automation. If a different format is needed, update `constructUrls()` in `scripts/setup-supabase-cloud.ts:233-241`.
- Once a real run succeeds end-to-end, decide whether to tighten the Vercel `vercel env ls` regex (currently `^\s*${key}\b` against the human-readable table — Vercel CLI output format may need adjustment).

---

## Resume checklist

When picking up the work:

1. **Inspect uncommitted state:** `rtk git status` then `rtk git diff` to see all four file changes.
2. **Decide on commits:** Marco uses logical-commits style. Suggested split:
   - Commit 1: `DEPLOY.md` audit fixes (Sections 1, 2, secrets, rollback, notes — everything except Section 3).
   - Commit 2: `scripts/setup-supabase-cloud.ts` + `package.json` script entry + `DEPLOY.md` Section 3 rewrite.
3. **First real test:**
   ```bash
   pnpm db:setup-cloud --dry-run
   ```
   Pick prod + preview from the list, paste passwords, watch for psql verify success. Confirm the masked summary looks right.
4. **If dry-run is good:** drop `--dry-run` and accept all prompts to push to Vercel + GH and bootstrap both projects.
5. **If `supabase projects list --output json` schema mismatches:** update `projectSchema` at `scripts/setup-supabase-cloud.ts:118-124`. Likely candidate: the field might be called `ref` instead of `id` — change all references.
6. **If pooler URL doesn't resolve via psql:** the script will prompt you to paste the URL from Supabase dashboard (Settings → Database → Transaction pooler). Paste it including `?pgbouncer=true`. The fallback path is implemented.
7. **After a successful real run:** verify in Vercel dashboard (Settings → Environment Variables) that all 5 vars are set for both Preview and Production scopes, and `gh secret list --repo aesir-tecnologia/folhario` includes `PROD_DATABASE_DIRECT_URL`.

---

## Key file paths (clickable)

- `DEPLOY.md` — pipeline doc (heavily edited).
- `scripts/setup-supabase-cloud.ts` — new interactive script.
- `package.json:30` — `db:setup-cloud` script entry.
- `scripts/migrate.ts` — pattern reference (style, exit codes, tsx invocation).
- `scripts/sync-supabase-env.sh` — bash precedent for shelling out to Supabase CLI.
- `src/shared/config/server-env.ts` — Zod schema; intentionally NOT imported by the new script.
- `src/shared/db/migration-client.ts` — what `pnpm db:setup` ultimately uses; reads `serverEnv.DATABASE_URL`.
- `.github/workflows/ci.yml` — for cross-referencing what env vars the deploy workflows need to mirror.
- `.gitignore:47` — confirms `.vercel/` is ignored (where the script writes its summary).
- `.claude/plans/create-an-interactive-script-radiant-zebra.md` — approved design doc.
