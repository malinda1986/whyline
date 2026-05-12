export type CodingMemory = {
  id: string;
  createdAt: string;
  updatedAt: string;

  repoId: string;
  repoPath?: string;
  repoName?: string;
  branch?: string;
  commitSha?: string;

  files: string[];
  tags: string[];

  task?: string;
  intent: string;
  summary: string;
  decision: string;
  why: string;

  alternativesRejected: string[];
  risks: string[];
  followUps: string[];

  source: "manual" | "claude-code" | "cli" | "hook";
  rawTranscriptPath?: string;

  embeddingText: string;
};

export type ScoreBreakdown = {
  total: number;
  sameRepo: number;
  fileOverlap: number;
  tagMatch: number;
  decisionMatch: number;
  whyMatch: number;
  summaryMatch: number;
  filePathMatch: number;
  recency: number;
};

export type SearchResult = {
  memory: CodingMemory;
  score: ScoreBreakdown;
  relevanceReason: string;
};

export type RepoContext = {
  repoRoot: string;
  repoId: string;
  repoPath: string;
  repoName: string;
  branch: string | null;
  commitSha: string;
  changedFiles: string[];
};
