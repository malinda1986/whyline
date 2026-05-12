import crypto from "crypto";
import type Database from "better-sqlite3";
import type { CodingMemory } from "./types.js";

export function generateMemoryId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `mem_${timestamp}${random}`;
}

export function buildEmbeddingText(
  memory: Pick<
    CodingMemory,
    | "intent"
    | "summary"
    | "decision"
    | "why"
    | "alternativesRejected"
    | "risks"
    | "followUps"
    | "tags"
    | "files"
    | "commitSha"
  >
): string {
  return [
    memory.intent,
    memory.summary,
    memory.decision,
    memory.why,
    ...memory.alternativesRejected,
    ...memory.risks,
    ...memory.followUps,
    ...memory.tags,
    ...memory.files,
    memory.commitSha ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function saveMemory(db: Database.Database, memory: CodingMemory): void {
  const insertMemory = db.prepare(`
    INSERT INTO memories (
      id, created_at, updated_at,
      repo_id, repo_path, repo_name, branch, commit_sha,
      task, intent, summary, decision, why,
      source, raw_transcript_path, embedding_text
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const insertFile = db.prepare(
    "INSERT OR IGNORE INTO memory_files (memory_id, file_path) VALUES (?, ?)"
  );
  const insertTag = db.prepare(
    "INSERT OR IGNORE INTO memory_tags (memory_id, tag) VALUES (?, ?)"
  );
  const insertAlt = db.prepare(
    "INSERT OR IGNORE INTO memory_alternatives (memory_id, value) VALUES (?, ?)"
  );
  const insertRisk = db.prepare(
    "INSERT OR IGNORE INTO memory_risks (memory_id, value) VALUES (?, ?)"
  );
  const insertFollowup = db.prepare(
    "INSERT OR IGNORE INTO memory_followups (memory_id, value) VALUES (?, ?)"
  );

  const run = db.transaction(() => {
    insertMemory.run(
      memory.id,
      memory.createdAt,
      memory.updatedAt,
      memory.repoId,
      memory.repoPath ?? null,
      memory.repoName ?? null,
      memory.branch ?? null,
      memory.commitSha ?? null,
      memory.task ?? null,
      memory.intent,
      memory.summary,
      memory.decision,
      memory.why,
      memory.source,
      memory.rawTranscriptPath ?? null,
      memory.embeddingText
    );
    for (const f of memory.files) insertFile.run(memory.id, f);
    for (const t of memory.tags) insertTag.run(memory.id, t);
    for (const a of memory.alternativesRejected) insertAlt.run(memory.id, a);
    for (const r of memory.risks) insertRisk.run(memory.id, r);
    for (const fu of memory.followUps) insertFollowup.run(memory.id, fu);
  });

  run();
}

type MemoryRow = {
  id: string;
  created_at: string;
  updated_at: string;
  repo_id: string;
  repo_path: string | null;
  repo_name: string | null;
  branch: string | null;
  commit_sha: string | null;
  task: string | null;
  intent: string;
  summary: string;
  decision: string;
  why: string;
  source: string;
  raw_transcript_path: string | null;
  embedding_text: string;
};

function hydrateMemory(db: Database.Database, row: MemoryRow): CodingMemory {
  const files = db
    .prepare<[string], { file_path: string }>(
      "SELECT file_path FROM memory_files WHERE memory_id = ?"
    )
    .all(row.id)
    .map((r) => r.file_path);

  const tags = db
    .prepare<[string], { tag: string }>("SELECT tag FROM memory_tags WHERE memory_id = ?")
    .all(row.id)
    .map((r) => r.tag);

  const alternativesRejected = db
    .prepare<[string], { value: string }>(
      "SELECT value FROM memory_alternatives WHERE memory_id = ?"
    )
    .all(row.id)
    .map((r) => r.value);

  const risks = db
    .prepare<[string], { value: string }>(
      "SELECT value FROM memory_risks WHERE memory_id = ?"
    )
    .all(row.id)
    .map((r) => r.value);

  const followUps = db
    .prepare<[string], { value: string }>(
      "SELECT value FROM memory_followups WHERE memory_id = ?"
    )
    .all(row.id)
    .map((r) => r.value);

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    repoId: row.repo_id,
    repoPath: row.repo_path ?? undefined,
    repoName: row.repo_name ?? undefined,
    branch: row.branch ?? undefined,
    commitSha: row.commit_sha ?? undefined,
    task: row.task ?? undefined,
    intent: row.intent,
    summary: row.summary,
    decision: row.decision,
    why: row.why,
    source: row.source as CodingMemory["source"],
    rawTranscriptPath: row.raw_transcript_path ?? undefined,
    embeddingText: row.embedding_text,
    files,
    tags,
    alternativesRejected,
    risks,
    followUps,
  };
}

export function getMemoryById(db: Database.Database, id: string): CodingMemory | null {
  const row = db
    .prepare<[string], MemoryRow>("SELECT * FROM memories WHERE id = ?")
    .get(id);
  return row ? hydrateMemory(db, row) : null;
}

export function getMemoryByCommit(db: Database.Database, commitSha: string): CodingMemory | null {
  const row = db
    .prepare<[string], MemoryRow>("SELECT * FROM memories WHERE commit_sha = ? LIMIT 1")
    .get(commitSha);
  return row ? hydrateMemory(db, row) : null;
}

export function getMemoriesByCommit(db: Database.Database, commitSha: string): CodingMemory[] {
  const rows = db
    .prepare<[string], MemoryRow>("SELECT * FROM memories WHERE commit_sha = ?")
    .all(commitSha);
  return rows.map((r) => hydrateMemory(db, r));
}

export function getMemoriesByFile(
  db: Database.Database,
  repoId: string | null,
  filePath: string,
  limit: number
): CodingMemory[] {
  let rows: MemoryRow[];
  if (repoId) {
    rows = db
      .prepare<[string, string, number], MemoryRow>(
        `SELECT m.* FROM memories m
         JOIN memory_files f ON f.memory_id = m.id
         WHERE m.repo_id = ? AND f.file_path = ?
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(repoId, filePath, limit);
  } else {
    rows = db
      .prepare<[string, number], MemoryRow>(
        `SELECT m.* FROM memories m
         JOIN memory_files f ON f.memory_id = m.id
         WHERE f.file_path = ?
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(filePath, limit);
  }
  return rows.map((r) => hydrateMemory(db, r));
}

export function getAllMemories(db: Database.Database): CodingMemory[] {
  const rows = db
    .prepare<[], MemoryRow>("SELECT * FROM memories ORDER BY created_at DESC")
    .all();
  return rows.map((r) => hydrateMemory(db, r));
}

export function getMemoriesByRepoId(db: Database.Database, repoId: string): CodingMemory[] {
  const rows = db
    .prepare<[string], MemoryRow>(
      "SELECT * FROM memories WHERE repo_id = ? ORDER BY created_at DESC"
    )
    .all(repoId);
  return rows.map((r) => hydrateMemory(db, r));
}

export function getMemoriesByRepoPath(db: Database.Database, repoPath: string): CodingMemory[] {
  const rows = db
    .prepare<[string], MemoryRow>(
      "SELECT * FROM memories WHERE repo_path LIKE ? ORDER BY created_at DESC"
    )
    .all(`%${repoPath}%`);
  return rows.map((r) => hydrateMemory(db, r));
}
