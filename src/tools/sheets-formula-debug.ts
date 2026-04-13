import type { sheets_v4 } from "@googleapis/sheets";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

export interface SheetsFormulaDebugContextValue {
  range: string;
  values: unknown[][];
  major_dimension?: "ROWS" | "COLUMNS";
}

export interface SheetsFormulaDebugInput {
  spreadsheet_id: string;
  target_cell: string;
  formula?: string;
  formulas?: string[];
  context_values?: SheetsFormulaDebugContextValue[];
  cleanup?: boolean;
  cleanup_context_ranges?: boolean;
}

interface SheetsFormulaDebugParsedCell {
  sheet_name: string;
  column_index: number;
  row_number: number;
}

interface SheetsFormulaDebugPlan {
  formulas: string[];
  evaluation_range: string;
  target_cells: string[];
}

interface SheetsFormulaDebugResult {
  index: number;
  target_cell: string;
  input_formula: string;
  normalized_formula: string;
  stored_formula: null | string;
  valid: boolean;
  error_type: null | string;
  error_message: null | string;
  error_classification: null | "PARSE_ERROR" | "EVALUATION_ERROR";
  formatted_value: null | string;
  computed_value_raw: null | number | string | boolean;
  effective_value: null | sheets_v4.Schema$ExtendedValue;
}

export const DEFAULT_SHEETS_FORMULA_DEBUG_READ_FIELDS = [
  "spreadsheetId",
  "sheets.data.rowData.values.userEnteredValue",
  "sheets.data.rowData.values.effectiveValue",
  "sheets.data.rowData.values.formattedValue",
].join(",");

export const sheetsFormulaDebugInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet used for formula validation/debugging."),
  target_cell: z
    .string()
    .min(1)
    .describe("A1 single-cell reference used as the first formula evaluation cell (for example: 'Sheet1!B2')."),
  formula: z
    .string()
    .min(1)
    .optional()
    .describe("Single formula candidate to validate/debug. Either formula or formulas is required."),
  formulas: z
    .array(z.string().min(1))
    .min(1)
    .max(100)
    .optional()
    .describe("Optional list of formula candidates for batch validation/debugging in one call."),
  context_values: z
    .array(
      z.object({
        range: z.string().min(1),
        values: z.array(z.array(z.unknown())),
        major_dimension: z.enum(["ROWS", "COLUMNS"]).optional(),
      }),
    )
    .min(1)
    .max(100)
    .optional()
    .describe("Optional supporting values written before formula evaluation (for referenced cells/ranges)."),
  cleanup: z.boolean().optional().describe("When true, clear formula evaluation cells after results are collected."),
  cleanup_context_ranges: z
    .boolean()
    .optional()
    .describe("When true with cleanup=true, context_values ranges are also cleared."),
};

export const sheetsFormulaDebugToolDefinition = {
  name: "sheets_formula_debug",
  title: "Validate and debug spreadsheet formulas",
  description:
    "Validate/debug one or many formulas by writing with USER_ENTERED, reading effective/error values, and optionally cleaning up evaluation cells.",
} as const;

function normalizeFormula(input: string) {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Formula candidates cannot be empty.");
  }

  return trimmed.startsWith("=") ? trimmed : `=${trimmed}`;
}

export function parseSpreadsheetFormulaCandidates(input: SheetsFormulaDebugInput) {
  const hasFormula = typeof input.formula === "string";
  const hasFormulas = Array.isArray(input.formulas);

  if (hasFormula === hasFormulas) {
    throw new Error("Provide exactly one of formula or formulas.");
  }

  const rawCandidates = hasFormula ? [input.formula as string] : (input.formulas as string[]);

  return rawCandidates.map((candidate) => ({
    input_formula: candidate,
    normalized_formula: normalizeFormula(candidate),
  }));
}

function parseSheetName(sheetToken: string) {
  if (sheetToken.length === 0) {
    throw new Error("target_cell must include a sheet name.");
  }

  if (sheetToken.startsWith("'") && sheetToken.endsWith("'")) {
    const body = sheetToken.slice(1, -1).replace(/''/g, "'");
    if (body.length === 0) {
      throw new Error("Sheet name in target_cell cannot be empty.");
    }
    return body;
  }

  return sheetToken;
}

function columnLabelToIndex(label: string) {
  let total = 0;
  for (const char of label.toUpperCase()) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) {
      throw new Error(`Invalid column label in target_cell: ${label}`);
    }
    total = total * 26 + (code - 64);
  }
  return total - 1;
}

