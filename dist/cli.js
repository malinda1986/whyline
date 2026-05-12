#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init.js";
const program = new Command();
program
    .name("coding-memory")
    .description("Local-first memory for AI coding sessions")
    .version("0.1.0");
program.command("init").description("Initialize coding-memory storage").action(() => runInit());
program
    .command("save")
    .description("Save a coding memory")
    .requiredOption("--commit <ref>", "Git commit ref")
    .requiredOption("--summary-file <path>", "Path to markdown summary file")
    .action(async (options) => {
    const { runSave } = await import("./commands/save.js");
    await runSave(options);
});
program
    .command("search <query>")
    .description("Search coding memories")
    .option("--file <path>", "Filter by file path")
    .option("--limit <n>", "Max results", "10")
    .action(async (query, options) => {
    const { runSearch } = await import("./commands/search.js");
    await runSearch(query, options);
});
program
    .command("show [id]")
    .description("Show a single memory")
    .option("--commit <sha>", "Find by commit SHA instead")
    .action(async (id, options) => {
    const { runShow } = await import("./commands/show.js");
    await runShow(id, options);
});
program
    .command("mcp")
    .description("Start MCP server over stdio")
    .action(async () => {
    const { runMcp } = await import("./commands/mcp.js");
    await runMcp();
});
program.parse();
//# sourceMappingURL=cli.js.map