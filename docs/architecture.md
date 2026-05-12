# Whyline — Architecture

## What it does

Whyline captures the reasoning behind code changes and makes it available to future AI coding sessions.

Git stores diffs. Whyline stores the *why* — the intent, the decision, the alternatives that were rejected, the risks that were acknowledged. It does this by sitting at two points in the development loop:

- **Session start** — searches past memories and surfaces relevant context to Claude before any code is touched
- **After commit** — synthesizes the conversation into a structured record and saves it to a local SQLite database

No cloud. No background daemon. No extra UI. Just a CLI and an MCP server.

---

## The development loop

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CC as Claude Code
    participant MCP as Whyline MCP Server
    participant DB as SQLite (~/.whyline/memory.db)
    participant Git as Git

    Dev->>CC: "Add retention policy for audit logs"
    CC->>MCP: search_coding_memory(query, repoPath, files)
    MCP->>DB: query memories by keyword + repo
    DB-->>MCP: ranked results with relevanceReason
    MCP-->>CC: past decisions surfaced
    CC-->>Dev: "Last time we touched this, we chose X because Y. Still the case?"

    Dev->>CC: work on task...
    CC->>Git: git commit

    Git-->>CC: commit SHA
    CC-->>Dev: "Here's what I'm saving — let me know if you want to add anything"
    Dev->>CC: (optional corrections)
    CC->>MCP: save_coding_memory(intent, decision, why, files, commitSha, ...)
    MCP->>DB: INSERT memory + junction tables
    DB-->>MCP: saved
    MCP-->>CC: { id, saved: true }
```

---

## System components

```mermaid
graph TB
    subgraph CLI["CLI (whyline)"]
        init[init]
        save[save]
        search[search]
        show[show]
        mcp_cmd[mcp]
    end

    subgraph MCP["MCP Server (stdio)"]
        search_tool[search_coding_memory]
        save_tool[save_coding_memory]
        commit_tool[get_commit_memory]
        file_tool[get_file_memories]
    end

    subgraph Memory["Memory Layer"]
        parseSummary[parseSummary\nmarkdown → structured]
        redact[redactSecrets\nscans all text fields]
        saveMemory[saveMemory\ndb.transaction]
        searchMemory[searchMemory\nkeyword scoring]
    end

    subgraph Git["Git Helpers"]
        repoId[repoId\nremote URL → hash]
        repoContext[repoContext\ncwd → RepoContext]
        diff[diff\ngit diff-tree]
    end

    subgraph DB["SQLite (~/.whyline/)"]
        memories[(memories)]
        files[(memory_files)]
        tags[(memory_tags)]
        alts[(memory_alternatives)]
        risks_t[(memory_risks)]
        followups[(memory_followups)]
    end

    save --> parseSummary
    save --> redact
    save --> repoContext
    save --> saveMemory

    search --> searchMemory
    show --> saveMemory

    save_tool --> redact
    save_tool --> saveMemory
    search_tool --> searchMemory
    commit_tool --> saveMemory
    file_tool --> saveMemory

    saveMemory --> memories
    saveMemory --> files
    saveMemory --> tags
    saveMemory --> alts
    saveMemory --> risks_t
    saveMemory --> followups

    repoContext --> repoId
    repoContext --> diff

    mcp_cmd --> MCP
