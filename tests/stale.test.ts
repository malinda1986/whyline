import { describe, it, expect } from "vitest";
import { isStale, STALE_THRESHOLD_DAYS } from "../src/memory/searchMemory.js";
import type { CodingMemory } from "../src/memory/types.js";

function makeMemory(daysAgo: number): CodingMemory {
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "mem_test",
    createdAt,
    updatedAt: createdAt,
    repoId: "repo1",
    files: [],
    tags: [],
    intent: "test",
    summary: "test",
    decision: "test",
    why: "test",
    alternativesRejected: [],
    risks: [],
    followUps: [],
    source: "cli",
    embeddingText: "",
  };
}

describe("isStale", () => {
  it("returns false for a memory created today", () => {
    expect(isStale(makeMemory(0))).toBe(false);
  });

  it("returns false for a memory 89 days old", () => {
    expect(isStale(makeMemory(89))).toBe(false);
  });

  it("returns true for a memory exactly at threshold", () => {
    expect(isStale(makeMemory(STALE_THRESHOLD_DAYS + 1))).toBe(true);
  });

  it("returns true for a memory 180 days old", () => {
    expect(isStale(makeMemory(180))).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(isStale(makeMemory(10), 7)).toBe(true);
    expect(isStale(makeMemory(5), 7)).toBe(false);
  });
});
