export type WriteStatus = "created" | "updated" | "unchanged";

export type WriteResult = {
  path: string;
  status: WriteStatus;
};

export interface ToolAdapter {
  readonly toolName: string;
  readonly displayName: string;
  readonly configPath: string;
  readonly instructionPath: string;
  writeConfig(repoRoot: string): WriteResult;
  writeInstructions(repoRoot: string, repoPath: string): WriteResult;
  writePermissions?(repoRoot: string): WriteResult;
}