```

---

## Data model

A single **memory** record captures one coding session. All list fields are stored in separate junction tables and joined at read time.

```mermaid
erDiagram
    memories {
        TEXT id PK
        TEXT repo_id
        TEXT repo_path
        TEXT repo_name
        TEXT branch
        TEXT commit_sha
        TEXT task
        TEXT intent
        TEXT summary
        TEXT decision
        TEXT why
        TEXT source
        TEXT embedding_text
        TEXT created_at
        TEXT updated_at
    }

    memory_files {
        TEXT memory_id FK
        TEXT file_path
    }

    memory_tags {
        TEXT memory_id FK
        TEXT tag
    }

    memory_alternatives {
        TEXT memory_id FK
        TEXT value
    }

    memory_risks {
        TEXT memory_id FK
        TEXT value
    }

    memory_followups {
        TEXT memory_id FK
        TEXT value
    }

    memories ||--o{ memory_files : "files touched"
    memories ||--o{ memory_tags : "tags"
    memories ||--o{ memory_alternatives : "alternatives rejected"
    memories ||--o{ memory_risks : "known risks"
    memories ||--o{ memory_followups : "follow-up tasks"
```

---

## Save pipeline

When a memory is saved (via CLI or MCP), every text field passes through the same pipeline before touching the database.

```mermaid
flowchart LR
    A[Raw input\nmarkdown or MCP fields] --> B[parseSummary\nextract structured fields]
    B --> C[redactSecrets\nreplace tokens / keys / PEM blocks]
    C --> D[buildEmbeddingText\nconcatenate all fields]
    D --> E[saveMemory\ndb.transaction INSERT]
    E --> F[(SQLite)]
```

**Secret patterns redacted:**
- GitHub tokens (`ghp_`, `gho_`, `ghs_`)
- npm tokens (`npm_`)
- AWS access keys (`AKIA...`)
- Bearer tokens
- `.env`-style assignments (`API_KEY=value`)
- PEM private key blocks

---

## Search pipeline

Search is deterministic keyword scoring — no embeddings, no external service.

```mermaid
flowchart TD
    A[query + repoPath + files] --> B[resolve repo_id from repoPath]
    B --> C{repo_id results?}
    C -- yes --> D[fetch memories by repo_id]
    C -- no --> E[fallback: fetch by repo_path LIKE]
    D --> F[scoreMemory for each result]
    E --> F
    F --> G{query provided?}
    G -- yes --> H{contentScore > 0?}
    H -- yes --> I[keep result]
    H -- no --> J[discard — same-repo bonus alone not enough]
    G -- no --> I
    I --> K[sort by total score desc]
    K --> L[limit results]
    L --> M[explainRelevance → relevanceReason string]
```

**Score weights:**

| Component | Points |
|-----------|--------|
| Same repo | +10 |
| File overlap | +8 |
| Tag match | +5 |
| Decision match | +4 |
| Why match | +3 |
| Summary match | +2 |
| File path match | +2 |
| Recency (≤30 days) | +1 |

The `relevanceReason` field in search results describes which components fired, e.g. `"Matched: same repo (+10), tag match (+5), decision match (+4)"`.

---

## Repo identity

Whyline needs a stable identifier for each repo so memories can be scoped and searched correctly even if the repo is cloned to a different local path.

```mermaid
flowchart TD
    A[getRepoId] --> B{remote URL available?}
    B -- yes --> C[normalise URL\nstrip .git, git@ → https://]
    C --> D[sha256 → truncate to 32 chars]
    B -- no --> E[hash of absolute repo path]
    D --> F[repo_id stored in DB]
    E --> F
    F --> G[also store repo_path for fallback search]
```

This means memories survive repo renames and remain queryable by path if the remote changes.

---

## MCP integration

The MCP server runs as a stdio process, launched by Claude Code when a session starts in a repo that has `.mcp.json`.

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant Server as Whyline MCP (stdio)
    participant DB as SQLite

    CC->>Server: spawn process (node dist/cli.js mcp)
    CC->>Server: ListTools request
    Server-->>CC: 4 tool descriptors

    CC->>Server: CallTool: search_coding_memory
    Server->>DB: openDb → searchMemory → db.close
    Server-->>CC: JSON results

    CC->>Server: CallTool: save_coding_memory
    Server->>DB: openDb → redactSecrets → saveMemory → db.close
    Server-->>CC: { id, saved: true }
```

The DB connection is opened and closed per request — no persistent connection. All stdout is reserved for JSON-RPC; logs go to stderr only.

---

## Directory structure

```
src/
  cli.ts                  entry point, commander, shebang
  config.ts               DATA_DIR, DB_PATH, resolveConfig(), isInitialized()
  commands/
    init.ts               create ~/.whyline/, run migrations
    save.ts               parse markdown → redact → save
    search.ts             resolve repo, score, print results
    show.ts               fetch by id or commit SHA
    mcp.ts                start MCP stdio server
  db/
    connection.ts         openDb() — WAL + foreign_keys
    schema.ts             MIGRATIONS[] — versioned SQL
    migrations.ts         runMigrations() — idempotent
  git/
    git.ts                getRepoRoot, getCurrentBranch, resolveCommit
    repoId.ts             getRepoId(), getRepoName(), normalizeRemoteUrl()
    diff.ts               getChangedFilesForCommit()
    repoContext.ts        getRepoContext() → RepoContext
  memory/
    types.ts              CodingMemory, ScoreBreakdown, SearchResult, RepoContext
    parseSummary.ts       markdown → structured fields
    redactSecrets.ts      SECRET_PATTERNS[], redactSecrets()
    saveMemory.ts         saveMemory(), getMemoryById(), searchMemory helpers
    searchMemory.ts       scoreMemory(), explainRelevance(), searchMemory()
    repoContext.ts        assembles RepoContext from cwd + ref
  mcp/
    server.ts             createMcpServer() — 4 tools, stdio transport
    tools.ts              Zod schemas for all tool inputs
  output/
    format.ts             formatMemory(), formatSearchResult()
  skill/
    SKILL.md              Claude Code skill instructions
  hooks/
    post-commit.sample.sh reminder hook template
```
