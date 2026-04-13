import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { verifyToken } from "#google.ts";
import { registerSheetsAnalyzeTool } from "#tools/sheets-analyze.ts";
import { registerSheetsEditTool } from "#tools/sheets-edit.ts";
import { registerSheetsFormulaDebugTool } from "#tools/sheets-formula-debug.ts";
import { registerSheetsGetTools } from "#tools/sheets-get.ts";
import { registerSheetsReadGridTool } from "#tools/sheets-read-grid.ts";
import { registerSheetsReadValuesTool } from "#tools/sheets-read-values.ts";
import { registerSheetsStyleTool } from "#tools/sheets-style.ts";

try {
  await verifyToken();
} catch {
  console.error("Failed to verify token. Please run with 'auth' subcommand to authenticate.");
  process.exit(1);
}

const server = new McpServer({
  name: "Sheets MCP",
  version: "0.1.0",
});

registerSheetsGetTools(server);
registerSheetsReadValuesTool(server);
registerSheetsReadGridTool(server);
registerSheetsAnalyzeTool(server);
registerSheetsFormulaDebugTool(server);
registerSheetsEditTool(server);
registerSheetsStyleTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
