import crypto from "crypto";
export function generateMemoryId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    return `mem_${timestamp}${random}`;
}
export function buildEmbeddingText(memory) {
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
export function saveMemory(db, memory) {
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
    const insertFile = db.prepare("INSERT OR IGNORE INTO memory_files (memory_id, file_path) VALUES (?, ?)");
    const insertTag = db.prepare("INSERT OR IGNORE INTO memory_tags (memory_id, tag) VALUES (?, ?)");
    const insertAlt = db.prepare("INSERT OR IGNORE INTO memory_alternatives (memory_id, value) VALUES (?, ?)");
    const insertRisk = db.prepare("INSERT OR IGNORE INTO memory_risks (memory_id, value) VALUES (?, ?)");
    const insertFollowup = db.prepare("INSERT OR IGNORE INTO memory_followups (memory_id, value) VALUES (?, ?)");
    const run = db.transaction(() => {
        insertMemory.run(memory.id, memory.createdAt, memory.updatedAt, memory.repoId, memory.repoPath ?? null, memory.repoName ?? null, memory.branch ?? null, memory.commitSha ?? null, memory.task ?? null, memory.intent, memory.summary, memory.decision, memory.why, memory.source, memory.rawTranscriptPath ?? null, memory.embeddingText);
        for (const f of memory.files)
            insertFile.run(memory.id, f);
        for (const t of memory.tags)
            insertTag.run(memory.id, t);
        for (const a of memory.alternativesRejected)
            insertAlt.run(memory.id, a);
        for (const r of memory.risks)
            insertRisk.run(memory.id, r);
        for (const fu of memory.followUps)
            insertFollowup.run(memory.id, fu);
    });
    run();
}
function hydrateMemory(db, row) {
    const files = db
        .prepare("SELECT file_path FROM memory_files WHERE memory_id = ?")
        .all(row.id)
        .map((r) => r.file_path);
    const tags = db
        .prepare("SELECT tag FROM memory_tags WHERE memory_id = ?")
        .all(row.id)
        .map((r) => r.tag);
    const alternativesRejected = db
        .prepare("SELECT value FROM memory_alternatives WHERE memory_id = ?")
        .all(row.id)
        .map((r) => r.value);
    const risks = db
        .prepare("SELECT value FROM memory_risks WHERE memory_id = ?")
        .all(row.id)
        .map((r) => r.value);
    const followUps = db
        .prepare("SELECT value FROM memory_followups WHERE memory_id = ?")
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
        source: row.source,
        rawTranscriptPath: row.raw_transcript_path ?? undefined,
        embeddingText: row.embedding_text,
        files,
        tags,
        alternativesRejected,
        risks,
        followUps,
    };
}
export function getMemoryById(db, id) {
    const row = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(id);
    return row ? hydrateMemory(db, row) : null;
}
export function getMemoryByCommit(db, commitSha) {
    const row = db
        .prepare("SELECT * FROM memories WHERE commit_sha = ? LIMIT 1")
        .get(commitSha);
    return row ? hydrateMemory(db, row) : null;
}
export function getMemoriesByCommit(db, commitSha) {
    const rows = db
        .prepare("SELECT * FROM memories WHERE commit_sha = ?")
        .all(commitSha);
    return rows.map((r) => hydrateMemory(db, r));
}
export function getMemoriesByFile(db, repoId, filePath, limit) {
    let rows;
    if (repoId) {
        rows = db
            .prepare(`SELECT m.* FROM memories m
         JOIN memory_files f ON f.memory_id = m.id
         WHERE m.repo_id = ? AND f.file_path = ?
         ORDER BY m.created_at DESC
         LIMIT ?`)
            .all(repoId, filePath, limit);
    }
    else {
        rows = db
            .prepare(`SELECT m.* FROM memories m
         JOIN memory_files f ON f.memory_id = m.id
         WHERE f.file_path = ?
         ORDER BY m.created_at DESC
         LIMIT ?`)
            .all(filePath, limit);
    }
    return rows.map((r) => hydrateMemory(db, r));
}
export function getAllMemories(db) {
    const rows = db
        .prepare("SELECT * FROM memories ORDER BY created_at DESC")
        .all();
    return rows.map((r) => hydrateMemory(db, r));
}
export function getMemoriesByRepoId(db, repoId) {
    const rows = db
        .prepare("SELECT * FROM memories WHERE repo_id = ? ORDER BY created_at DESC")
        .all(repoId);
    return rows.map((r) => hydrateMemory(db, r));
}
export function getMemoriesByRepoPath(db, repoPath) {
    const rows = db
        .prepare("SELECT * FROM memories WHERE repo_path LIKE ? ORDER BY created_at DESC")
        .all(`%${repoPath}%`);
    return rows.map((r) => hydrateMemory(db, r));
}
//# sourceMappingURL=saveMemory.js.map