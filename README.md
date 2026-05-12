# coding-memory

Local-first memory for AI coding sessions.

> Git remembers what changed. `coding-memory` remembers why it changed.

`coding-memory` stores concise engineering reasoning outside the git repository and exposes it back to Claude Code through an MCP server. During a coding session you discuss why a design was chosen, what was rejected, known risks, and follow-up work. Git preserves the diff; `coding-memory` preserves the reasoning.

---

## Installation

```bash
git clone <repo>
cd coding-memory
npm install
npm run build
npm link
```

### Node version requirement

Node 18 or later. The native `better-sqlite3` bindings must be compiled for your Node version:

```bash
npm rebuild better-sqlite3
```

---

## Quick start

### 1. Initialize

```bash
coding-memory init
```

Creates `~/.coding-memory/` with `memory.db` and `config.json`.

### 2. Create a memory summary file

Create `memory.md` in your project:

```markdown
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
```

### 3. Save a memory

```bash
coding-memory save --commit HEAD --summary-file memory.md
```

Output:
```
Saved coding memory mem_lzfg9vk3a1b2c3d4
Repo: my-app
Commit: abc12345
Files: 3
```

### 4. Search memories

```bash
coding-memory search "why optimistic comments?"
coding-memory search "refresh token" --file src/auth/session.ts
coding-memory search "checkout validation" --limit 5
```

### 5. Show a memory

```bash
coding-memory show mem_lzfg9vk3a1b2c3d4
coding-memory show --commit abc12345
```

### 6. Start MCP server

```bash
coding-memory mcp
```

---

## Configure Claude Code

Add to your `.claude/settings.json` (project-level) or `~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "coding-memory": {
      "command": "coding-memory",
      "args": ["mcp"]
    }
  }
}
```

Then add the skill to Claude Code by referencing `src/skill/SKILL.md` in your project's `CLAUDE.md`.

---

## Memory summary file format

The parser is forgiving — missing fields fall back to safe defaults.

Supported headings:

| Heading | Type | Default |
|---------|------|---------|
| `Task:` | text | *(omitted)* |
| `Intent:` | text | `"Unspecified intent"` |
| `Summary:` | text | *(full file content)* |
| `Decision:` | text | `"Unspecified decision"` |
| `Why:` | text | `"Unspecified rationale"` |
| `Alternatives rejected:` | bullet list | `[]` |
| `Risks:` | bullet list | `[]` |
| `Follow-ups:` | bullet list | `[]` |
| `Tags:` | bullet list | `[]` |

---

## MCP tools

Claude Code can call these tools via the MCP server:

| Tool | Description |
|------|-------------|
| `search_coding_memory` | Search memories by keyword |
| `save_coding_memory` | Save a new memory |
| `get_commit_memory` | Get memories for a specific commit |
| `get_file_memories` | Get memories touching a specific file |

---

## Secret redaction

All text is automatically scanned before saving. The following are redacted and replaced with `[REDACTED_SECRET]`:

- GitHub tokens (`ghp_`, `gho_`, `ghs_`)
- npm tokens (`npm_`)
- AWS access keys (`AKIA...`)
- Bearer tokens
- `.env`-style secrets (`API_KEY=`, `SECRET=`, etc.)
- PEM private key blocks

---

## Post-commit hook (optional)

Copy `src/hooks/post-commit.sample.sh` to `.git/hooks/post-commit` and make it executable:

```bash
cp src/hooks/post-commit.sample.sh .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

This reminds you to save a memory after each commit.

---

## Development

```bash
npm run dev -- init           # run via tsx without building
npm test                      # run tests
npm run build                 # compile to dist/
npm run lint                  # eslint
```

---

## Storage

All data is stored locally at `~/.coding-memory/memory.db` (SQLite). The repository is never modified unless you explicitly install the post-commit hook.

---

## Roadmap

- v0.2 — `--manual` interactive save mode
- v0.3 — optional LLM summarization
- v0.4 — embeddings-based search
- v0.5 — import Claude Code transcript manually
- v0.6 — GitHub PR integration
- v0.7 — team-shared memory server
