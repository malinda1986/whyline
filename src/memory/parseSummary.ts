export type ParsedSummary = {
  task?: string;
  intent: string;
  summary: string;
  decision: string;
  why: string;
  alternativesRejected: string[];
  risks: string[];
  followUps: string[];
  tags: string[];
};

const HEADING_REGEX = /^([A-Za-z][A-Za-z\- ]+):\s*$/m;

function extractSections(text: string): Record<string, string> {
  const lines = text.split("\n");
  const sections: Record<string, string> = {};
  let currentHeading: string | null = null;
  const buffer: string[] = [];

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
    } else {
      if (currentHeading !== null) {
        buffer.push(line);
      }
    }
  }
  flush();

  return sections;
}

function parseBullets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export function parseSummary(markdown: string): ParsedSummary {
  // Remove markdown h1 title lines before parsing sections
  const text = markdown.replace(/^#[^#].*$/m, "").trim();
  const sections = extractSections(text);

  const get = (key: string): string | undefined => sections[key];

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
