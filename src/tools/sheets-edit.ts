import type { sheets_v4 } from "@googleapis/sheets";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

export type SheetsEditMajorDimension = "ROWS" | "COLUMNS";
export type SheetsEditValueInputOption = "RAW" | "USER_ENTERED";
export type SheetsEditInsertDataOption = "OVERWRITE" | "INSERT_ROWS";
export type SheetsEditValueRenderOption = "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA";
export type SheetsEditDateTimeRenderOption = "SERIAL_NUMBER" | "FORMATTED_STRING";

export interface SheetsEditValueUpdateOperation {
  range: string;
  values: unknown[][];
  major_dimension?: SheetsEditMajorDimension;
}

export interface SheetsEditAppendOperation {
  range: string;
  values: unknown[][];
  major_dimension?: SheetsEditMajorDimension;
  value_input_option?: SheetsEditValueInputOption;
  insert_data_option?: SheetsEditInsertDataOption;
}

export interface SheetsEditInput {
  spreadsheet_id: string;
  dry_run?: boolean;
  value_input_option?: SheetsEditValueInputOption;
  include_values_in_response?: boolean;
  response_value_render_option?: SheetsEditValueRenderOption;
  response_date_time_render_option?: SheetsEditDateTimeRenderOption;
  value_updates?: SheetsEditValueUpdateOperation[];
  append_rows?: SheetsEditAppendOperation[];
  clear_ranges?: string[];
  requests?: sheets_v4.Schema$Request[];
  include_spreadsheet_in_response?: boolean;
  response_ranges?: string[];
  response_include_grid_data?: boolean;
}

interface SheetsEditValuesBatchUpdateRequest {
  spreadsheetId: string;
  requestBody: {
    data: {
      range: string;
      majorDimension: SheetsEditMajorDimension;
      values: unknown[][];
    }[];
    valueInputOption: SheetsEditValueInputOption;
    includeValuesInResponse: boolean;
    responseValueRenderOption?: SheetsEditValueRenderOption;
    responseDateTimeRenderOption?: SheetsEditDateTimeRenderOption;
  };
}

interface SheetsEditValuesBatchClearRequest {
  spreadsheetId: string;
  requestBody: {
    ranges: string[];
  };
}

interface SheetsEditValuesAppendRequest {
  spreadsheetId: string;
  range: string;
  valueInputOption: SheetsEditValueInputOption;
  insertDataOption: SheetsEditInsertDataOption;
  includeValuesInResponse: boolean;
  responseValueRenderOption?: SheetsEditValueRenderOption;
  responseDateTimeRenderOption?: SheetsEditDateTimeRenderOption;
  requestBody: {
    majorDimension: SheetsEditMajorDimension;
    values: unknown[][];
  };
}

interface SheetsEditBatchUpdateRequest {
  spreadsheetId: string;
  requestBody: {
    requests: sheets_v4.Schema$Request[];
    includeSpreadsheetInResponse: boolean;
    responseRanges?: string[];
    responseIncludeGridData: boolean;
  };
}

export const sheetsEditInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet to edit."),
  dry_run: z
    .boolean()
    .optional()
    .describe("When true, no API mutation calls are executed and the planned operations are returned."),
  value_input_option: z
    .enum(["RAW", "USER_ENTERED"])
    .optional()
    .describe("Default value input mode for value updates and append operations."),
  include_values_in_response: z
    .boolean()
    .optional()
    .describe("Whether to include updated values in responses for update/append operations."),
  response_value_render_option: z
    .enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"])
    .optional()
    .describe("How values should be rendered when include_values_in_response is enabled."),
  response_date_time_render_option: z
    .enum(["SERIAL_NUMBER", "FORMATTED_STRING"])
    .optional()
    .describe("How date/time values should be rendered when include_values_in_response is enabled."),
  value_updates: z
    .array(
      z.object({
        range: z.string().min(1),
        values: z.array(z.array(z.unknown())),
        major_dimension: z.enum(["ROWS", "COLUMNS"]).optional(),
      }),
    )
    .min(1)
    .max(200)
    .optional()
    .describe("Batch value update operations that are coalesced into one values.batchUpdate call."),
  append_rows: z
    .array(
      z.object({
        range: z.string().min(1),
        values: z.array(z.array(z.unknown())),
        major_dimension: z.enum(["ROWS", "COLUMNS"]).optional(),
        value_input_option: z.enum(["RAW", "USER_ENTERED"]).optional(),
        insert_data_option: z.enum(["OVERWRITE", "INSERT_ROWS"]).optional(),
      }),
    )
    .min(1)
    .max(50)
    .optional()
    .describe("Append operations executed in order using values.append."),
  clear_ranges: z
    .array(z.string().min(1))
    .min(1)
    .max(200)
    .optional()
    .describe("Ranges to clear in one values.batchClear call."),
  requests: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(200)
    .optional()
    .describe("Raw spreadsheet batchUpdate requests for sheet structure and other advanced mutations."),
  include_spreadsheet_in_response: z
    .boolean()
    .optional()
    .describe("Whether spreadsheets.batchUpdate should include the updated spreadsheet in its response."),
  response_ranges: z
    .array(z.string().min(1))
    .min(1)
    .max(100)
    .optional()
    .describe("Optional ranges to include in spreadsheets.batchUpdate response when enabled."),
  response_include_grid_data: z
    .boolean()
    .optional()
    .describe("Whether spreadsheets.batchUpdate response should include grid data for response_ranges."),
};

