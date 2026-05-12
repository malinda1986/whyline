import { getRepoRoot, getCurrentBranch, resolveCommit } from "../git/git.js";
import { getRepoId, getRepoName } from "../git/repoId.js";
import { getChangedFilesForCommit } from "../git/diff.js";
import type { RepoContext } from "./types.js";

export function getRepoContext(cwd: string, commitRef: string): RepoContext {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) throw new Error("Not inside a git repository");

  const commitSha = resolveCommit(repoRoot, commitRef);
  const repoId = getRepoId(repoRoot);
  const repoName = getRepoName(repoRoot);
  const branch = getCurrentBranch(repoRoot);
  const changedFiles = getChangedFilesForCommit(repoRoot, commitSha);

  return {
    repoRoot,
    repoId,
    repoPath: repoRoot,
    repoName,
    branch,
    commitSha,
    changedFiles,
  };
}
