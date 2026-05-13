import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, generateMemoryId, getAllMemories, getMemoryById } from "../src/memory/saveMemory.js";
import { runExport } from "../src/commands/export.js";
import { runImport } from "../src/commands/import.js";
import type { CodingMemory } from "../src/memory/types.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whyline-exportimport-"));
const dbPath = path.join(tmpDir, "memory.db");

vi.mock("../src/config.js", () => ({
  isInitialized: () => true,
  resolveConfig: () => ({ storage: { dbPath } }),
}));

import { vi } from "vitest";

type ExportEnvelope = { schemaVersion: number; memories: CodingMemory[] };

function readExport(file: string): ExportEnvelope {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as ExportEnvelope;
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
    summary: "Implemented refresh token rotation",
    decision: "Rotate tokens on every request",
    why: "One-time-use tokens prevent replay attacks",
    alternativesRejected: ["Use long-lived tokens"],
    risks: ["Requires client to handle new token on every response"],
    followUps: ["Monitor token churn rate"],
    source: "cli",
    embeddingText: "Add refresh token rotation to prevent replay attacks",
    ...overrides,
  };
}

describe("export", () => {
  let outFile: string;

  beforeEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const setupDb = openDb(dbPath);
    runMigrations(setupDb);
    setupDb.close();
    outFile = path.join(tmpDir, `export-${Date.now()}.json`);
  });

  it("exports JSON with schemaVersion envelope", async () => {
    const realDb = openDb(dbPath);
    saveMemory(realDb, makeMemory({ id: "mem_a" }));
    saveMemory(realDb, makeMemory({ id: "mem_b", repoId: "repo-xyz" }));
    realDb.close();

    await runExport({ format: "json", output: outFile, repo: false, tag: [], since: undefined, before: undefined });

    const envelope = readExport(outFile);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.memories.length).toBe(2);
    const ids = envelope.memories.map((m) => m.id);
    expect(ids).toContain("mem_a");
    expect(ids).toContain("mem_b");
  });

  it("exports as markdown with --format md", async () => {
    const realDb = openDb(dbPath);
    saveMemory(realDb, makeMemory({ id: "mem_md" }));
    realDb.close();

    const mdOut = path.join(tmpDir, "export.md");
    await runExport({ format: "md", output: mdOut, repo: false, tag: [], since: undefined, before: undefined });

    const text = fs.readFileSync(mdOut, "utf-8");
    expect(text).toContain("# mem_md");
    expect(text).toContain("Intent:");
    expect(text).toContain("Decision:");
  });

  it("--since filters out old memories", async () => {
    const realDb = openDb(dbPath);
    saveMemory(realDb, makeMemory({ id: "mem_old", createdAt: "2024-01-15T00:00:00.000Z" }));
    saveMemory(realDb, makeMemory({ id: "mem_new", createdAt: "2025-06-15T00:00:00.000Z" }));
    realDb.close();

    await runExport({ format: "json", output: outFile, repo: false, tag: [], since: "2025-01-01", before: undefined });

    const { memories } = readExport(outFile);
    expect(memories.length).toBe(1);
    expect(memories[0].id).toBe("mem_new");
  });

  it("--before filters out new memories", async () => {
    const realDb = openDb(dbPath);
    saveMemory(realDb, makeMemory({ id: "mem_old2", createdAt: "2024-01-15T00:00:00.000Z" }));
    saveMemory(realDb, makeMemory({ id: "mem_new2", createdAt: "2025-06-15T00:00:00.000Z" }));
    realDb.close();

    await runExport({ format: "json", output: outFile, repo: false, tag: [], since: undefined, before: "2024-12-31" });

    const { memories } = readExport(outFile);
    expect(memories.length).toBe(1);
    expect(memories[0].id).toBe("mem_old2");
  });

  it("--tag filters by tag", async () => {
    const realDb = openDb(dbPath);
    saveMemory(realDb, makeMemory({ id: "mem_auth", tags: ["auth"] }));
    saveMemory(realDb, makeMemory({ id: "mem_pay", tags: ["payments"], intent: "Add payment retry logic for failed gateway calls", decision: "Retry with backoff", why: "Transient failures should not block checkout" }));
    realDb.close();

    await runExport({ format: "json", output: outFile, repo: false, tag: ["auth"], since: undefined, before: undefined });

    const { memories } = readExport(outFile);
    expect(memories.length).toBe(1);
    expect(memories[0].id).toBe("mem_auth");
  });

  it("exports zero memories when no match", async () => {
    await runExport({ format: "json", output: outFile, repo: false, tag: ["nope"], since: undefined, before: undefined });
    const { schemaVersion, memories } = readExport(outFile);
    expect(schemaVersion).toBe(1);
    expect(memories.length).toBe(0);
  });
});

