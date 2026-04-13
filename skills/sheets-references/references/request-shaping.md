# Request Shaping

## Core Rules

- Prefer one high-capability tool call over multiple narrow calls.
- Always scope reads with explicit A1 `ranges` when possible.
- Always use the smallest useful response shape.
- Batch related operations in one invocation.
- Discover first, then slice: metadata before broad grid reads.
- Keep payloads moderate; avoid giant single-shot writes when the work can be split cleanly.

## Read Limits And Shaping

### `sheets_get`

- Limit `ranges` to needed slices (max 50).
- Pass `fields` whenever full metadata is not required.
- Prefer reconnaissance masks before full spreadsheet payloads.
- Keep `include_grid_data` off unless cell-level data is required.

### `sheets_read_values`

- Coalesce read targets into one `ranges[]` array (1..100).
- Use `UNFORMATTED_VALUE` for stable numbers and dates.
- Use `FORMULA` when formula text is needed but notes / formats are not.
- Avoid repeated single-range calls when one batch read covers the request.

### `sheets_read_grid`

- Always provide targeted `ranges[]` (1..25).
- Keep the default grid field mask unless a narrower override is known.
- Avoid whole-sheet fetches unless truly necessary.
- Read only the slice that matters; do not use grid reads as a first-pass reconnaissance tool.

## Diagnose Limits And Shaping

### `sheets_analyze`

- Batch related ranges together (1..100).
- Keep `include_formula_map=false` unless formula-location evidence is required.
- Keep `sample_size` small unless wider sampling is necessary.
- Set `duplicate_key_columns` when diagnosing joins, dedupe tasks, or pivot source quality.

### `sheets_formula_debug`

- Batch candidate formulas with `formulas[]` when comparing alternatives.
- Include only minimal `context_values[]`.
- Use a scratch target cell with free space below it.
- Prefer one debug pass with cleanup over repeated single-formula experiments.

## Write Limits And Shaping

### `sheets_edit`

- Combine `value_updates`, `append_rows`, `clear_ranges`, and `requests` into one tool call when they belong together.
- Limits:
  - `value_updates`: 1..200
  - `append_rows`: 1..50
  - `clear_ranges`: 1..200
  - `requests`: 1..200
- Use `dry_run=true` when the request is large, destructive, or structurally complex.
- If the change can be expressed as one coherent `requests[]` batch, prefer that when atomicity matters.
- Split giant write payloads instead of forcing a single oversized request.

### `sheets_style`

- Combine ordered style requests in one `requests[]` array.
- Limit `requests`: 1..200
- Keep requests narrowly scoped to the exact styled region.
- Preserve order intentionally, especially for conditional formatting and layered style effects.

## Large-Sheet Heuristics

- Metadata first, then targeted value reads.
- Use field masks on `spreadsheets.get`.
- Limit `includeGridData`.
- Prefer formula text reads over grid reads when possible.
- Narrow ranges before diagnosing or styling.
