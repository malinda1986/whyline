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
declare const HEADING_REGEX: RegExp;
export declare function parseSummary(markdown: string): ParsedSummary;
export { HEADING_REGEX };
