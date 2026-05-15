# Claude Instructions for Whyline

You are working on `whyline` — a local-first CLI + MCP server that stores AI coding-session reasoning in SQLite and exposes it to Claude Code.

The MVP is complete. All 7 milestones are built and 160 tests pass.

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

## Keeping instruction files in sync

There are three files that describe how Claude should behave when working with memories. They must always be consistent with each other:

| File | Purpose |
|------|---------|
| `src/skill/SKILL.md` | Used when Whyline is loaded as a Claude Code skill |
| `how-to-run/CLAUDE.md.template` | Injected into user repos by `whyline install --tool claude` |
| `how-to-run/cursor.md.template` | Injected into user repos by `whyline install --tool cursor` |
| `docs/architecture.md` | System overview — commands, components, pipelines, directory structure |
| Deployed `CLAUDE.md` files (e.g. `/Users/malinda.ranasinghe/Documents/contentful/moi/audit-logging/CLAUDE.md`) | Already-wired repos that won't re-run `install-claude` |

**Any time you add or change a feature, ask: does this change how Claude should behave?**

If yes, update all three before closing the task:

1. `src/skill/SKILL.md` — update the relevant section
2. `how-to-run/CLAUDE.md.template` — apply the same change
3. Any deployed `CLAUDE.md` files — patch manually (or remind the user to re-run `whyline install-claude`)

Triggers that always require a sync:
- New MCP tool added (Claude needs to know when and how to call it)
- New field added to memory responses (e.g. `isStale`, future `confidence`)
- Search or save workflow changes
- New quality, staleness, or deduplication rules
- Changes to what Claude should say when surfacing a memory
- New CLI command added — update `docs/architecture.md` directory structure and component diagram
- New tool adapter added (new `src/adapters/<tool>.ts`) — add instruction template to `how-to-run/`, update table above, update `docs/architecture.md`

If you only update one file, future sessions in repos wired with the old template will behave differently from repos wired with the new one — the instructions will drift.
