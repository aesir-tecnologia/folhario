#!/usr/bin/env tsx
/**
 * Interactive setup for DEPLOY.md Section 3 — Supabase cloud projects.
 *
 * Discovers the user's prod + preview Supabase projects via `supabase projects list`,
 * collects DB passwords, fetches API keys, constructs Supavisor pooler + direct
 * connection strings, verifies connectivity with psql, and (with explicit consent)
 * pushes env vars to Vercel and the production direct URL to GitHub Actions
 * secrets, then runs `pnpm db:setup` against each project.
 *
 * Design: .planning/plans/create-an-interactive-script.md
 */

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { promisify } from "node:util";
import { z } from "zod";

const execFileP = promisify(execFile);
const SUPABASE_BIN = "./node_modules/.bin/supabase";
const SCRIPT = "setup-supabase-cloud";
const SUMMARY_FILE = path.join(".vercel", "cloud-setup-summary.md");

const log = {
  info: (m: string) => console.log(`[${SCRIPT}] ${m}`),
  warn: (m: string) => console.warn(`[${SCRIPT}] ${m}`),
  error: (m: string) => console.error(`[${SCRIPT}] ${m}`),
  raw: (m: string) => console.log(m),
};

function fail(msg: string, code = 2): never {
  log.error(msg);
  process.exit(code);
}

// ── Flags ────────────────────────────────────────────────────────────────

type Flags = {
  dryRun: boolean;
  skipBootstrap: boolean;
  skipVerify: boolean;
  prodRef?: string;
  previewRef?: string;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, skipBootstrap: false, skipVerify: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--skip-bootstrap") flags.skipBootstrap = true;
    else if (arg === "--skip-verify") flags.skipVerify = true;
    else if (arg.startsWith("--prod-ref=")) flags.prodRef = arg.slice("--prod-ref=".length);
    else if (arg.startsWith("--preview-ref="))
      flags.previewRef = arg.slice("--preview-ref=".length);
    else fail(`unknown flag: ${arg}`, 1);
  }
  return flags;
}

function printUsage(): void {
  log.raw(`usage: pnpm db:setup-cloud [flags]

flags:
  --dry-run               collect inputs, print summary, never push or bootstrap
  --skip-bootstrap        skip the pnpm db:setup prompts
  --skip-verify           skip psql connectivity probes
  --prod-ref=<ref>        skip the production picker (use this Supabase project ref)
  --preview-ref=<ref>     skip the preview picker (use this Supabase project ref)
  --help, -h              show this message
`);
}

// ── Preflight ────────────────────────────────────────────────────────────

async function which(cmd: string): Promise<boolean> {
  try {
    await execFileP("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

async function preflight(flags: Flags): Promise<void> {
  if (!existsSync(SUPABASE_BIN)) fail(`${SUPABASE_BIN} missing — run \`pnpm install\` first.`);
  if (!existsSync(".vercel/project.json"))
    fail(".vercel/project.json missing — run `pnpm dlx vercel@latest link` first.");
  if (!(await which("vercel")))
    fail("vercel CLI not on PATH. Install: `pnpm add -g vercel` or use `pnpm dlx vercel@latest`.");
  if (!(await which("gh"))) fail("gh CLI not on PATH. Install: https://cli.github.com/");
  if (!flags.skipVerify && !(await which("psql")))
    fail(
      "psql not on PATH. Install postgres client (e.g. `brew install libpq`) or pass --skip-verify.",
    );

  try {
    await execFileP("gh", ["auth", "status"]);
  } catch {
    fail("gh CLI not authenticated. Run `gh auth login` first.");
  }
  try {
    await execFileP(SUPABASE_BIN, ["projects", "list", "--output", "json"]);
  } catch (err) {
    fail(
      `supabase login required — run \`${SUPABASE_BIN} login\` first.\n` +
        `(${(err as Error).message.split("\n")[0]})`,
    );
  }
}

// ── Project discovery ────────────────────────────────────────────────────

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization_id: z.string(),
  region: z.string(),
  created_at: z.string().optional(),
});
type SupabaseProject = z.infer<typeof projectSchema>;

async function listSupabaseProjects(): Promise<SupabaseProject[]> {
  const { stdout } = await execFileP(SUPABASE_BIN, ["projects", "list", "--output", "json"]);
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) fail("supabase projects list returned unexpected shape");
  return parsed.map((p: unknown) => projectSchema.parse(p));
}