export const sheetsEditToolDefinition = {
  name: "sheets_edit",
  title: "Edit spreadsheet values and structure",
  description:
    "Perform batched value updates/appends/clears and structural requests in one tool call, with dry-run planning support.",
} as const;

function getDefaultValueInputOption(input: SheetsEditInput) {
  return input.value_input_option ?? "USER_ENTERED";
}

function getIncludeValuesInResponse(input: SheetsEditInput) {
  return input.include_values_in_response ?? false;
}

export function hasSheetsEditOperations(input: SheetsEditInput) {
  return Boolean(
    (input.value_updates && input.value_updates.length > 0) ||
      (input.append_rows && input.append_rows.length > 0) ||
      (input.clear_ranges && input.clear_ranges.length > 0) ||
      (input.requests && input.requests.length > 0),
  );
}

export function buildSheetsEditValuesBatchUpdateRequest(
  input: SheetsEditInput,
): SheetsEditValuesBatchUpdateRequest | null {
  if (!input.value_updates || input.value_updates.length === 0) {
    return null;
  }

  return {
    spreadsheetId: input.spreadsheet_id,
    requestBody: {
      data: input.value_updates.map((update) => ({
        range: update.range,
        majorDimension: update.major_dimension ?? "ROWS",
        values: update.values,
      })),
      valueInputOption: getDefaultValueInputOption(input),
      includeValuesInResponse: getIncludeValuesInResponse(input),
      ...(input.response_value_render_option ? { responseValueRenderOption: input.response_value_render_option } : {}),
      ...(input.response_date_time_render_option
        ? { responseDateTimeRenderOption: input.response_date_time_render_option }
        : {}),
    },
  };
}

export function buildSheetsEditAppendRequests(input: SheetsEditInput): SheetsEditValuesAppendRequest[] {
  if (!input.append_rows || input.append_rows.length === 0) {
    return [];
  }

  return input.append_rows.map((appendOperation) => ({
    spreadsheetId: input.spreadsheet_id,
    range: appendOperation.range,
    valueInputOption: appendOperation.value_input_option ?? getDefaultValueInputOption(input),
    insertDataOption: appendOperation.insert_data_option ?? "INSERT_ROWS",
    includeValuesInResponse: getIncludeValuesInResponse(input),
    ...(input.response_value_render_option ? { responseValueRenderOption: input.response_value_render_option } : {}),
    ...(input.response_date_time_render_option
      ? { responseDateTimeRenderOption: input.response_date_time_render_option }
      : {}),
    requestBody: {
      majorDimension: appendOperation.major_dimension ?? "ROWS",
      values: appendOperation.values,
    },
  }));
}

export function buildSheetsEditValuesBatchClearRequest(
  input: SheetsEditInput,
): SheetsEditValuesBatchClearRequest | null {
  if (!input.clear_ranges || input.clear_ranges.length === 0) {
    return null;
  }

  return {
    spreadsheetId: input.spreadsheet_id,
    requestBody: {
      ranges: input.clear_ranges,
    },
  };
}

export function buildSheetsEditBatchUpdateRequest(input: SheetsEditInput): SheetsEditBatchUpdateRequest | null {
  if (!input.requests || input.requests.length === 0) {
    return null;
  }

  return {
    spreadsheetId: input.spreadsheet_id,
    requestBody: {
      requests: input.requests,
      includeSpreadsheetInResponse: input.include_spreadsheet_in_response ?? false,
      ...(input.response_ranges && input.response_ranges.length > 0 ? { responseRanges: input.response_ranges } : {}),
      responseIncludeGridData: input.response_include_grid_data ?? false,
    },
  };
}

