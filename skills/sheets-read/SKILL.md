---
name: sheets-read
description: Inspect Google Sheets without changing them: spreadsheet metadata, values, formulas, notes, merges, formatting, and targeted grid structures through `sheets_get`, `sheets_read_values`, and `sheets_read_grid`. Use for reconnaissance, exports, audits, and formula inventories. Do not use for computed diagnostics, formula evaluation loops, or mutations.
---

# Sheets Read

Use this skill for normal read-only retrieval from Google Sheets.

## Use When

- The user wants spreadsheet title, locale, timezone, sheet names, sheet IDs, dimensions, or named ranges.
- The user wants cell values from one or more ranges.
- The user wants formula text, notes, merges, formatting objects, or row/column metadata.
- The sheet name or exact range is not known yet and you need a light reconnaissance pass before another Sheets skill.

## Do Not Use When

- The user wants null ratios, inferred types, duplicates, outlier hints, or formula debugging. Use `sheets-diagnose`.
- The user wants to validate a formula by writing it into a scratch cell. Use `sheets-diagnose`.
- The user wants to change values, formulas, structure, charts, or styling. Use `sheets-write`.

## Frame The Task First

Translate the request into four fields before choosing a tool:

- Goal: what answer or artifact is needed?
- Context: which spreadsheet, sheets, ranges, formulas, notes, or layout details matter?
- Constraints: read-only, narrow range, exact formatting fidelity, stable numeric types, etc.
- Done when: what should be visible in the final response?

If sheet names or ranges are unknown, start with `sheets_get` and a narrow field mask.

## Tool Selection

| Tool | Use when | Avoid when | Cost |
|---|---|---|---|
| `sheets_get` | Metadata only: spreadsheet properties, sheet list, IDs, dimensions, named ranges, or a reconnaissance pass | Cell values, formulas, notes, merges, or formatting objects are needed | Lightest |
| `sheets_read_values` | One or more value matrices, including formatted values, unformatted values, or formula text | Full `CellData`, notes, merges, or formatting objects are needed | Light |
| `sheets_read_grid` | Exact grid structures: formulas plus effective values, notes, merges, row/column metadata, or cell formatting | Plain values or simple formula text are enough | Heaviest |

## High-Yield Workflows

### Reconnaissance

Use `sheets_get` first when the user says things like “look at this spreadsheet,” “find the right tab,” or “show me the sheets.” Keep the response small with `fields`.

### Value Export Or Numeric Inspection

Use `sheets_read_values` with `value_render_option=UNFORMATTED_VALUE` when downstream logic depends on stable numbers, booleans, or serial dates instead of display strings.

### Formula Inventory

Use `sheets_read_values` with `value_render_option=FORMULA` when the user wants to know which formulas are present but does not need full `CellData`.

### Grid Audit

Use `sheets_read_grid` when the question depends on notes, merges, row/column metadata, `userEnteredFormat`, or `effectiveFormat`.

## Decision Rules

1. Start with `sheets_get` when the user only needs structure or when the range is not yet known.
2. Use `sheets_read_values` when the user needs value matrices or formula text.
3. Use `sheets_read_grid` only when the user explicitly needs grid-level structures.
4. Never use a heavier tool when a lighter tool fully covers the request.
5. For large spreadsheets, discover first, then read only targeted A1 ranges.

## Cross-Cutting Rules

- Batch related ranges into one call whenever schema limits allow it.
- Prefer explicit A1 ranges over broad whole-sheet reads.
- Prefer the smallest useful response shape.
- Use `fields` on `sheets_get` before reaching for `include_grid_data`.
- Use `value_render_option=FORMULA` instead of `sheets_read_grid` when formula text alone is enough.
- Use `date_time_render_option=SERIAL_NUMBER` when stable date math matters more than presentation.
- Reserve `sheets_read_grid` for questions that truly depend on notes, merges, formatting, or row/column metadata.
- Load deeper doctrine only when needed:
  - `../sheets-references/references/tool-catalog.md`
  - `../sheets-references/references/request-shaping.md`
  - `../sheets-references/references/performance-and-scale.md`
  - `../sheets-references/references/formatting-and-visualization.md`

## `sheets_get`

### Use When

- The user wants spreadsheet title, locale, timezone, sheet metadata, dimensions, or named ranges.
- The user wants a cheap reconnaissance pass before a more targeted read or write.
- The user wants range-scoped metadata but not cell payloads.

### Do Not Use When

- The user needs cell values, formulas, notes, merges, or formatting objects.
- The user needs broad diagnostics or formula validation.

### Input Contract

- Required: `spreadsheet_id`
- Optional:
  - `ranges` (max 50)
  - `fields` (Google Sheets field mask)
  - `include_grid_data` (default omitted / false)