describe("import", () => {
  let importFile: string;

  beforeEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const setupDb = openDb(dbPath);
    runMigrations(setupDb);
    setupDb.close();
    importFile = path.join(tmpDir, `import-${Date.now()}.json`);
  });

  it("imports from v1 envelope format", async () => {
    const envelope = { schemaVersion: 1, memories: [makeMemory({ id: "mem_imp1" }), makeMemory({ id: "mem_imp2" })] };
    fs.writeFileSync(importFile, JSON.stringify(envelope));

    await runImport(importFile);

    const db = openDb(dbPath);
    const all = getAllMemories(db);
    db.close();
    expect(all.length).toBe(2);
  });

  it("imports from legacy bare array (backward compat)", async () => {
    const memories = [makeMemory({ id: "mem_legacy1" }), makeMemory({ id: "mem_legacy2" })];
    fs.writeFileSync(importFile, JSON.stringify(memories));

    await runImport(importFile);

    const db = openDb(dbPath);
    const all = getAllMemories(db);
    db.close();
    expect(all.length).toBe(2);
  });

  it("skips memories that already exist", async () => {
    const memory = makeMemory({ id: "mem_dup" });
    const realDb = openDb(dbPath);
    saveMemory(realDb, memory);
    realDb.close();

    fs.writeFileSync(importFile, JSON.stringify({ schemaVersion: 1, memories: [memory] }));
    await runImport(importFile);

    const db = openDb(dbPath);
    const all = getAllMemories(db);
    db.close();
    expect(all.length).toBe(1);
  });

  it("skips invalid entries and imports valid ones", async () => {
    const valid = makeMemory({ id: "mem_valid" });
    const invalid = { id: "bad", notAMemory: true };
    fs.writeFileSync(importFile, JSON.stringify({ schemaVersion: 1, memories: [valid, invalid] }));

    await runImport(importFile);

    const db = openDb(dbPath);
    const m = getMemoryById(db, "mem_valid");
    db.close();
    expect(m).not.toBeNull();
  });

  it("redacts secrets on import", async () => {
    const memory = makeMemory({
      id: "mem_secret",
      intent: "Add auth using token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234",
    });
    fs.writeFileSync(importFile, JSON.stringify({ schemaVersion: 1, memories: [memory] }));

    await runImport(importFile);

    const db = openDb(dbPath);
    const m = getMemoryById(db, "mem_secret");
    db.close();
    expect(m?.intent).toContain("[REDACTED_SECRET]");
    expect(m?.intent).not.toContain("ghp_");
  });

  it("rejects non-JSON files", async () => {
    fs.writeFileSync(importFile, "# Not JSON\n## Intent:\nSomething");
    await expect(runImport(importFile)).rejects.toThrow();
  });

  it("round-trips: export then import", async () => {
    const realDb = openDb(dbPath);
    saveMemory(realDb, makeMemory({ id: "mem_rt1" }));
    saveMemory(realDb, makeMemory({ id: "mem_rt2", repoId: "repo-xyz" }));
    realDb.close();

    await runExport({ format: "json", output: importFile, repo: false, tag: [], since: undefined, before: undefined });

    fs.unlinkSync(dbPath);
    const freshDb = openDb(dbPath);
    runMigrations(freshDb);
    freshDb.close();

    await runImport(importFile);

    const db = openDb(dbPath);
    const all = getAllMemories(db);
    db.close();
    expect(all.length).toBe(2);
    const ids = all.map((m) => m.id);
    expect(ids).toContain("mem_rt1");
    expect(ids).toContain("mem_rt2");
  });
});
