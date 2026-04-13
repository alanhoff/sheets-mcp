import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

export interface SheetsGetInput {
  spreadsheet_id: string;
  ranges?: string[];
  fields?: string;
  include_grid_data?: boolean;
}

interface SheetsGetRequest {
  spreadsheetId: string;
  ranges?: string[];
  fields?: string;
  includeGridData?: boolean;
}

export const sheetsGetInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet to retrieve information about."),
  ranges: z
    .array(z.string().min(1))
    .max(50)
    .optional()
    .describe("Optional list of A1 ranges to limit returned data (for example: ['Sheet1!A1:D50'])."),
  fields: z
    .string()
    .min(1)
    .optional()
    .describe("Optional Google Sheets field mask (for example: 'spreadsheetId,properties.title,sheets.properties')."),
  include_grid_data: z
    .boolean()
    .optional()
    .describe("Whether to include grid data; keep false unless grid-level cell data is required."),
};

export const sheetsGetToolDefinitions = [
  {
    name: "sheets_get",
    title: "Get information about a spreadsheet",
    description: "Fetch spreadsheet metadata with optional ranges and field masks.",
  },
] as const;

export function buildSheetsGetRequest(input: SheetsGetInput): SheetsGetRequest {
  return {
    spreadsheetId: input.spreadsheet_id,
    ...(input.ranges && input.ranges.length > 0 ? { ranges: input.ranges } : {}),
    ...(input.fields ? { fields: input.fields } : {}),
    ...(input.include_grid_data !== undefined ? { includeGridData: input.include_grid_data } : {}),
  };
}

export async function sheetsGetHandler(input: SheetsGetInput) {
  const sheets = await getSheetsClient();
  const request = buildSheetsGetRequest(input);

  const data = await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.get(request);
      return response.data;
    },
    { operationName: "spreadsheets.get" },
  );

  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

export function registerSheetsGetTools(server: McpServer) {
  for (const tool of sheetsGetToolDefinitions) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: sheetsGetInputSchema,
      },
      sheetsGetHandler,
    );
  }
}
