import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { searchMemory } from "../memory/searchMemory.js";
import {
  saveMemory,
  generateMemoryId,
  buildEmbeddingText,
  getMemoriesByCommit,
  getMemoriesByFile,
} from "../memory/saveMemory.js";
import { getRepoId } from "../git/repoId.js";
import { redactSecrets } from "../memory/redactSecrets.js";
import {
  SearchMemoryInput,
  SaveMemoryInput,
  GetCommitMemoryInput,
  GetFileMemoriesInput,
} from "./tools.js";
import type { CodingMemory } from "../memory/types.js";

function resolveRepoId(repoPath?: string, repoId?: string): string | undefined {
  if (repoId) return repoId;
  if (repoPath) {
    try {
      return getRepoId(repoPath);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function createMcpServer(): Promise<void> {
  const server = new Server(
    { name: "whyline", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_coding_memory",
        description:
          "Search stored coding memories by keyword. Returns relevant memories with reasoning about why and tradeoffs made.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            repoPath: { type: "string", description: "Absolute path to the git repository" },
            repoId: { type: "string", description: "Repository ID (hash)" },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Filter by file paths",
            },
            limit: { type: "number", description: "Max results (default 10)" },
          },
          required: ["query"],
        },
      },
      {
        name: "save_coding_memory",
        description: "Save a new coding memory with reasoning, decisions, and context.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string" },
            commitSha: { type: "string" },
            files: { type: "array", items: { type: "string" } },
            task: { type: "string" },
            intent: { type: "string" },
            summary: { type: "string" },
            decision: { type: "string" },
            why: { type: "string" },
            alternativesRejected: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
            followUps: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            source: {
              type: "string",
              enum: ["manual", "claude-code", "cli", "hook"],
            },
          },
          required: ["files", "intent", "summary", "decision", "why"],
        },
      },
      {
        name: "get_commit_memory",
        description: "Get coding memories associated with a specific git commit.",
        inputSchema: {
          type: "object",
          properties: {
            commitSha: { type: "string" },
            repoPath: { type: "string" },
            repoId: { type: "string" },
          },
          required: ["commitSha"],
        },
      },
      {
        name: "get_file_memories",
        description: "Get coding memories that touch a specific file path.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            repoPath: { type: "string" },
            repoId: { type: "string" },
            limit: { type: "number" },
          },
          required: ["filePath"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const db = openDb(resolveConfig().storage.dbPath);
    try {
      switch (request.params.name) {
        case "search_coding_memory": {
          const input = SearchMemoryInput.parse(request.params.arguments);
          const resolvedRepoId = resolveRepoId(input.repoPath, input.repoId);
          const results = searchMemory(db, {
            query: input.query,
            repoId: resolvedRepoId,
            repoPath: input.repoPath,
            files: input.files,
            limit: input.limit,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  memories: results.map((r) => ({
                    id: r.memory.id,
                    commitSha: r.memory.commitSha,
                    files: r.memory.files,
                    intent: r.memory.intent,
                    summary: r.memory.summary,
                    decision: r.memory.decision,
                    why: r.memory.why,
                    alternativesRejected: r.memory.alternativesRejected,
                    risks: r.memory.risks,
                    followUps: r.memory.followUps,
                    tags: r.memory.tags,
                    relevanceReason: r.relevanceReason,
                  })),
                }),
              },
            ],
          };
        }

        case "save_coding_memory": {
          const input = SaveMemoryInput.parse(request.params.arguments);
          const resolvedRepoId = resolveRepoId(input.repoPath, undefined);
          const now = new Date().toISOString();
          const id = generateMemoryId();

          const memory: CodingMemory = {
            id,
            createdAt: now,
            updatedAt: now,
            repoId: resolvedRepoId ?? "unknown",
            repoPath: input.repoPath,
            commitSha: input.commitSha,
            files: input.files,
            tags: input.tags.map(redactSecrets),
            task: input.task ? redactSecrets(input.task) : undefined,
            intent: redactSecrets(input.intent),
            summary: redactSecrets(input.summary),
            decision: redactSecrets(input.decision),
            why: redactSecrets(input.why),
            alternativesRejected: input.alternativesRejected.map(redactSecrets),
            risks: input.risks.map(redactSecrets),
            followUps: input.followUps.map(redactSecrets),
            source: input.source,
            embeddingText: "",
          };
          memory.embeddingText = buildEmbeddingText(memory);

          saveMemory(db, memory);
          return {
            content: [{ type: "text", text: JSON.stringify({ id, saved: true }) }],
          };
        }

        case "get_commit_memory": {
          const input = GetCommitMemoryInput.parse(request.params.arguments);
          const memories = getMemoriesByCommit(db, input.commitSha);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  memories: memories.map((m) => ({
                    id: m.id,
                    intent: m.intent,
                    decision: m.decision,
                    why: m.why,
                    files: m.files,
                    risks: m.risks,
                    followUps: m.followUps,
                  })),
                }),
              },
            ],
          };
        }

        case "get_file_memories": {
          const input = GetFileMemoriesInput.parse(request.params.arguments);
          const resolvedRepoId = resolveRepoId(input.repoPath, input.repoId) ?? null;
          const memories = getMemoriesByFile(db, resolvedRepoId, input.filePath, input.limit);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  memories: memories.map((m) => ({
                    id: m.id,
                    commitSha: m.commitSha,
                    intent: m.intent,
                    decision: m.decision,
                    why: m.why,
                    risks: m.risks,
                    followUps: m.followUps,
                  })),
                }),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } finally {
      db.close();
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
