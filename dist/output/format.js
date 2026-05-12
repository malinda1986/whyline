export function formatMemory(memory, verbose = false) {
    const lines = [memory.id];
    if (memory.commitSha)
        lines.push(`Commit: ${memory.commitSha.slice(0, 8)}`);
    if (memory.repoName)
        lines.push(`Repo: ${memory.repoName}`);
    if (memory.files.length)
        lines.push(`Files: ${memory.files.join(", ")}`);
    lines.push("", "Intent:", `  ${memory.intent}`);
    lines.push("", "Decision:", `  ${memory.decision}`);
    lines.push("", "Why:", `  ${memory.why}`);
    if (memory.risks.length) {
        lines.push("", "Risks:");
        for (const r of memory.risks)
            lines.push(`  - ${r}`);
    }
    if (verbose) {
        if (memory.alternativesRejected.length) {
            lines.push("", "Alternatives rejected:");
            for (const a of memory.alternativesRejected)
                lines.push(`  - ${a}`);
        }
        if (memory.followUps.length) {
            lines.push("", "Follow-ups:");
            for (const fu of memory.followUps)
                lines.push(`  - ${fu}`);
        }
        if (memory.tags.length) {
            lines.push("", `Tags: ${memory.tags.join(", ")}`);
        }
        if (memory.task) {
            lines.push("", `Task: ${memory.task}`);
        }
        lines.push("", `Summary: ${memory.summary}`);
    }
    return lines.join("\n");
}
export function formatSearchResult(result) {
    return `${formatMemory(result.memory)}\n\n  [${result.relevanceReason}]`;
}
//# sourceMappingURL=format.js.map