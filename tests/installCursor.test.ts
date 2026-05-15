import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { CursorAdapter } from "../src/adapters/cursor.js";

vi.mock("../src/git/repoId.js", () => ({ getRepoName: () => "test-repo" }));

vi.mock("../src/git/git.js", () => ({
  getRepoRoot: (cwd: string) => {
    if (fs.existsSync(path.join(cwd, ".git"))) return cwd;
    return null;
  },
}));

function makeGitDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-cursor-adapter-"));
  fs.mkdirSync(path.join(dir, ".git"));
  return dir;
}

describe("CursorAdapter", () => {
  let repoDir: string;
  const adapter = new CursorAdapter();

  beforeEach(() => { repoDir = makeGitDir(); });

  it("toolName is cursor", () => {
    expect(adapter.toolName).toBe("cursor");
  });

  it("configPath is .cursor/mcp.json", () => {
    expect(adapter.configPath).toBe(".cursor/mcp.json");
  });

  it("instructionPath is .cursorrules", () => {
    expect(adapter.instructionPath).toBe(".cursorrules");
  });

  it("writeConfig creates .cursor/mcp.json with whyline entry", () => {
    const result = adapter.writeConfig(repoDir);
    expect(result.status).toBe("created");
    const mcp = JSON.parse(fs.readFileSync(path.join(repoDir, ".cursor", "mcp.json"), "utf-8"));
    expect(mcp.mcpServers.whyline).toEqual({ command: "whyline", args: ["mcp"] });
  });

  it("writeConfig merges into existing .cursor/mcp.json without removing other servers", () => {
    const cursorDir = path.join(repoDir, ".cursor");
    fs.mkdirSync(cursorDir);
    const existing = { mcpServers: { "other-tool": { command: "other", args: [] } } };
    fs.writeFileSync(path.join(cursorDir, "mcp.json"), JSON.stringify(existing));
    adapter.writeConfig(repoDir);
    const mcp = JSON.parse(fs.readFileSync(path.join(cursorDir, "mcp.json"), "utf-8"));
    expect(mcp.mcpServers["other-tool"]).toBeDefined();
    expect(mcp.mcpServers.whyline).toEqual({ command: "whyline", args: ["mcp"] });
  });

  it("writeConfig is idempotent", () => {
    adapter.writeConfig(repoDir);
    const result2 = adapter.writeConfig(repoDir);
    expect(result2.status).toBe("unchanged");
  });

  it("writeInstructions creates .cursorrules with Whyline section", () => {
    const result = adapter.writeInstructions(repoDir, repoDir);
    expect(result.status).toBe("created");
    const content = fs.readFileSync(path.join(repoDir, ".cursorrules"), "utf-8");
    expect(content).toContain("## Whyline Memory");
    expect(content).toContain(repoDir);
    expect(content).toContain('"cursor"');
  });

  it("writeInstructions appends to existing .cursorrules that lacks Whyline section", () => {
    fs.writeFileSync(path.join(repoDir, ".cursorrules"), "# Existing rules\n\nsome rule.\n");
    adapter.writeInstructions(repoDir, repoDir);
    const content = fs.readFileSync(path.join(repoDir, ".cursorrules"), "utf-8");
    expect(content).toContain("Existing rules");
    expect(content).toContain("## Whyline Memory");
  });

  it("writeInstructions is idempotent", () => {
    adapter.writeInstructions(repoDir, repoDir);
    const after1 = fs.readFileSync(path.join(repoDir, ".cursorrules"), "utf-8");
    adapter.writeInstructions(repoDir, repoDir);
    const after2 = fs.readFileSync(path.join(repoDir, ".cursorrules"), "utf-8");
    expect(after1).toBe(after2);
    expect(after2.split("## Whyline Memory").length - 1).toBe(1);
  });

  it("has no writePermissions method", () => {
    expect((adapter as { writePermissions?: unknown }).writePermissions).toBeUndefined();
  });
});

import { runInstall } from "../src/commands/install.js";

describe("runInstall --tool", () => {
  let repoDir: string;

  beforeEach(() => { repoDir = makeGitDir(); });

  it("--tool cursor creates .cursor/mcp.json and .cursorrules", async () => {
    await runInstall({ tool: "cursor", repoPath: repoDir });
    expect(fs.existsSync(path.join(repoDir, ".cursor", "mcp.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, ".cursorrules"))).toBe(true);
  });

  it("--tool unknown exits 1 with helpful message", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    await expect(runInstall({ tool: "unknown-tool", repoPath: repoDir })).rejects.toThrow("exit:1");
    exitSpy.mockRestore();
  });
});
