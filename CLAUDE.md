# Claude Instructions for Whyline

You are working on `whyline` — a local-first CLI + MCP server that stores AI coding-session reasoning in SQLite and exposes it to Claude Code.

The MVP is complete. All 7 milestones are built and 72 tests pass.

## Build principles

- Prefer simple local-first implementation.
- Do not build hosted sync unless explicitly asked.
- Do not build a UI unless explicitly asked.
- Do not store raw transcripts by default.
- Always redact secrets before saving memory.
- Keep the CLI useful without MCP.
- Keep the MCP server thin and deterministic.
- Write tests for database, search, and redaction behavior.
- Prefer boring, maintainable TypeScript.
- Use ESM (`"type": "module"`). All imports must use `.js` extensions even for `.ts` source files.
- `better-sqlite3` is synchronous — do not use async/await in the DB layer.

## What not to build

- Cloud auth or team sharing
- Hosted vector DB or embeddings service
- Web UI
- Background daemons
- `--manual` interactive mode (deferred to v0.2)
- PR integrations (deferred to v0.6)

## Schema changes

Any change to the database schema must be added as a new entry in `src/db/schema.ts` `MIGRATIONS[]` array with an incremented version number. Never modify existing migration SQL.

## Adding a new CLI command

1. Create `src/commands/<name>.ts` with a `run<Name>()` export.
2. Register it in `src/cli.ts`.
3. Add tests in `tests/<name>.test.ts` using in-memory SQLite.

## Adding a new MCP tool

1. Add a Zod schema to `src/mcp/tools.ts`.
2. Add the tool descriptor to the `ListToolsRequestSchema` handler in `src/mcp/server.ts`.
3. Add the `CallToolRequestSchema` case in `src/mcp/server.ts`.
4. Run `redactSecrets()` on any user-supplied text before saving.
