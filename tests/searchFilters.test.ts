import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, generateMemoryId } from "../src/memory/saveMemory.js";
import { searchMemory } from "../src/memory/searchMemory.js";
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
    tags: ["auth", "security"],
    intent: "Add refresh token rotation to prevent replay attacks",
    summary: "Implemented refresh token rotation",
    decision: "Rotate tokens on every request",
    why: "One-time-use tokens prevent replay attacks",
    alternativesRejected: [],
    risks: [],
    followUps: [],
    source: "cli",
    embeddingText: "Add refresh token rotation to prevent replay attacks",
    ...overrides,
  };
}

describe("search — tag filtering", () => {
  let db: Database.Database;
  beforeEach(() => { db = makeTestDb(); });

  it("returns only memories that have the requested tag", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), tags: ["auth", "security"] }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), tags: ["payments"], intent: "Add payment gateway retry logic for failed transactions", decision: "Retry with exponential backoff", why: "Transient failures should not block checkout permanently" }));

    const results = searchMemory(db, { query: "", tags: ["auth"] });
    expect(results.length).toBe(1);
    expect(results[0].memory.tags).toContain("auth");
  });

  it("returns only memories that have ALL requested tags", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), tags: ["auth", "security"] }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), tags: ["auth"], intent: "Add auth session expiry handling for idle users", decision: "Expire after 30 minutes idle", why: "Reduces attack surface for stolen sessions" }));

    const results = searchMemory(db, { query: "", tags: ["auth", "security"] });
    expect(results.length).toBe(1);
    expect(results[0].memory.tags).toContain("security");
  });

  it("is case-insensitive for tags", () => {
    saveMemory(db, makeMemory({ tags: ["Auth", "Security"] }));
    const results = searchMemory(db, { query: "", tags: ["auth"] });
    expect(results.length).toBe(1);
  });

  it("returns empty when no memory matches the tag", () => {
    saveMemory(db, makeMemory({ tags: ["auth"] }));
    const results = searchMemory(db, { query: "", tags: ["payments"] });
    expect(results.length).toBe(0);
  });

  it("works alongside a keyword query", () => {
    saveMemory(db, makeMemory({ tags: ["auth"], intent: "Add refresh token rotation to prevent replay attacks", decision: "Rotate tokens on every request", why: "One-time-use tokens prevent replay attacks" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), tags: ["payments"], intent: "Add retry logic for payment gateway token failures in checkout", decision: "Retry three times with backoff", why: "Token failures are transient and retryable" }));

    const results = searchMemory(db, { query: "token", tags: ["auth"] });
    expect(results.length).toBe(1);
    expect(results[0].memory.tags).toContain("auth");
  });
});

describe("search — date filters", () => {
  let db: Database.Database;
  beforeEach(() => { db = makeTestDb(); });

  it("--since filters out memories before the date", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-01-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-06-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2025-01-15T00:00:00.000Z" }));

    const results = searchMemory(db, { query: "", since: "2024-06-01" });
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(new Date(r.memory.createdAt).getTime()).toBeGreaterThanOrEqual(new Date("2024-06-01").getTime());
    }
  });

  it("--before filters out memories after the date", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-01-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-06-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2025-01-15T00:00:00.000Z" }));

    const results = searchMemory(db, { query: "", before: "2024-12-31" });
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(new Date(r.memory.createdAt).getTime()).toBeLessThanOrEqual(new Date("2024-12-31").getTime());
    }
  });

  it("--since and --before can be combined", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-01-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-06-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2025-01-15T00:00:00.000Z" }));

    const results = searchMemory(db, { query: "", since: "2024-03-01", before: "2024-12-31" });
    expect(results.length).toBe(1);
    expect(results[0].memory.createdAt).toBe("2024-06-15T00:00:00.000Z");
  });

  it("returns all when no date filters given", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-01-15T00:00:00.000Z" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2025-01-15T00:00:00.000Z" }));
    const results = searchMemory(db, { query: "" });
    expect(results.length).toBe(2);
  });

  it("date and tag filters can be combined", () => {
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-06-15T00:00:00.000Z", tags: ["auth"] }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2024-06-15T00:00:00.000Z", tags: ["payments"], intent: "Add payment gateway retry logic for failed transactions", decision: "Retry with exponential backoff", why: "Transient failures should not block checkout permanently" }));
    saveMemory(db, makeMemory({ id: generateMemoryId(), createdAt: "2023-01-01T00:00:00.000Z", tags: ["auth"], intent: "Implement auth session expiry for security compliance", decision: "Expire sessions after 30 minutes idle", why: "Reduces attack surface for stolen session tokens" }));

    const results = searchMemory(db, { query: "", tags: ["auth"], since: "2024-01-01" });
    expect(results.length).toBe(1);
    expect(results[0].memory.tags).toContain("auth");
    expect(results[0].memory.createdAt).toBe("2024-06-15T00:00:00.000Z");
  });
});
