export type SpreadsheetInferredType = "number" | "boolean" | "string" | "mixed" | "unknown";

export interface SpreadsheetAnalysisRangeInput {
  range: string;
  values: unknown[][];
}

export interface SpreadsheetAnalysisOptions {
  hasHeaderRow?: boolean;
  duplicateKeyColumns?: number[];
  sampleSize?: number;
  outlierZScoreThreshold?: number;
}

export interface SpreadsheetOutlierHints {
  count: number;
  threshold: number;
  min: number;
  max: number;
  sample_values: number[];
}

export interface SpreadsheetAnalysisColumn {
  index: number;
  header: null | string;
  inferred_type: SpreadsheetInferredType;
  non_null_count: number;
  null_count: number;
  null_ratio: number;
  distinct_count: number;
  sample_values: unknown[];
  outlier_hints: null | SpreadsheetOutlierHints;
}

export interface SpreadsheetAnalysisDuplicateExample {
  key: string;
  occurrences: number;
}

export interface SpreadsheetAnalysisDuplicateSummary {
  key_columns: number[];
  duplicate_key_count: number;
  duplicate_row_count: number;
  examples: SpreadsheetAnalysisDuplicateExample[];
}

export interface SpreadsheetAnalysisRangeResult {
  range: string;
  row_count: number;
  column_count: number;
  columns: SpreadsheetAnalysisColumn[];
  duplicate_summary: null | SpreadsheetAnalysisDuplicateSummary;
  warnings: string[];
}

export interface SpreadsheetAnalysisSummary {
  range_count: number;
  row_count: number;
  column_count: number;
  duplicate_row_count: number;
  warning_count: number;
}

export interface SpreadsheetAnalysisResult {
  summary: SpreadsheetAnalysisSummary;
  ranges: SpreadsheetAnalysisRangeResult[];
}

const DEFAULT_SAMPLE_SIZE = 5;
const DEFAULT_OUTLIER_ZSCORE_THRESHOLD = 3;

function isNullishCell(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return false;
}

function toDistinctKey(value: unknown): string {
  if (isNullishCell(value)) {
    return "nullish";
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? "number:NaN" : `number:${value}`;
  }
  if (typeof value === "boolean") {
    return `boolean:${value}`;
  }
  if (typeof value === "string") {
    return `string:${value}`;
  }

  try {
    return `json:${JSON.stringify(value)}`;
  } catch {
    return `string:${String(value)}`;
  }
}

function inferType(values: unknown[]): SpreadsheetInferredType {
  const types = new Set<SpreadsheetInferredType>();

  for (const value of values) {
    if (isNullishCell(value)) {
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      types.add("number");
      continue;
    }
    if (typeof value === "boolean") {
      types.add("boolean");
      continue;
    }

    types.add("string");
  }

  if (types.size === 0) {
    return "unknown";
  }
  if (types.size === 1) {
    return [...types][0];
  }
  return "mixed";
}

function round(value: number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function buildOutlierHints(values: unknown[], threshold: number, sampleSize: number): null | SpreadsheetOutlierHints {
  const numericValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numericValues.length < 2) {
    return null;
  }

  const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  const variance = numericValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numericValues.length;
  const standardDeviation = Math.sqrt(variance);

  const outliers =
    standardDeviation > 0
      ? numericValues.filter((value) => Math.abs((value - mean) / standardDeviation) >= threshold)
      : [];

  return {
    count: outliers.length,
    threshold,
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
    sample_values: outliers.slice(0, sampleSize),
  };
}

