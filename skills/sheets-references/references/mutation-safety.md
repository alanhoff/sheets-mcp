# Mutation Safety

## Core Rules

- Prefer `dry_run=true` first for complex or high-impact mutations.
- Review normalized or planned payloads before live execution.
- If a write depends on current spreadsheet state, do `read -> plan -> write`.
- Data changes should happen before formatting changes when both are needed.
- Verify important writes with a targeted read afterward.

## Atomicity Nuance

- A single Google Sheets request is atomic at the API level.
- `sheets_edit` may fan out into multiple internal API calls (`values.batchUpdate`, append, clear, `batchUpdate`), so the whole tool invocation is not atomic as one unit.
- If all-or-nothing behavior matters, prefer one coherent `requests[]` batch when the change can be expressed that way.

## `sheets_edit`

- May fan out into multiple Google API calls.
- Internal calls are not atomic together.
- Appends execute sequentially, one append request per entry.
- Prefer explicit ranges and narrow request bodies to avoid accidental overreach.

## `sheets_style`

- Request order matters inside `requests[]`.
- Later style requests see effects of earlier ones.
- Keep rule ordering intentional, especially for conditional formatting.

## Formula Debug Safety

- Use scratch cells or scratch sheets when validating formulas.
- Use `cleanup=true` for disposable checks.
- Only clear context ranges when they were written purely for debugging.

## Visualization Safety

- Confirm source headers and typed numeric data before building a report or dashboard layer.
- Apply visual polish after values and formulas are stable.
- Prefer dry-runs for advanced raw request specs.
