# Tool Catalog

## Selection Rules

- Use the lightest tool that fully covers the request.
- Prefer read-only tools before write or write/read debug loops.
- Prefer one batched call over many narrow calls.
- Route by user intent, not by which Google API endpoint sounds more general.

## Read

### `sheets_get`

- Best for: spreadsheet metadata, sheet list, IDs, dimensions, named ranges, and reconnaissance.
- Prefer when: you do not yet know the right sheet or range, or you only need metadata.
- Avoid when: values, formulas, notes, merges, or formatting are needed.
- Side effects: none.

### `sheets_read_values`

- Best for: value matrices across one or more ranges.
- Prefer when: plain values or formula text are enough.
- Avoid when: notes, merges, formats, or full `CellData` are needed.
- Side effects: none.

### `sheets_read_grid`

- Best for: formulas plus effective values, notes, merges, row/column metadata, and formatting objects.
- Prefer when: the exact returned grid structure matters.
- Avoid when: plain values or simple formula text are enough.
- Side effects: none.

## Diagnose

### `sheets_analyze`

- Best for: profiling, null ratios, inferred types, duplicate keys, outlier hints, and optional formula maps.
- Prefer when: the problem may be data shape, data cleanliness, or key quality.
- Avoid when: a specific formula needs scratch evaluation.
- Side effects: none.

### `sheets_formula_debug`

- Best for: validating, comparing, and diagnosing one or more formulas.
- Prefer when: you need parse-vs-evaluation evidence or candidate comparison.
- Avoid when: broad range profiling is enough.
- Side effects: writes evaluation cells, reads results, may clear scratch cells.

## Write

### `sheets_edit`

- Best for: value updates, appends, clears, and structural `batchUpdate` requests.
- Prefer when: the task changes data, formulas, or non-style structure.
- Also use when: the user needs advanced raw request families accepted by `spreadsheets.batchUpdate` that are outside `sheets_style`.
- Avoid when: the request is purely visual styling.
- Side effects: mutates spreadsheet state; may fan out into multiple Google API calls.

### `sheets_style`

- Best for: formatting, borders, merges, banding, conditional formatting, auto-resize, and style-oriented sheet properties.
- Prefer when: the task is presentation, readability, or visual emphasis.
- Avoid when: the task is primarily data, formulas, or structure.
- Side effects: mutates spreadsheet presentation with one `spreadsheets.batchUpdate` call.

## Common Routing Shortcuts

- “What sheets / tabs are here?” -> `sheets_get`
- “Read these cells / export these values” -> `sheets_read_values`
- “Show notes / merges / formatting / formulas with effective values” -> `sheets_read_grid`
- “Why does this lookup / filter / import fail?” -> `sheets_analyze`, then `sheets_formula_debug` if needed
- “Write / append / clear / rename / structural edit” -> `sheets_edit`
- “Highlight / band / resize / merge / conditional format” -> `sheets_style`
