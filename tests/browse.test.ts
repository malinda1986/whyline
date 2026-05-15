import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, generateMemoryId } from "../src/memory/saveMemory.js";
import type { CodingMemory } from "../src/memory/types.js";
import { parseGitLog, getCommitsWithMemories, getMemoryBySha } from "../src/commands/browse.js";
import Database from "better-sqlite3";

function makeTestDb(): Database.Database {
  const db = openDb(":memory:");
  runMigrations(db);
  return db;
}

function makeMemory(overrides: Partial<CodingMemory> = {}): CodingMemory {
  const id = generateMemoryId();
  return {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repoId: "repo1",
    repoPath: "/home/user/my-app",
    repoName: "my-app",
    branch: "main",
    commitSha: "abc1234567890",
    files: ["src/index.ts"],
    tags: ["test"],
    task: undefined,
    intent: "Add feature X",
    summary: "Implemented X",
    decision: "Use approach Y",
    why: "Because Z",
    alternativesRejected: ["approach A"],
    risks: ["risk 1"],
    followUps: [],
    source: "cli",
    rawTranscriptPath: undefined,
    embeddingText: "Add feature X Implemented X Use approach Y Because Z",
    ...overrides,
  };
}

describe("parseGitLog", () => {
  it("parses git log lines into structured objects", () => {
    const output =
      "abc1234567890|Add feature X|2024-01-15T10:00:00Z|HEAD -> main, origin/main\n" +
      "def4567890ab|Fix bug Y|2024-01-14T09:00:00Z|\n";
    const result = parseGitLog(output);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      sha: "abc1234567890",
      message: "Add feature X",
      date: "2024-01-15T10:00:00Z",
      branch: "main",
    });
    expect(result[1]).toEqual({
      sha: "def4567890ab",
      message: "Fix bug Y",
      date: "2024-01-14T09:00:00Z",
      branch: "",
    });
  });

  it("handles empty output", () => {
    expect(parseGitLog("")).toEqual([]);
    expect(parseGitLog("\n")).toEqual([]);
  });

  it("extracts branch from refs with no HEAD pointer", () => {
    const output = "abc123|msg|2024-01-01T00:00:00Z|origin/main\n";
    const result = parseGitLog(output);
    expect(result[0].branch).toBe("origin/main");
  });
});

describe("getCommitsWithMemories", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("annotates commits that have a memory with hasMemory=true", () => {
    const memory = makeMemory({ commitSha: "abc1234567890", repoId: "repo1" });
    saveMemory(db, memory);

    const lines = [
      { sha: "abc1234567890", message: "Add feature X", date: new Date().toISOString(), branch: "main" },
      { sha: "def4567890ab", message: "Fix bug Y", date: new Date().toISOString(), branch: "main" },
    ];

    const result = getCommitsWithMemories(db, "repo1", lines);
    expect(result[0].hasMemory).toBe(true);
    expect(result[0].isStale).toBe(false);
    expect(result[1].hasMemory).toBe(false);
    expect(result[1].isStale).toBe(false);
  });

  it("sets isStale=true for memories older than 90 days", () => {
    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const memory = makeMemory({
      commitSha: "abc1234567890",
      repoId: "repo1",
      createdAt: oldDate,
      updatedAt: oldDate,
    });
    saveMemory(db, memory);

    const lines = [
      { sha: "abc1234567890", message: "Old feature", date: oldDate, branch: "main" },
    ];

    const result = getCommitsWithMemories(db, "repo1", lines);
    expect(result[0].hasMemory).toBe(true);
    expect(result[0].isStale).toBe(true);
  });

  it("includes intent, decision, why in rows that have a memory", () => {
    const memory = makeMemory({ commitSha: "abc1234567890", repoId: "repo1" });
    saveMemory(db, memory);

    const lines = [
      { sha: "abc1234567890", message: "Add feature X", date: new Date().toISOString(), branch: "main" },
    ];

    const result = getCommitsWithMemories(db, "repo1", lines);
    expect(result[0].intent).toBe("Add feature X");
    expect(result[0].decision).toBe("Use approach Y");
    expect(result[0].why).toBe("Because Z");
  });

  it("only annotates commits from the given repoId", () => {
    const memory = makeMemory({ commitSha: "abc1234567890", repoId: "other-repo" });
    saveMemory(db, memory);

    const lines = [
      { sha: "abc1234567890", message: "Add feature X", date: new Date().toISOString(), branch: "main" },
    ];

    const result = getCommitsWithMemories(db, "repo1", lines);
    expect(result[0].hasMemory).toBe(false);
  });
});

describe("getMemoryBySha", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("returns memory when SHA matches", () => {
    const memory = makeMemory({ commitSha: "abc1234567890" });
    saveMemory(db, memory);
    const result = getMemoryBySha(db, "abc1234567890");
    expect(result).not.toBeNull();
    expect(result?.commitSha).toBe("abc1234567890");
  });

  it("returns null when SHA has no memory", () => {
    const result = getMemoryBySha(db, "nonexistentsha");
    expect(result).toBeNull();
  });
});
