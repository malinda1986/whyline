import type Database from "better-sqlite3";
import { MIGRATIONS } from "./schema.js";

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = db
    .prepare<[], { version: number }>("SELECT version FROM migrations ORDER BY version")
    .all()
    .map((r) => r.version);

  const pending = MIGRATIONS.filter((m) => !applied.includes(m.version));

  for (const migration of pending) {
    db.exec(migration.sql);
    db.prepare("INSERT INTO migrations (version, applied_at) VALUES (?, ?)").run(
      migration.version,
      new Date().toISOString()
    );
  }
}
