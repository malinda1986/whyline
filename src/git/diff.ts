import { execSync } from "child_process";

export function getChangedFilesForCommit(repoRoot: string, commitSha: string): string[] {
  try {
    // --name-status gives type + paths; we parse renames to include both old and new paths
    const output = execSync(`git diff-tree --no-commit-id -r --name-status ${commitSha}`, {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    const paths = new Set<string>();
    for (const line of output.trim().split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      const status = parts[0];
      if (status.startsWith("R") || status.startsWith("C")) {
        // Rename or copy: parts[1] = old path, parts[2] = new path
        if (parts[1]) paths.add(parts[1]);
        if (parts[2]) paths.add(parts[2]);
      } else {
        // Added, modified, deleted: parts[1] = path
        if (parts[1]) paths.add(parts[1]);
      }
    }
    return [...paths];
  } catch {
    return [];
  }
}

export function getFileRenameHistory(repoRoot: string, filePath: string): string[] {
  try {
    const output = execSync(
      `git log --follow --name-only --format="" -- ${filePath}`,
      { cwd: repoRoot, encoding: "utf-8" }
    );
    const paths = new Set<string>([filePath]);
    for (const line of output.trim().split("\n").filter(Boolean)) {
      paths.add(line.trim());
    }
    return [...paths];
  } catch {
    return [filePath];
  }
}
