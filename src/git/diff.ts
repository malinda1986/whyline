import { execSync } from "child_process";

export function getChangedFilesForCommit(repoRoot: string, commitSha: string): string[] {
  try {
    const output = execSync(`git diff-tree --no-commit-id -r --name-only ${commitSha}`, {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
