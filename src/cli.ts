#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init.js";

function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

const program = new Command();

program
  .name("whyline")
  .description("Local-first memory for AI coding sessions")
  .version("0.1.0");

program.command("init").description("Initialize whyline storage").action(() => runInit());

program
  .command("doctor")
  .description("Check whyline setup and diagnose configuration problems")
  .action(async () => {
    const { runDoctor } = await import("./commands/doctor.js");
    await runDoctor();
  });

program
  .command("install-claude")
  .description("Create or update .mcp.json, CLAUDE.md, and .claude/settings.local.json for this repo")
  .option("--repo-path <path>", "Target repo path (defaults to current directory)")
  .action(async (options: { repoPath?: string }) => {
    const { runInstallClaude } = await import("./commands/install-claude.js");
    await runInstallClaude(options);
  });

program
  .command("install")
  .description("Create or update tool config files for this repo")
  .option("--tool <name>", "Tool to configure: claude or cursor", "claude")
  .option("--repo-path <path>", "Target repo path (defaults to current directory)")
  .action(async (options: { tool: string; repoPath?: string }) => {
    const { runInstall } = await import("./commands/install.js");
    await runInstall(options);
  });

program
  .command("save")
  .description("Save a coding memory")
  .requiredOption("--commit <ref>", "Git commit ref")
  .requiredOption("--summary-file <path>", "Path to markdown summary file")
  .action(async (options: { commit: string; summaryFile: string }) => {
    const { runSave } = await import("./commands/save.js");
    await runSave(options);
  });

program
  .command("search <query>")
  .description("Search coding memories")
  .option("--file <path>", "Filter by file path")
  .option("--tag <tag>", "Filter by tag (repeat for multiple)", collect, [])
  .option("--since <date>", "Only memories created after this date (e.g. 2025-01-01)")
  .option("--before <date>", "Only memories created before this date (e.g. 2025-12-31)")
  .option("--limit <n>", "Max results", "10")
  .action(async (query: string, options: { file?: string; tag: string[]; since?: string; before?: string; limit: string }) => {
    const { runSearch } = await import("./commands/search.js");
    await runSearch(query, options);
  });

program
  .command("show [id]")
  .description("Show a single memory")
  .option("--commit <sha>", "Find by commit SHA instead")
  .action(async (id: string | undefined, options: { commit?: string }) => {
    const { runShow } = await import("./commands/show.js");
    await runShow(id, options);
  });

program
  .command("list")
  .description("List stored memories in reverse chronological order")
  .option("--repo", "Limit to the current git repository", false)
  .option("--limit <n>", "Max results", "20")
  .action(async (options: { repo: boolean; limit: string }) => {
    const { runList } = await import("./commands/list.js");
    await runList(options);
  });

program
  .command("delete <id>")
  .description("Delete a memory by ID")
  .option("--force", "Skip confirmation prompt", false)
  .action(async (id: string, options: { force: boolean }) => {
    const { runDelete } = await import("./commands/delete.js");
    await runDelete(id, options);
  });

program
  .command("stats")
  .description("Show memory storage statistics")
  .action(async () => {
    const { runStats } = await import("./commands/stats.js");
    await runStats();
  });

program
  .command("edit <id>")
  .description("Edit a memory in $EDITOR")
  .action(async (id: string) => {
    const { runEdit } = await import("./commands/edit.js");
    await runEdit(id);
  });

program
  .command("export")
  .description("Export memories to JSON or markdown")
  .option("--format <fmt>", "Output format: json or md", "json")
  .option("--output <path>", "Write to file instead of stdout")
  .option("--repo", "Limit to the current git repository", false)
  .option("--tag <tag>", "Filter by tag (repeat for multiple)", collect, [])
  .option("--since <date>", "Only memories created after this date (e.g. 2025-01-01)")
  .option("--before <date>", "Only memories created before this date (e.g. 2025-12-31)")
  .action(async (options: { format: string; output?: string; repo: boolean; tag: string[]; since?: string; before?: string }) => {
    const { runExport } = await import("./commands/export.js");
    await runExport(options);
  });

program
  .command("import <file>")
  .description("Import memories from a JSON export file")
  .action(async (file: string) => {
    const { runImport } = await import("./commands/import.js");
    await runImport(file);
  });

program
  .command("summarize <id>")
  .description("Use the Claude API to improve a saved memory's quality (requires ANTHROPIC_API_KEY)")
  .option("--force", "Apply improvements without confirmation prompt", false)
  .action(async (id: string, options: { force: boolean }) => {
    const { runSummarize } = await import("./commands/summarize.js");
    await runSummarize(id, options);
  });

program
  .command("mcp")
  .description("Start MCP server over stdio")
  .action(async () => {
    const { runMcp } = await import("./commands/mcp.js");
    await runMcp();
  });

program.parse();
