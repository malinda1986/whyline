# Coding Memory Skill

Use this skill when assisting with software development in a git repository.

## Purpose

Preserve and retrieve engineering reasoning across AI coding sessions.

## Before modifying code

1. Identify the repo, task, and likely files to edit.
2. Call `search_coding_memory` with:
   - `repoPath` — the absolute path to the git repository
   - `query` — the task description
   - `files` — likely file paths to be modified
3. Review retrieved memories.
4. Treat memories as historical context, not absolute truth.
5. Mention important retrieved constraints before making changes.

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

Ask the user to approve the memory summary before saving.

## After user approval

Call `save_coding_memory` with the approved summary.

## Memory quality rules

Good memory is concise, factual, and useful for future coding sessions.

Do not save:

- raw noisy transcript by default
- secrets, access tokens, or private credentials
- temporary debugging dead ends
- unapproved assumptions
- huge diffs
- unrelated conversation

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
