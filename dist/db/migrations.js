import { MIGRATIONS } from "./schema.js";
export function runMigrations(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
    const applied = db
        .prepare("SELECT version FROM migrations ORDER BY version")
        .all()
        .map((r) => r.version);
    const pending = MIGRATIONS.filter((m) => !applied.includes(m.version));
    for (const migration of pending) {
        db.exec(migration.sql);
        db.prepare("INSERT INTO migrations (version, applied_at) VALUES (?, ?)").run(migration.version, new Date().toISOString());
    }
}
//# sourceMappingURL=migrations.js.map