import type Database from "better-sqlite3";
import type { CodingMemory, ScoreBreakdown, SearchResult } from "./types.js";
import {
  getMemoriesByRepoId,
  getMemoriesByRepoPath,
  getAllMemories,
} from "./saveMemory.js";

export type SearchOptions = {
  query: string;
  repoId?: string;
  repoPath?: string;
  files?: string[];
  limit?: number;
};

export function scoreMemory(
  memory: CodingMemory,
  query: string,
  contextRepoId: string | null,
  contextFiles: string[]
): ScoreBreakdown {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    const sameRepo = contextRepoId && memory.repoId === contextRepoId ? 10 : 0;
    const ageMs = Date.now() - new Date(memory.createdAt).getTime();
    const recency = ageMs < 30 * 24 * 60 * 60 * 1000 ? 1 : 0;
    return { total: sameRepo + recency, sameRepo, fileOverlap: 0, tagMatch: 0, decisionMatch: 0, whyMatch: 0, summaryMatch: 0, filePathMatch: 0, recency };
  }

  const hasKeyword = (text: string): boolean =>
    words.some((w) => text.toLowerCase().includes(w));

  const sameRepo = contextRepoId && memory.repoId === contextRepoId ? 10 : 0;
  const fileOverlap = contextFiles.some((f) => memory.files.includes(f)) ? 8 : 0;
  const tagMatch = memory.tags.some(hasKeyword) ? 5 : 0;
  const decisionMatch = hasKeyword(memory.decision) ? 4 : 0;
  const whyMatch = hasKeyword(memory.why) ? 3 : 0;
  const summaryMatch = hasKeyword(memory.summary) ? 2 : 0;
  const filePathMatch = memory.files.some(hasKeyword) ? 2 : 0;

  const ageMs = Date.now() - new Date(memory.createdAt).getTime();
  const recency = ageMs < 30 * 24 * 60 * 60 * 1000 ? 1 : 0;

  const total =
    sameRepo +
    fileOverlap +
    tagMatch +
    decisionMatch +
    whyMatch +
    summaryMatch +
    filePathMatch +
    recency;

  return {
    total,
    sameRepo,
    fileOverlap,
    tagMatch,
    decisionMatch,
    whyMatch,
    summaryMatch,
    filePathMatch,
    recency,
  };
}

export function explainRelevance(scores: ScoreBreakdown): string {
  const parts: string[] = [];
  if (scores.sameRepo) parts.push(`same repo (+${scores.sameRepo})`);
  if (scores.fileOverlap) parts.push(`file overlap (+${scores.fileOverlap})`);
  if (scores.tagMatch) parts.push(`tag match (+${scores.tagMatch})`);
  if (scores.decisionMatch) parts.push(`keyword in decision (+${scores.decisionMatch})`);
  if (scores.whyMatch) parts.push(`keyword in why (+${scores.whyMatch})`);
  if (scores.summaryMatch) parts.push(`keyword in summary (+${scores.summaryMatch})`);
  if (scores.filePathMatch) parts.push(`keyword in file path (+${scores.filePathMatch})`);
  if (scores.recency) parts.push(`recent memory (+${scores.recency})`);
  return parts.length ? `Matched: ${parts.join(", ")}` : "No specific match factors";
}

export function searchMemory(db: Database.Database, options: SearchOptions): SearchResult[] {
  const { query, repoId, repoPath, files = [], limit = 10 } = options;

  let memories: CodingMemory[] = [];

  if (repoId) {
    memories = getMemoriesByRepoId(db, repoId);
    // Fallback to repo path search if repo ID yields no results
    if (memories.length === 0 && repoPath) {
      memories = getMemoriesByRepoPath(db, repoPath);
    }
  } else if (repoPath) {
    memories = getMemoriesByRepoPath(db, repoPath);
  } else {
    memories = getAllMemories(db);
  }

  const emptyQuery = query.trim() === "";

  const results: SearchResult[] = memories
    .map((memory) => {
      const score = scoreMemory(memory, query, repoId ?? null, files);
      return {
        memory,
        score,
        relevanceReason: explainRelevance(score),
      };
    })
    .filter((r) => {
      if (emptyQuery) return true;
      // Require at least one content-based component to match
      const contentScore =
        r.score.fileOverlap +
        r.score.tagMatch +
        r.score.decisionMatch +
        r.score.whyMatch +
        r.score.summaryMatch +
        r.score.filePathMatch;
      return contentScore > 0;
    })
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);

  return results;
}
