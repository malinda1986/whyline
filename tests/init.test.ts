import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { runInit } from "../src/commands/init.js";
import { openDb } from "../src/db/connection.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "whyline-test-"));
}

describe("init command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the data directory", () => {
    const dataDir = path.join(tmpDir, "data");
    runInit({ dataDir });
    expect(fs.existsSync(dataDir)).toBe(true);
  });

  it("creates config.json with correct structure", () => {
    const dataDir = path.join(tmpDir, "data");
    runInit({ dataDir });
    const configPath = path.join(dataDir, "config.json");
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.version).toBe(1);
    expect(config.storage.dbPath).toContain("memory.db");
  });

  it("creates memory.db", () => {
    const dataDir = path.join(tmpDir, "data");
    runInit({ dataDir });
    expect(fs.existsSync(path.join(dataDir, "memory.db"))).toBe(true);
  });

  it("creates a valid SQLite database with all tables", () => {
    const dataDir = path.join(tmpDir, "data");
    runInit({ dataDir });
    const dbPath = path.join(dataDir, "memory.db");
    const db = openDb(dbPath);

    const tables = db
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map((r) => r.name);

    db.close();

    expect(tables).toContain("memories");
    expect(tables).toContain("memory_files");
    expect(tables).toContain("memory_tags");
    expect(tables).toContain("memory_alternatives");
    expect(tables).toContain("memory_risks");
    expect(tables).toContain("memory_followups");
    expect(tables).toContain("migrations");
  });

  it("records migration version in migrations table", () => {
    const dataDir = path.join(tmpDir, "data");
    runInit({ dataDir });
    const db = openDb(path.join(dataDir, "memory.db"));
    const rows = db
      .prepare<[], { version: number }>("SELECT version FROM migrations")
      .all();
    db.close();
    expect(rows.map((r) => r.version)).toContain(1);
  });

  it("is idempotent — second init does not throw or duplicate migrations", () => {
    const dataDir = path.join(tmpDir, "data");
    runInit({ dataDir });
    expect(() => runInit({ dataDir })).not.toThrow();

    const db = openDb(path.join(dataDir, "memory.db"));
    const rows = db
      .prepare<[], { version: number }>("SELECT version FROM migrations")
      .all();
    db.close();
    const versions = rows.map((r) => r.version);
    expect(versions.filter((v) => v === 1).length).toBe(1);
  });
});
