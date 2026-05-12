import type Database from "better-sqlite3";
import type { CodingMemory, ScoreBreakdown, SearchResult } from "./types.js";
export type SearchOptions = {
    query: string;
    repoId?: string;
    repoPath?: string;
    files?: string[];
    limit?: number;
};
export declare function scoreMemory(memory: CodingMemory, query: string, contextRepoId: string | null, contextFiles: string[]): ScoreBreakdown;
export declare function explainRelevance(scores: ScoreBreakdown): string;
export declare function searchMemory(db: Database.Database, options: SearchOptions): SearchResult[];
