# Formula Doctrine Index

## Use When

- User asks which Google Sheets formula family to use.
- Task involves lookups, joins, virtual tables, spill pipelines, cleanup, or anti-pattern review.
- Main skill needs deeper formula doctrine before proposing a read, diagnose, or write step.

## Avoid When

- User only needs ordinary metadata or value reads already covered by `sheets-read`.
- User already needs live mutation more than formula selection. Route to `sheets-write`.
- User already has a narrow failing candidate formula and execution proof is next. Route to `sheets_formula_debug`.

## High-Yield Formulas Or Patterns

- Lookup and join requests: load `formulas-lookup-and-joins.md`.
- Spill reshaping or virtual-table construction: load `formulas-arrays-and-shaping.md`.
- Text cleanup, type coercion, regex, or locale cleanup: load `formulas-text-date-cleanup.md`.
- Performance, brittleness, and “should we avoid this?” questions: load `formulas-pitfalls-and-anti-patterns.md`.
- Parse-vs-evaluation debugging: pair this index with `formula-debugging-playbooks.md`.

## Tips And Tricks

- Read formula text first with `sheets_read_values` using `value_render_option=FORMULA` before assuming the stored formula matches the user’s description.
- For joins, inspect key columns with `sheets_analyze` before rewriting lookup logic.
- Treat virtual tables as formula-level staging areas: `HSTACK`, `VSTACK`, and array literals are often safer than mutating the sheet early.
- Prefer `LET` when a formula reuses the same expensive subexpression.

## Common Pitfalls

- Rewriting formulas before checking duplicates, nulls, or mixed key types.
- Treating `#N/A` as syntax failure when it often means “no match”.
- Using `QUERY` as default answer even when dedicated array functions are clearer.
- Hiding real defects with broad `IFERROR(...)`.

## Debugging Clues

- If values look equal but do not match, suspect hidden whitespace, text-vs-number drift, or non-breaking spaces.
- If a spill formula fails only in-sheet, inspect blocking cells around the target range.
- If an import-based formula is flaky, check permissions, chain depth, and payload size before changing syntax.

## Escalation Path

- Stay in `sheets-read` for formula inventory or read-only inspection.
- Move to `sheets_analyze` when key quality, duplicates, nulls, or mixed types may be root cause.
- Move to `sheets_formula_debug` when candidate execution evidence is required.
- Move to `sheets-write` only after formula choice is settled and a persistent sheet change is desired.