export async function sheetsEditHandler(input: SheetsEditInput) {
  if (!hasSheetsEditOperations(input)) {
    throw new Error(
      "sheets_edit requires at least one operation: value_updates, append_rows, clear_ranges, or requests.",
    );
  }

  const dryRun = input.dry_run ?? false;
  const valuesBatchUpdateRequest = buildSheetsEditValuesBatchUpdateRequest(input);
  const appendRequests = buildSheetsEditAppendRequests(input);
  const valuesBatchClearRequest = buildSheetsEditValuesBatchClearRequest(input);
  const batchUpdateRequest = buildSheetsEditBatchUpdateRequest(input);

  const plan = {
    value_updates: valuesBatchUpdateRequest?.requestBody.data.length ?? 0,
    append_rows: appendRequests.length,
    clear_ranges: valuesBatchClearRequest?.requestBody.ranges.length ?? 0,
    structural_requests: batchUpdateRequest?.requestBody.requests.length ?? 0,
  };

  if (dryRun) {
    const payload = {
      spreadsheet_id: input.spreadsheet_id,
      dry_run: true,
      planned_operations: plan,
      requests: {
        ...(valuesBatchUpdateRequest ? { values_batch_update: valuesBatchUpdateRequest } : {}),
        ...(appendRequests.length > 0 ? { append_requests: appendRequests } : {}),
        ...(valuesBatchClearRequest ? { values_batch_clear: valuesBatchClearRequest } : {}),
        ...(batchUpdateRequest ? { spreadsheets_batch_update: batchUpdateRequest } : {}),
      },
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    };
  }

  const sheets = await getSheetsClient();
  const results = {
    value_updates: null as null | {
      total_updated_rows: number;
      total_updated_columns: number;
      total_updated_cells: number;
      total_updated_sheets: number;
      responses: number;
    },
    append_rows: [] as {
      table_range: null | string;
      updated_range: null | string;
      updated_rows: number;
      updated_columns: number;
      updated_cells: number;
    }[],
    clear_ranges: null as null | {
      cleared_ranges: string[];
      cleared_range_count: number;
    },
    structural_requests: null as null | {
      replies_count: number;
    },
  };

  if (valuesBatchUpdateRequest) {
    const valuesBatchUpdateResponse = await executeSheetsRequest(
      async () => {
        const response = await sheets.spreadsheets.values.batchUpdate(valuesBatchUpdateRequest);
        return response.data;
      },
      { operationName: "spreadsheets.values.batchUpdate", lane: "write" },
    );

    results.value_updates = {
      total_updated_rows: valuesBatchUpdateResponse.totalUpdatedRows ?? 0,
      total_updated_columns: valuesBatchUpdateResponse.totalUpdatedColumns ?? 0,
      total_updated_cells: valuesBatchUpdateResponse.totalUpdatedCells ?? 0,
      total_updated_sheets: valuesBatchUpdateResponse.totalUpdatedSheets ?? 0,
      responses: valuesBatchUpdateResponse.responses?.length ?? 0,
    };
  }

  for (const appendRequest of appendRequests) {
    const appendResponse = await executeSheetsRequest(
      async () => {
        const response = await sheets.spreadsheets.values.append(appendRequest);
        return response.data;
      },
      { operationName: "spreadsheets.values.append", lane: "write" },
    );

    const updates = appendResponse.updates;
    results.append_rows.push({
      table_range: appendResponse.tableRange ?? null,
      updated_range: updates?.updatedRange ?? null,
      updated_rows: updates?.updatedRows ?? 0,
      updated_columns: updates?.updatedColumns ?? 0,
      updated_cells: updates?.updatedCells ?? 0,
    });
  }

  if (valuesBatchClearRequest) {
    const clearResponse = await executeSheetsRequest(
      async () => {
        const response = await sheets.spreadsheets.values.batchClear(valuesBatchClearRequest);
        return response.data;
      },
      { operationName: "spreadsheets.values.batchClear", lane: "write" },
    );

    const clearedRanges = clearResponse.clearedRanges ?? [];
    results.clear_ranges = {
      cleared_ranges: clearedRanges,
      cleared_range_count: clearedRanges.length,
    };
  }

  if (batchUpdateRequest) {
    const batchUpdateResponse = await executeSheetsRequest(
      async () => {
        const response = await sheets.spreadsheets.batchUpdate(batchUpdateRequest);
        return response.data;
      },
      { operationName: "spreadsheets.batchUpdate", lane: "write" },
    );

    results.structural_requests = {
      replies_count: batchUpdateResponse.replies?.length ?? 0,
    };
  }

  const payload = {
    spreadsheet_id: input.spreadsheet_id,
    dry_run: false,
    planned_operations: plan,
    results,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

export function registerSheetsEditTool(server: McpServer) {
  server.registerTool(
    sheetsEditToolDefinition.name,
    {
      title: sheetsEditToolDefinition.title,
      description: sheetsEditToolDefinition.description,
      inputSchema: sheetsEditInputSchema,
    },
    sheetsEditHandler,
  );
}
