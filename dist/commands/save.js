import fs from "fs";
import { isInitialized, resolveConfig } from "../config.js";
import { openDb } from "../db/connection.js";
import { getRepoContext } from "../memory/repoContext.js";
import { parseSummary } from "../memory/parseSummary.js";
import { redactSecrets } from "../memory/redactSecrets.js";
import { saveMemory, generateMemoryId, buildEmbeddingText } from "../memory/saveMemory.js";
export async function runSave(options) {
    if (!isInitialized()) {
        console.error("coding-memory is not initialized. Run `coding-memory init` first.");
        process.exit(1);
    }
    const cwd = process.cwd();
    let ctx;
    try {
        ctx = getRepoContext(cwd, options.commit);
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
    if (!fs.existsSync(options.summaryFile)) {
        console.error(`Error: summary file not found: ${options.summaryFile}`);
        process.exit(1);
    }
    const rawMarkdown = fs.readFileSync(options.summaryFile, "utf-8");
    const parsed = parseSummary(rawMarkdown);
    const now = new Date().toISOString();
    const id = generateMemoryId();
    const memory = {
        id,
        createdAt: now,
        updatedAt: now,
        repoId: ctx.repoId,
        repoPath: ctx.repoPath,
        repoName: ctx.repoName,
        branch: ctx.branch ?? undefined,
        commitSha: ctx.commitSha,
        files: ctx.changedFiles,
        tags: parsed.tags.map(redactSecrets),
        task: parsed.task ? redactSecrets(parsed.task) : undefined,
        intent: redactSecrets(parsed.intent),
        summary: redactSecrets(parsed.summary),
        decision: redactSecrets(parsed.decision),
        why: redactSecrets(parsed.why),
        alternativesRejected: parsed.alternativesRejected.map(redactSecrets),
        risks: parsed.risks.map(redactSecrets),
        followUps: parsed.followUps.map(redactSecrets),
        source: "cli",
        embeddingText: "",
    };
    memory.embeddingText = buildEmbeddingText(memory);
    const db = openDb(resolveConfig().storage.dbPath);
    saveMemory(db, memory);
    db.close();
    console.log(`Saved coding memory ${memory.id}`);
    console.log(`Repo: ${ctx.repoName}`);
    console.log(`Commit: ${ctx.commitSha.slice(0, 8)}`);
    console.log(`Files: ${ctx.changedFiles.length}`);
}
//# sourceMappingURL=save.js.map