---
name: sheets-diagnose
description: "Diagnose spreadsheet data quality and formula behavior through `sheets_analyze` and `sheets_formula_debug`. Use for profiling, lookup failures, import issues, and formula troubleshooting. Do not use for ordinary reads or direct mutations."
---

# Sheets Diagnose

Use this skill for spreadsheet diagnostics and formula troubleshooting.

## Use When

- The user wants null ratios, inferred types, duplicate keys, outlier hints, or formula maps.
- The user wants to validate, compare, or debug one or more formulas.
- The user is not sure whether a spreadsheet problem is data quality, key quality, formula behavior, or import behavior.
- The user wants a pre-write sanity check before changing formulas or refreshing a dashboard.

## Do Not Use When

- The user only wants metadata, values, notes, or formatting inspection. Use `sheets-read`.
- The user already knows the desired mutation and wants to apply it. Use `sheets-write`.

## Frame The Task First

Translate the request into four fields before choosing a tool:

- Goal: what is failing or suspicious?
- Context: which spreadsheet, sheets, ranges, keys, formulas, or imports are involved?
- Constraints: read-only first, no persistent debug residue, exact formula parity, etc.
- Done when: what proof will count as diagnosed?

If the issue is ambiguous, start with the cheapest read-only evidence.

## Symptom To First Move

| Symptom | First move | Why |
|---|---|---|
| Duplicate rows, missing joins, or inconsistent keys | `sheets_analyze` with `duplicate_key_columns` | Distinguish data quality from formula bugs |
| Null-heavy or mixed-type columns | `sheets_analyze` | Surface shape and type drift quickly |
| Specific formula fails or needs comparison | `sheets_formula_debug` | Produces parse-vs-evaluation evidence |
| `FILTER` / lookup / import result seems wrong | Analyze referenced ranges first, then debug the formula | Many “formula bugs” are really range, key, permission, or empty-result problems |
| Need to know where formulas exist | `sheets_analyze` with `include_formula_map=true` | Read-only formula geography |

## Decision Rules

1. Start with `sheets_analyze` for broad data-quality, shape, and key-quality questions.
2. Use `sheets_formula_debug` for a specific formula or candidate set.
3. When the user is unsure whether the issue is data or formula, start with read-only analysis.
4. Only escalate to scratch evaluation when targeted execution evidence is actually needed.
5. When diagnosing lookups or filters, inspect the referenced ranges before rewriting the formula.

## High-Yield Playbooks

### Lookup And Join Failures

- Check duplicates, nulls, and mixed types in the key columns before changing the formula.
- Suspect whitespace or hidden-text differences when values “look the same” but do not match.
- Remember that `XLOOKUP` requires lookup and result ranges with compatible shape and returns `#N/A` by default when no match is found.

### `FILTER` Surprises

- Verify that each condition range has the same length as the filtered range.
- Do not mix row conditions and column conditions in one `FILTER`.
- Treat `#N/A` carefully: it may mean “no rows matched,” not “the formula is malformed.”

### `LET` Failures

- Ensure the declared names are identifiers, not cell references.
- Evaluate names left to right; later expressions cannot use names declared later in the same `LET`.

### `IMPORTRANGE` Problems

- Distinguish permission failures from formula syntax failures.
- Large imports, chained imports, volatile upstream references, and freshness delays can all look like formula bugs.
- Debug permission and range size before rewriting the formula.

### Array Behavior

- Many array-returning formulas expand into neighboring cells automatically.
- Use a scratch target cell with clear space below it when debugging array-producing formulas.

## Cross-Cutting Rules

- `sheets_analyze` is cheaper and read-only; prefer it for broad overview work.
- `sheets_formula_debug` straddles read and write lanes because it writes evaluation cells before reading results.
- Use scratch cells or scratch sheets for formula validation whenever possible.
- Use `cleanup=true` for disposable checks unless the user explicitly wants the debug cells left in place.
- Seed only the minimal `context_values` needed to reproduce the behavior.
- When comparing candidate formulas, batch them into one debug run instead of repeating one-by-one calls.
- Normalize key and range assumptions before blaming the formula.
- Load deeper doctrine only when needed:
  - `../sheets-references/references/tool-catalog.md`
  - `../sheets-references/references/request-shaping.md`
  - `../sheets-references/references/formula-debugging-playbooks.md`
  - `../sheets-references/references/performance-and-scale.md`
  - `../sheets-references/references/error-taxonomy.md`

## `sheets_analyze`

### Use When