function columnIndexToLabel(columnIndex: number) {
  let value = columnIndex + 1;
  let label = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function toA1SheetToken(sheetName: string) {
  if (/^[A-Za-z0-9_]+$/.test(sheetName)) {
    return sheetName;
  }

  return `'${sheetName.replace(/'/g, "''")}'`;
}

function toA1CellReference(sheetName: string, columnIndex: number, rowNumber: number) {
  const sheetToken = toA1SheetToken(sheetName);
  return `${sheetToken}!${columnIndexToLabel(columnIndex)}${rowNumber}`;
}

function toA1ColumnRange(sheetName: string, columnIndex: number, startRowNumber: number, endRowNumber: number) {
  const sheetToken = toA1SheetToken(sheetName);
  const columnLabel = columnIndexToLabel(columnIndex);

  if (startRowNumber === endRowNumber) {
    return `${sheetToken}!${columnLabel}${startRowNumber}`;
  }

  return `${sheetToken}!${columnLabel}${startRowNumber}:${columnLabel}${endRowNumber}`;
}

export function parseSheetsFormulaDebugTargetCell(targetCell: string): SheetsFormulaDebugParsedCell {
  const splitIndex = targetCell.lastIndexOf("!");
  if (splitIndex <= 0 || splitIndex >= targetCell.length - 1) {
    throw new Error("target_cell must be a valid A1 single-cell reference with sheet name (for example: Sheet1!A1).");
  }

  const sheetToken = targetCell.slice(0, splitIndex);
  const cellToken = targetCell.slice(splitIndex + 1);
  const cellMatch = cellToken.match(/^\$?([A-Za-z]+)\$?([1-9][0-9]*)$/);

  if (!cellMatch) {
    throw new Error("target_cell must point to a single cell (for example: Sheet1!B2).");
  }

  return {
    sheet_name: parseSheetName(sheetToken),
    column_index: columnLabelToIndex(cellMatch[1]),
    row_number: Number.parseInt(cellMatch[2], 10),
  };
}

export function buildSheetsFormulaDebugPlan(input: SheetsFormulaDebugInput): SheetsFormulaDebugPlan {
  if ((input.cleanup ?? false) === false && (input.cleanup_context_ranges ?? false)) {
    throw new Error("cleanup_context_ranges can only be true when cleanup is true.");
  }

  const parsedCell = parseSheetsFormulaDebugTargetCell(input.target_cell);
  const formulaCandidates = parseSpreadsheetFormulaCandidates(input);
  const formulaCount = formulaCandidates.length;
  const endRowNumber = parsedCell.row_number + formulaCount - 1;

  return {
    formulas: formulaCandidates.map((candidate) => candidate.normalized_formula),
    evaluation_range: toA1ColumnRange(
      parsedCell.sheet_name,
      parsedCell.column_index,
      parsedCell.row_number,
      endRowNumber,
    ),
    target_cells: formulaCandidates.map((_, index) =>
      toA1CellReference(parsedCell.sheet_name, parsedCell.column_index, parsedCell.row_number + index),
    ),
  };
}

export function classifySpreadsheetFormulaError(errorType: null | string) {
  if (!errorType) {
    return null;
  }

  return errorType === "ERROR" ? "PARSE_ERROR" : "EVALUATION_ERROR";
}

function extractEffectiveValueRaw(
  effectiveValue: null | sheets_v4.Schema$ExtendedValue | undefined,
): null | number | string | boolean {
  if (!effectiveValue) {
    return null;
  }

  if (typeof effectiveValue.numberValue === "number") {
    return effectiveValue.numberValue;
  }
  if (typeof effectiveValue.stringValue === "string") {
    return effectiveValue.stringValue;
  }
  if (typeof effectiveValue.boolValue === "boolean") {
    return effectiveValue.boolValue;
  }

  return null;
}

export function buildSheetsFormulaDebugWriteRequest(input: SheetsFormulaDebugInput) {
  const plan = buildSheetsFormulaDebugPlan(input);

  return {
    spreadsheetId: input.spreadsheet_id,
    requestBody: {
      data: [
        ...(input.context_values ?? []).map((contextValue) => ({
          range: contextValue.range,
          majorDimension: contextValue.major_dimension ?? "ROWS",
          values: contextValue.values,
        })),
        {
          range: plan.evaluation_range,
          majorDimension: "ROWS" as const,
          values: plan.formulas.map((formula) => [formula]),
        },
      ],
      valueInputOption: "USER_ENTERED" as const,
      includeValuesInResponse: false,
    },
  };
}

export function buildSheetsFormulaDebugReadRequest(input: SheetsFormulaDebugInput) {
  const plan = buildSheetsFormulaDebugPlan(input);

  return {
    spreadsheetId: input.spreadsheet_id,
    ranges: [plan.evaluation_range],
    includeGridData: true as const,
    fields: DEFAULT_SHEETS_FORMULA_DEBUG_READ_FIELDS,
  };
}

export function buildSheetsFormulaDebugResults(
  input: SheetsFormulaDebugInput,
  gridRows: (null | sheets_v4.Schema$RowData)[],
): SheetsFormulaDebugResult[] {
  const plan = buildSheetsFormulaDebugPlan(input);
  const formulaCandidates = parseSpreadsheetFormulaCandidates(input);

  return formulaCandidates.map((candidate, index) => {
    const cell = gridRows[index]?.values?.[0];
    const effectiveValue = cell?.effectiveValue ?? null;
    const errorType = effectiveValue?.errorValue?.type ?? null;
    const errorMessage = effectiveValue?.errorValue?.message ?? null;

    return {
      index,
      target_cell: plan.target_cells[index],
      input_formula: candidate.input_formula,
      normalized_formula: candidate.normalized_formula,
      stored_formula: cell?.userEnteredValue?.formulaValue ?? null,
      valid: !errorType,
      error_type: errorType,
      error_message: errorMessage,
      error_classification: classifySpreadsheetFormulaError(errorType),
      formatted_value: cell?.formattedValue ?? null,
      computed_value_raw: extractEffectiveValueRaw(effectiveValue),
      effective_value: effectiveValue,
    };
  });
}

function summarizeResults(results: SheetsFormulaDebugResult[]) {
  const invalidResults = results.filter((result) => !result.valid);

  return {
    total: results.length,
    valid: results.length - invalidResults.length,
    invalid: invalidResults.length,
    parse_errors: invalidResults.filter((result) => result.error_classification === "PARSE_ERROR").length,
    evaluation_errors: invalidResults.filter((result) => result.error_classification === "EVALUATION_ERROR").length,
  };
}

export async function sheetsFormulaDebugHandler(input: SheetsFormulaDebugInput) {
  const sheets = await getSheetsClient();
  const plan = buildSheetsFormulaDebugPlan(input);
  const writeRequest = buildSheetsFormulaDebugWriteRequest(input);
  const readRequest = buildSheetsFormulaDebugReadRequest(input);
  const cleanupRequested = input.cleanup ?? false;
  const cleanupContextRanges = input.cleanup_context_ranges ?? false;

  await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.values.batchUpdate(writeRequest);
      return response.data;
    },
    { operationName: "spreadsheets.values.batchUpdate", lane: "write" },
  );

  const readData = await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.get(readRequest);
      return response.data;
    },
    { operationName: "spreadsheets.get" },
  );

  const gridRows = readData.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const results = buildSheetsFormulaDebugResults(input, gridRows);

  let cleanupResult: {
    requested: boolean;
    context_ranges_included: boolean;
    cleared_range_count: number;
    cleared_ranges: string[];
    error: null | string;
  } = {
    requested: cleanupRequested,
    context_ranges_included: cleanupRequested && cleanupContextRanges,
    cleared_range_count: 0,
    cleared_ranges: [],
    error: null,
  };

  if (cleanupRequested) {
    const clearRanges = [
      plan.evaluation_range,
      ...(cleanupContextRanges ? (input.context_values ?? []).map((contextValue) => contextValue.range) : []),
    ];
    const dedupedClearRanges = [...new Set(clearRanges)];

    try {
      const clearData = await executeSheetsRequest(
        async () => {
          const response = await sheets.spreadsheets.values.batchClear({
            spreadsheetId: input.spreadsheet_id,
            requestBody: {
              ranges: dedupedClearRanges,
            },
          });

          return response.data;
        },
        { operationName: "spreadsheets.values.batchClear", lane: "write" },
      );

      const clearedRanges = clearData.clearedRanges ?? [];
      cleanupResult = {
        ...cleanupResult,
        cleared_range_count: clearedRanges.length,
        cleared_ranges: clearedRanges,
      };
    } catch (error) {
      cleanupResult = {
        ...cleanupResult,
        error: error instanceof Error ? error.message : "Unknown cleanup error",
      };
    }
  }

  const payload = {
    spreadsheet_id: input.spreadsheet_id,
    target_cell: input.target_cell,
    evaluation_range: plan.evaluation_range,
    formula_count: results.length,
    context_ranges_written: input.context_values?.length ?? 0,
    summary: summarizeResults(results),
    cleanup: cleanupResult,
    results,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

export function registerSheetsFormulaDebugTool(server: McpServer) {
  server.registerTool(
    sheetsFormulaDebugToolDefinition.name,
    {
      title: sheetsFormulaDebugToolDefinition.title,
      description: sheetsFormulaDebugToolDefinition.description,
      inputSchema: sheetsFormulaDebugInputSchema,
    },
    sheetsFormulaDebugHandler,
  );
}
