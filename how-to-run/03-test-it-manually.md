# Step 3 — Test It Manually (CLI)

Before testing with Claude Code, verify the CLI works end-to-end.

---

## Save a test memory

Create a test summary file:

```bash
cat > /tmp/test-memory.md << 'EOF'
Intent:
Test that Whyline is working correctly.

Summary:
Ran a manual test save to verify the CLI and database are working.

Decision:
Use a hardcoded test file rather than a real commit summary.

Why:
Fastest way to verify the install without needing a real coding session.

Alternatives rejected:
- Skipping the manual test entirely.

Risks:
- None for this test.

Follow-ups:
- Delete this test memory after verifying.

Tags:
- test
- install-check
EOF
```

Save it (run from inside any git repo, or use `--commit` with any valid SHA):

```bash
cd /path/to/any-git-repo
whyline save --commit HEAD --summary-file /tmp/test-memory.md
```

Expected output:
```
Saved memory mem_xxxxx
Repo: your-repo-name
Commit: abc12345
Files: 0
```

---

## Search for it

```bash
whyline search "install check"
```

Expected: one result with `[Matched: ...]` relevance reason.

---

## Show it

```bash
whyline show mem_xxxxx   # use the ID printed above
```

Expected: full verbose output with all fields.

---

## Show by commit

```bash
whyline show --commit HEAD
```

---

## Clean up

```bash
# The test memory lives in ~/.whyline/memory.db
# There's no delete command in v0.1 — you can ignore it or wipe the DB:
rm ~/.whyline/memory.db && whyline init
```
