import { describe, it, expect } from "vitest";
import { parseSummary } from "../src/memory/parseSummary.js";

const FULL_EXAMPLE = `# Memory

Intent:
Add optimistic comment rendering.

Summary:
Implemented optimistic rendering for new comments so they appear immediately.

Decision:
Render comments immediately and reconcile after server ack.

Why:
Waiting for server confirmation made comment creation feel slow.

Alternatives rejected:
- Server-confirmed rendering only.
- Polling for new comments after submit.

Risks:
- Duplicate comments during reconnect.
- Failed server ack needs rollback UI.

Follow-ups:
- Add dedupe reconciliation tests.
- Add failed-send retry state.

Tags:
- comments
- sync
- optimistic-ui
`;

describe("parseSummary", () => {
  it("parses all standard fields from a full example", () => {
    const result = parseSummary(FULL_EXAMPLE);
    expect(result.intent).toBe("Add optimistic comment rendering.");
    expect(result.summary).toBe(
      "Implemented optimistic rendering for new comments so they appear immediately."
    );
    expect(result.decision).toBe("Render comments immediately and reconcile after server ack.");
    expect(result.why).toBe("Waiting for server confirmation made comment creation feel slow.");
    expect(result.alternativesRejected).toEqual([
      "Server-confirmed rendering only.",
      "Polling for new comments after submit.",
    ]);
    expect(result.risks).toEqual([
      "Duplicate comments during reconnect.",
      "Failed server ack needs rollback UI.",
    ]);
    expect(result.followUps).toEqual([
      "Add dedupe reconciliation tests.",
      "Add failed-send retry state.",
    ]);
    expect(result.tags).toEqual(["comments", "sync", "optimistic-ui"]);
  });

  it("parses optional Task: heading", () => {
    const input = `Task:\nFix comment sync bug.\n\nIntent:\nFix the sync.\n`;
    const result = parseSummary(input);
    expect(result.task).toBe("Fix comment sync bug.");
  });

  it("returns undefined for task when heading is absent", () => {
    const result = parseSummary(FULL_EXAMPLE);
    expect(result.task).toBeUndefined();
  });

  it("uses safe defaults for missing fields", () => {
    const result = parseSummary("Some random text with no headings.");
    expect(result.intent).toBe("Unspecified intent");
    expect(result.decision).toBe("Unspecified decision");
    expect(result.why).toBe("Unspecified rationale");
    expect(result.alternativesRejected).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.followUps).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("uses full file content as summary fallback when Summary: heading is missing", () => {
    const input = "Intent:\nDo something.\n";
    const result = parseSummary(input);
    expect(result.summary).toBeTruthy();
  });

  it("handles asterisk bullets as well as dash bullets", () => {
    const input = `Risks:\n* Risk one\n* Risk two\n`;
    const result = parseSummary(input);
    expect(result.risks).toEqual(["Risk one", "Risk two"]);
  });

  it("strips the markdown h1 title line", () => {
    const input = `# My Session Memory\n\nIntent:\nDo something useful.\n`;
    const result = parseSummary(input);
    expect(result.intent).toBe("Do something useful.");
  });

  it("handles Follow ups (without hyphen) as synonym for Follow-ups", () => {
    const input = `Follow ups:\n- Test A\n- Test B\n`;
    const result = parseSummary(input);
    expect(result.followUps).toEqual(["Test A", "Test B"]);
  });

  it("trims whitespace from field values", () => {
    const input = `Intent:\n   Add something.   \n`;
    const result = parseSummary(input);
    expect(result.intent).toBe("Add something.");
  });
});
