# Step 2 — Wire Up Your Repo

Run this once in each repo you want Whyline to work in:

```bash
cd your-project
whyline install-claude
```

That's it. The command creates or updates three files:

| File | What it does |
|------|-------------|
| `.mcp.json` | Registers the `whyline` MCP server with Claude Code |
| `CLAUDE.md` | Adds the memory instructions so Claude searches and saves automatically |
| `.claude/settings.local.json` | Auto-approves the five MCP tool calls so Claude doesn't prompt on every use |

Running it again is safe — it merges, never overwrites unrelated content.

---

## What the files look like

### `.mcp.json`

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

> **If `whyline` is not on your PATH** (e.g. you didn't run `npm link`), edit this to use the absolute path:
> ```json
> {
>   "mcpServers": {
>     "whyline": {
>       "command": "node",
>       "args": ["/absolute/path/to/whyline/dist/cli.js", "mcp"]
>     }
>   }
> }
> ```

### `.claude/settings.local.json`

```json
{
  "permissions": {
    "allow": [
      "mcp__whyline__save_coding_memory",
      "mcp__whyline__search_coding_memory",
      "mcp__whyline__get_recent_memories",
      "mcp__whyline__get_file_memories",
      "mcp__whyline__get_commit_memory"
    ]
  },
  "enabledMcpjsonServers": ["whyline"]
}
```

> `settings.local.json` is machine-specific. Add it to your `.gitignore` if you don't want it committed.

### `CLAUDE.md`

The Whyline section is appended to any existing `CLAUDE.md`, or a new file is created if none exists. See `CLAUDE.md.template` in this folder for the full content.

---

## Verify the setup

```bash
whyline doctor
```

All seven checks should pass before you start a session.
