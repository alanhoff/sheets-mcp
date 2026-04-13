import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import {
  analyzeValueRanges,
  type SpreadsheetAnalysisDuplicateExample,
  type SpreadsheetAnalysisRangeInput,
} from "#services/analysis-engine.ts";
import { executeSheetsRequest, getSheetsClient } from "#services/google-client.ts";

export type SheetsAnalyzeValueRenderOption = "UNFORMATTED_VALUE" | "FORMULA";

export interface SheetsAnalyzeInput {
  spreadsheet_id: string;
  ranges: string[];
  has_header_row?: boolean;
  duplicate_key_columns?: number[];
  include_formula_map?: boolean;
  sample_size?: number;
  outlier_zscore_threshold?: number;
}

interface SheetsAnalyzeValuesRequest {
  spreadsheetId: string;
  ranges: string[];
  majorDimension: "ROWS";
  valueRenderOption: SheetsAnalyzeValueRenderOption;
  dateTimeRenderOption: "SERIAL_NUMBER";
}

interface SheetsAnalyzeFormulaCell {
  row_index: number;
  column_index: number;
  formula: string;
}

interface SheetsAnalyzeFormulaRange {
  range: string;
  formula_cell_count: number;
  sample_formulas: SheetsAnalyzeFormulaCell[];
}

export const sheetsAnalyzeInputSchema = {
  spreadsheet_id: z.string().min(1).describe("The ID of the spreadsheet to analyze."),
  ranges: z
    .array(z.string().min(1))
    .min(1)
    .max(100)
    .describe("One or more A1 ranges to profile in a single batch read."),
  has_header_row: z
    .boolean()
    .optional()
    .describe("Whether the first row in each range should be treated as a header row."),
  duplicate_key_columns: z
    .array(z.int().min(0))
    .min(1)
    .max(20)
    .optional()
    .describe("Optional 0-based column indexes used to detect duplicate row keys."),
  include_formula_map: z
    .boolean()
    .optional()
    .describe("Whether to collect a formula map by issuing a second batch read in FORMULA mode."),
  sample_size: z
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of sample values/examples to include in analysis output."),
  outlier_zscore_threshold: z
    .number()
    .gt(0)
    .max(10)
    .optional()
    .describe("Z-score threshold used to flag numeric outlier hints."),
};

export const sheetsAnalyzeToolDefinition = {
  name: "sheets_analyze",
  title: "Analyze spreadsheet ranges",
  description:
    "Profile selected ranges with null ratios, type inference, duplicate-key detection, outlier hints, and optional formula mapping.",
} as const;

export function buildSheetsAnalyzeValuesRequest(
  input: SheetsAnalyzeInput,
  valueRenderOption: SheetsAnalyzeValueRenderOption = "UNFORMATTED_VALUE",
): SheetsAnalyzeValuesRequest {
  return {
    spreadsheetId: input.spreadsheet_id,
    ranges: input.ranges,
    majorDimension: "ROWS",
    valueRenderOption,
    dateTimeRenderOption: "SERIAL_NUMBER",
  };
}

export function buildFormulaMap(
  valueRanges: { range?: null | string; values?: null | unknown[][] }[],
  sampleSize: number,
) {
  const formulaRanges: SheetsAnalyzeFormulaRange[] = [];
  let totalFormulaCellCount = 0;

  for (const valueRange of valueRanges) {
    const formulas: SheetsAnalyzeFormulaCell[] = [];
    const rows = valueRange.values ?? [];

    for (const [rowIndex, row] of rows.entries()) {
      for (const [columnIndex, value] of row.entries()) {
        if (typeof value === "string" && value.startsWith("=")) {
          formulas.push({
            row_index: rowIndex,
            column_index: columnIndex,
            formula: value,
          });
        }
      }
    }

    totalFormulaCellCount += formulas.length;
    formulaRanges.push({
      range: valueRange.range ?? "",
      formula_cell_count: formulas.length,
      sample_formulas: formulas.slice(0, sampleSize),
    });
  }

  return {
    total_formula_cell_count: totalFormulaCellCount,
    ranges: formulaRanges,
  };
}

function buildDuplicateKeyExamples(examples: SpreadsheetAnalysisDuplicateExample[]) {
  return examples.map((example) => ({
    key: example.key,
    occurrences: example.occurrences,
  }));
}

export async function sheetsAnalyzeHandler(input: SheetsAnalyzeInput) {
  const sheets = await getSheetsClient();
  const hasHeaderRow = input.has_header_row ?? true;
  const sampleSize = input.sample_size ?? 5;
  const includeFormulaMap = input.include_formula_map ?? false;
  const outlierThreshold = input.outlier_zscore_threshold ?? 3;

  const valuesRequest = buildSheetsAnalyzeValuesRequest(input, "UNFORMATTED_VALUE");
  const valuesData = await executeSheetsRequest(
    async () => {
      const response = await sheets.spreadsheets.values.batchGet(valuesRequest);
      return response.data;
    },
    { operationName: "spreadsheets.values.batchGet" },
  );

  const rangesForAnalysis: SpreadsheetAnalysisRangeInput[] = (valuesData.valueRanges ?? []).map((valueRange) => ({
    range: valueRange.range ?? "",
    values: valueRange.values ?? [],
  }));

  const analysis = analyzeValueRanges(rangesForAnalysis, {
    hasHeaderRow,
    duplicateKeyColumns: input.duplicate_key_columns,
    sampleSize,
    outlierZScoreThreshold: outlierThreshold,
  });

  const normalizedRanges = analysis.ranges.map((range) => ({
    range: range.range,
    row_count: range.row_count,
    column_count: range.column_count,
    warnings: range.warnings,
    columns: range.columns,
    duplicate_summary: range.duplicate_summary
      ? {
          key_columns: range.duplicate_summary.key_columns,
          duplicate_key_count: range.duplicate_summary.duplicate_key_count,
          duplicate_row_count: range.duplicate_summary.duplicate_row_count,
          examples: buildDuplicateKeyExamples(range.duplicate_summary.examples),
        }
      : null,
  }));

  let formulaMap: undefined | ReturnType<typeof buildFormulaMap>;
  if (includeFormulaMap) {
    const formulaRequest = buildSheetsAnalyzeValuesRequest(input, "FORMULA");
    const formulaData = await executeSheetsRequest(
      async () => {
        const response = await sheets.spreadsheets.values.batchGet(formulaRequest);
        return response.data;
      },
      { operationName: "spreadsheets.values.batchGet" },
    );

    formulaMap = buildFormulaMap(formulaData.valueRanges ?? [], sampleSize);
  }

  const payload = {
    spreadsheet_id: valuesData.spreadsheetId ?? input.spreadsheet_id,
    requested_ranges: input.ranges.length,
    returned_ranges: rangesForAnalysis.length,
    options: {
      has_header_row: hasHeaderRow,
      duplicate_key_columns: input.duplicate_key_columns ?? [],
      include_formula_map: includeFormulaMap,
      sample_size: sampleSize,
      outlier_zscore_threshold: outlierThreshold,
    },
    summary: analysis.summary,
    ranges: normalizedRanges,
    ...(formulaMap ? { formula_map: formulaMap } : {}),
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

export function registerSheetsAnalyzeTool(server: McpServer) {
  server.registerTool(
    sheetsAnalyzeToolDefinition.name,
    {
      title: sheetsAnalyzeToolDefinition.title,
      description: sheetsAnalyzeToolDefinition.description,
      inputSchema: sheetsAnalyzeInputSchema,
    },
    sheetsAnalyzeHandler,
  );
}
