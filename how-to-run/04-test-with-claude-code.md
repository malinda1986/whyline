# Step 4 — Test With Claude Code

Once you've completed steps 1–3, open your repo in Claude Code and run through this scenario.

---

## Scenario A — Memory search on session start

1. Open your repo in Claude Code
2. Ask Claude to do any coding task, e.g.:
   > "Add a retention policy for audit logs"
3. Claude should **automatically call `search_coding_memory`** before asking any questions or touching any files
4. If no memories exist yet, Claude proceeds normally
5. Complete the task and commit

**What to watch for:**
- Claude calls `search_coding_memory` as the very first action
- You see `[Searching Whyline memories...]` or similar in the tool call output

---

## Scenario B — Memory saved after commit

1. Do some work with Claude in your repo
2. Ask Claude to commit:
   > "commit this"
3. After the commit succeeds, Claude should:
   - Show you a memory summary: _"Here's what I'm saving..."_
   - Display intent, decision, why, risks, follow-ups
   - Call `save_coding_memory` automatically
4. You can add corrections or say nothing — it saves either way

**What to watch for:**
- Claude shows the summary without you asking
- `save_coding_memory` is called with the real commit SHA

---

## Scenario C — Past decision surfaced

1. Start a new Claude Code session in the same repo
2. Ask Claude to change something you changed before, e.g.:
   > "change the retention period"
3. Claude should find the previous memory and say something like:
   > _"I found a previous memory about this: we set retention to 90 days because of legal requirements. Before I proceed — what's the reason for changing it now?"_
4. Give a reason
5. Claude proceeds, and saves a new memory with the updated reasoning

**What to watch for:**
- Claude surfaces the old decision and asks WHY before asking WHAT
- New memory records both the change and the reason

---

## Troubleshooting

**Claude isn't calling `search_coding_memory` automatically**
- Check `.mcp.json` exists at the repo root
- Check `enabledMcpjsonServers` is set in `.claude/settings.local.json`
- Restart the Claude Code session after adding these files

**`search_coding_memory` returns no results**
- Make sure `whyline init` has been run
- Make sure at least one memory has been saved with `whyline save`
- Check `repoPath` in `CLAUDE.md` matches your actual repo path exactly

**MCP server fails to start**
- Run `whyline mcp` manually and check for errors
- Verify `~/.whyline/memory.db` exists (run `whyline init` if not)
- On Node 22: verify the native binding was rebuilt (see step 1)
