import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ClaudeAdapter } from "../src/adapters/claude.js";

vi.mock("../src/git/repoId.js", () => ({ getRepoName: () => "test-repo" }));

function makeGitDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-claude-adapter-"));
  fs.mkdirSync(path.join(dir, ".git"));
  return dir;
}

describe("ClaudeAdapter", () => {
  let repoDir: string;
  const adapter = new ClaudeAdapter();

  beforeEach(() => { repoDir = makeGitDir(); });

  it("toolName is claude", () => {
    expect(adapter.toolName).toBe("claude");
  });

  it("configPath is .mcp.json", () => {
    expect(adapter.configPath).toBe(".mcp.json");
  });

  it("instructionPath is CLAUDE.md", () => {
    expect(adapter.instructionPath).toBe("CLAUDE.md");
  });

  it("writeConfig creates .mcp.json", () => {
    const result = adapter.writeConfig(repoDir);
    expect(result.status).toBe("created");
    const mcp = JSON.parse(fs.readFileSync(path.join(repoDir, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers.whyline).toEqual({ command: "whyline", args: ["mcp"] });
  });

  it("writeConfig is idempotent", () => {
    adapter.writeConfig(repoDir);
    const result2 = adapter.writeConfig(repoDir);
    expect(result2.status).toBe("unchanged");
  });

  it("writeInstructions creates CLAUDE.md", () => {
    const result = adapter.writeInstructions(repoDir, repoDir);
    expect(result.status).toBe("created");
    const content = fs.readFileSync(path.join(repoDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("## Whyline Memory");
    expect(content).toContain(repoDir);
  });

  it("writePermissions creates .claude/settings.local.json", () => {
    const result = adapter.writePermissions!(repoDir);
    expect(result.status).toBe("created");
    const settings = JSON.parse(
      fs.readFileSync(path.join(repoDir, ".claude", "settings.local.json"), "utf-8")
    );
    expect(settings.permissions.allow).toContain("mcp__whyline__save_coding_memory");
  });
});
