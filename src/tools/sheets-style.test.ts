import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { sheets_v4 } from "@googleapis/sheets";
import { z } from "zod/v4";
import {
  buildSheetsStyleBatchUpdateRequest,
  extractSheetsStyleRequestKinds,
  normalizeSheetsStyleRequests,
  sheetsStyleInputSchema,
  sheetsStyleToolDefinition,
  validateSheetsStyleRequests,
} from "#tools/sheets-style.ts";

describe("sheets_style tool", () => {
  it("requires at least one style request", () => {
    const schema = z.object(sheetsStyleInputSchema);
    const parsed = schema.safeParse({
      spreadsheet_id: "sheet-123",
      requests: [],
    });

    assert.equal(parsed.success, false);
  });

  it("normalizes requests by stripping undefined fields", () => {
    const requests = normalizeSheetsStyleRequests([
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: undefined,
          },
          fields: "userEnteredFormat.textFormat.bold",
        },
      },
    ]);

    assert.deepEqual(requests, [
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
          },
          fields: "userEnteredFormat.textFormat.bold",
        },
      },
    ]);
  });

  it("extracts request kinds in order and validates supported keys", () => {
    const requests = [{ repeatCell: {} }, { updateBorders: {} }, { addConditionalFormatRule: {} }];

    assert.deepEqual(extractSheetsStyleRequestKinds(requests), [
      "repeatCell",
      "updateBorders",
      "addConditionalFormatRule",
    ]);
    assert.deepEqual(validateSheetsStyleRequests(requests), [
      "repeatCell",
      "updateBorders",
      "addConditionalFormatRule",
    ]);
  });

  it("throws on unsupported request payloads", () => {
    const unsupported = [{ totallyCustomRequest: {} }] as unknown as sheets_v4.Schema$Request[];

    assert.throws(
      () => {
        validateSheetsStyleRequests(unsupported);
      },
      {
        message: /unsupported request objects/i,
      },
    );
  });

  it("maps style requests to spreadsheets.batchUpdate format", () => {
    const request = buildSheetsStyleBatchUpdateRequest({
      spreadsheet_id: "sheet-123",
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
      ],
      include_spreadsheet_in_response: true,
      response_ranges: ["Sheet1!A1:B10"],
      response_include_grid_data: false,
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
        ],
        includeSpreadsheetInResponse: true,
        responseRanges: ["Sheet1!A1:B10"],
        responseIncludeGridData: false,
      },
    });
  });

  it("exposes the canonical tool name", () => {
    assert.equal(sheetsStyleToolDefinition.name, "sheets_style");
  });
});
