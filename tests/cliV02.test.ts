import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import {
  saveMemory,
  generateMemoryId,
  listMemories,
  deleteMemory,
  getMemoryById,
  getStats,
  updateMemory,
} from "../src/memory/saveMemory.js";
import type { CodingMemory } from "../src/memory/types.js";
import type Database from "better-sqlite3";

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
    intent: "Add refresh token rotation",
    summary: "Implemented refresh token rotation",
    decision: "Rotate on every use",
    why: "One-time-use tokens prevent replay attacks",
    alternativesRejected: ["Long-lived tokens"],
    risks: ["Token invalidation race condition"],
    followUps: ["Add rotation tests"],
    source: "cli",
    embeddingText: "Add refresh token rotation",
    ...overrides,
  };
}

describe("listMemories", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeTestDb(); });

  it("returns all memories in reverse chronological order", () => {
    const m1 = makeMemory({ createdAt: "2024-01-01T00:00:00.000Z" });
    const m2 = makeMemory({ createdAt: "2024-06-01T00:00:00.000Z" });
    saveMemory(db, m1);
    saveMemory(db, m2);
    const results = listMemories(db, { limit: 10 });
    expect(results[0].id).toBe(m2.id);
    expect(results[1].id).toBe(m1.id);
  });

  it("respects limit", () => {
    for (let i = 0; i < 5; i++) saveMemory(db, makeMemory());
    const results = listMemories(db, { limit: 3 });
    expect(results.length).toBe(3);
  });

  it("filters by repoId when provided", () => {
    const m1 = makeMemory({ repoId: "repo-abc" });
    const m2 = makeMemory({ repoId: "repo-xyz" });
    saveMemory(db, m1);
    saveMemory(db, m2);
    const results = listMemories(db, { repoId: "repo-abc", limit: 10 });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(m1.id);
  });

  it("returns all repos when repoId is not provided", () => {
    saveMemory(db, makeMemory({ repoId: "repo-abc" }));
    saveMemory(db, makeMemory({ repoId: "repo-xyz" }));
    const results = listMemories(db, { limit: 10 });
    expect(results.length).toBe(2);
  });

  it("returns empty array when no memories exist", () => {
    expect(listMemories(db, { limit: 10 })).toEqual([]);
  });
});

describe("deleteMemory", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeTestDb(); });

  it("deletes a memory by ID", () => {
    const m = makeMemory();
    saveMemory(db, m);
    deleteMemory(db, m.id);
    expect(getMemoryById(db, m.id)).toBeNull();
  });

  it("cascades to junction tables", () => {
    const m = makeMemory();
    saveMemory(db, m);
    deleteMemory(db, m.id);
    const files = db.prepare("SELECT * FROM memory_files WHERE memory_id = ?").all(m.id);
    const tags = db.prepare("SELECT * FROM memory_tags WHERE memory_id = ?").all(m.id);
    expect(files.length).toBe(0);
    expect(tags.length).toBe(0);
  });

  it("is a no-op for non-existent ID", () => {
    expect(() => deleteMemory(db, "nonexistent")).not.toThrow();
  });
});

describe("getStats", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeTestDb(); });

  it("returns zeros when no memories exist", () => {
    const stats = getStats(db);
    expect(stats.total).toBe(0);
    expect(stats.repos).toBe(0);
  });

  it("counts total memories and distinct repos", () => {
    saveMemory(db, makeMemory({ repoId: "repo-a" }));
    saveMemory(db, makeMemory({ repoId: "repo-a" }));
    saveMemory(db, makeMemory({ repoId: "repo-b" }));
    const stats = getStats(db);
    expect(stats.total).toBe(3);
    expect(stats.repos).toBe(2);
  });

  it("returns top files sorted by count", () => {
    const m1 = makeMemory({ files: ["src/auth.ts", "src/session.ts"] });
    const m2 = makeMemory({ files: ["src/auth.ts"] });
    saveMemory(db, m1);
    saveMemory(db, m2);
    const stats = getStats(db);
    expect(stats.topFiles[0].filePath).toBe("src/auth.ts");
    expect(stats.topFiles[0].count).toBe(2);
  });

  it("includes oldest and newest dates", () => {
    saveMemory(db, makeMemory({ createdAt: "2024-01-01T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ createdAt: "2024-12-31T00:00:00.000Z" }));
    const stats = getStats(db);
    expect(stats.oldest).toBeTruthy();
    expect(stats.newest).toBeTruthy();
    expect(stats.oldest).not.toBe(stats.newest);
  });
});

describe("updateMemory", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeTestDb(); });

  it("updates text fields", () => {
    const m = makeMemory();
    saveMemory(db, m);
    updateMemory(db, m.id, {
      intent: "Updated intent",
      summary: "Updated summary",
      decision: "Updated decision",
      why: "Updated why",
      embeddingText: "Updated intent Updated summary",
    });
    const updated = getMemoryById(db, m.id);
    expect(updated?.intent).toBe("Updated intent");
    expect(updated?.decision).toBe("Updated decision");
  });

  it("replaces tags on update", () => {
    const m = makeMemory({ tags: ["old-tag"] });
    saveMemory(db, m);
    updateMemory(db, m.id, { tags: ["new-tag-1", "new-tag-2"] });
    const updated = getMemoryById(db, m.id);
    expect(updated?.tags).toContain("new-tag-1");
    expect(updated?.tags).toContain("new-tag-2");
    expect(updated?.tags).not.toContain("old-tag");
  });

  it("replaces risks on update", () => {
    const m = makeMemory({ risks: ["old risk"] });
    saveMemory(db, m);
    updateMemory(db, m.id, { risks: ["new risk"] });
    const updated = getMemoryById(db, m.id);
    expect(updated?.risks).toContain("new risk");
    expect(updated?.risks).not.toContain("old risk");
  });

  it("replaces followUps on update", () => {
    const m = makeMemory({ followUps: ["old followup"] });
    saveMemory(db, m);
    updateMemory(db, m.id, { followUps: ["new followup"] });
    const updated = getMemoryById(db, m.id);
    expect(updated?.followUps).toContain("new followup");
    expect(updated?.followUps).not.toContain("old followup");
  });

  it("updates the updated_at timestamp", () => {
    const m = makeMemory();
    saveMemory(db, m);
    const before = getMemoryById(db, m.id)!.updatedAt;
    updateMemory(db, m.id, { intent: "changed" });
    const after = getMemoryById(db, m.id)!.updatedAt;
    expect(after >= before).toBe(true);
  });
});
