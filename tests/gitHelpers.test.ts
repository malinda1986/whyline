import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeRemoteUrl, getRepoId, getRepoName } from "../src/git/repoId.js";

// Mock child_process for getRepoId/getRepoName tests that use execSync
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";
const mockExecSync = vi.mocked(execSync);

describe("normalizeRemoteUrl", () => {
  it("strips .git suffix", () => {
    expect(normalizeRemoteUrl("https://github.com/user/repo.git")).toBe(
      "https://github.com/user/repo"
    );
  });

  it("converts git@ SSH URL to https", () => {
    expect(normalizeRemoteUrl("git@github.com:user/repo.git")).toBe(
      "https://github.com/user/repo"
    );
  });

  it("lowercases the URL", () => {
    expect(normalizeRemoteUrl("https://GitHub.com/User/Repo")).toBe(
      "https://github.com/user/repo"
    );
  });

  it("handles URLs without .git suffix", () => {
    expect(normalizeRemoteUrl("https://github.com/user/repo")).toBe(
      "https://github.com/user/repo"
    );
  });
});

describe("getRepoId", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a 32-char hex string when remote exists", () => {
    mockExecSync.mockReturnValue("git@github.com:user/repo.git\n" as unknown as Buffer);
    const id = getRepoId("/some/path");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces the same ID for the same remote URL regardless of path", () => {
    mockExecSync.mockReturnValue("git@github.com:user/repo.git\n" as unknown as Buffer);
    const id1 = getRepoId("/path/one");
    const id2 = getRepoId("/path/two");
    expect(id1).toBe(id2);
  });

  it("falls back to path hash when execSync throws (no remote)", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("no remote");
    });
    const id = getRepoId("/some/repo/path");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces different IDs for different repos", () => {
    mockExecSync
      .mockReturnValueOnce("git@github.com:user/repo-a.git\n" as unknown as Buffer)
      .mockReturnValueOnce("git@github.com:user/repo-b.git\n" as unknown as Buffer);
    const id1 = getRepoId("/path");
    const id2 = getRepoId("/path");
    expect(id1).not.toBe(id2);
  });
});

describe("getRepoName", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it("extracts repo name from remote URL", () => {
    mockExecSync.mockReturnValue("git@github.com:user/my-project.git\n" as unknown as Buffer);
    expect(getRepoName("/some/path")).toBe("my-project");
  });

  it("falls back to directory name when no remote", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("no remote");
    });
    expect(getRepoName("/home/user/my-app")).toBe("my-app");
  });
});
