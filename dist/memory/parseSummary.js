const HEADING_REGEX = /^([A-Za-z][A-Za-z\- ]+):\s*$/m;
function extractSections(text) {
    const lines = text.split("\n");
    const sections = {};
    let currentHeading = null;
    const buffer = [];
    const flush = () => {
        if (currentHeading !== null) {
            sections[currentHeading] = buffer.join("\n").trim();
            buffer.length = 0;
        }
    };
    for (const line of lines) {
        const match = line.match(/^([A-Za-z][A-Za-z\- ]+):\s*$/);
        if (match) {
            flush();
            currentHeading = match[1].toLowerCase();
        }
        else {
            if (currentHeading !== null) {
                buffer.push(line);
            }
        }
    }
    flush();
    return sections;
}
function parseBullets(text) {
    return text
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
}
export function parseSummary(markdown) {
    // Remove markdown h1 title lines before parsing sections
    const text = markdown.replace(/^#[^#].*$/m, "").trim();
    const sections = extractSections(text);
    const get = (key) => sections[key];
    return {
        task: get("task")?.trim() || undefined,
        intent: get("intent")?.trim() || "Unspecified intent",
        summary: get("summary")?.trim() || markdown.trim(),
        decision: get("decision")?.trim() || "Unspecified decision",
        why: get("why")?.trim() || "Unspecified rationale",
        alternativesRejected: parseBullets(get("alternatives rejected") ?? ""),
        risks: parseBullets(get("risks") ?? ""),
        followUps: parseBullets(get("follow-ups") ?? get("follow ups") ?? ""),
        tags: parseBullets(get("tags") ?? ""),
    };
}
// Keep HEADING_REGEX exported for potential reuse
export { HEADING_REGEX };
//# sourceMappingURL=parseSummary.js.map