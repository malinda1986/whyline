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
  {
    version: 2,
    sql: `
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at);

      PRAGMA foreign_keys = OFF;

      CREATE TABLE memory_alternatives_new (
        memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        value     TEXT NOT NULL,
        UNIQUE(memory_id, value)
      );
      INSERT INTO memory_alternatives_new SELECT memory_id, value FROM memory_alternatives;
      DROP TABLE memory_alternatives;
      ALTER TABLE memory_alternatives_new RENAME TO memory_alternatives;

      CREATE TABLE memory_risks_new (
        memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        value     TEXT NOT NULL,
        UNIQUE(memory_id, value)
      );
      INSERT INTO memory_risks_new SELECT memory_id, value FROM memory_risks;
      DROP TABLE memory_risks;
      ALTER TABLE memory_risks_new RENAME TO memory_risks;

      CREATE TABLE memory_followups_new (
        memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        value     TEXT NOT NULL,
        UNIQUE(memory_id, value)
      );
      INSERT INTO memory_followups_new SELECT memory_id, value FROM memory_followups;
      DROP TABLE memory_followups;
      ALTER TABLE memory_followups_new RENAME TO memory_followups;

      PRAGMA foreign_keys = ON;
    `,
  },
];
