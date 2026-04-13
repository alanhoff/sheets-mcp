import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSheetsGetRequest, sheetsGetToolDefinitions } from "#tools/sheets-get.ts";

describe("sheets_get tool", () => {
  it("keeps legacy request behavior when only spreadsheet id is provided", () => {
    const request = buildSheetsGetRequest({ spreadsheet_id: "sheet-123" });

    assert.deepEqual(request, { spreadsheetId: "sheet-123" });
  });

  it("maps optional request parameters to google api format", () => {
    const request = buildSheetsGetRequest({
      spreadsheet_id: "sheet-123",
      ranges: ["Sheet1!A1:C10"],
      fields: "spreadsheetId,properties.title",
      include_grid_data: true,
    });

    assert.deepEqual(request, {
      spreadsheetId: "sheet-123",
      ranges: ["Sheet1!A1:C10"],
      fields: "spreadsheetId,properties.title",
      includeGridData: true,
    });
  });

  it("exposes the canonical tool name", () => {
    const toolNames = sheetsGetToolDefinitions.map((tool) => tool.name);
    assert.deepEqual(toolNames, ["sheets_get"]);
  });
});
