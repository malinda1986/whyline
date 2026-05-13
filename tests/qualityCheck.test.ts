import { describe, it, expect, beforeEach } from "vitest";
import { checkQuality, checkDuplicates } from "../src/memory/qualityCheck.js";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, generateMemoryId } from "../src/memory/saveMemory.js";
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
    commitSha: "abc12345",
    files: ["src/auth/session.ts"],
    tags: ["auth"],
    intent: "Add refresh token rotation to prevent replay attacks",
    summary: "Implemented token rotation on every use",
    decision: "Rotate tokens on every request",
    why: "One-time-use tokens prevent replay attacks in auth flow",
    alternativesRejected: ["Long-lived tokens"],
    risks: ["Token invalidation race condition"],
    followUps: ["Add rotation tests"],
    source: "cli",
    embeddingText: "Add refresh token rotation",
    ...overrides,
  };
}

describe("checkQuality", () => {
  it("returns no warnings for good fields", () => {
    const warnings = checkQuality({
      intent: "Add refresh token rotation to prevent replay attacks",
      decision: "Rotate tokens on every request to invalidate old ones",
      why: "One-time-use tokens prevent replay attacks in the auth flow",
    });
    expect(warnings).toHaveLength(0);
  });

  it("warns when intent is too short", () => {
    const warnings = checkQuality({
      intent: "fix",
      decision: "Rotate tokens on every request to prevent replay attacks",
      why: "One-time-use tokens prevent replay attacks in auth flow",
    });
    expect(warnings.some((w) => w.field === "intent")).toBe(true);
  });

  it("warns when decision is too short", () => {
    const warnings = checkQuality({
      intent: "Add refresh token rotation to prevent replay attacks",
      decision: "done",
      why: "One-time-use tokens prevent replay attacks in auth flow",
    });
    expect(warnings.some((w) => w.field === "decision")).toBe(true);
  });

  it("warns when why is too short", () => {
    const warnings = checkQuality({
      intent: "Add refresh token rotation to prevent replay attacks",
      decision: "Rotate tokens on every request to prevent replay attacks",
      why: "wip",
    });
    expect(warnings.some((w) => w.field === "why")).toBe(true);
  });

  it("warns on filler phrases", () => {
    const warnings = checkQuality({
      intent: "updated the auth logic for session handling",
      decision: "done with the implementation details of token refresh",
      why: "fixed the issue that was causing problems in production",
    });
    const fillerWarnings = warnings.filter((w) => w.message.includes("filler"));
    expect(fillerWarnings.length).toBeGreaterThan(0);
  });

  it("warns on exact filler match", () => {
    const warnings = checkQuality({
      intent: "done",
      decision: "Rotate tokens on every request to prevent replay attacks",
      why: "One-time-use tokens prevent replay attacks in auth flow",
    });
    expect(warnings.some((w) => w.field === "intent")).toBe(true);
  });

  it("returns multiple warnings for multiple bad fields", () => {
    const warnings = checkQuality({
      intent: "fix",
      decision: "done",
      why: "wip",
    });
    expect(warnings.length).toBe(3);
  });
});

describe("checkDuplicates", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeTestDb(); });

  it("returns no warnings when no memories exist", () => {
    const warnings = checkDuplicates(db, makeMemory());
    expect(warnings).toHaveLength(0);
  });

  it("warns when a memory with the same commit SHA already exists", () => {
    const existing = makeMemory({ commitSha: "abc12345" });
    saveMemory(db, existing);

    const warnings = checkDuplicates(db, makeMemory({ commitSha: "abc12345" }));
    expect(warnings.some((w) => w.type === "same-commit")).toBe(true);
    expect(warnings[0].existingId).toBe(existing.id);
  });

  it("warns when a similar intent exists with overlapping files", () => {
    const existing = makeMemory({
      commitSha: "old123",
      intent: "Add refresh token rotation to prevent replay attacks",
      files: ["src/auth/session.ts"],
    });
    saveMemory(db, existing);

    const incoming = makeMemory({
      commitSha: "new456",
      intent: "Add refresh token rotation for auth security",
      files: ["src/auth/session.ts"],
    });
    const warnings = checkDuplicates(db, incoming);
    expect(warnings.some((w) => w.type === "similar-intent")).toBe(true);
  });

  it("does not warn for similar intent with no file overlap", () => {
    const existing = makeMemory({
      intent: "Add refresh token rotation to prevent replay attacks",
      files: ["src/auth/session.ts"],
    });
    saveMemory(db, existing);

    const incoming = makeMemory({
      commitSha: "new456",
      intent: "Add refresh token rotation for auth security",
      files: ["src/payments/checkout.ts"],
    });
    const warnings = checkDuplicates(db, incoming);
    expect(warnings.some((w) => w.type === "similar-intent")).toBe(false);
  });

  it("does not warn for different intents on the same files", () => {
    const existing = makeMemory({
      intent: "Add refresh token rotation to prevent replay attacks",
      files: ["src/auth/session.ts"],
    });
    saveMemory(db, existing);

    const incoming = makeMemory({
      commitSha: "new456",
      intent: "Fix payment gateway timeout on slow network connections",
      files: ["src/auth/session.ts"],
    });
    const warnings = checkDuplicates(db, incoming);
    expect(warnings.some((w) => w.type === "similar-intent")).toBe(false);
  });

  it("does not warn when repo IDs differ", () => {
    const existing = makeMemory({ repoId: "repo-abc", commitSha: "abc12345" });
    saveMemory(db, existing);

    const incoming = makeMemory({ repoId: "repo-xyz", commitSha: "abc12345" });
    const warnings = checkDuplicates(db, incoming);
    expect(warnings).toHaveLength(0);
  });
});
