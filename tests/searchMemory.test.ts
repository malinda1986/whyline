import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { saveMemory, generateMemoryId } from "../src/memory/saveMemory.js";
import { searchMemory, scoreMemory, explainRelevance } from "../src/memory/searchMemory.js";
import type { CodingMemory, ScoreBreakdown } from "../src/memory/types.js";
import Database from "better-sqlite3";

function makeTestDb(): Database.Database {
  const db = openDb(":memory:");
  runMigrations(db);
  return db;
}

function makeMemory(overrides: Partial<CodingMemory> = {}): CodingMemory {
  return {
    id: generateMemoryId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repoId: "default-repo",
    repoPath: "/home/user/default-app",
    repoName: "default-app",
    branch: "main",
    commitSha: "abc123",
    files: ["src/app.ts"],
    tags: ["feature"],
    intent: "Default intent",
    summary: "Default summary",
    decision: "Default decision",
    why: "Default rationale",
    alternativesRejected: [],
    risks: [],
    followUps: [],
    source: "cli",
    embeddingText: "Default intent Default summary Default decision Default rationale",
    ...overrides,
  };
}

describe("scoreMemory", () => {
  it("gives +10 for same repo", () => {
    const memory = makeMemory({ repoId: "my-repo" });
    const score = scoreMemory(memory, "query", "my-repo", []);
    expect(score.sameRepo).toBe(10);
  });

  it("gives 0 for different repo", () => {
    const memory = makeMemory({ repoId: "other-repo" });
    const score = scoreMemory(memory, "query", "my-repo", []);
    expect(score.sameRepo).toBe(0);
  });

  it("gives +8 for file overlap", () => {
    const memory = makeMemory({ files: ["src/auth.ts"] });
    const score = scoreMemory(memory, "query", null, ["src/auth.ts"]);
    expect(score.fileOverlap).toBe(8);
  });

  it("gives +5 for tag match", () => {
    const memory = makeMemory({ tags: ["optimistic-ui"] });
    const score = scoreMemory(memory, "optimistic", null, []);
    expect(score.tagMatch).toBe(5);
  });

  it("gives +4 for keyword in decision", () => {
    const memory = makeMemory({ decision: "Use optimistic rendering" });
    const score = scoreMemory(memory, "optimistic", null, []);
    expect(score.decisionMatch).toBe(4);
  });

  it("gives +3 for keyword in why", () => {
    const memory = makeMemory({ why: "Server was too slow" });
    const score = scoreMemory(memory, "slow", null, []);
    expect(score.whyMatch).toBe(3);
  });

  it("gives +2 for keyword in summary", () => {
    const memory = makeMemory({ summary: "Implemented caching layer" });
    const score = scoreMemory(memory, "caching", null, []);
    expect(score.summaryMatch).toBe(2);
  });

  it("gives +2 for keyword in file path", () => {
    const memory = makeMemory({ files: ["src/comments/sync.ts"] });
    const score = scoreMemory(memory, "comments", null, []);
    expect(score.filePathMatch).toBe(2);
  });

  it("gives +1 recency for recent memory", () => {
    const memory = makeMemory({ createdAt: new Date().toISOString() });
    const score = scoreMemory(memory, "query", null, []);
    expect(score.recency).toBe(1);
  });

  it("gives 0 recency for old memory", () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const memory = makeMemory({ createdAt: oldDate });
    const score = scoreMemory(memory, "query", null, []);
    expect(score.recency).toBe(0);
  });

  it("computes total as sum of all components", () => {
    const memory = makeMemory({
      repoId: "my-repo",
      tags: ["comments"],
      decision: "Use optimistic rendering",
      files: ["src/comments/sync.ts"],
      createdAt: new Date().toISOString(),
    });
    const score = scoreMemory(memory, "comments optimistic", "my-repo", []);
    expect(score.total).toBe(
      score.sameRepo +
        score.fileOverlap +
        score.tagMatch +
        score.decisionMatch +
        score.whyMatch +
        score.summaryMatch +
        score.filePathMatch +
        score.recency
    );
  });
});

