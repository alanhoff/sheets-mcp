import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSheetsFormulaDebugPlan,
  buildSheetsFormulaDebugResults,
  buildSheetsFormulaDebugWriteRequest,
  classifySpreadsheetFormulaError,
  parseSpreadsheetFormulaCandidates,
  sheetsFormulaDebugToolDefinition,
} from "#tools/sheets-formula-debug.ts";

describe("sheets_formula_debug tool", () => {
  it("builds a single-formula plan with normalized formula text", () => {
    const plan = buildSheetsFormulaDebugPlan({
      spreadsheet_id: "sheet-123",
      target_cell: "Sheet1!B2",
      formula: "SUM(A1:A3)",
    });

    assert.deepEqual(plan, {
      formulas: ["=SUM(A1:A3)"],
      evaluation_range: "Sheet1!B2",
      target_cells: ["Sheet1!B2"],
    });
  });

  it("builds a multi-formula plan from the target start cell", () => {
    const plan = buildSheetsFormulaDebugPlan({
      spreadsheet_id: "sheet-123",
      target_cell: "'Data Sheet'!C5",
      formulas: ["=1+1", "A1*2", " IF(TRUE, 1, 0) "],
    });

    assert.deepEqual(plan, {
      formulas: ["=1+1", "=A1*2", "=IF(TRUE, 1, 0)"],
      evaluation_range: "'Data Sheet'!C5:C7",
      target_cells: ["'Data Sheet'!C5", "'Data Sheet'!C6", "'Data Sheet'!C7"],
    });
  });

  it("includes context values and formula range in one write request", () => {
    const request = buildSheetsFormulaDebugWriteRequest({
      spreadsheet_id: "sheet-123",
      target_cell: "Sheet1!D10",
      formulas: ["A1+A2", "A3+A4"],
      context_values: [
        {
          range: "Sheet1!A1:A4",
          values: [[1], [2], [3], [4]],
        },
      ],
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      requestBody: {
        data: [
          {
            range: "Sheet1!A1:A4",
            majorDimension: "ROWS",
            values: [[1], [2], [3], [4]],
          },
          {
            range: "Sheet1!D10:D11",
            majorDimension: "ROWS",
            values: [["=A1+A2"], ["=A3+A4"]],
          },
        ],
        valueInputOption: "USER_ENTERED",
        includeValuesInResponse: false,
      },
    });
  });

  it("enforces exactly one of formula or formulas", () => {
    assert.throws(
      () =>
        parseSpreadsheetFormulaCandidates({
          spreadsheet_id: "sheet-123",
          target_cell: "Sheet1!A1",
        }),
      /exactly one of formula or formulas/i,
    );

    assert.throws(
      () =>
        parseSpreadsheetFormulaCandidates({
          spreadsheet_id: "sheet-123",
          target_cell: "Sheet1!A1",
          formula: "=A1",
          formulas: ["=A2"],
        }),
      /exactly one of formula or formulas/i,
    );
  });

  it("requires cleanup=true when cleanup_context_ranges=true", () => {
    assert.throws(
      () =>
        buildSheetsFormulaDebugPlan({
          spreadsheet_id: "sheet-123",
          target_cell: "Sheet1!A1",
          formula: "=A1",
          cleanup_context_ranges: true,
        }),
      /cleanup_context_ranges can only be true when cleanup is true/i,
    );
  });

  it("classifies Sheets formula errors for debugging output", () => {
    assert.equal(classifySpreadsheetFormulaError("ERROR"), "PARSE_ERROR");
    assert.equal(classifySpreadsheetFormulaError("REF"), "EVALUATION_ERROR");
    assert.equal(classifySpreadsheetFormulaError(null), null);
  });

  it("builds per-formula debug results from returned grid rows", () => {
    const results = buildSheetsFormulaDebugResults(
      {
        spreadsheet_id: "sheet-123",
        target_cell: "Sheet1!A1",
        formulas: ["=1+1", "=A1/0"],
      },
      [
        {
          values: [
            {
              userEnteredValue: { formulaValue: "=1+1" },
              effectiveValue: { numberValue: 2 },
              formattedValue: "2",
            },
          ],
        },
        {
          values: [
            {
              userEnteredValue: { formulaValue: "=A1/0" },
              effectiveValue: {
                errorValue: {
                  type: "DIVIDE_BY_ZERO",
                  message: "Division by zero.",
                },
              },
              formattedValue: "#DIV/0!",
            },
          ],
        },
      ],
    );

    assert.equal(results.length, 2);
    assert.equal(results[0].valid, true);
    assert.equal(results[0].computed_value_raw, 2);
    assert.equal(results[1].valid, false);
    assert.equal(results[1].error_type, "DIVIDE_BY_ZERO");
    assert.equal(results[1].error_classification, "EVALUATION_ERROR");
  });

  it("exposes the canonical tool name", () => {
    assert.equal(sheetsFormulaDebugToolDefinition.name, "sheets_formula_debug");
  });
});
