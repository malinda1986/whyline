import { describe, it, expect } from "vitest";

describe("ToolAdapter interface shape", () => {
  it("WriteResult has path and status fields", () => {
    const result: import("../src/adapters/types.js").WriteResult = {
      path: "/some/path",
      status: "created",
    };
    expect(result.path).toBe("/some/path");
    expect(result.status).toBe("created");
  });
});
