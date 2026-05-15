import http from "http";
import net from "net";
import { execSync, exec } from "child_process";
import { readFileSync } from "fs";
import Database from "better-sqlite3";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getRepoRoot } from "../git/git.js";
import { getRepoId, getRepoName } from "../git/repoId.js";
import { getMemoryByCommit } from "../memory/saveMemory.js";
import type { CodingMemory } from "../memory/types.js";

export type CommitRow = {
  sha: string;
  message: string;
  date: string;
  branch: string;
  hasMemory: boolean;
  isStale: boolean;
  intent?: string;
  decision?: string;
  why?: string;
};

export type GitLogLine = {
  sha: string;
  message: string;
  date: string;
  branch: string;
};

export function parseGitLog(output: string): GitLogLine[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      const sha = parts[0].trim();
      const message = parts[1]?.trim() ?? "";
      const date = parts[2]?.trim() ?? "";
      const refs = parts.slice(3).join("|").trim();
      return { sha, message, date, branch: extractBranch(refs) };
    });
}

function extractBranch(refs: string): string {
  const headMatch = refs.match(/HEAD -> ([^,\s]+)/);
  if (headMatch) return headMatch[1];
  const first = refs.split(",")[0].trim();
  return first || "";
}

const STALE_MS = 90 * 24 * 60 * 60 * 1000;

export function getCommitsWithMemories(
  db: Database.Database,
  repoId: string,
  gitLogLines: GitLogLine[]
): CommitRow[] {
  type MemoryDbRow = {
    commit_sha: string;
    created_at: string;
    intent: string;
    decision: string;
    why: string;
  };

  const rows = db
    .prepare<[string], MemoryDbRow>(
      "SELECT commit_sha, created_at, intent, decision, why FROM memories WHERE repo_id = ? AND commit_sha IS NOT NULL"
    )
    .all(repoId);

  const memMap = new Map<string, MemoryDbRow>();
  for (const row of rows) {
    memMap.set(row.commit_sha, row);
  }

  return gitLogLines.map(({ sha, message, date, branch }) => {
    const entry = memMap.get(sha);
    const hasMemory = entry !== undefined;
    const isStale = hasMemory
      ? Date.now() - new Date(entry!.created_at).getTime() > STALE_MS
      : false;
    return {
      sha,
      message,
      date,
      branch,
      hasMemory,
      isStale,
      ...(entry
        ? { intent: entry.intent, decision: entry.decision, why: entry.why }
        : {}),
    };
  });
}

export function getMemoryBySha(
  db: Database.Database,
  sha: string
): CodingMemory | null {
  return getMemoryByCommit(db, sha);
}

// ── HTTP server ──────────────────────────────────────────────────────────────

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(start: number): Promise<number> {
  for (let port = start; port < start + 10; port++) {
    if (await isPortAvailable(port)) return port;
  }
  console.error("No available port found in range 3742–3751.");
  process.exit(1);
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start ${url}`
      : process.platform === "darwin"
        ? `open ${url}`
        : `xdg-open ${url}`;
  exec(cmd);
}

function createServer(
  repoRoot: string,
  repoId: string,
  port: number
): http.Server {
  const htmlPath = new URL("./browse.html", import.meta.url);
  const html = readFileSync(htmlPath, "utf-8");

  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = urlObj.pathname;

    if (pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (pathname === "/api/commits") {
      try {
        const gitOut = execSync(
          `git -C "${repoRoot}" log --format="%H|%s|%aI|%D" -n 200 HEAD`
        ).toString();
        const lines = parseGitLog(gitOut);
        const db = openDb(resolveConfig().storage.dbPath);
        const commits = getCommitsWithMemories(db, repoId, lines);
        const repoName = getRepoName(repoRoot);
        db.close();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ repoName, commits }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }

    const memMatch = pathname.match(/^\/api\/memory\/([a-f0-9A-F]+)$/);
    if (memMatch) {
      const sha = memMatch[1];
      try {
        const db = openDb(resolveConfig().storage.dbPath);
        const memory = getMemoryBySha(db, sha);
        db.close();
        if (!memory) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(memory));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, "127.0.0.1");
  return server;
}

export async function runBrowse(): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  const repoRoot = getRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error("Not inside a git repository.");
    process.exit(1);
  }

  const repoId = getRepoId(repoRoot);
  const port = await findAvailablePort(3742);
  const url = `http://localhost:${port}`;

  createServer(repoRoot, repoId, port);

  console.log(`whyline browse → ${url}`);
  openBrowser(url);
  console.log("Press Ctrl-C to stop.");

  process.on("SIGINT", () => {
    process.exit(0);
  });
}