function buildDuplicateSummary(
  rows: unknown[][],
  duplicateKeyColumns: number[] | undefined,
  sampleSize: number,
): null | SpreadsheetAnalysisDuplicateSummary {
  if (!duplicateKeyColumns || duplicateKeyColumns.length === 0) {
    return null;
  }

  const keyCounts = new Map<string, number>();

  for (const row of rows) {
    const keyParts = duplicateKeyColumns.map((columnIndex) => row[columnIndex]);

    if (keyParts.every((value) => isNullishCell(value))) {
      continue;
    }

    const key = keyParts.map(toDistinctKey).join("|");
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const duplicateEntries = [...keyCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1]);

  const duplicateRowCount = duplicateEntries.reduce((sum, [, count]) => sum + (count - 1), 0);

  return {
    key_columns: duplicateKeyColumns,
    duplicate_key_count: duplicateEntries.length,
    duplicate_row_count: duplicateRowCount,
    examples: duplicateEntries.slice(0, sampleSize).map(([key, occurrences]) => ({ key, occurrences })),
  };
}

function getColumnCount(rows: unknown[][]) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

export function analyzeValueRanges(
  ranges: SpreadsheetAnalysisRangeInput[],
  options: SpreadsheetAnalysisOptions = {},
): SpreadsheetAnalysisResult {
  const hasHeaderRow = options.hasHeaderRow ?? true;
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const outlierThreshold = options.outlierZScoreThreshold ?? DEFAULT_OUTLIER_ZSCORE_THRESHOLD;

  const rangeResults = ranges.map((rangeInput) => {
    const rawRows = rangeInput.values ?? [];
    const headerRow = hasHeaderRow && rawRows.length > 0 ? rawRows[0] : [];
    const dataRows = hasHeaderRow && rawRows.length > 0 ? rawRows.slice(1) : rawRows;
    const columnCount = getColumnCount(rawRows);
    const warnings: string[] = [];

    if (rawRows.length === 0) {
      warnings.push("No rows returned for the selected range.");
    } else if (dataRows.length === 0) {
      warnings.push("No data rows available after excluding the header row.");
    }

    const rowLengths = dataRows.map((row) => row.length);
    if (new Set(rowLengths).size > 1) {
      warnings.push("Rows have inconsistent column counts.");
    }

    const columns: SpreadsheetAnalysisColumn[] = Array.from({ length: columnCount }, (_, columnIndex) => {
      const columnValues = dataRows.map((row) => row[columnIndex]);
      const nonNullValues = columnValues.filter((value) => !isNullishCell(value));
      const distinctCount = new Set(nonNullValues.map(toDistinctKey)).size;
      const nullCount = columnValues.length - nonNullValues.length;

      return {
        index: columnIndex,
        header: typeof headerRow[columnIndex] === "string" ? headerRow[columnIndex] : null,
        inferred_type: inferType(columnValues),
        non_null_count: nonNullValues.length,
        null_count: nullCount,
        null_ratio: columnValues.length > 0 ? round(nullCount / columnValues.length) : 0,
        distinct_count: distinctCount,
        sample_values: nonNullValues.slice(0, sampleSize),
        outlier_hints: buildOutlierHints(columnValues, outlierThreshold, sampleSize),
      };
    });

    const duplicateSummary = buildDuplicateSummary(dataRows, options.duplicateKeyColumns, sampleSize);
    if (duplicateSummary && duplicateSummary.duplicate_row_count > 0) {
      warnings.push("Duplicate keys detected for one or more configured key columns.");
    }

    return {
      range: rangeInput.range,
      row_count: dataRows.length,
      column_count: columnCount,
      columns,
      duplicate_summary: duplicateSummary,
      warnings,
    };
  });

  const summary: SpreadsheetAnalysisSummary = {
    range_count: rangeResults.length,
    row_count: rangeResults.reduce((sum, range) => sum + range.row_count, 0),
    column_count: rangeResults.reduce((sum, range) => sum + range.column_count, 0),
    duplicate_row_count: rangeResults.reduce(
      (sum, range) => sum + (range.duplicate_summary?.duplicate_row_count ?? 0),
      0,
    ),
    warning_count: rangeResults.reduce((sum, range) => sum + range.warnings.length, 0),
  };

  return {
    summary,
    ranges: rangeResults,
  };
}
