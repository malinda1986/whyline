import { z } from "zod";
export declare const SearchMemoryInput: z.ZodObject<{
    repoPath: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    query: z.ZodString;
    files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    files?: string[] | undefined;
    repoId?: string | undefined;
    repoPath?: string | undefined;
}, {
    query: string;
    files?: string[] | undefined;
    repoId?: string | undefined;
    repoPath?: string | undefined;
    limit?: number | undefined;
}>;
export declare const SaveMemoryInput: z.ZodObject<{
    repoPath: z.ZodOptional<z.ZodString>;
    commitSha: z.ZodOptional<z.ZodString>;
    files: z.ZodArray<z.ZodString, "many">;
    task: z.ZodOptional<z.ZodString>;
    intent: z.ZodString;
    summary: z.ZodString;
    decision: z.ZodString;
    why: z.ZodString;
    alternativesRejected: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    risks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    followUps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    source: z.ZodDefault<z.ZodEnum<["manual", "claude-code", "cli", "hook"]>>;
}, "strip", z.ZodTypeAny, {
    intent: string;
    summary: string;
    decision: string;
    why: string;
    risks: string[];
    tags: string[];
    alternativesRejected: string[];
    followUps: string[];
    files: string[];
    source: "manual" | "claude-code" | "cli" | "hook";
    task?: string | undefined;
    commitSha?: string | undefined;
    repoPath?: string | undefined;
}, {
    intent: string;
    summary: string;
    decision: string;
    why: string;
    files: string[];
    task?: string | undefined;
    risks?: string[] | undefined;
    tags?: string[] | undefined;
    alternativesRejected?: string[] | undefined;
    followUps?: string[] | undefined;
    commitSha?: string | undefined;
    repoPath?: string | undefined;
    source?: "manual" | "claude-code" | "cli" | "hook" | undefined;
}>;
export declare const GetCommitMemoryInput: z.ZodObject<{
    repoPath: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    commitSha: z.ZodString;
}, "strip", z.ZodTypeAny, {
    commitSha: string;
    repoId?: string | undefined;
    repoPath?: string | undefined;
}, {
    commitSha: string;
    repoId?: string | undefined;
    repoPath?: string | undefined;
}>;
export declare const GetFileMemoriesInput: z.ZodObject<{
    repoPath: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    filePath: string;
    repoId?: string | undefined;
    repoPath?: string | undefined;
}, {
    filePath: string;
    repoId?: string | undefined;
    repoPath?: string | undefined;
    limit?: number | undefined;
}>;
export type SearchMemoryInputType = z.infer<typeof SearchMemoryInput>;
export type SaveMemoryInputType = z.infer<typeof SaveMemoryInput>;
export type GetCommitMemoryInputType = z.infer<typeof GetCommitMemoryInput>;
export type GetFileMemoriesInputType = z.infer<typeof GetFileMemoriesInput>;
