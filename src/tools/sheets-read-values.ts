import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

export type SheetsReadValuesMajorDimension = "ROWS" | "COLUMNS";
export type SheetsReadValuesRenderOption = "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA";
export type SheetsReadValuesDateTimeRenderOption = "SERIAL_NUMBER" | "FORMATTED_STRING";

export interface SheetsReadValuesInput {
  spreadsheet_id: string;
  ranges: string[];
  major_dimension?: SheetsReadValuesMajorDimension;
  value_render_option?: SheetsReadValuesRenderOption;
  date_time_render_option?: SheetsReadValuesDateTimeRenderOption;
}

interface SheetsReadValuesRequest {
  spreadsheetId: string;
  ranges: string[];
  majorDimension?: SheetsReadValuesMajorDimension;
  valueRenderOption?: SheetsReadValuesRenderOption;
  dateTimeRenderOption?: SheetsReadValuesDateTimeRenderOption;
}

export const sheetsReadValuesInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet to read values from."),
  ranges: z
    .array(z.string().min(1))
    .min(1)
    .max(100)
    .describe("One or more A1 ranges to read in a single batch call (for example: ['Sheet1!A1:C50'])."),
  major_dimension: z
    .enum(["ROWS", "COLUMNS"])
    .optional()
    .describe("Whether values should be grouped by rows or columns."),
  value_render_option: z
    .enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"])
    .optional()
    .describe("Controls how values are rendered in the response."),
  date_time_render_option: z
    .enum(["SERIAL_NUMBER", "FORMATTED_STRING"])
    .optional()
    .describe("Controls date/time rendering when value_render_option is UNFORMATTED_VALUE."),
};

export const sheetsReadValuesToolDefinition = {
  name: "sheets_read_values",
  title: "Read one or more spreadsheet ranges",
  description: "Batch read values from one or many ranges using spreadsheets.values.batchGet.",
} as const;

export function buildSheetsReadValuesRequest(input: SheetsReadValuesInput): SheetsReadValuesRequest {
  return {
    spreadsheetId: input.spreadsheet_id,
    ranges: input.ranges,
    ...(input.major_dimension ? { majorDimension: input.major_dimension } : {}),
    ...(input.value_render_option ? { valueRenderOption: input.value_render_option } : {}),
    ...(input.date_time_render_option ? { dateTimeRenderOption: input.date_time_render_option } : {}),
  };
}

export async function sheetsReadValuesHandler(input: SheetsReadValuesInput) {
  const sheets = await getSheetsClient();
  const request = buildSheetsReadValuesRequest(input);

  const data = await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.values.batchGet(request);
      return response.data;
    },
    { operationName: "spreadsheets.values.batchGet" },
  );

  const valueRanges = (data.valueRanges ?? []).map((valueRange) => ({
    range: valueRange.range ?? "",
    major_dimension: valueRange.majorDimension ?? input.major_dimension ?? "ROWS",
    values: valueRange.values ?? [],
  }));

  const payload = {
    spreadsheet_id: data.spreadsheetId ?? input.spreadsheet_id,
    requested_ranges: input.ranges.length,
    returned_ranges: valueRanges.length,
    value_ranges: valueRanges,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

export function registerSheetsReadValuesTool(server: McpServer) {
  server.registerTool(
    sheetsReadValuesToolDefinition.name,
    {
      title: sheetsReadValuesToolDefinition.title,
      description: sheetsReadValuesToolDefinition.description,
      inputSchema: sheetsReadValuesInputSchema,
    },
    sheetsReadValuesHandler,
  );
}