async function pickProjects(
  projects: SupabaseProject[],
  flags: Flags,
): Promise<{ production: SupabaseProject; preview: SupabaseProject }> {
  if (projects.length < 2) fail(`need at least 2 Supabase projects, found ${projects.length}`);

  const findOrFail = (ref: string, label: string) => {
    const p = projects.find((x) => x.id === ref);
    if (!p) fail(`--${label}-ref=${ref} not found in supabase projects list`);
    return p;
  };

  let production = flags.prodRef ? findOrFail(flags.prodRef, "prod") : undefined;
  let preview = flags.previewRef ? findOrFail(flags.previewRef, "preview") : undefined;

  if (!production || !preview) {
    log.info("Supabase projects in your account:");
    projects.forEach((p, i) => log.raw(`  [${i + 1}] ${p.name}  ref=${p.id}  region=${p.region}`));
  }

  if (!production) {
    const idx = await readNumber(
      `Which project is PRODUCTION? [1-${projects.length}]: `,
      1,
      projects.length,
    );
    production = projects[idx - 1]!;
  }
  if (!preview) {
    const idx = await readNumber(
      `Which project is PREVIEW? [1-${projects.length}]: `,
      1,
      projects.length,
    );
    preview = projects[idx - 1]!;
  }
  if (production.id === preview.id) fail("preview must differ from production");
  return { production, preview };
}

// ── Prompts ──────────────────────────────────────────────────────────────

async function readLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function readNumber(prompt: string, min: number, max: number): Promise<number> {
  for (;;) {
    const raw = (await readLine(prompt)).trim();
    const n = Number(raw);
    if (Number.isInteger(n) && n >= min && n <= max) return n;
    log.error(`enter an integer between ${min} and ${max}`);
  }
}

async function confirm(question: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? " [Y/n]: " : " [y/N]: ";
  const raw = (await readLine(question + suffix)).trim().toLowerCase();
  if (raw === "") return defaultYes;
  return raw === "y" || raw === "yes";
}

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    output.write(prompt);
    if (!input.isTTY) {
      // Non-TTY: fall back to plain readline (no echo control possible).
      readLine("").then((v) => resolve(v));
      return;
    }
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let buf = "";
    const onData = (key: string) => {
      for (const ch of key) {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10) {
          input.setRawMode(false);
          input.pause();
          input.removeListener("data", onData);
          output.write("\n");
          resolve(buf);
          return;
        }
        if (code === 3) {
          input.setRawMode(false);
          input.pause();
          input.removeListener("data", onData);
          output.write("\n");
          process.exit(130);
        }
        if (code === 127 || code === 8) {
          if (buf.length > 0) buf = buf.slice(0, -1);
          continue;
        }
        if (code < 32) continue;
        buf += ch;
      }
    };
    input.on("data", onData);
  });
}

// ── API keys ─────────────────────────────────────────────────────────────

const apiKeyEntrySchema = z.object({ name: z.string(), api_key: z.string() });
type ApiKeys = { anon: string; serviceRole: string };

