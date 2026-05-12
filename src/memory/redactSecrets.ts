type SecretPattern = { name: string; pattern: RegExp };

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "github_token", pattern: /ghp_[A-Za-z0-9]{36}/g },
  { name: "github_oauth", pattern: /gho_[A-Za-z0-9]{36}/g },
  { name: "github_app_token", pattern: /ghs_[A-Za-z0-9]{36}/g },
  { name: "npm_token", pattern: /npm_[A-Za-z0-9]{36}/g },
  { name: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/g },
  {
    name: "bearer_token",
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  },
  {
    name: "dotenv_secret",
    pattern:
      /(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|AUTH_KEY)\s*=\s*\S+/gi,
  },
  {
    name: "private_key_block",
    pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  },
];

export function redactSecrets(input: string): string {
  let output = input;
  for (const { pattern } of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes to avoid stateful bugs
    pattern.lastIndex = 0;
    output = output.replace(pattern, "[REDACTED_SECRET]");
  }
  return output;
}