- The user wants summary statistics, inferred types, null ratios, duplicate detection, or outlier hints.
- The user wants a formula map across one or more ranges without running a write/read debug loop.
- The user wants fast evidence about whether the data shape supports a pivot, lookup, or dashboard.

### Do Not Use When

- The user needs to execute a specific formula and inspect its effective value or error.

### Input Contract

- Required:
  - `spreadsheet_id`
  - `ranges` (1..100)
- Optional:
  - `has_header_row` (default `true`)
  - `duplicate_key_columns`
  - `include_formula_map` (default `false`)
  - `sample_size` (default `5`, max `50`)
  - `outlier_zscore_threshold` (default `3`)

### Safe Defaults

- Assume header rows unless the user says otherwise.
- Keep `sample_size` small.
- Keep `include_formula_map=false` unless formula-location evidence is explicitly needed.
- Configure `duplicate_key_columns` when diagnosing joins, dedupe jobs, or pivot source quality.

### Execution Semantics

- API calls: 1-2
- Endpoints:
  - always 1x `spreadsheets.values.batchGet` in `UNFORMATTED_VALUE` mode
  - plus 1x `spreadsheets.values.batchGet` in `FORMULA` mode when `include_formula_map=true`
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
  options,
  summary,
  ranges,
  formula_map?
}
```

### Examples

- “Analyze `Leads!A1:H1000` for null ratios and inferred types.”
- “Find duplicate keys in `Orders!A1:J5000` and include a formula map.”

## `sheets_formula_debug`

### Use When

- The user wants to check if a formula is valid.
- The user wants to classify a failure as parse vs evaluation failure.
- The user wants to compare several candidate formulas in one pass.
- The user wants proof before replacing a live spreadsheet formula.

### Do Not Use When

- The user only wants to know where formulas exist in a range.
- The user wants a broad diagnostic overview instead of candidate execution evidence.

### Input Contract

- Required:
  - `spreadsheet_id`
  - `target_cell` (single A1 cell with sheet name)
  - exactly one of:
    - `formula`
    - `formulas` (1..100)
- Optional:
  - `context_values`
  - `cleanup` (default `false`)
  - `cleanup_context_ranges` (allowed only when `cleanup=true`)

### Safe Defaults

- Use a dedicated scratch area for testing.
- Keep candidate lists compact unless broad comparison is requested.
- Enable `cleanup=true` for non-persistent validation runs.
- Keep `cleanup_context_ranges=false` unless the seeded inputs are disposable.
- Leave enough empty rows below `target_cell`: candidates are written vertically downward in the same column.

### Execution Semantics

- API calls: 2-3
- Endpoints:
  - `spreadsheets.values.batchUpdate` to write formulas and context values
  - `spreadsheets.get` to read effective values and errors
  - `spreadsheets.values.batchClear` when `cleanup=true`
- Lanes:
  - write for setup / cleanup
  - read for result inspection

### Validation And Failure Modes

- Hard failures before API calls:
  - `"Provide exactly one of formula or formulas."`
  - `"Formula candidates cannot be empty."`
  - `"target_cell must be a valid A1 single-cell reference with sheet name"`
  - `"target_cell must point to a single cell"`
  - `"target_cell must include a sheet name."`
  - `"Sheet name in target_cell cannot be empty."`
  - `"cleanup_context_ranges can only be true when cleanup is true."`

### Output Shape

```text
{
  spreadsheet_id,
  target_cell,
  evaluation_range,
  formula_count,
  context_ranges_written,
  summary,
  cleanup,
  results
}
```

### Error Classification

- `PARSE_ERROR`: Google returned `errorType="ERROR"`.
- `EVALUATION_ERROR`: the formula parsed, but execution failed.
- Use raw `error_type` and `error_message` for more granular diagnosis.

### Interpretation Rules

- A parse error usually means syntax, spelling, quoting, or malformed expression structure.
- An evaluation error usually means the formula ran into bad references, bad types, missing matches, permissions, or empty-result behavior.
- If the formula is valid but the result is still wrong, inspect the referenced ranges with `sheets-read` or `sheets_analyze` before proposing a fix.

### Examples

- “Validate `SUM(B2:B20)` at `Ops!Z1` and clean up afterward.”
- “Debug `=VLOOKUP(A2,Ref!A:C,3,FALSE)` at `Sheet1!G2`.”
- “Compare three candidate formulas at `Sheet1!AA2`.”

## Escalation

- Move to `sheets-read` when diagnosis shows the next step is inspecting formatting, notes, or underlying ranges.
- Move to `sheets-write` when the next step is applying a corrected formula or data change.
- Load `../sheets-references/SKILL.md` only when deeper doctrine is needed.
