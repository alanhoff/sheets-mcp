import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod/v4";
import {
  buildSheetsEditAppendRequests,
  buildSheetsEditBatchUpdateRequest,
  buildSheetsEditValuesBatchClearRequest,
  buildSheetsEditValuesBatchUpdateRequest,
  hasSheetsEditOperations,
  sheetsEditInputSchema,
  sheetsEditToolDefinition,
} from "#tools/sheets-edit.ts";

describe("sheets_edit tool", () => {
  it("detects whether at least one operation is present", () => {
    const hasNone = hasSheetsEditOperations({
      spreadsheet_id: "sheet-123",
    });
    const hasOperations = hasSheetsEditOperations({
      spreadsheet_id: "sheet-123",
      clear_ranges: ["Sheet1!A1:B2"],
    });

    assert.equal(hasNone, false);
    assert.equal(hasOperations, true);
  });

  it("maps value updates to values.batchUpdate format", () => {
    const request = buildSheetsEditValuesBatchUpdateRequest({
      spreadsheet_id: "sheet-123",
      value_input_option: "RAW",
      include_values_in_response: true,
      response_value_render_option: "UNFORMATTED_VALUE",
      response_date_time_render_option: "SERIAL_NUMBER",
      value_updates: [
        {
          range: "Sheet1!A1:B2",
          values: [
            ["a", "b"],
            ["c", "d"],
          ],
        },
      ],
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      requestBody: {
        data: [
          {
            range: "Sheet1!A1:B2",
            majorDimension: "ROWS",
            values: [
              ["a", "b"],
              ["c", "d"],
            ],
          },
        ],
        valueInputOption: "RAW",
        includeValuesInResponse: true,
        responseValueRenderOption: "UNFORMATTED_VALUE",
        responseDateTimeRenderOption: "SERIAL_NUMBER",
      },
    });
  });

  it("maps append rows to ordered values.append requests", () => {
    const requests = buildSheetsEditAppendRequests({
      spreadsheet_id: "sheet-123",
      value_input_option: "USER_ENTERED",
      append_rows: [
        {
          range: "Sheet1!A:C",
          values: [[1, 2, 3]],
        },
      ],
    });

    assert.deepEqual(requests, [
      {
        spreadsheetId: "sheet-123",
        range: "Sheet1!A:C",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        includeValuesInResponse: false,
        requestBody: {
          majorDimension: "ROWS",
          values: [[1, 2, 3]],
        },
      },
    ]);
  });

  it("maps clear ranges to values.batchClear format", () => {
    const request = buildSheetsEditValuesBatchClearRequest({
      spreadsheet_id: "sheet-123",
      clear_ranges: ["Sheet1!A1:A10", "Sheet1!C1:C10"],
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      requestBody: {
        ranges: ["Sheet1!A1:A10", "Sheet1!C1:C10"],
      },
    });
  });

  it("maps structural requests to spreadsheets.batchUpdate format", () => {
    const request = buildSheetsEditBatchUpdateRequest({
      spreadsheet_id: "sheet-123",
      include_spreadsheet_in_response: true,
      response_ranges: ["Sheet1!A1:D10"],
      response_include_grid_data: false,
      requests: [
        {
          addSheet: {
            properties: {
              title: "New Sheet",
            },
          },
        },
      ],
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: "New Sheet",
              },
            },
          },
        ],
        includeSpreadsheetInResponse: true,
        responseRanges: ["Sheet1!A1:D10"],
        responseIncludeGridData: false,
      },
    });
  });

  it("validates append operation options", () => {
    const schema = z.object(sheetsEditInputSchema);
    const parsed = schema.safeParse({
      spreadsheet_id: "sheet-123",
      append_rows: [
        {
          range: "Sheet1!A:C",
          values: [[1, 2, 3]],
          insert_data_option: "INVALID_OPTION",
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  it("exposes the canonical tool name", () => {
    assert.equal(sheetsEditToolDefinition.name, "sheets_edit");
  });
});
