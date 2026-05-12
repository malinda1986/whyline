import fs from "fs";
import path from "path";
import { DATA_DIR, DB_PATH, CONFIG_PATH, AppConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { runMigrations } from "../db/migrations.js";

type InitOptions = {
  dataDir?: string;
};

export function runInit(options: InitOptions = {}): void {
  const dataDir = options.dataDir ?? DATA_DIR;
  const dbPath = options.dataDir ? path.join(options.dataDir, "memory.db") : DB_PATH;
  const configPath = options.dataDir ? path.join(options.dataDir, "config.json") : CONFIG_PATH;

  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(configPath)) {
    const config: AppConfig = {
      version: 1,
      storage: { dbPath },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  const db = openDb(dbPath);
  runMigrations(db);
  db.close();

  console.log(`Initialized coding-memory at ${dataDir}`);
}
