# coding-memory

Local-first memory for AI coding sessions.

`coding-memory` stores concise engineering reasoning outside the git repository and exposes it back to Claude Code through an MCP server.

The goal is simple:

> Git remembers what changed. `coding-memory` remembers why it changed.

---

## 1. Product summary

AI coding sessions lose context after they end.

During a coding session, the assistant and developer often discuss:

- why a design was chosen
- rejected alternatives
- edge cases
- assumptions
- known risks
- follow-up work
- test strategy
- migration concerns

Git preserves the diff, but not the reasoning behind the diff.

`coding-memory` creates a local memory layer for this reasoning.

It should:

1. Save cleaned, user-approved coding-session summaries.
2. Link memories to repo, commit, branch, files, task, and tags.
3. Store everything outside the repo.
4. Let Claude Code retrieve relevant memories later through MCP.
5. Avoid saving raw noisy conversations by default.

---

## 2. MVP goal

Build a usable local-first MVP.

The user should be able to:

```bash
coding-memory init
coding-memory save --commit HEAD --summary-file memory.md
coding-memory search "why did we use optimistic updates?"
coding-memory mcp

Claude Code should be able to call MCP tools to:

search coding memory
save coding memory
get memory for a commit
get memories for a file
3. Non-goals for MVP

Do not build these yet:

hosted SaaS
cloud sync
team sharing
auth
web UI
VS Code extension
GitHub app
PR bot
automatic raw transcript capture
complex vector DB setup
multi-user permissions

Keep the MVP local, simple, and working.

4. Architecture
Claude Code
   │
   │ MCP calls
   ▼
coding-memory MCP server
   │
   ├─ search_coding_memory
   ├─ save_coding_memory
   ├─ get_commit_memory
   └─ get_file_memories
   │
   ▼
Local memory service
   │
   ├─ SQLite metadata store
   ├─ keyword search
   ├─ secret redaction
   └─ optional raw transcript path
   │
   ▼
~/.coding-memory/memory.db

The repo should not be modified except when the user explicitly installs hooks or creates local config.

5. Suggested tech stack

Use TypeScript and Node.js.

Suggested packages:

commander
better-sqlite3
zod
@modelcontextprotocol/sdk
vitest
tsx
typescript
eslint
prettier

Do not add cloud dependencies in MVP.

6. Repository structure

Create this structure:

coding-memory/
  README.md
  CLAUDE.md
  package.json
  tsconfig.json
  src/
    cli.ts
    db/
      connection.ts
      schema.ts
      migrations.ts
    git/
      git.ts
      repoId.ts
      diff.ts
    memory/
      types.ts
      saveMemory.ts
      searchMemory.ts
      parseSummary.ts
      redactSecrets.ts
      repoContext.ts
    mcp/
      server.ts
      tools.ts
    skill/
      SKILL.md
    hooks/
      post-commit.sample.sh
  tests/
    init.test.ts
    saveMemory.test.ts
    searchMemory.test.ts
    redactSecrets.test.ts
7. Data model

Create this TypeScript type:

export type CodingMemory = {
  id: string;
  createdAt: string;
  updatedAt: string;

  repoId: string;
  repoPath?: string;
  repoName?: string;
  branch?: string;
  commitSha?: string;

  files: string[];
  tags: string[];

  task?: string;
  intent: string;
  summary: string;
  decision: string;
  why: string;

  alternativesRejected: string[];
  risks: string[];
  followUps: string[];

  source: "manual" | "claude-code" | "cli" | "hook";
  rawTranscriptPath?: string;

  embeddingText: string;
};
8. SQLite schema

Use SQLite at:

~/.coding-memory/memory.db

Schema:

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
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_risks (
  memory_id TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_followups (
  memory_id TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_repo_id ON memories(repo_id);
CREATE INDEX IF NOT EXISTS idx_memories_commit_sha ON memories(commit_sha);
CREATE INDEX IF NOT EXISTS idx_memory_files_file_path ON memory_files(file_path);
CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag);
9. CLI commands
9.1 init
coding-memory init

Creates:

~/.coding-memory/
~/.coding-memory/memory.db
~/.coding-memory/config.json

config.json can start simple:

{
  "version": 1,
  "storage": {
    "dbPath": "~/.coding-memory/memory.db"
  }
}
9.2 save

Supported commands:

coding-memory save --commit HEAD --summary-file memory.md
coding-memory save --commit abc123 --summary-file memory.md
coding-memory save --manual

For MVP, prioritize this:

coding-memory save --commit HEAD --summary-file memory.md

Behavior:

Detect git repo root.
Compute stable repoId.
Resolve commit SHA.
Get branch name.
Get changed files for the commit.
Read summary file.
Parse summary into structured fields.
Redact secrets.
Save memory to SQLite.
Print saved memory ID.

Example output:

Saved coding memory mem_01HZY9T7G7EXAMPLE
Repo: my-app
Commit: abc123
Files: 3
9.3 search

Supported commands:

coding-memory search "why optimistic comments?"
coding-memory search "refresh token" --file src/auth/session.ts
coding-memory search "checkout validation" --limit 5

Behavior:

Detect current repo if inside git repo.
Search memories for same repo first.
Score by relevance.
Print concise results.

Example output:

mem_01HZY9T7G7EXAMPLE
Commit: abc123
Files: src/comments/sync.ts

Intent:
Add optimistic comment rendering

Decision:
Render comments immediately and reconcile after server ack.

Why:
Waiting for server confirmation made the UI feel slow.

Risks:
- Duplicate comments during reconnect
9.4 show

Supported commands:

coding-memory show mem_01HZY9T7G7EXAMPLE
coding-memory show --commit abc123
9.5 mcp
coding-memory mcp

Starts MCP server over stdio.

This is what Claude Code will run.

10. Memory summary file format

Support markdown summaries like this:

# Memory

Intent:
Add optimistic comment rendering.

Summary:
Implemented optimistic rendering for new comments so they appear immediately.

Decision:
Render comments immediately and reconcile after server ack.

Why:
Waiting for server confirmation made comment creation feel slow.

Alternatives rejected:
- Server-confirmed rendering only.
- Polling for new comments after submit.

Risks:
- Duplicate comments during reconnect.
- Failed server ack needs rollback UI.

Follow-ups:
- Add dedupe reconciliation tests.
- Add failed-send retry state.

Tags:
- comments
- sync
- optimistic-ui

The parser should be forgiving.

It should support these headings:

Intent:
Summary:
Decision:
Why:
Alternatives rejected:
Risks:
Follow-ups:
Tags:

If a field is missing, use safe defaults:

intent: "Unspecified intent"
summary: contents of file
decision: "Unspecified decision"
why: "Unspecified rationale"
11. Secret redaction

Before saving any text, redact obvious secrets.

Implement redactSecrets(input: string): string.

Redact at least:

GitHub tokens
npm tokens
AWS access keys
private keys
bearer tokens
.env style secrets

Replace with:

[REDACTED_SECRET]

Examples to catch:

ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AKIAxxxxxxxxxxxxxxxx
Authorization: Bearer abcdef123456
API_KEY=abcdef123456
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----

Add tests for this.

12. Search MVP

Do simple deterministic search first.

No embeddings for MVP.

Build embeddingText as a concatenation of:

intent
summary
decision
why
alternativesRejected
risks
followUps
tags
files
commitSha

Search scoring:

+10 same repo
+8 file path overlap
+5 exact keyword match in tags
+4 exact keyword match in decision
+3 exact keyword match in why
+2 exact keyword match in summary
+2 exact keyword match in file path
+1 recent memory

Return highest-scoring results.

Later, embeddings can be added behind the same API.

13. Git behavior

Implement helpers:

getRepoRoot(cwd: string): string | null
getRepoName(repoRoot: string): string
getRepoId(repoRoot: string): string
getCurrentBranch(repoRoot: string): string | null
resolveCommit(repoRoot: string, ref: string): string
getChangedFilesForCommit(repoRoot: string, commitSha: string): string[]

repoId should be stable across local paths where possible.

Suggested approach:

Try git config --get remote.origin.url.
Normalize it.
Hash it.
If no remote exists, hash repo root path.
14. MCP tools

Expose these MCP tools.

14.1 search_coding_memory

Input:

{
  repoPath?: string;
  repoId?: string;
  query: string;
  files?: string[];
  limit?: number;
}

Output:

{
  memories: Array<{
    id: string;
    commitSha?: string;
    files: string[];
    intent: string;
    summary: string;
    decision: string;
    why: string;
    alternativesRejected: string[];
    risks: string[];
    followUps: string[];
    tags: string[];
    relevanceReason: string;
  }>;
}
14.2 save_coding_memory

Input:

{
  repoPath?: string;
  commitSha?: string;
  files: string[];
  task?: string;
  intent: string;
  summary: string;
  decision: string;
  why: string;
  alternativesRejected?: string[];
  risks?: string[];
  followUps?: string[];
  tags?: string[];
  source?: "manual" | "claude-code" | "cli" | "hook";
}

Output:

{
  id: string;
  saved: true;
}
14.3 get_commit_memory

Input:

{
  repoPath?: string;
  repoId?: string;
  commitSha: string;
}

Output:

{
  memories: Array<{
    id: string;
    intent: string;
    decision: string;
    why: string;
    files: string[];
    risks: string[];
    followUps: string[];
  }>;
}
14.4 get_file_memories

Input:

{
  repoPath?: string;
  repoId?: string;
  filePath: string;
  limit?: number;
}

Output:

{
  memories: Array<{
    id: string;
    commitSha?: string;
    intent: string;
    decision: string;
    why: string;
    risks: string[];
    followUps: string[];
  }>;
}
15. Claude Skill

Create this file:

src/skill/SKILL.md

Content:

# Coding Memory Skill

Use this skill when assisting with software development in a git repository.

## Purpose

Preserve and retrieve engineering reasoning across AI coding sessions.

## Before modifying code

1. Identify the repo, task, and likely files to edit.
2. Call `search_coding_memory` with:
   - repo path
   - task description
   - likely file paths
3. Review retrieved memories.
4. Treat memories as historical context, not absolute truth.
5. Mention important retrieved constraints before making changes.

## While coding

Preserve prior decisions unless the user explicitly wants to change them.

Pay attention to:

- rejected alternatives
- known risks
- follow-up tasks
- migration constraints
- compatibility concerns
- previous decisions around the same files

## Before committing

Summarize the coding session into a memory capsule:

- goal
- files changed
- decision
- why
- alternatives rejected
- risks
- follow-ups
- tags

Ask the user to approve the memory summary.

## After user approval

Call `save_coding_memory`.

## Memory quality rules

Good memory is concise, factual, and useful for future coding sessions.

Do not save:

- raw noisy transcript by default
- secrets
- access tokens
- private credentials
- temporary debugging dead ends
- unapproved assumptions
- huge diffs
- unrelated conversation

Prefer this format:

```json
{
  "intent": "Add optimistic comment rendering",
  "decision": "Render comments immediately and reconcile after server ack",
  "why": "Server-confirmed rendering made the UI feel slow",
  "alternativesRejected": [
    "Wait for server confirmation before rendering"
  ],
  "risks": [
    "Duplicate comments during reconnect"
  ],
  "followUps": [
    "Add dedupe reconciliation tests"
  ],
  "tags": ["comments", "sync", "optimistic-ui"]
}

