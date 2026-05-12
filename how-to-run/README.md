# How to Run Whyline

Follow these steps in order to install Whyline, wire it up to a repo, and test the full memory loop with Claude Code.

---

## Steps

| # | File | What it covers |
|---|------|----------------|
| 1 | [01-install.md](./01-install.md) | Clone, build, link the CLI, run `whyline init` |
| 2 | [02-wire-up-your-repo.md](./02-wire-up-your-repo.md) | Add `.mcp.json`, `settings.local.json`, and `CLAUDE.md` to your repo |
| 3 | [03-test-it-manually.md](./03-test-it-manually.md) | Verify save/search/show work from the CLI |
| 4 | [04-test-with-claude-code.md](./04-test-with-claude-code.md) | Test the full loop: search on start, save after commit, past decisions surfaced |

---

## Template files

| File | Use |
|------|-----|
| [CLAUDE.md.template](./CLAUDE.md.template) | Copy to your repo's `CLAUDE.md` and set `repoPath` |

---

## TL;DR (happy path)

```bash
# 1. Install
git clone <whyline-repo>
cd whyline
npm install && npm run build
npm rebuild better-sqlite3
npm link
whyline init

# 2. Wire up your repo
cd /path/to/your-repo
# create .mcp.json, .claude/settings.local.json, CLAUDE.md
# (see 02-wire-up-your-repo.md for exact file contents)

# 3. Test CLI
whyline save --commit HEAD --summary-file /tmp/test-memory.md
whyline search "test"

# 4. Open repo in Claude Code and ask it to do something
# → Claude searches memories automatically
# → Commit → Claude saves memory automatically
```
