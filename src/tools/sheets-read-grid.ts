import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

export interface SheetsReadGridInput {
  spreadsheet_id: string;
  ranges: string[];
  fields?: string;
}

interface SheetsReadGridRequest {
  spreadsheetId: string;
  ranges: string[];
  includeGridData: true;
  fields: string;
}

export const DEFAULT_SHEETS_READ_GRID_FIELDS = [
  "spreadsheetId",
  "sheets.properties",
  "sheets.merges",
  "sheets.data.startRow",
  "sheets.data.startColumn",
  "sheets.data.rowData.values.userEnteredValue",
  "sheets.data.rowData.values.effectiveValue",
  "sheets.data.rowData.values.formattedValue",
  "sheets.data.rowData.values.note",
  "sheets.data.rowData.values.userEnteredFormat",
  "sheets.data.rowData.values.effectiveFormat",
  "sheets.data.rowMetadata",
  "sheets.data.columnMetadata",
].join(",");

export const sheetsReadGridInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet to read grid data from."),
  ranges: z
    .array(z.string().min(1))
    .min(1)
    .max(25)
    .describe("One or more A1 ranges to read grid-level data from in a single request."),
  fields: z
    .string()
    .min(1)
    .optional()
    .describe("Optional Google Sheets field mask override. Defaults to a minimized mask for grid inspection."),
};

export const sheetsReadGridToolDefinition = {
  name: "sheets_read_grid",
  title: "Read grid-level spreadsheet data",
  description:
    "Read formulas, notes, effective values, formatting, merges, and dimension metadata using spreadsheets.get.",
} as const;

export function buildSheetsReadGridRequest(input: SheetsReadGridInput): SheetsReadGridRequest {
  const fields = input.fields?.trim() ? input.fields.trim() : DEFAULT_SHEETS_READ_GRID_FIELDS;

  return {
    spreadsheetId: input.spreadsheet_id,
    ranges: input.ranges,
    includeGridData: true,
    fields,
  };
}

export async function sheetsReadGridHandler(input: SheetsReadGridInput) {
  const sheets = await getSheetsClient();
  const request = buildSheetsReadGridRequest(input);

  const data = await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.get(request);
      return response.data;
    },
    { operationName: "spreadsheets.get" },
  );

  const normalizedSheets = (data.sheets ?? []).map((sheet) => ({
    sheet_id: sheet.properties?.sheetId ?? null,
    title: sheet.properties?.title ?? "",
    index: sheet.properties?.index ?? null,
    grid_properties: sheet.properties?.gridProperties ?? null,
    merges: sheet.merges ?? [],
    grid_data: (sheet.data ?? []).map((gridData) => ({
      start_row: gridData.startRow ?? 0,
      start_column: gridData.startColumn ?? 0,
      row_metadata: gridData.rowMetadata ?? [],
      column_metadata: gridData.columnMetadata ?? [],
      rows: (gridData.rowData ?? []).map((rowData) => ({
        cells: (rowData.values ?? []).map((cell) => ({
          formatted_value: cell.formattedValue ?? null,
          formula: cell.userEnteredValue?.formulaValue ?? null,
          user_entered_value: cell.userEnteredValue ?? null,
          effective_value: cell.effectiveValue ?? null,
          note: cell.note ?? null,
          user_entered_format: cell.userEnteredFormat ?? null,
          effective_format: cell.effectiveFormat ?? null,
        })),
      })),
    })),
  }));

  const payload = {
    spreadsheet_id: data.spreadsheetId ?? input.spreadsheet_id,
    requested_ranges: input.ranges.length,
    returned_sheets: normalizedSheets.length,
    fields: request.fields,
    sheets: normalizedSheets,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

export function registerSheetsReadGridTool(server: McpServer) {
  server.registerTool(
    sheetsReadGridToolDefinition.name,
    {
      title: sheetsReadGridToolDefinition.title,
      description: sheetsReadGridToolDefinition.description,
      inputSchema: sheetsReadGridInputSchema,
    },
    sheetsReadGridHandler,
  );
}
