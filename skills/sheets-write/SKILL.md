---
name: sheets-write
description: "Change Google Sheets data, formulas, structure, dashboards, charts, and styling through `sheets_edit` and `sheets_style`. Use for live mutations and dry-run planning. Do not use for read-only inspection or diagnostics."
---

# Sheets Write

Use this skill for spreadsheet mutations.

## Use When

- The user wants to write values, formulas, append rows, clear ranges, or send structural `batchUpdate` requests.
- The user wants to apply formatting, borders, banding, conditional formatting, merges, or auto-resize operations.
- The user wants to create or update advanced spreadsheet artifacts through raw `spreadsheets.batchUpdate` requests, such as charts, data validation, or other structural request families accepted by Google Sheets.
- The user wants a dry-run preview before a mutation.

## Do Not Use When

- The user only wants to inspect data or metadata. Use `sheets-read`.
- The user wants profiling or formula diagnosis rather than a change. Use `sheets-diagnose`.

## Frame The Task First

Translate the request into four fields before choosing a tool:

- Goal: what should change?
- Context: which spreadsheet, sheets, ranges, formulas, visuals, or layout regions are involved?
- Constraints: dry-run first, no destructive overwrite, preserve formulas, preserve formatting, one-sheet scope, etc.
- Done when: what read-back or visual state will prove success?

If the request is ambiguous or high-impact, do a reconnaissance read before writing.

## Intent To Tool

| Intent | Prefer | Notes |
|---|---|---|
| Write or replace values and formulas | `sheets_edit` | Best for value matrices and formula writes |
| Append rows | `sheets_edit` | Appends execute sequentially |
| Clear ranges | `sheets_edit` | Use for data reset or cleanup |
| Sheet structure or advanced raw `batchUpdate` requests | `sheets_edit` | Includes request families not covered by `sheets_style` |
| Borders, merges, banding, conditional formatting, auto-resize, cell formatting | `sheets_style` | Style-oriented `batchUpdate` request families |
| Data + formatting in one user task | `sheets_edit` then `sheets_style` | Data and structure first, presentation second |

## Decision Rules

1. Choose `sheets_edit` for data and structure.
2. Choose `sheets_style` for appearance and presentation.
3. When both are needed, do two calls:
   - data / structure first with `sheets_edit`
   - formatting second with `sheets_style`
4. Treat overlapping request families by intent:
   - `updateCells` for values / formulas -> `sheets_edit`
   - `updateCells` for formatting -> `sheets_style`
   - `updateDimensionProperties` for data layout -> `sheets_edit`
   - `updateDimensionProperties` for visual fit -> `sheets_style`

## High-Yield Workflows

### Safe Refresh

- Read or inspect first if the existing state matters.
- Dry-run the mutation if it is large, destructive, or touches multiple regions.
- Apply the live write.
- Read back the affected ranges if verification matters.

### Dashboard Or Report Build

- Prepare values and formulas first.
- Then apply formatting, banding, conditional formatting, and auto-resize.
- Use raw structural requests only when the task truly needs them.

### Cleanup Or Refactor

- Clear or overwrite data only after the target ranges are confirmed.
- Keep response-expansion flags off unless echoed payloads are needed for verification.
- Verify the final shape after any structural change.

## Cross-Cutting Rules

- Prefer `dry_run=true` first for complex or high-impact mutations.
- Use a `read -> plan -> dry_run -> live write -> verify` loop for important changes.
- Pack related work into one tool invocation whenever schema limits allow it.
- Keep ranges narrow and explicit.
- `dry_run` is available on both tools but defaults to `false`; set it explicitly when preview is required.
- Writes are not inherently atomic across multiple internal Google API calls inside `sheets_edit`.
- If all-or-nothing behavior matters, prefer one coherent `requests[]` batch update when the change can be expressed that way.
- Data changes should happen before formatting changes when both are needed.
- Prepare clean headers, stable key columns, and typed numeric data before building pivot-like summaries, dashboards, or visual layers.
- Load deeper doctrine only when needed:
  - `../sheets-references/references/request-shaping.md`
  - `../sheets-references/references/mutation-safety.md`
  - `../sheets-references/references/performance-and-scale.md`
  - `../sheets-references/references/formatting-and-visualization.md`
  - `../sheets-references/references/error-taxonomy.md`

## `sheets_edit`

### Use When

- The user wants value updates, appends, clears, or structural `batchUpdate` requests.
- The user wants one normalized tool call that may cover several mutation families together.
- The user wants raw `spreadsheets.batchUpdate` request families not covered by `sheets_style`.

### Do Not Use When

- The change is only visual styling or formatting.

### Input Contract

- Required:
  - `spreadsheet_id`
  - At least one of `value_updates`, `append_rows`, `clear_ranges`, or `requests`