async function fetchApiKeys(ref: string): Promise<ApiKeys> {
  const { stdout } = await execFileP(SUPABASE_BIN, [
    "projects",
    "api-keys",
    "--project-ref",
    ref,
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) fail(`api-keys for ${ref} returned unexpected shape`);
  const entries = parsed.map((e: unknown) => apiKeyEntrySchema.parse(e));
  const anon = entries.find((e) => e.name === "anon")?.api_key;
  const service = entries.find((e) => e.name === "service_role")?.api_key;
  if (!anon || !service) fail(`api-keys for ${ref} missing anon or service_role entry`);
  return { anon, serviceRole: service };
}

// ── URL construction ─────────────────────────────────────────────────────

const urlSchema = z.url();
type DbUrls = { pooler: string; direct: string };

function constructUrls(project: SupabaseProject, password: string): DbUrls {
  const enc = encodeURIComponent(password);
  const pooler = `postgres://postgres.${project.id}:${enc}@aws-0-${project.region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
  const direct = `postgres://postgres:${enc}@db.${project.id}.supabase.co:5432/postgres`;
  urlSchema.parse(pooler);
  urlSchema.parse(direct);
  return { pooler, direct };
}

function maskUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ":****@");
}

function projectUrl(p: SupabaseProject): string {
  return `https://${p.id}.supabase.co`;
}

// ── Verify ───────────────────────────────────────────────────────────────

async function probePsql(urlStr: string): Promise<void> {
  const u = new URL(urlStr);
  const password = decodeURIComponent(u.password);
  const safe = `postgres://${u.username}@${u.host}${u.pathname}${u.search}`;
  await execFileP("psql", [safe, "-c", "select 1", "-q", "-t", "-A"], {
    timeout: 15_000,
    env: { ...process.env, PGPASSWORD: password },
  });
}

async function verifyOrFallback(
  label: string,
  kind: "pooler" | "direct",
  initial: string,
): Promise<string> {
  log.info(`verifying ${label} ${kind} (${maskUrl(initial)})...`);
  try {
    await probePsql(initial);
    log.info(`  ok`);
    return initial;
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err))
      .split("\n")
      .slice(0, 3)
      .join("\n");
    log.warn(`  ${kind} verify failed: ${msg.replace(/:([^:@/\s]+)@/g, ":****@")}`);
    log.warn(
      `  the deterministic ${kind} URL did not connect — Supabase may use a non-standard hostname for this project.`,
    );
    if (
      !(await confirm(
        `Paste the ${kind} URL for ${label} from Supabase dashboard (Settings → Database)?`,
        true,
      ))
    ) {
      fail(`${label} ${kind} verify failed and no manual override provided`);
    }
    const pasted = (await readLine(`${label} ${kind} URL: `)).trim();
    if (!pasted) fail("empty URL");
    urlSchema.parse(pasted);
    await probePsql(pasted);
    log.info(`  ok (manual override)`);
    return pasted;
  }
}

async function verifyAll(label: string, urls: DbUrls): Promise<DbUrls> {
  const pooler = await verifyOrFallback(label, "pooler", urls.pooler);
  const direct = await verifyOrFallback(label, "direct", urls.direct);
  return { pooler, direct };
}

// ── Summary ──────────────────────────────────────────────────────────────

type Summary = {
  production: SupabaseProject;
  preview: SupabaseProject;
  prodUrls: DbUrls;
  previewUrls: DbUrls;
  prodKeys: ApiKeys;
  previewKeys: ApiKeys;
};

function printSummary(s: Summary): void {
  log.raw("");
  log.raw("── Supabase cloud setup summary ────────────────────────────");
  for (const [label, p, urls, keys] of [
    ["production", s.production, s.prodUrls, s.prodKeys],
    ["preview", s.preview, s.previewUrls, s.previewKeys],
  ] as const) {
    log.raw(`${label}: ${p.name} (${p.id}) [${p.region}]`);
    log.raw(`  project URL  : ${projectUrl(p)}`);
    log.raw(`  anon key     : ${keys.anon.slice(0, 12)}…`);
    log.raw(`  service key  : ${keys.serviceRole.slice(0, 12)}…  (server-only)`);
    log.raw(`  pooler URL   : ${maskUrl(urls.pooler)}`);
    log.raw(`  direct URL   : ${maskUrl(urls.direct)}`);
  }
  log.raw("────────────────────────────────────────────────────────────");
  log.raw("");
}

