import { isInitialized } from "../config.js";
import { createMcpServer } from "../mcp/server.js";
export async function runMcp() {
    if (!isInitialized()) {
        process.stderr.write("coding-memory is not initialized. Run `coding-memory init` first.\n");
        process.exit(1);
    }
    await createMcpServer();
}
//# sourceMappingURL=mcp.js.map