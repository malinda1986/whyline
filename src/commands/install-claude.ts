import { runInstall } from "./install.js";

export async function runInstallClaude(options: { repoPath?: string }): Promise<void> {
  return runInstall({ tool: "claude", repoPath: options.repoPath });
}
