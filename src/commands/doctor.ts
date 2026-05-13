import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { resolveConfig, isInitialized } from "../config.js";
import { openDb } from "../db/connection.js";
import { MIGRATIONS } from "../db/schema.js";
import { getRepoRoot } from "../git/git.js";

type CheckResult = { label: string; ok: boolean; detail?: string };

function check(label: string, ok: boolean, detail?: string): CheckResult {
  return { label, ok, detail };
}

export async function runDoctor(): Promise<void> {
  const results: CheckResult[] = [];
  const cwd = process.cwd();

  // 1. DB exists
  const initialized = isInitialized();
  results.push(check("DB exists", initialized, initialized ? resolveConfig().storage.dbPath : "run `whyline init` first"));

  // 2. Migrations current
  if (initialized) {
    try {
      const db = openDb(resolveConfig().storage.dbPath);
      const applied = db
        .prepare<[], { version: number }>("SELECT version FROM migrations ORDER BY version")
        .all()
        .map((r) => r.version);
      db.close();
      const latest = MIGRATIONS[MIGRATIONS.length - 1].version;
      const current = applied.includes(latest);
      results.push(check(
        "Migrations current",
        current,
        current ? `v${latest}` : `applied up to v${Math.max(...applied, 0)}, latest is v${latest} — run \`whyline init\``
      ));
    } catch (e) {
      results.push(check("Migrations current", false, String(e)));
    }
  } else {
    results.push(check("Migrations current", false, "skipped — DB not initialised"));
  }

  // 3. `whyline` command available on PATH
  try {
    const bin = execSync("which whyline", { encoding: "utf-8" }).trim();
    results.push(check("`whyline` on PATH", true, bin));
  } catch {
    results.push(check("`whyline` on PATH", false, "not found — run `npm link` or `npm install -g whyline`"));
  }

  // 4. Inside a git repo
  const repoRoot = getRepoRoot(cwd);
  results.push(check(
    "Inside a git repo",
    repoRoot !== null,
    repoRoot ?? "not a git repository — memories cannot be linked to commits"
  ));

  // 5. .mcp.json configured
  if (repoRoot) {
    const mcpJson = path.join(repoRoot, ".mcp.json");
    let mcpOk = false;
    let mcpDetail: string | undefined;
    if (fs.existsSync(mcpJson)) {
      try {
        const raw = JSON.parse(fs.readFileSync(mcpJson, "utf-8")) as Record<string, unknown>;
        const servers = (raw.mcpServers ?? {}) as Record<string, unknown>;
        mcpOk = Object.keys(servers).some((k) => k.toLowerCase().includes("whyline"));
        mcpDetail = mcpOk ? mcpJson : `${mcpJson} exists but no whyline server entry found`;
      } catch {
        mcpDetail = `${mcpJson} is not valid JSON`;
      }
    } else {
      mcpDetail = `${mcpJson} not found — see how-to-run/02-wire-up-your-repo.md`;
    }
    results.push(check(".mcp.json configured", mcpOk, mcpDetail));

    // 6. CLAUDE.md mentions Whyline
    const claudeMd = path.join(repoRoot, "CLAUDE.md");
    if (fs.existsSync(claudeMd)) {
      const content = fs.readFileSync(claudeMd, "utf-8");
      const mentioned = /whyline/i.test(content);
      results.push(check(
        "CLAUDE.md mentions Whyline",
        mentioned,
        mentioned ? claudeMd : `${claudeMd} exists but does not mention Whyline — see how-to-run/CLAUDE.md.template`
      ));
    } else {
      results.push(check("CLAUDE.md mentions Whyline", false, `${claudeMd} not found`));
    }
  } else {
    results.push(check(".mcp.json configured", false, "skipped — not in a git repo"));
    results.push(check("CLAUDE.md mentions Whyline", false, "skipped — not in a git repo"));
  }

  // 7. MCP server starts (quick smoke test)
  try {
    // Send a ListTools request and expect a response within 3 s
    const proc = execSync(
      `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | whyline mcp`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const mcpOk = proc.includes("search_coding_memory");
    results.push(check("MCP server starts", mcpOk, mcpOk ? "tools/list responded" : "unexpected response"));
  } catch {
    results.push(check("MCP server starts", false, "whyline mcp did not respond — check PATH check above"));
  }

  // Print results
  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const detail = r.detail ? `  (${r.detail})` : "";
    console.log(`  ${icon}  ${r.label}${detail}`);
    if (!r.ok) allOk = false;
  }

  console.log("");
  if (allOk) {
    console.log("All checks passed. Whyline is ready.");
  } else {
    console.log("Some checks failed. Fix the issues above and re-run `whyline doctor`.");
    process.exit(1);
  }
}