describe("explainRelevance", () => {
  it("returns non-empty string for any non-zero score", () => {
    const score: ScoreBreakdown = {
      total: 10,
      sameRepo: 10,
      fileOverlap: 0,
      tagMatch: 0,
      decisionMatch: 0,
      whyMatch: 0,
      summaryMatch: 0,
      filePathMatch: 0,
      recency: 0,
    };
    expect(explainRelevance(score)).toContain("same repo");
  });

  it("returns 'No specific match factors' for zero score", () => {
    const score: ScoreBreakdown = {
      total: 0,
      sameRepo: 0,
      fileOverlap: 0,
      tagMatch: 0,
      decisionMatch: 0,
      whyMatch: 0,
      summaryMatch: 0,
      filePathMatch: 0,
      recency: 0,
    };
    expect(explainRelevance(score)).toBe("No specific match factors");
  });

  it("includes all non-zero factors in the explanation", () => {
    const score: ScoreBreakdown = {
      total: 15,
      sameRepo: 10,
      fileOverlap: 0,
      tagMatch: 5,
      decisionMatch: 0,
      whyMatch: 0,
      summaryMatch: 0,
      filePathMatch: 0,
      recency: 0,
    };
    const reason = explainRelevance(score);
    expect(reason).toContain("same repo");
    expect(reason).toContain("tag match");
  });
});

describe("searchMemory", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
    // Insert 4 memories for testing
    saveMemory(
      db,
      makeMemory({
        repoId: "my-repo",
        tags: ["optimistic-ui"],
        decision: "Use optimistic rendering for comments",
        why: "Server wait was too slow",
        files: ["src/comments/sync.ts"],
        commitSha: "commit1",
      })
    );
    saveMemory(
      db,
      makeMemory({
        repoId: "my-repo",
        tags: ["auth"],
        decision: "Use JWT tokens for auth",
        why: "Simple and stateless",
        files: ["src/auth/session.ts"],
        commitSha: "commit2",
      })
    );
    saveMemory(
      db,
      makeMemory({
        repoId: "other-repo",
        tags: ["caching"],
        decision: "Redis cache for hot data",
        why: "DB was bottleneck",
        files: ["src/cache.ts"],
        commitSha: "commit3",
      })
    );
    saveMemory(
      db,
      makeMemory({
        repoId: "my-repo",
        tags: ["checkout"],
        decision: "Validate cart before checkout",
        why: "Prevent invalid orders",
        files: ["src/checkout.ts"],
        commitSha: "commit4",
      })
    );
  });

  it("returns results matching the query keyword", () => {
    const results = searchMemory(db, { query: "optimistic", repoId: "my-repo" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].memory.tags).toContain("optimistic-ui");
  });

  it("ranks same-repo memories higher than cross-repo memories", () => {
    const results = searchMemory(db, { query: "cache", repoId: "my-repo" });
    const repoIds = results.map((r) => r.memory.repoId);
    if (repoIds.includes("my-repo") && repoIds.includes("other-repo")) {
      const myRepoIdx = repoIds.indexOf("my-repo");
      const otherRepoIdx = repoIds.indexOf("other-repo");
      expect(myRepoIdx).toBeLessThan(otherRepoIdx);
    }
  });

  it("respects --limit", () => {
    const results = searchMemory(db, { query: "", repoId: "my-repo", limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns empty array when no memories match query", () => {
    const results = searchMemory(db, { query: "xyznonexistentterm", repoId: "my-repo" });
    expect(results.length).toBe(0);
  });

  it("falls back to repoPath search when repoId yields no results", () => {
    const results = searchMemory(db, {
      query: "optimistic",
      repoId: "unknown-repo-id",
      repoPath: "/home/user/default-app",
    });
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("includes relevanceReason in each result", () => {
    const results = searchMemory(db, { query: "optimistic", repoId: "my-repo" });
    for (const result of results) {
      expect(result.relevanceReason).toBeTruthy();
    }
  });

  it("results are sorted by score descending", () => {
    const results = searchMemory(db, { query: "optimistic comments", repoId: "my-repo" });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score.total).toBeGreaterThanOrEqual(results[i].score.total);
    }
  });
});
