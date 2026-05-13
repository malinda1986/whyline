# Whyline

<p align="center">
  <img src="docs/logo.png" alt="Whyline" width="120" />
</p>

![npm](https://img.shields.io/npm/v/@malindar/whyline)
![license](https://img.shields.io/github/license/malinda1986/whyline)
![build](https://img.shields.io/github/actions/workflow/status/malinda1986/whyline/ci.yml)

Local-first memory for AI coding sessions.

> Git remembers what changed. Whyline remembers why.

---

## Why this exists

You've been there. You open a file, see a decision made months ago, and have no idea why. The diff shows _what_ changed. The commit message says "fix retention logic." But why 90 days? Why a background job and not a cron? Why not S3?

That context lived in a conversation — and it's gone.

AI coding sessions with tools like Claude produce something valuable beyond the code: the reasoning behind it. The intent, the tradeoffs, the alternatives that were rejected, the risks that were acknowledged. None of that ends up in git. It lives in a chat window and disappears when the context resets.

Whyline captures it.

After each coding session, it stores a concise reasoning record in SQLite on your machine — no cloud, no auth, no new workflow. When you start a new session touching the same files, Claude searches those records automatically and surfaces the relevant context:

> _"Last time we touched this file, we rejected S3 archival because of cost. Still the case?"_

The loop is tight:

- **Start a task** → Claude searches past memories and brings forward relevant decisions
- **Finish and commit** → Claude synthesizes the session and saves the reasoning automatically
- **Come back later** → The why is right there, not lost in a chat history

It works through Claude Code's MCP protocol. Two files to set it up in any repo: `.mcp.json` and `CLAUDE.md`.

---

## Installation

```bash
git clone https://github.com/malinda1986/whyline.git
cd whyline
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
whyline init
```

Creates `~/.whyline/` with `memory.db` and `config.json`.

### 2. Wire up a repo

Run this once in each repo you want Whyline to work in:

```bash
cd your-project
whyline install-claude
```

Creates or updates three files:

- `.mcp.json` — registers the Whyline MCP server (merges with existing entries)
- `CLAUDE.md` — adds the memory instructions for Claude (appends if the file already exists)
- `.claude/settings.local.json` — auto-approves the five MCP tool calls so Claude doesn't prompt on every use

```
  ✓  .mcp.json  (created)
  ✓  CLAUDE.md  (created)
  ✓  .claude/settings.local.json  (created)

Done. Open this repo in Claude Code and run `whyline doctor` to verify.
```

Running it again is safe — it only writes what's missing and never removes existing content.

### 3. Verify setup (optional)

```bash
whyline doctor
```

Checks that the DB exists, migrations are current, the binary is on your PATH, you're inside a git repo, `.mcp.json` is configured, `CLAUDE.md` mentions Whyline, and the MCP server starts. Run this whenever something feels off.

```
  ✓  DB exists  (~/.whyline/memory.db)
  ✓  Migrations current  (v1)
  ✓  `whyline` on PATH  (/usr/local/bin/whyline)
  ✓  Inside a git repo  (/home/user/my-app)
  ✓  .mcp.json configured  (/home/user/my-app/.mcp.json)
  ✓  CLAUDE.md mentions Whyline  (/home/user/my-app/CLAUDE.md)
  ✓  MCP server starts  (tools/list responded)

All checks passed. Whyline is ready.
```

### 3. Create a memory summary file

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

### 4. Save a memory

```bash
whyline save --commit HEAD --summary-file memory.md
```

Output:

```
Saved memory mem_abc12345
Repo: my-app
Commit: abc12345
Files: 3
```

### 5. Search memories

```bash
whyline search "why optimistic comments?"
whyline search "refresh token" --file src/auth/session.ts
whyline search "checkout validation" --limit 5

# Filter by tag (repeat for AND semantics)
whyline search "" --tag auth --tag security

# Filter by date
whyline search "" --since 2025-01-01
whyline search "" --before 2025-06-30
whyline search "token" --tag auth --since 2025-01-01 --before 2025-12-31
```

### 6. Browse all memories

```bash
whyline list              # all memories, newest first
whyline list --repo       # scoped to the current git repo
whyline list --limit 5    # cap results
```

### 7. Show a memory

```bash
whyline show mem_abc12345
whyline show --commit abc12345
```

### 8. Edit a memory

Open a memory in `$EDITOR` as markdown, save changes back to the DB:

```bash
whyline edit mem_abc12345
```

### 9. Delete a memory

```bash
whyline delete mem_abc12345          # prompts for confirmation
whyline delete mem_abc12345 --force  # skips confirmation
```

### 10. Export & import memories

```bash
# Export all memories as JSON (default)
whyline export > backup.json

# Export as markdown
whyline export --format md --output memories.md

# Export only this repo's memories, filtered by tag and date
whyline export --repo --tag auth --since 2025-01-01 --output auth-memories.json

# Import from a previous export (skips duplicates, redacts any exposed secrets)
whyline import backup.json
```

### 11. Storage stats

```bash
whyline stats
```

Output:

```
Total memories:  42
Repos tracked:   3
Oldest memory:   1/15/2025
Newest memory:   5/13/2026

Most referenced files:
  12x  src/auth/session.ts
   8x  src/comments/sync.ts
   5x  src/db/migrations.ts
```

### 12. Start MCP server

```bash
whyline mcp
```

---

## Configure Claude Code

Add `.mcp.json` to your repo root:

```json
{
  "mcpServers": {
    "whyline": {
      "command": "whyline",
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

| Heading                  | Type        | Default                   |
| ------------------------ | ----------- | ------------------------- |
| `Task:`                  | text        | _(omitted)_               |
| `Intent:`                | text        | `"Unspecified intent"`    |
| `Summary:`               | text        | _(full file content)_     |
| `Decision:`              | text        | `"Unspecified decision"`  |
| `Why:`                   | text        | `"Unspecified rationale"` |
| `Alternatives rejected:` | bullet list | `[]`                      |
| `Risks:`                 | bullet list | `[]`                      |
| `Follow-ups:`            | bullet list | `[]`                      |
| `Tags:`                  | bullet list | `[]`                      |

---

## MCP tools

Claude Code can call these tools via the MCP server:

| Tool                   | Description                           |
| ---------------------- | ------------------------------------- |
| `search_coding_memory` | Search memories by keyword            |
| `save_coding_memory`   | Save a new memory                     |
| `get_commit_memory`    | Get memories for a specific commit    |
| `get_file_memories`    | Get memories touching a specific file |

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

All data is stored locally at `~/.whyline/memory.db` (SQLite). The repository is never modified unless you explicitly install the post-commit hook.

---

## Roadmap

- v0.6 — `--manual` interactive save mode
- v0.6 — GitHub PR integration
- v0.7 — team-shared memory server
