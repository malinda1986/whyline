import os from "os";
import path from "path";
import fs from "fs";

export const DATA_DIR = path.join(os.homedir(), ".coding-memory");
export const DB_PATH = path.join(DATA_DIR, "memory.db");
export const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export type AppConfig = {
  version: number;
  storage: {
    dbPath: string;
  };
};

export function resolveConfig(): AppConfig {
  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as AppConfig;
  }
  return { version: 1, storage: { dbPath: DB_PATH } };
}

export function isInitialized(): boolean {
  return fs.existsSync(DB_PATH);
}
