import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod/v4";
import {
  buildSheetsReadGridRequest,
  DEFAULT_SHEETS_READ_GRID_FIELDS,
  sheetsReadGridInputSchema,
  sheetsReadGridToolDefinition,
} from "#tools/sheets-read-grid.ts";

describe("sheets_read_grid tool", () => {
  it("requires at least one range", () => {
    const schema = z.object(sheetsReadGridInputSchema);
    const parsed = schema.safeParse({
      spreadsheet_id: "sheet-123",
      ranges: [],
    });

    assert.equal(parsed.success, false);
  });

  it("maps request parameters to grid-level spreadsheets.get format", () => {
    const request = buildSheetsReadGridRequest({
      spreadsheet_id: "sheet-123",
      ranges: ["Sheet1!A1:D25"],
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      ranges: ["Sheet1!A1:D25"],
      includeGridData: true,
      fields: DEFAULT_SHEETS_READ_GRID_FIELDS,
    });
  });

  it("allows overriding the field mask for specialized reads", () => {
    const request = buildSheetsReadGridRequest({
      spreadsheet_id: "sheet-123",
      ranges: ["Sheet1!A1:D25"],
      fields: "spreadsheetId,sheets.properties.title",
    });

    assert.equal(request.fields, "spreadsheetId,sheets.properties.title");
  });

  it("exposes the canonical tool name", () => {
    assert.equal(sheetsReadGridToolDefinition.name, "sheets_read_grid");
  });
});
