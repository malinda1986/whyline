# Coding Memory Skill

Use this skill when assisting with software development in a git repository.

## Purpose

Preserve and retrieve engineering reasoning across AI coding sessions.

## Before modifying code

**The very first action — before reading any file, before asking any question — is always a memory search. No exceptions.**

- If the task is clearly described: call `search_coding_memory` with:
  - `repoPath` — the absolute path to the git repository
  - `query` — the task description
  - `files` — likely file paths to be modified

- If the task is vague or just starting out: call `get_recent_memories` with:
  - `repoPath` — the absolute path to the git repository
  - `limit` — 5

**If memories come back**, you MUST:
1. STOP. Do not read any file yet.
2. Quote the memory to the user verbatim: _"I found a previous memory about this: [decision + reason]. Before I proceed — what's the reason for changing it now?"_
3. If the memory has `isStale: true`, add: _"Note: this memory is over 90 days old — verify it still applies before treating it as current."_
4. Wait for the user to respond before doing anything else.

**If no memories come back**, say "No past memories found for this area" and then proceed normally.

Treat memories as historical context — they explain past decisions, not current truth.

## While coding

Preserve prior decisions unless the user explicitly wants to change them.

Pay attention to:

- rejected alternatives
- known risks
- follow-up tasks
- migration constraints
- compatibility concerns
- previous decisions around the same files

## Before committing

Summarize the coding session into a memory capsule:

- goal / intent
- files changed
- decision
- why
- alternatives rejected
- risks
- follow-ups
- tags

Show the summary to the user before saving:
_"Here's what I'm saving as a coding memory — let me know if you want to add or correct anything:"_

Wait for the user to respond. If they add or correct something, apply it. Then call `save_coding_memory`.

## Memory quality rules

Only save memories that would genuinely help a future session. Good memory:
- Explains a non-obvious decision
- Warns about a real risk
- Records a rejected alternative that someone will try again

Do not save:

- Routine refactors with no tradeoffs
- Things obvious from reading the code
- Secrets, access tokens, or private credentials
- Temporary debugging dead ends

Prefer this format:

```json
{
  "intent": "Add optimistic comment rendering",
  "decision": "Render comments immediately and reconcile after server ack",
  "why": "Server-confirmed rendering made the UI feel slow",
  "alternativesRejected": [
    "Wait for server confirmation before rendering"
  ],
  "risks": [
    "Duplicate comments during reconnect"
  ],
  "followUps": [
    "Add dedupe reconciliation tests"
  ],
  "tags": ["comments", "sync", "optimistic-ui"]
}
```
