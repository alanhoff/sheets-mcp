import type { sheets_v4 } from "@googleapis/sheets";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

const SUPPORTED_SHEETS_STYLE_REQUEST_KEYS = [
  "repeatCell",
  "updateBorders",
  "mergeCells",
  "unmergeCells",
  "updateCells",
  "updateDimensionProperties",
  "addBanding",
  "updateBanding",
  "deleteBanding",
  "addConditionalFormatRule",
  "updateConditionalFormatRule",
  "deleteConditionalFormatRule",
  "updateSheetProperties",
  "autoResizeDimensions",
] as const;

type SheetsStyleRequestKey = (typeof SUPPORTED_SHEETS_STYLE_REQUEST_KEYS)[number];

export interface SheetsStyleInput {
  spreadsheet_id: string;
  dry_run?: boolean;
  requests: sheets_v4.Schema$Request[];
  include_spreadsheet_in_response?: boolean;
  response_ranges?: string[];
  response_include_grid_data?: boolean;
}

interface SheetsStyleBatchUpdateRequest {
  spreadsheetId: string;
  requestBody: {
    requests: sheets_v4.Schema$Request[];
    includeSpreadsheetInResponse: boolean;
    responseRanges?: string[];
    responseIncludeGridData: boolean;
  };
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const result = {} as Record<string, unknown>;
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue !== undefined) {
        result[key] = stripUndefinedDeep(nestedValue);
      }
    }
    return result as T;
  }

  return value;
}

export const sheetsStyleInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet to style."),
  dry_run: z
    .boolean()
    .optional()
    .describe("When true, no mutation call is executed and the normalized batchUpdate request is returned."),
  requests: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(200)
    .describe(
      "Ordered style requests for spreadsheets.batchUpdate (repeatCell, updateBorders, conditional formats, etc).",
    ),
  include_spreadsheet_in_response: z
    .boolean()
    .optional()
    .describe("Whether to include the updated spreadsheet in the batchUpdate response."),
  response_ranges: z
    .array(z.string().min(1))
    .min(1)
    .max(100)
    .optional()
    .describe("Optional ranges to include in the response when include_spreadsheet_in_response is true."),
  response_include_grid_data: z.boolean().optional().describe("Whether response ranges should include grid data."),
};

export const sheetsStyleToolDefinition = {
  name: "sheets_style",
  title: "Apply spreadsheet style requests",
  description:
    "Apply ordered formatting/styling batchUpdate requests (text format, borders, merges, banding, freezes, and conditional formats), with dry-run support.",
} as const;

export function normalizeSheetsStyleRequests(requests: sheets_v4.Schema$Request[]) {
  return requests.map((request) => stripUndefinedDeep(request));
}

function getSheetsStyleRequestKind(request: sheets_v4.Schema$Request): null | SheetsStyleRequestKey {
  const requestObject = request as Record<string, unknown>;

  for (const key of SUPPORTED_SHEETS_STYLE_REQUEST_KEYS) {
    if (requestObject[key] !== undefined) {
      return key;
    }
  }

  return null;
}

export function extractSheetsStyleRequestKinds(requests: sheets_v4.Schema$Request[]) {
  return requests.map((request) => getSheetsStyleRequestKind(request));
}

export function validateSheetsStyleRequests(requests: sheets_v4.Schema$Request[]) {
  const kinds = extractSheetsStyleRequestKinds(requests);
  const invalidIndexes = kinds
    .map((kind, index) => ({ kind, index }))
    .filter((entry) => entry.kind === null)
    .map((entry) => entry.index);

  if (invalidIndexes.length > 0) {
    throw new Error(
      `sheets_style received unsupported request objects at indexes: ${invalidIndexes.join(", ")}. Supported request keys: ${SUPPORTED_SHEETS_STYLE_REQUEST_KEYS.join(", ")}.`,
    );
  }

  return kinds as SheetsStyleRequestKey[];
}

export function buildSheetsStyleBatchUpdateRequest(input: SheetsStyleInput): SheetsStyleBatchUpdateRequest {
  const normalizedRequests = normalizeSheetsStyleRequests(input.requests);

  return {
    spreadsheetId: input.spreadsheet_id,
    requestBody: {
      requests: normalizedRequests,
      includeSpreadsheetInResponse: input.include_spreadsheet_in_response ?? false,
      ...(input.response_ranges && input.response_ranges.length > 0 ? { responseRanges: input.response_ranges } : {}),
      responseIncludeGridData: input.response_include_grid_data ?? false,
    },
  };
}

function countRequestKinds(kinds: SheetsStyleRequestKey[]) {
  const counts: Partial<Record<SheetsStyleRequestKey, number>> = {};
  for (const kind of kinds) {
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

export async function sheetsStyleHandler(input: SheetsStyleInput) {
  const requestKinds = validateSheetsStyleRequests(input.requests);
  const batchUpdateRequest = buildSheetsStyleBatchUpdateRequest(input);
  const dryRun = input.dry_run ?? false;

  const planned = {
    request_count: batchUpdateRequest.requestBody.requests.length,
    request_kinds: requestKinds,
    request_kind_counts: countRequestKinds(requestKinds),
  };

  if (dryRun) {
    const payload = {
      spreadsheet_id: input.spreadsheet_id,
      dry_run: true,
      planned_operations: planned,
      request: batchUpdateRequest,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    };
  }

  const sheets = await getSheetsClient();
  const responseData = await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.batchUpdate(batchUpdateRequest);
      return response.data;
    },
    { operationName: "spreadsheets.batchUpdate", lane: "write" },
  );

  const payload = {
    spreadsheet_id: input.spreadsheet_id,
    dry_run: false,
    planned_operations: planned,
    results: {
      replies_count: responseData.replies?.length ?? 0,
    },
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

export function registerSheetsStyleTool(server: McpServer) {
  server.registerTool(
    sheetsStyleToolDefinition.name,
    {
      title: sheetsStyleToolDefinition.title,
      description: sheetsStyleToolDefinition.description,
      inputSchema: sheetsStyleInputSchema,
    },
    sheetsStyleHandler,
  );
}
