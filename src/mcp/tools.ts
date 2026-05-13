import { z } from "zod";

export const SearchMemoryInput = z.object({
  repoPath: z.string().optional(),
  repoId: z.string().optional(),
  query: z.string(),
  files: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  since: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().int().positive().default(10),
});

export const SaveMemoryInput = z.object({
  repoPath: z.string().optional(),
  commitSha: z.string().optional(),
  files: z.array(z.string()),
  task: z.string().optional(),
  intent: z.string(),
  summary: z.string(),
  decision: z.string(),
  why: z.string(),
  alternativesRejected: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  source: z.enum(["manual", "claude-code", "cli", "hook"]).default("claude-code"),
});

export const GetCommitMemoryInput = z.object({
  repoPath: z.string().optional(),
  repoId: z.string().optional(),
  commitSha: z.string(),
});

export const GetFileMemoriesInput = z.object({
  repoPath: z.string().optional(),
  repoId: z.string().optional(),
  filePath: z.string(),
  limit: z.number().int().positive().default(10),
});

export const GetRecentMemoriesInput = z.object({
  repoPath: z.string().optional(),
  repoId: z.string().optional(),
  limit: z.number().int().positive().default(5),
});

export type SearchMemoryInputType = z.infer<typeof SearchMemoryInput>;
export type SaveMemoryInputType = z.infer<typeof SaveMemoryInput>;
export type GetCommitMemoryInputType = z.infer<typeof GetCommitMemoryInput>;
export type GetFileMemoriesInputType = z.infer<typeof GetFileMemoriesInput>;
export type GetRecentMemoriesInputType = z.infer<typeof GetRecentMemoriesInput>;
