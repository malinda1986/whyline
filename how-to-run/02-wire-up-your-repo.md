# Step 2 — Wire Up Your Repo

These two files tell Claude Code to use Whyline in your project.
Add them to the root of any repo you want Whyline to work in.

---

## File 1 — `.mcp.json`

Create `.mcp.json` at the repo root:

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

> **If `whyline` is not on your PATH** (e.g. you didn't run `npm link`), use the absolute path instead:
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

---

## File 2 — `.claude/settings.local.json`

Create `.claude/settings.local.json` at the repo root to auto-approve the MCP tools so Claude doesn't prompt on every call:

```json
{
  "permissions": {
    "allow": [
      "mcp__whyline__save_coding_memory",
      "mcp__whyline__search_coding_memory"
    ]
  },
  "enabledMcpjsonServers": ["whyline"]
}
```

> `settings.local.json` is machine-specific. Add it to your `.gitignore` if you don't want it committed.

---

## File 3 — `CLAUDE.md`

Create or update `CLAUDE.md` at the repo root with the contents from `how-to-run/CLAUDE.md.template` in this folder.

Customise the `repoPath` value to the absolute path of your repo on your machine.

---

## Verify the MCP server starts

```bash
cd your-repo
whyline mcp
```

You should see the server start with no errors. Press `Ctrl+C` to stop.

Claude Code will start it automatically when you open the repo.