---

## 16. CLAUDE.md for this project

Create this file at repo root:

```txt
CLAUDE.md

Content:

# Claude Instructions for coding-memory

You are building a local-first tool called `coding-memory`.

The product stores AI coding-session reasoning outside the git repo and exposes it back to Claude Code through an MCP server.

## Build principles

- Prefer simple local-first implementation.
- Do not build hosted sync in MVP.
- Do not build a UI in MVP.
- Do not store raw transcripts by default.
- Always redact secrets before saving memory.
- Keep the CLI useful without MCP.
- Keep the MCP server thin and deterministic.
- Write tests for database, search, and redaction behavior.
- Prefer boring, maintainable TypeScript.

## MVP acceptance criteria

The user can:

1. Run `coding-memory init`.
2. Run `coding-memory save --commit HEAD --summary-file memory.md`.
3. Run `coding-memory search "some query"`.
4. Run `coding-memory mcp`.
5. Configure Claude Code to use the MCP server.
6. Ask Claude Code to search previous coding memories.

## Implementation order

1. Project setup.
2. SQLite schema.
3. Git repo detection.
4. Manual save command.
5. Search command.
6. MCP server.
7. Skill file.
8. Hook sample.
9. Tests.
10. README usage docs.

## Do not overbuild

Avoid:

- cloud auth
- team sharing
- hosted vector DB
- web UI
- complex embeddings
- PR integrations
- background daemons

Build the smallest working local tool first.
17. Post-commit hook sample

Create:

src/hooks/post-commit.sample.sh

Content:

#!/usr/bin/env bash
set -euo pipefail

if command -v coding-memory >/dev/null 2>&1; then
  echo ""
  echo "You can save AI coding memory for this commit:"
  echo "  coding-memory save --commit HEAD --manual"
  echo ""
fi

Do not auto-save memory without user approval in MVP.

18. README usage docs to include

Add a user-facing section like this:

## Installation

```bash
npm install
npm run build
npm link
Initialize local memory
coding-memory init
Save memory for a commit

