import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { MIGRATIONS } from "../src/db/schema.js";

// Capture console output
async function captureOutput(fn: () => Promise<void>): Promise<{ stdout: string; exitCode: number }> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => lines.push(args.join(" "));

  let exitCode = 0;
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code})`);
  });

  try {
    await fn();
  } catch (e: unknown) {
    if (!(e instanceof Error) || !e.message.startsWith("process.exit")) throw e;
  } finally {
    console.log = orig;
    vi.restoreAllMocks();
  }

  return { stdout: lines.join("\n"), exitCode };
}

describe("doctor — DB checks", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-doctor-"));
    dbPath = path.join(tmpDir, "memory.db");
    vi.resetModules();
  });

  it("reports DB missing when not initialised", async () => {
    vi.doMock("../src/config.js", () => ({
      isInitialized: () => false,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => null }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error("not called");
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✗.*DB exists/);
  });

  it("reports DB present and migrations current when initialised", async () => {
    const db = openDb(dbPath);
    runMigrations(db);
    db.close();

    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => null }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error("not called");
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✓.*DB exists/);
    expect(stdout).toMatch(/✓.*Migrations current/);
  });

  it("reports migrations out of date when db has older version", async () => {
    // Create DB but only apply migrations up to v0 (none)
    const db = openDb(dbPath);
    db.exec("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
    db.close();

    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => null }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✗.*Migrations current/);
    expect(stdout).toMatch(`v${MIGRATIONS[MIGRATIONS.length - 1].version}`);
  });
});

describe("doctor — git repo checks", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-doctor-"));
    dbPath = path.join(tmpDir, "memory.db");
    const db = openDb(dbPath);
    runMigrations(db);
    db.close();
    vi.resetModules();
  });

  it("reports not in git repo when getRepoRoot returns null", async () => {
    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => null }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✗.*Inside a git repo/);
    expect(stdout).toMatch(/skipped.*not in a git repo/);
  });

  it("reports .mcp.json missing when inside a git repo without the file", async () => {
    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => tmpDir }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✗.*MCP config/);
  });

  it("detects valid .mcp.json with whyline server entry", async () => {
    const mcpJson = { mcpServers: { whyline: { command: "whyline", args: ["mcp"] } } };
    fs.writeFileSync(path.join(tmpDir, ".mcp.json"), JSON.stringify(mcpJson));

    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => tmpDir }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✓.*MCP config/);
  });

  it("detects CLAUDE.md that mentions Whyline", async () => {
    fs.writeFileSync(path.join(tmpDir, ".mcp.json"), JSON.stringify({ mcpServers: { whyline: {} } }));
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# My project\n\nUses Whyline for memory.\n");

    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => tmpDir }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✓.*Instruction file/);
  });

  it("detects CLAUDE.md that does not mention Whyline", async () => {
    fs.writeFileSync(path.join(tmpDir, ".mcp.json"), JSON.stringify({ mcpServers: { whyline: {} } }));
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# My project\n\nNo memory tooling configured.\n");

    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => tmpDir }));
    vi.doMock("child_process", async (orig) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    expect(stdout).toMatch(/✗.*Instruction file/);
  });
});

describe("doctor — Cursor detection", () => {
  function makeTempRepo(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "whyline-doctor-cursor-"));
  }

  async function captureDoctor(dir: string): Promise<string> {
    const dbPath = path.join(dir, "memory.db");
    const db = (await import("../src/db/connection.js")).openDb(dbPath);
    (await import("../src/db/migrations.js")).runMigrations(db);
    db.close();

    vi.resetModules();
    vi.doMock("../src/config.js", () => ({
      isInitialized: () => true,
      resolveConfig: () => ({ storage: { dbPath } }),
    }));
    vi.doMock("../src/git/git.js", () => ({ getRepoRoot: () => dir }));
    vi.doMock("child_process", async (orig: () => Promise<object>) => {
      const actual = await orig();
      return {
        ...(actual as object),
        execSync: (cmd: string) => {
          if (cmd === "which whyline") return "/usr/local/bin/whyline\n";
          throw new Error();
        },
      };
    });

    const { runDoctor } = await import("../src/commands/doctor.js");
    const { stdout } = await captureOutput(() => runDoctor());
    return stdout;
  }

  it("passes MCP config check when .cursor/mcp.json has whyline entry", async () => {
    const dir = makeTempRepo();
    const cursorDir = path.join(dir, ".cursor");
    fs.mkdirSync(cursorDir);
    fs.writeFileSync(
      path.join(cursorDir, "mcp.json"),
      JSON.stringify({ mcpServers: { whyline: { command: "whyline", args: ["mcp"] } } })
    );
    fs.writeFileSync(path.join(dir, ".cursorrules"), "## Whyline Memory\n");
    const output = await captureDoctor(dir);
    expect(output).toContain("✓  MCP config");
    expect(output).toContain("✓  Instruction file");
  });

  it("fails MCP config check when neither .mcp.json nor .cursor/mcp.json has whyline entry", async () => {
    const dir = makeTempRepo();
    const output = await captureDoctor(dir);
    expect(output).toContain("✗  MCP config");
  });
});
