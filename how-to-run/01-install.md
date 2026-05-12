# Step 1 — Install Whyline

## Prerequisites

- Node.js 18 or later (Node 22 recommended)
- npm
- git

Check your versions:

```bash
node --version   # should be v18+
npm --version
git --version
```

---

## Clone and build

```bash
git clone <whyline-repo-url>
cd whyline
npm install
npm run build
```

## Rebuild native bindings (required on Node 20+)

`better-sqlite3` uses native C++ bindings. You must compile them for your Node version:

```bash
npm rebuild better-sqlite3
```

If `npm rebuild` fails or produces no `.node` file (common on Node 22), run manually:

```bash
npx node-gyp rebuild
mkdir -p node_modules/better-sqlite3/build/Release
cp build/Release/better_sqlite3.node node_modules/better-sqlite3/build/Release/
```

## Make the CLI available globally

```bash
npm link
```

Verify:

```bash
which whyline        # should print a path
whyline --version    # should print 0.1.0
```

---

## Initialize storage

```bash
whyline init
```

This creates `~/.whyline/` with:
- `memory.db` — SQLite database
- `config.json` — storage config

You only need to do this once per machine. Running it again is safe (idempotent).