async function writeSummaryFile(s: Summary): Promise<void> {
  if (!existsSync(".vercel")) return; // .vercel/ confirmed gitignored
  const content = [
    "# Supabase cloud setup summary",
    "",
    "Auto-generated by `pnpm db:setup-cloud`. This file lives under `.vercel/` (gitignored).",
    "Passwords are masked. Do not commit.",
    "",
    `## production: ${s.production.name}`,
    `- ref: \`${s.production.id}\``,
    `- region: \`${s.production.region}\``,
    `- project URL: \`${projectUrl(s.production)}\``,
    `- pooler URL: \`${maskUrl(s.prodUrls.pooler)}\``,
    `- direct URL: \`${maskUrl(s.prodUrls.direct)}\``,
    "",
    `## preview: ${s.preview.name}`,
    `- ref: \`${s.preview.id}\``,
    `- region: \`${s.preview.region}\``,
    `- project URL: \`${projectUrl(s.preview)}\``,
    `- pooler URL: \`${maskUrl(s.previewUrls.pooler)}\``,
    `- direct URL: \`${maskUrl(s.previewUrls.direct)}\``,
    "",
  ].join("\n");
  await writeFile(SUMMARY_FILE, content, "utf8");
  log.info(`summary written to ${SUMMARY_FILE}`);
}

// ── Vercel push ──────────────────────────────────────────────────────────

async function ensureVercelToken(): Promise<string> {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  log.warn("VERCEL_TOKEN not set in env (load via .env.local with `tsx --env-file-if-exists`).");
  const token = await readPassword("Paste VERCEL_TOKEN: ");
  if (!token) fail("VERCEL_TOKEN required for vercel push");
  process.env.VERCEL_TOKEN = token;
  if (await confirm("Persist VERCEL_TOKEN to .env.local for future runs?", false)) {
    await appendFile(".env.local", `\nVERCEL_TOKEN=${token}\n`);
    log.info("appended VERCEL_TOKEN to .env.local");
  }
  return token;
}

function spawnWithStdin(cmd: string, args: string[], stdinValue: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
    child.stdin.write(stdinValue);
    child.stdin.end();
  });
}

async function vercelEnvExists(scope: string, key: string, token: string): Promise<boolean> {
  try {
    const { stdout } = await execFileP("vercel", ["env", "ls", scope, "--token", token]);
    return new RegExp(`^\\s*${key}\\b`, "m").test(stdout);
  } catch {
    return false;
  }
}

async function vercelEnvAdd(
  scope: string,
  key: string,
  value: string,
  token: string,
): Promise<void> {
  if (await vercelEnvExists(scope, key, token)) {
    log.info(`vercel env: ${scope}.${key} exists — removing first`);
    await execFileP("vercel", ["env", "rm", key, scope, "--yes", "--token", token]);
  }
  await spawnWithStdin("vercel", ["env", "add", key, scope, "--token", token], value);
  log.info(`vercel env: set ${scope}.${key}`);
}

async function pushVercel(
  scope: "preview" | "production",
  values: Record<string, string>,
  token: string,
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await vercelEnvAdd(scope, key, value, token);
  }
}

// ── GH push ──────────────────────────────────────────────────────────────

async function gitRepoSlug(): Promise<string> {
  const { stdout } = await execFileP("git", ["config", "--get", "remote.origin.url"]);
  const url = stdout.trim();
  const m = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!m) fail(`could not parse repo slug from \`${url}\``);
  return m[1]!;
}

async function pushGhSecret(name: string, value: string): Promise<void> {
  const slug = await gitRepoSlug();
  await spawnWithStdin("gh", ["secret", "set", name, "--repo", slug], value);
  log.info(`gh secret: set ${slug}/${name}`);
}

// ── Bootstrap ────────────────────────────────────────────────────────────

