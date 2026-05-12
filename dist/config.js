import os from "os";
import path from "path";
import fs from "fs";
export const DATA_DIR = path.join(os.homedir(), ".coding-memory");
export const DB_PATH = path.join(DATA_DIR, "memory.db");
export const CONFIG_PATH = path.join(DATA_DIR, "config.json");
export function resolveConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        return JSON.parse(raw);
    }
    return { version: 1, storage: { dbPath: DB_PATH } };
}
export function isInitialized() {
    return fs.existsSync(DB_PATH);
}
//# sourceMappingURL=config.js.map