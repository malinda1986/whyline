export type Migration = {
  version: number;
  sql: string;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        repo_id TEXT NOT NULL,
        repo_path TEXT,
        repo_name TEXT,
        branch TEXT,
        commit_sha TEXT,
        task TEXT,
        intent TEXT NOT NULL,
        summary TEXT NOT NULL,
        decision TEXT NOT NULL,
        why TEXT NOT NULL,
        source TEXT NOT NULL,
        raw_transcript_path TEXT,
        embedding_text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_files (
        memory_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        PRIMARY KEY (memory_id, file_path),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_tags (
        memory_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (memory_id, tag),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_alternatives (
        memory_id TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(memory_id, value)
      );

      CREATE TABLE IF NOT EXISTS memory_risks (
        memory_id TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(memory_id, value)
      );

      CREATE TABLE IF NOT EXISTS memory_followups (
        memory_id TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(memory_id, value)
      );

      CREATE INDEX IF NOT EXISTS idx_memories_repo_id ON memories(repo_id);
      CREATE INDEX IF NOT EXISTS idx_memories_repo_path ON memories(repo_path);
      CREATE INDEX IF NOT EXISTS idx_memories_commit_sha ON memories(commit_sha);
      CREATE INDEX IF NOT EXISTS idx_memory_files_file_path ON memory_files(file_path);
      CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag);
    `,
  },
];
