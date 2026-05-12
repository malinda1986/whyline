import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, getMemoryById, getMemoryByCommit, generateMemoryId, buildEmbeddingText } from "../src/memory/saveMemory.js";
import type { CodingMemory } from "../src/memory/types.js";

function makeTestDb(): Database.Database {
  const db = openDb(":memory:");
  runMigrations(db);
  return db;
}

function makeMemory(overrides: Partial<CodingMemory> = {}): CodingMemory {
  const id = generateMemoryId();
  const base: CodingMemory = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repoId: "testrepo123",
    repoPath: "/home/user/my-app",
    repoName: "my-app",
    branch: "main",
    commitSha: "abc1234567890",
    files: ["src/comments/sync.ts", "src/comments/render.ts"],
    tags: ["comments", "optimistic-ui"],
    intent: "Add optimistic comment rendering",
    summary: "Implemented optimistic rendering",
    decision: "Render immediately, reconcile after ack",
    why: "Server wait made UI feel slow",
    alternativesRejected: ["Server-confirmed only"],
    risks: ["Duplicate comments during reconnect"],
    followUps: ["Add dedupe tests"],
    source: "cli",
    embeddingText: "Add optimistic comment rendering Implemented optimistic rendering",
    ...overrides,
  };
  return base;
}

describe("saveMemory", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("saves a memory to the memories table", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(memory.id) as { id: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.id).toBe(memory.id);
  });

  it("saves linked files to memory_files", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const files = db
      .prepare<[string], { file_path: string }>(
        "SELECT file_path FROM memory_files WHERE memory_id = ?"
      )
      .all(memory.id)
      .map((r) => r.file_path);
    expect(files).toEqual(expect.arrayContaining(memory.files));
    expect(files.length).toBe(memory.files.length);
  });

  it("saves linked tags to memory_tags", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const tags = db
      .prepare<[string], { tag: string }>("SELECT tag FROM memory_tags WHERE memory_id = ?")
      .all(memory.id)
      .map((r) => r.tag);
    expect(tags).toEqual(expect.arrayContaining(memory.tags));
  });

  it("saves alternatives to memory_alternatives", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const alts = db
      .prepare<[string], { value: string }>(
        "SELECT value FROM memory_alternatives WHERE memory_id = ?"
      )
      .all(memory.id)
      .map((r) => r.value);
    expect(alts).toEqual(expect.arrayContaining(memory.alternativesRejected));
  });

  it("saves risks to memory_risks", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const risks = db
      .prepare<[string], { value: string }>(
        "SELECT value FROM memory_risks WHERE memory_id = ?"
      )
      .all(memory.id)
      .map((r) => r.value);
    expect(risks).toEqual(expect.arrayContaining(memory.risks));
  });

  it("saves followUps to memory_followups", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const followUps = db
      .prepare<[string], { value: string }>(
        "SELECT value FROM memory_followups WHERE memory_id = ?"
      )
      .all(memory.id)
      .map((r) => r.value);
    expect(followUps).toEqual(expect.arrayContaining(memory.followUps));
  });

  it("prevents duplicate junction rows on re-insert attempt", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    // Manually try to insert a duplicate file — should be silently ignored
    db.prepare("INSERT OR IGNORE INTO memory_files (memory_id, file_path) VALUES (?, ?)").run(
      memory.id,
      memory.files[0]
    );
    const files = db
      .prepare<[string], { file_path: string }>(
        "SELECT file_path FROM memory_files WHERE memory_id = ?"
      )
      .all(memory.id);
    expect(files.length).toBe(memory.files.length);
  });
});

describe("getMemoryById", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("retrieves a memory by ID with all junction data", () => {
    const memory = makeMemory();
    saveMemory(db, memory);
    const retrieved = getMemoryById(db, memory.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(memory.id);
    expect(retrieved?.files).toEqual(expect.arrayContaining(memory.files));
    expect(retrieved?.tags).toEqual(expect.arrayContaining(memory.tags));
    expect(retrieved?.risks).toEqual(expect.arrayContaining(memory.risks));
    expect(retrieved?.followUps).toEqual(expect.arrayContaining(memory.followUps));
  });

  it("returns null for unknown ID", () => {
    expect(getMemoryById(db, "nonexistent")).toBeNull();
  });
});

describe("getMemoryByCommit", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("retrieves memory by commit SHA", () => {
    const memory = makeMemory({ commitSha: "deadbeef1234" });
    saveMemory(db, memory);
    const retrieved = getMemoryByCommit(db, "deadbeef1234");
    expect(retrieved?.id).toBe(memory.id);
  });

  it("returns null for unknown commit", () => {
    expect(getMemoryByCommit(db, "unknown")).toBeNull();
  });
});

describe("generateMemoryId", () => {
  it("generates IDs with mem_ prefix", () => {
    expect(generateMemoryId()).toMatch(/^mem_/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, generateMemoryId));
    expect(ids.size).toBe(100);
  });
});

describe("buildEmbeddingText", () => {
  it("concatenates all content fields", () => {
    const memory = makeMemory();
    const text = buildEmbeddingText(memory);
    expect(text).toContain(memory.intent);
    expect(text).toContain(memory.decision);
    expect(text).toContain(memory.why);
    expect(text).toContain(memory.files[0]);
    expect(text).toContain(memory.tags[0]);
  });
});
