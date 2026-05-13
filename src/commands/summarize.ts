import https from "https";
import readline from "readline";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getMemoryById, updateMemory, buildEmbeddingText } from "../memory/saveMemory.js";

type ImprovedMemory = {
  intent: string;
  summary: string;
  decision: string;
  why: string;
  alternativesRejected: string[];
  risks: string[];
  followUps: string[];
  tags: string[];
};

function buildPrompt(memory: {
  intent: string;
  summary: string;
  decision: string;
  why: string;
  alternativesRejected: string[];
  risks: string[];
  followUps: string[];
  tags: string[];
}): string {
  return `You are improving a coding memory record. Rewrite each field to be clearer, more specific, and more useful for a future developer session. Do not invent details that aren't implied by the original. Keep each field concise. Return ONLY valid JSON with these exact keys: intent, summary, decision, why, alternativesRejected (array), risks (array), followUps (array), tags (array).

Original memory:
${JSON.stringify(memory, null, 2)}`;
}

async function callClaudeApi(prompt: string, apiKey: string): Promise<ImprovedMemory> {
  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as {
              content?: Array<{ type: string; text: string }>;
              error?: { message: string };
            };
            if (parsed.error) {
              reject(new Error(`Claude API error: ${parsed.error.message}`));
              return;
            }
            const text = parsed.content?.find((c) => c.type === "text")?.text ?? "";
            // Extract JSON from the response (may be wrapped in markdown code block)
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
            const improved = JSON.parse(jsonMatch[1].trim()) as ImprovedMemory;
            resolve(improved);
          } catch (e) {
            reject(new Error(`Failed to parse Claude response: ${String(e)}\nRaw: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function diffField(label: string, before: string | string[], after: string | string[]): string {
  const b = Array.isArray(before) ? before.join(", ") : before;
  const a = Array.isArray(after) ? after.join(", ") : after;
  if (b === a) return "";
  return `  ${label}:\n    before: ${b}\n    after:  ${a}`;
}

function showDiff(original: ImprovedMemory, improved: ImprovedMemory): void {
  const diffs = [
    diffField("intent", original.intent, improved.intent),
    diffField("summary", original.summary, improved.summary),
    diffField("decision", original.decision, improved.decision),
    diffField("why", original.why, improved.why),
    diffField("alternativesRejected", original.alternativesRejected, improved.alternativesRejected),
    diffField("risks", original.risks, improved.risks),
    diffField("followUps", original.followUps, improved.followUps),
    diffField("tags", original.tags, improved.tags),
  ].filter(Boolean);

  if (diffs.length === 0) {
    console.log("No changes suggested — memory is already well-written.");
  } else {
    console.log("\nProposed improvements:\n");
    console.log(diffs.join("\n\n"));
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export async function runSummarize(id: string, options: { force: boolean }): Promise<void> {
  if (!isInitialized()) {
    console.error("whyline is not initialized. Run `whyline init` first.");
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is not set.");
    console.error("Export it before running: export ANTHROPIC_API_KEY=your_key");
    process.exit(1);
  }

  const db = openDb(resolveConfig().storage.dbPath);
  const memory = getMemoryById(db, id);
  db.close();

  if (!memory) {
    console.error(`Memory not found: ${id}`);
    process.exit(1);
  }

  const original: ImprovedMemory = {
    intent: memory.intent,
    summary: memory.summary,
    decision: memory.decision,
    why: memory.why,
    alternativesRejected: memory.alternativesRejected,
    risks: memory.risks,
    followUps: memory.followUps,
    tags: memory.tags,
  };

  console.log(`Summarizing memory ${id}...`);
  const improved = await callClaudeApi(buildPrompt(original), apiKey);

  showDiff(original, improved);

  const hasChanges =
    JSON.stringify(original) !== JSON.stringify(improved);

  if (!hasChanges) {
    return;
  }

  const shouldSave = options.force || (await confirm("\nApply improvements? [y/N] "));

  if (!shouldSave) {
    console.log("Cancelled.");
    return;
  }

  const db2 = openDb(resolveConfig().storage.dbPath);
  const embeddingText = buildEmbeddingText({
    ...memory,
    ...improved,
    commitSha: memory.commitSha,
    files: memory.files,
  });
  updateMemory(db2, id, { ...improved, embeddingText });
  db2.close();

  console.log(`Updated memory ${id}.`);
}