- Optional:
  - `dry_run`
  - `value_input_option` (default `USER_ENTERED`)
  - `include_values_in_response`
  - `response_value_render_option`
  - `response_date_time_render_option`
  - `include_spreadsheet_in_response`
  - `response_ranges`
  - `response_include_grid_data`

### Limits

- `value_updates`: 1..200
- `append_rows`: 1..50
- `clear_ranges`: 1..200
- `requests`: 1..200

### Safe Defaults

- Prefer `value_input_option=USER_ENTERED` unless raw literal writes are required.
- Keep response-expansion flags off unless echoed payloads are needed.
- Group related mutations into one invocation to minimize API calls.
- Prefer `dry_run=true` before sending complex `requests[]`.
- Keep raw request payloads explicit; do not rely on broad wildcards when a narrower request can be expressed.

### Execution Semantics

- API calls: 1-4+
- Endpoints:
  - `spreadsheets.values.batchUpdate` for `value_updates`
  - `spreadsheets.values.append` for `append_rows` (one per append entry, sequential)
  - `spreadsheets.values.batchClear` for `clear_ranges`
  - `spreadsheets.batchUpdate` for structural `requests`
- Lane: write for all internal calls
- `dry_run=true`: 0 API calls
- Important: not atomic across internal calls

### Validation And Failure Modes

- Hard failure before any API call:
  - `"sheets_edit requires at least one operation: value_updates, append_rows, clear_ranges, or requests."`
- Other failures come from Google API validation, permissions, or missing resources.
- Raw `requests[]` are passed through to Google API validation; invalid request families or malformed field masks fail there.

### Output Shape

```text
dry_run=true:
{
  spreadsheet_id,
  dry_run: true,
  planned_operations,
  requests
}

dry_run=false:
{
  spreadsheet_id,
  dry_run: false,
  planned_operations,
  results: {
    value_updates,
    append_rows,
    clear_ranges,
    structural_requests
  }
}
```

### Examples

- “Dry-run an update that writes `Dashboard!B2:D20` and clears `Dashboard!F2:F20`.”
- “Append rows to `RawData!A:D` and rename sheet ID 12345 to `Archive` in one request.”
- “Dry-run a structural request batch before adding a dashboard artifact.”

## `sheets_style`

### Use When

- The user wants style-focused `spreadsheets.batchUpdate` requests.
- The user wants borders, merges, banding, conditional formatting, or auto-resize behavior.
- The user wants a polished presentation layer after data changes.

### Do Not Use When

- The primary goal is writing or clearing values, formulas, or structure.

### Input Contract

- Required:
  - `spreadsheet_id`
  - `requests` (1..200)
- Optional:
  - `dry_run`
  - `include_spreadsheet_in_response`
  - `response_ranges`
  - `response_include_grid_data`

### Supported Request Kinds

- `repeatCell`
- `updateBorders`
- `mergeCells`
- `unmergeCells`
- `updateCells`
- `updateDimensionProperties`
- `addBanding`
- `updateBanding`
- `deleteBanding`
- `addConditionalFormatRule`
- `updateConditionalFormatRule`
- `deleteConditionalFormatRule`
- `updateSheetProperties`
- `autoResizeDimensions`

### Safe Defaults

- Keep requests narrowly scoped to specific ranges or sheets.
- Keep response-expansion flags off unless needed.
- Use one ordered batch instead of multiple style calls.
- Treat `dry_run` as request-shape validation; semantic range validation still happens at execution time.
- When using conditional formatting, treat request order as intentional and deterministic.

### Execution Semantics

- API calls: 1
- Endpoint: `spreadsheets.batchUpdate`
- Lane: write
- `dry_run=true`: 0 API calls

### Validation And Failure Modes

- Hard failure before any API call:
  - `"sheets_style received unsupported request objects at indexes: ..."`
- Other failures come from Google API validation, permissions, or missing resources.

### Output Shape

```text
dry_run=true:
{
  spreadsheet_id,
  dry_run: true,
  planned_operations: {
    request_count,
    request_kinds,
    request_kind_counts
  },
  request
}

dry_run=false:
{
  spreadsheet_id,
  dry_run: false,
  planned_operations: {
    request_count,
    request_kinds,
    request_kind_counts
  },
  results: {
    replies_count
  }
}
```

### Examples

- “Dry-run formatting for `Summary!A1:F1` with bold centered text and bottom border.”
- “Apply conditional formatting and banding to `Ops!A2:H500` in one style batch.”

## Escalation

- Move to `sheets-read` when the user needs inspection before mutation.
- Move to `sheets-diagnose` when a failed write depends on understanding data quality or a broken formula.
- Load `../sheets-references/SKILL.md` only when deeper cross-cutting doctrine is needed.
