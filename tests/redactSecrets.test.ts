import { describe, it, expect } from "vitest";
import { redactSecrets, SECRET_PATTERNS } from "../src/memory/redactSecrets.js";

describe("redactSecrets", () => {
  it("redacts GitHub personal access tokens (ghp_)", () => {
    const input = "token: ghp_abcdefghijklmnopqrstuvwxyz1234567890";
    expect(redactSecrets(input)).toContain("[REDACTED_SECRET]");
    expect(redactSecrets(input)).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
  });

  it("redacts GitHub OAuth tokens (gho_)", () => {
    const input = "gho_abcdefghijklmnopqrstuvwxyz1234567890";
    expect(redactSecrets(input)).toBe("[REDACTED_SECRET]");
  });

  it("redacts GitHub App tokens (ghs_)", () => {
    const input = "ghs_abcdefghijklmnopqrstuvwxyz1234567890";
    expect(redactSecrets(input)).toBe("[REDACTED_SECRET]");
  });

  it("redacts npm tokens", () => {
    const input = "npm_abcdefghijklmnopqrstuvwxyz1234567890";
    expect(redactSecrets(input)).toBe("[REDACTED_SECRET]");
  });

  it("redacts AWS access keys", () => {
    const input = "AKIAIOSFODNN7EXAMPLE";
    expect(redactSecrets(input)).toBe("[REDACTED_SECRET]");
  });

  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc";
    expect(redactSecrets(input)).toContain("[REDACTED_SECRET]");
    expect(redactSecrets(input)).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("redacts .env-style secrets", () => {
    expect(redactSecrets("API_KEY=abc123secret")).toContain("[REDACTED_SECRET]");
    expect(redactSecrets("SECRET=mysecretvalue")).toContain("[REDACTED_SECRET]");
    expect(redactSecrets("PASSWORD=hunter2")).toContain("[REDACTED_SECRET]");
    expect(redactSecrets("TOKEN=abcdef")).toContain("[REDACTED_SECRET]");
  });

  it("redacts PEM private key blocks", () => {
    const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA1234567890abcdef
-----END RSA PRIVATE KEY-----`;
    expect(redactSecrets(input)).toBe("[REDACTED_SECRET]");
  });

  it("does not redact normal text", () => {
    const input = "We decided to use optimistic rendering for better UX.";
    expect(redactSecrets(input)).toBe(input);
  });

  it("does not redact short random strings that look like keys but aren't", () => {
    const input = "The AKID prefix is used for something else here";
    expect(redactSecrets(input)).toBe(input);
  });

  it("redacts multiple secrets in one string", () => {
    const input = `ghp_abcdefghijklmnopqrstuvwxyz1234567890 and npm_abcdefghijklmnopqrstuvwxyz1234567890`;
    const result = redactSecrets(input);
    expect(result).not.toMatch(/ghp_/);
    expect(result).not.toMatch(/npm_/);
    expect(result.split("[REDACTED_SECRET]").length - 1).toBe(2);
  });

  it("all SECRET_PATTERNS have a name and a RegExp", () => {
    for (const p of SECRET_PATTERNS) {
      expect(p.name).toBeTruthy();
      expect(p.pattern).toBeInstanceOf(RegExp);
    }
  });
});
