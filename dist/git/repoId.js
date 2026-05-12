import { execSync } from "child_process";
import crypto from "crypto";
import path from "path";
export function normalizeRemoteUrl(url) {
    return url
        .trim()
        .toLowerCase()
        .replace(/\.git$/, "")
        .replace(/^git@([^:]+):(.+)$/, "https://$1/$2");
}
export function getRepoId(repoRoot) {
    try {
        const remote = execSync("git config --get remote.origin.url", {
            cwd: repoRoot,
            encoding: "utf-8",
        }).trim();
        if (remote) {
            return crypto
                .createHash("sha256")
                .update(normalizeRemoteUrl(remote))
                .digest("hex")
                .slice(0, 32);
        }
    }
    catch {
        // no remote — fall through
    }
    return crypto
        .createHash("sha256")
        .update(path.resolve(repoRoot))
        .digest("hex")
        .slice(0, 32);
}
export function getRepoName(repoRoot) {
    try {
        const remote = execSync("git config --get remote.origin.url", {
            cwd: repoRoot,
            encoding: "utf-8",
        }).trim();
        if (remote) {
            return path.basename(normalizeRemoteUrl(remote));
        }
    }
    catch {
        // no remote
    }
    return path.basename(repoRoot);
}
//# sourceMappingURL=repoId.js.map