Create memory.md:

# Memory

Intent:
Add optimistic comment rendering.

Summary:
Implemented optimistic rendering for new comments.

Decision:
Render comments immediately and reconcile after server ack.

Why:
Waiting for server confirmation made comment creation feel slow.

Alternatives rejected:
- Server-confirmed rendering only.

Risks:
- Duplicate comments during reconnect.

Follow-ups:
- Add dedupe reconciliation tests.

Tags:
- comments
- sync
- optimistic-ui

Save it:

coding-memory save --commit HEAD --summary-file memory.md
Search memory
coding-memory search "why optimistic comments?"
Start MCP server
coding-memory mcp

Configure Claude Code to run this command as an MCP server:

coding-memory mcp

---

## 19. Tests

Add tests for:

### Init

- creates memory directory
- creates SQLite database
- runs migrations

### Save memory

- saves memory from summary file
- links memory to files
- links memory to tags
- stores alternatives, risks, and follow-ups
- resolves `HEAD` commit

### Search

- finds memory by keyword
- ranks same-repo results higher
- ranks file-overlap results higher
- respects `--limit`

### Redaction

- redacts GitHub tokens
- redacts npm tokens
- redacts AWS keys
- redacts bearer tokens
- redacts private keys
- redacts `.env` style secrets

---

