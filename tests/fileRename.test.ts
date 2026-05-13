import { describe, it, expect, vi, beforeEach } from "vitest";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, generateMemoryId, getMemoriesByFile } from "../src/memory/saveMemory.js";
import type { CodingMemory } from "../src/memory/types.js";
import type Database from "better-sqlite3";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";
const mockExecSync = vi.mocked(execSync);

function makeTestDb(): Database.Database {
  const db = openDb(":memory:");
  runMigrations(db);
  return db;
}

function makeMemory(overrides: Partial<CodingMemory> = {}): CodingMemory {
  return {
    id: generateMemoryId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repoId: "repo-abc",
    repoPath: "/home/user/my-app",
    repoName: "my-app",
    branch: "main",
    commitSha: "abc123",
    files: ["src/auth/session.ts"],
    tags: ["auth"],
    intent: "Add refresh token rotation to prevent replay attacks",
    summary: "Implemented refresh token rotation on every use",
    decision: "Rotate on every use",
    why: "One-time-use tokens prevent replay attacks",
    alternativesRejected: [],
    risks: [],
    followUps: [],
    source: "cli",
    embeddingText: "Add refresh token rotation",
    ...overrides,
  };
}

describe("getChangedFilesForCommit — rename detection", () => {
  beforeEach(() => { mockExecSync.mockReset(); });

  it("includes both old and new paths for renamed files", async () => {
    mockExecSync.mockReturnValue(
      "R100\tsrc/auth/session.ts\tsrc/authentication/session.ts\n" as unknown as Buffer
    );
    const { getChangedFilesForCommit } = await import("../src/git/diff.js");
    const files = getChangedFilesForCommit("/repo", "abc123");
    expect(files).toContain("src/auth/session.ts");
    expect(files).toContain("src/authentication/session.ts");
  });

  it("includes both old and new paths for copied files", async () => {
    mockExecSync.mockReturnValue(
      "C080\tsrc/utils/helper.ts\tsrc/shared/helper.ts\n" as unknown as Buffer
    );
    const { getChangedFilesForCommit } = await import("../src/git/diff.js");
    const files = getChangedFilesForCommit("/repo", "abc123");
    expect(files).toContain("src/utils/helper.ts");
    expect(files).toContain("src/shared/helper.ts");
  });

  it("handles regular modified files normally", async () => {
    mockExecSync.mockReturnValue(
      "M\tsrc/auth/login.ts\n" as unknown as Buffer
    );
    const { getChangedFilesForCommit } = await import("../src/git/diff.js");
    const files = getChangedFilesForCommit("/repo", "abc123");
    expect(files).toEqual(["src/auth/login.ts"]);
  });

  it("deduplicates paths when same file appears multiple times", async () => {
    mockExecSync.mockReturnValue(
      "M\tsrc/auth/session.ts\nR100\tsrc/auth/session.ts\tsrc/authentication/session.ts\n" as unknown as Buffer
    );
    const { getChangedFilesForCommit } = await import("../src/git/diff.js");
    const files = getChangedFilesForCommit("/repo", "abc123");
    const unique = new Set(files);
    expect(unique.size).toBe(files.length);
  });
});

describe("getFileRenameHistory", () => {
  beforeEach(() => { mockExecSync.mockReset(); });

  it("returns current path and historical paths", async () => {
    mockExecSync.mockReturnValue(
      "src/auth/session.ts\n\nsrc/authentication/session.ts\n" as unknown as Buffer
    );
    const { getFileRenameHistory } = await import("../src/git/diff.js");
    const history = getFileRenameHistory("/repo", "src/authentication/session.ts");
    expect(history).toContain("src/authentication/session.ts");
    expect(history).toContain("src/auth/session.ts");
  });

  it("always includes the requested file even if git returns nothing", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("git error"); });
    const { getFileRenameHistory } = await import("../src/git/diff.js");
    const history = getFileRenameHistory("/repo", "src/auth/session.ts");
    expect(history).toEqual(["src/auth/session.ts"]);
  });

  it("deduplicates paths", async () => {
    mockExecSync.mockReturnValue(
      "src/auth/session.ts\nsrc/auth/session.ts\n" as unknown as Buffer
    );
    const { getFileRenameHistory } = await import("../src/git/diff.js");
    const history = getFileRenameHistory("/repo", "src/auth/session.ts");
    const unique = new Set(history);
    expect(unique.size).toBe(history.length);
  });
});

describe("getMemoriesByFile — multiple paths", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeTestDb(); });

  it("finds memory by old path after rename", () => {
    const m = makeMemory({ files: ["src/auth/session.ts"] });
    saveMemory(db, m);
    // Search with both old and new path (simulating rename history lookup)
    const results = getMemoriesByFile(db, "repo-abc", ["src/authentication/session.ts", "src/auth/session.ts"], 10);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(m.id);
  });

  it("finds memory by new path stored at save time", () => {
    const m = makeMemory({ files: ["src/authentication/session.ts"] });
    saveMemory(db, m);
    const results = getMemoriesByFile(db, "repo-abc", ["src/authentication/session.ts", "src/auth/session.ts"], 10);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(m.id);
  });

  it("deduplicates results when memory matches multiple paths in the list", () => {
    // Memory stored with both old and new path (as happens at commit time)
    const m = makeMemory({ files: ["src/auth/session.ts", "src/authentication/session.ts"] });
    saveMemory(db, m);
    const results = getMemoriesByFile(db, "repo-abc", ["src/auth/session.ts", "src/authentication/session.ts"], 10);
    expect(results.length).toBe(1);
  });

  it("still works with a single path string", () => {
    const m = makeMemory({ files: ["src/auth/session.ts"] });
    saveMemory(db, m);
    const results = getMemoriesByFile(db, "repo-abc", "src/auth/session.ts", 10);
    expect(results.length).toBe(1);
  });
});
