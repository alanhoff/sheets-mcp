import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod/v4";
import {
  buildFormulaMap,
  buildSheetsAnalyzeValuesRequest,
  sheetsAnalyzeInputSchema,
  sheetsAnalyzeToolDefinition,
} from "#tools/sheets-analyze.ts";

describe("sheets_analyze tool", () => {
  it("requires at least one range", () => {
    const schema = z.object(sheetsAnalyzeInputSchema);
    const parsed = schema.safeParse({
      spreadsheet_id: "sheet-123",
      ranges: [],
    });

    assert.equal(parsed.success, false);
  });

  it("validates duplicate key columns as non-negative integers", () => {
    const schema = z.object(sheetsAnalyzeInputSchema);
    const parsed = schema.safeParse({
      spreadsheet_id: "sheet-123",
      ranges: ["Sheet1!A1:C10"],
      duplicate_key_columns: [-1],
    });

    assert.equal(parsed.success, false);
  });

  it("maps analyze request parameters to google api batchGet format", () => {
    const request = buildSheetsAnalyzeValuesRequest(
      {
        spreadsheet_id: "sheet-123",
        ranges: ["Sheet1!A1:C10", "Sheet1!E1:G10"],
      },
      "FORMULA",
    );

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      ranges: ["Sheet1!A1:C10", "Sheet1!E1:G10"],
      majorDimension: "ROWS",
      valueRenderOption: "FORMULA",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
  });

  it("builds a compact formula map with sampled formula cells", () => {
    const formulaMap = buildFormulaMap(
      [
        {
          range: "Sheet1!A1:B2",
          values: [
            ["=SUM(A3:A5)", 10],
            ["text", "=A1*2"],
          ],
        },
      ],
      1,
    );

    assert.equal(formulaMap.total_formula_cell_count, 2);
    assert.equal(formulaMap.ranges[0].formula_cell_count, 2);
    assert.equal(formulaMap.ranges[0].sample_formulas.length, 1);
    assert.equal(formulaMap.ranges[0].sample_formulas[0].formula, "=SUM(A3:A5)");
  });

  it("exposes the canonical tool name", () => {
    assert.equal(sheetsAnalyzeToolDefinition.name, "sheets_analyze");
  });
});