## 20. Milestone plan

Implement in these milestones.

### Milestone 1: project setup

Build:

- `package.json`
- TypeScript config
- CLI skeleton
- test setup
- `coding-memory init`

Acceptance:

```bash
npm test
npm run build
coding-memory init
Milestone 2: database

Build:

SQLite connection
schema migrations
memory insert/query helpers

Acceptance:

coding-memory init

creates a working SQLite DB.

Milestone 3: git helpers

Build:

repo root detection
repo ID generation
branch detection
commit resolution
changed files for commit

Acceptance:

coding-memory save --commit HEAD --summary-file memory.md

can resolve repo and commit metadata.

Milestone 4: save command

Build:

parse markdown summary
redact secrets
save structured memory
print saved ID

Acceptance:

coding-memory save --commit HEAD --summary-file memory.md

saves a memory.

Milestone 5: search command

Build:

keyword search
scoring
formatted output

Acceptance:

coding-memory search "optimistic comments"

returns relevant memory.

Milestone 6: MCP server

Build MCP tools:

search_coding_memory
save_coding_memory
get_commit_memory
get_file_memories

Acceptance:

coding-memory mcp

starts MCP server over stdio.

Milestone 7: skill and docs

Build:

src/skill/SKILL.md
CLAUDE.md
hook sample
final README usage section

Acceptance:

A user can understand how to install, save, search, and use with Claude Code.

21. Suggested first prompt for Claude Code

Use this prompt after creating this file:

We are building a local-first developer tool called coding-memory.

Please read this README and implement the MVP in small milestones.

Goal:
- TypeScript Node CLI
- SQLite local database
- manual memory save
- search memories
- MCP server exposing search/save/get tools
- Claude Skill file
- post-commit hook sample
- tests

Important:
- Do not build cloud sync.
- Do not build UI.
- Do not store raw transcripts by default.
- Always redact secrets before saving.
- Keep implementation simple and working.

Start with Milestone 1:
- project setup
- package.json
- tsconfig
- CLI entrypoint
- test setup
- `coding-memory init`

After implementing, explain what changed and what command I should run to test it.
22. Future roadmap

Only after MVP works:

v0.2 optional LLM summarization
v0.3 embeddings
v0.4 import Claude Code transcript manually
v0.5 GitHub PR integration
v0.6 team-shared memory server
v0.7 hosted sync
v0.8 VS Code extension
23. Design principles
Memory should be external to the repo.
Memory should be concise.
Memory should be user-approved.
Memory should be searchable.
Memory should be useful to future AI coding sessions.
Raw transcripts are optional, not default.
Retrieval should prefer relevance over volume.
Prior memories are context, not truth.
The tool should work locally before it works in the cloud.