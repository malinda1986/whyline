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
- Use ESM (`"type": "module"`). All imports must use `.js` extensions even for `.ts` source files.
- `better-sqlite3` is synchronous — do not use async/await in the DB layer.

## MVP acceptance criteria

The user can:

1. Run `coding-memory init`.
2. Run `coding-memory save --commit HEAD --summary-file memory.md`.
3. Run `coding-memory search "some query"`.
4. Run `coding-memory show <id>`.
5. Run `coding-memory mcp`.
6. Configure Claude Code to use the MCP server.
7. Ask Claude Code to search previous coding memories.

## Implementation order

1. Project setup.
2. SQLite schema and migrations.
3. Git repo detection helpers.
4. Save command (parse markdown, redact secrets, store).
5. Search and show commands.
6. MCP server (4 tools).
7. Skill file, CLAUDE.md, hook sample, README.
8. Tests.

## Do not overbuild

Avoid:

- cloud auth
- team sharing
- hosted vector DB
- web UI
- complex embeddings
- PR integrations
- background daemons
- `--manual` interactive mode (deferred to v0.2)

Build the smallest working local tool first.
