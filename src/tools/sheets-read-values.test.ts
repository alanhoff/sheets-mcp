import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod/v4";
import {
  buildSheetsReadValuesRequest,
  sheetsReadValuesInputSchema,
  sheetsReadValuesToolDefinition,
} from "#tools/sheets-read-values.ts";

describe("sheets_read_values tool", () => {
  it("requires at least one range", () => {
    const schema = z.object(sheetsReadValuesInputSchema);
    const parsed = schema.safeParse({
      spreadsheet_id: "sheet-123",
      ranges: [],
    });

    assert.equal(parsed.success, false);
  });

  it("maps request parameters to google api batchGet format", () => {
    const request = buildSheetsReadValuesRequest({
      spreadsheet_id: "sheet-123",
      ranges: ["Sheet1!A1:C10", "Sheet1!E1:E10"],
      major_dimension: "COLUMNS",
      value_render_option: "UNFORMATTED_VALUE",
      date_time_render_option: "SERIAL_NUMBER",
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      ranges: ["Sheet1!A1:C10", "Sheet1!E1:E10"],
      majorDimension: "COLUMNS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
  });

  it("exposes the canonical tool name", () => {
    assert.equal(sheetsReadValuesToolDefinition.name, "sheets_read_values");
  });
});
