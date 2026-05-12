import { execSync } from "child_process";
export function getRepoRoot(cwd) {
    try {
        return execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf-8" }).trim();
    }
    catch {
        return null;
    }
}
export function getCurrentBranch(repoRoot) {
    try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", {
            cwd: repoRoot,
            encoding: "utf-8",
        }).trim();
        return branch === "HEAD" ? null : branch;
    }
    catch {
        return null;
    }
}
export function resolveCommit(repoRoot, ref) {
    return execSync(`git rev-parse ${ref}`, { cwd: repoRoot, encoding: "utf-8" }).trim();
}
//# sourceMappingURL=git.js.map