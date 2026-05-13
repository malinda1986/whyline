import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runInstallClaude } from "../src/commands/install-claude.js";

function makeGitDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-install-"));
  // minimal .git so getRepoRoot succeeds
  fs.mkdirSync(path.join(dir, ".git"));
  return dir;
}

vi.mock("../src/git/git.js", () => ({
  getRepoRoot: (cwd: string) => {
    // return cwd if it contains a .git dir
    if (fs.existsSync(path.join(cwd, ".git"))) return cwd;
    return null;
  },
}));

vi.mock("../src/git/repoId.js", () => ({
  getRepoName: () => "my-test-repo",
}));

describe("install-claude — .mcp.json", () => {
  let repoDir: string;

  beforeEach(() => { repoDir = makeGitDir(); });

  it("creates .mcp.json when absent", async () => {
    await runInstallClaude({ repoPath: repoDir });
    const mcp = JSON.parse(fs.readFileSync(path.join(repoDir, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers.whyline).toEqual({ command: "whyline", args: ["mcp"] });
  });

  it("merges into existing .mcp.json without removing other servers", async () => {
    const existing = { mcpServers: { "other-tool": { command: "other", args: [] } } };
    fs.writeFileSync(path.join(repoDir, ".mcp.json"), JSON.stringify(existing));

    await runInstallClaude({ repoPath: repoDir });

    const mcp = JSON.parse(fs.readFileSync(path.join(repoDir, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers["other-tool"]).toBeDefined();
    expect(mcp.mcpServers.whyline).toEqual({ command: "whyline", args: ["mcp"] });
  });

  it("is idempotent — running twice does not duplicate or change .mcp.json", async () => {
    await runInstallClaude({ repoPath: repoDir });
    const after1 = fs.readFileSync(path.join(repoDir, ".mcp.json"), "utf-8");
    await runInstallClaude({ repoPath: repoDir });
    const after2 = fs.readFileSync(path.join(repoDir, ".mcp.json"), "utf-8");
    expect(after1).toBe(after2);
  });
});

describe("install-claude — CLAUDE.md", () => {
  let repoDir: string;

  beforeEach(() => { repoDir = makeGitDir(); });

  it("creates CLAUDE.md with repo name header and Whyline section when absent", async () => {
    await runInstallClaude({ repoPath: repoDir });
    const content = fs.readFileSync(path.join(repoDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("my-test-repo");
    expect(content).toContain("## Whyline Memory");
    expect(content).toContain(repoDir);
  });

  it("appends Whyline section to an existing CLAUDE.md that lacks it", async () => {
    fs.writeFileSync(path.join(repoDir, "CLAUDE.md"), "# Existing project\n\nSome instructions.\n");
    await runInstallClaude({ repoPath: repoDir });
    const content = fs.readFileSync(path.join(repoDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("Existing project");
    expect(content).toContain("## Whyline Memory");
  });

  it("updates repoPath in existing CLAUDE.md that already has Whyline section", async () => {
    const oldPath = "/old/path/to/repo";
    const section = `# My repo\n\n## Whyline Memory\n\n- \`repoPath\`: \`${oldPath}\`\n`;
    fs.writeFileSync(path.join(repoDir, "CLAUDE.md"), section);

    await runInstallClaude({ repoPath: repoDir });

    const content = fs.readFileSync(path.join(repoDir, "CLAUDE.md"), "utf-8");
    expect(content).not.toContain(oldPath);
    expect(content).toContain(repoDir);
  });

  it("is idempotent — running twice does not duplicate the section", async () => {
    await runInstallClaude({ repoPath: repoDir });
    const after1 = fs.readFileSync(path.join(repoDir, "CLAUDE.md"), "utf-8");
    await runInstallClaude({ repoPath: repoDir });
    const after2 = fs.readFileSync(path.join(repoDir, "CLAUDE.md"), "utf-8");
    expect(after1).toBe(after2);
    // should only appear once
    expect(after2.split("## Whyline Memory").length - 1).toBe(1);
  });
});

describe("install-claude — .claude/settings.local.json", () => {
  let repoDir: string;

  beforeEach(() => { repoDir = makeGitDir(); });

  it("creates settings.local.json with all tool permissions", async () => {
    await runInstallClaude({ repoPath: repoDir });
    const settings = JSON.parse(
      fs.readFileSync(path.join(repoDir, ".claude", "settings.local.json"), "utf-8")
    );
    expect(settings.permissions.allow).toContain("mcp__whyline__save_coding_memory");
    expect(settings.permissions.allow).toContain("mcp__whyline__search_coding_memory");
    expect(settings.permissions.allow).toContain("mcp__whyline__get_recent_memories");
    expect(settings.enabledMcpjsonServers).toContain("whyline");
  });

  it("merges into existing settings.local.json without removing existing permissions", async () => {
    const settingsDir = path.join(repoDir, ".claude");
    fs.mkdirSync(settingsDir);
    const existing = { permissions: { allow: ["some__other__tool"] }, enabledMcpjsonServers: ["other"] };
    fs.writeFileSync(path.join(settingsDir, "settings.local.json"), JSON.stringify(existing));

    await runInstallClaude({ repoPath: repoDir });

    const settings = JSON.parse(
      fs.readFileSync(path.join(settingsDir, "settings.local.json"), "utf-8")
    );
    expect(settings.permissions.allow).toContain("some__other__tool");
    expect(settings.permissions.allow).toContain("mcp__whyline__save_coding_memory");
    expect(settings.enabledMcpjsonServers).toContain("other");
    expect(settings.enabledMcpjsonServers).toContain("whyline");
  });

  it("is idempotent — running twice does not duplicate permissions", async () => {
    await runInstallClaude({ repoPath: repoDir });
    const after1 = fs.readFileSync(path.join(repoDir, ".claude", "settings.local.json"), "utf-8");
    await runInstallClaude({ repoPath: repoDir });
    const after2 = fs.readFileSync(path.join(repoDir, ".claude", "settings.local.json"), "utf-8");
    expect(after1).toBe(after2);
    const parsed = JSON.parse(after2);
    const saveCount = (parsed.permissions.allow as string[]).filter(
      (p: string) => p === "mcp__whyline__save_coding_memory"
    ).length;
    expect(saveCount).toBe(1);
  });
});

describe("install-claude — error handling", () => {
  it("exits when not inside a git repo", async () => {
    const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-nogit-"));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    await expect(runInstallClaude({ repoPath: notARepo })).rejects.toThrow("exit:1");
    exitSpy.mockRestore();
  });
});