### Safe Defaults

- Start with only `spreadsheet_id`.
- Add a narrow `fields` mask before adding `include_grid_data`.
- Keep `include_grid_data` unset unless cell-level payload is explicitly required.
- For a reconnaissance pass, prefer a mask shaped like spreadsheet properties, sheet properties, and named ranges.

### Execution Semantics

- API calls: 1
- Endpoint: `spreadsheets.get`
- Lane: read

### Validation And Failure Modes

- No tool-level validation beyond schema checks.
- Common API failures: invalid spreadsheet ID, permission denied, invalid field mask.

### Output Shape

- Returns raw Google Sheets `Spreadsheet` JSON with no summarization.
- Exact shape depends on `fields`.
- Without a field mask, the full resource may include:
  - `spreadsheetId`
  - `properties`
  - `sheets[]`
  - `namedRanges[]`

### Examples

- “Get the title and sheet names for spreadsheet `1abc...`.”
- “Fetch only spreadsheet properties and sheet IDs for spreadsheet `1abc...`.”

## `sheets_read_values`

### Use When

- The user wants values from one or many ranges.
- The user wants formula text without full `CellData`.
- The user wants unformatted numeric values for downstream analysis.

### Do Not Use When

- The user needs notes, merges, or formatting objects.
- The user only needs spreadsheet-level metadata.

### Input Contract

- Required:
  - `spreadsheet_id`
  - `ranges` (1..100)
- Optional:
  - `major_dimension`: `ROWS` | `COLUMNS`
  - `value_render_option`: `FORMATTED_VALUE` | `UNFORMATTED_VALUE` | `FORMULA`
  - `date_time_render_option`: `SERIAL_NUMBER` | `FORMATTED_STRING`

### Safe Defaults

- Keep `major_dimension` unset unless column-major output is requested.
- Keep render options unset for general reads.
- Use `value_render_option=UNFORMATTED_VALUE` for stable numeric, boolean, or date work.
- Use `value_render_option=FORMULA` only when formula text is needed.
- Avoid `FORMATTED_VALUE` when you need type-consistent downstream reasoning.

### Execution Semantics

- API calls: 1
- Endpoint: `spreadsheets.values.batchGet`
- Lane: read

### Validation And Failure Modes

- No tool-level validation beyond schema checks.
- Common API failures: invalid ranges, spreadsheet not found, permission denied.

### Output Shape

```text
{
  spreadsheet_id,
  requested_ranges,
  returned_ranges,
  value_ranges: [
    {
      range,
      major_dimension,
      values
    }
  ]
}
```

### Examples

- “Read `Sheet1!A1:D50` and `Sheet2!A1:B20` from spreadsheet `1abc...`.”
- “Get formulas from `Revenue!A1:G200` in spreadsheet `1abc...`.”

## `sheets_read_grid`

### Use When

- The user needs formulas plus effective values.
- The user needs notes, merged ranges, row metadata, column metadata, or formatting objects.
- The user wants to inspect the exact grid structure returned by `spreadsheets.get`.

### Do Not Use When

- Plain values are enough.
- Spreadsheet metadata alone is enough.
- Formula text alone is enough.

### Input Contract

- Required:
  - `spreadsheet_id`
  - `ranges` (1..25)
- Optional:
  - `fields` (custom field mask override)

### Safe Defaults

- Always provide explicit `ranges`.
- Keep the default field mask unless a narrower custom mask is known.
- Avoid whole-sheet fetches unless truly necessary.
- Prefer a narrower custom `fields` mask when the question is only about one part of cell state, such as notes or formulas.

### Execution Semantics

- API calls: 1
- Endpoint: `spreadsheets.get` with `includeGridData=true`
- Lane: read

### Validation And Failure Modes

- No tool-level validation beyond schema checks.
- Common API failures: invalid ranges, invalid field mask, permission denied.

### Output Shape

```text
{
  spreadsheet_id,
  requested_ranges,
  returned_sheets,
  fields,
  sheets: [
    {
      sheet_id,
      title,
      index,
      grid_properties,
      merges,
      grid_data
    }
  ]
}
```

### Examples

- “Inspect formulas and notes in `Sheet1!A1:F200` for spreadsheet `1abc...`.”
- “Show merged ranges and row/column metadata for `Ops!A1:Z100` in spreadsheet `1abc...`.”

## Escalation

- Move to `sheets-diagnose` when the next step is computed profiling, duplicate detection, or formula validation.
- Move to `sheets-write` when the next step is changing values, structure, charts, or styling.
- Load `../sheets-references/SKILL.md` only when deeper doctrine is needed.