async function runDbSetup(
  directUrl: string,
  publicUrl: string,
  serviceRoleKey: string,
  label: string,
): Promise<void> {
  log.info(`running pnpm db:setup against ${label}...`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["db:setup"], {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: directUrl,
        DATABASE_POOL_URL: directUrl,
        NEXT_PUBLIC_SUPABASE_URL: publicUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      },
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`pnpm db:setup against ${label} exited ${code}`)),
    );
  });
  log.info(`pnpm db:setup against ${label} ok`);
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(flags: Flags): Promise<void> {
  log.info(`mode: ${flags.dryRun ? "dry-run" : "interactive"}`);
  await preflight(flags);

  const projects = await listSupabaseProjects();
  const { production, preview } = await pickProjects(projects, flags);

  const prodPassword = await readPassword(`Database password for production (${production.id}): `);
  if (!prodPassword) fail("production password cannot be empty");
  const previewPassword = await readPassword(`Database password for preview (${preview.id}): `);
  if (!previewPassword) fail("preview password cannot be empty");

  log.info("fetching API keys for production...");
  const prodKeys = await fetchApiKeys(production.id);
  log.info("fetching API keys for preview...");
  const previewKeys = await fetchApiKeys(preview.id);

  let prodUrls = constructUrls(production, prodPassword);
  let previewUrls = constructUrls(preview, previewPassword);

  if (!flags.skipVerify) {
    prodUrls = await verifyAll("production", prodUrls);
    previewUrls = await verifyAll("preview", previewUrls);
  } else {
    log.warn("--skip-verify: skipping psql connectivity probes");
  }

  const summary: Summary = { production, preview, prodUrls, previewUrls, prodKeys, previewKeys };
  printSummary(summary);
  await writeSummaryFile(summary);

  if (flags.dryRun) {
    log.info("--dry-run: stopping before any push or bootstrap.");
    return;
  }

  let vercelPushed = false;
  let ghPushed = false;
  let bootstrappedProd = false;
  let bootstrappedPreview = false;

  if (await confirm("Push these env vars to Vercel preview + production?", false)) {
    const token = await ensureVercelToken();
    await pushVercel(
      "preview",
      {
        DATABASE_URL: previewUrls.pooler,
        DATABASE_POOL_URL: previewUrls.pooler,
        NEXT_PUBLIC_SUPABASE_URL: projectUrl(preview),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: previewKeys.anon,
        SUPABASE_SERVICE_ROLE_KEY: previewKeys.serviceRole,
      },
      token,
    );
    await pushVercel(
      "production",
      {
        DATABASE_URL: prodUrls.pooler,
        DATABASE_POOL_URL: prodUrls.pooler,
        NEXT_PUBLIC_SUPABASE_URL: projectUrl(production),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: prodKeys.anon,
        SUPABASE_SERVICE_ROLE_KEY: prodKeys.serviceRole,
      },
      token,
    );
    vercelPushed = true;
  }

  if (await confirm("Push PROD_DATABASE_DIRECT_URL to GitHub Actions secrets?", false)) {
    await pushGhSecret("PROD_DATABASE_DIRECT_URL", prodUrls.direct);
    ghPushed = true;
  }

  if (!flags.skipBootstrap) {
    if (await confirm("Run pnpm db:setup against production now?", true)) {
      await runDbSetup(prodUrls.direct, projectUrl(production), prodKeys.serviceRole, "production");
      bootstrappedProd = true;
    }
    if (await confirm("Run pnpm db:setup against preview now?", true)) {
      await runDbSetup(previewUrls.direct, projectUrl(preview), previewKeys.serviceRole, "preview");
      bootstrappedPreview = true;
    }
  }

  log.raw("");
  log.info("done. final state:");
  log.raw(`  vercel preview+production env :: ${vercelPushed ? "pushed" : "skipped"}`);
  log.raw(`  GH secret PROD_DATABASE_DIRECT_URL :: ${ghPushed ? "pushed" : "skipped"}`);
  log.raw(`  pnpm db:setup production :: ${bootstrappedProd ? "ran" : "skipped"}`);
  log.raw(`  pnpm db:setup preview :: ${bootstrappedPreview ? "ran" : "skipped"}`);
  log.raw("");
  log.info("next: DEPLOY.md Section 4+ — verify Vercel env vars in dashboard.");
}

main(parseFlags(process.argv.slice(2))).catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
