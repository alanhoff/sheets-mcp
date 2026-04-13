# Formula Debugging Playbooks

## Start With Symptom Classification

1. Is it a syntax / parse failure?
2. Is it an execution failure with bad references, bad types, permissions, or no matches?
3. Is the formula probably fine, but the data assumptions are wrong?
4. Is the problem really import freshness or spreadsheet complexity?

## Parse-Failure Playbook

- Use `sheets_formula_debug` with the smallest reproducible formula.
- Compare the input formula, normalized formula, stored formula, and error message.
- Suspect malformed syntax, bad function names, or broken expression structure first.
- If the formula is meant to be array-returning, ensure the scratch area has room to expand.

## Evaluation-Failure Playbook

- Inspect referenced ranges with `sheets-read`.
- Profile key columns with `sheets_analyze` if a join or lookup is involved.
- Distinguish missing-data behavior from true formula bugs.
- Only rewrite the formula after range, key, and permission assumptions are checked.

## Lookup And Join Playbook

- Analyze the lookup key columns for:
  - null-heavy columns
  - duplicates
  - mixed types
  - hidden whitespace suspicion
- Remember:
  - `XLOOKUP` returns `#N/A` by default when no match is found
  - `lookup_range` and `result_range` must have compatible shape
- If values look identical but fail to match, suspect trimming / hidden text before changing the lookup logic.

## `FILTER` Playbook

- Ensure each condition range has exactly the same length as the filtered range.
- Do not mix row conditions and column conditions in one `FILTER`.
- Treat `#N/A` carefully: it may simply mean that no rows matched.
- If both rows and columns need filtering, think in two stages.

## `UNIQUE` Playbook

- If apparent duplicates remain, suspect hidden trailing spaces or inconsistent numeric formatting.
- Profile the source data before assuming the formula is wrong.

## `LET` Playbook

- Identifier rules:
  - cannot be ranges like `A1`
  - cannot have spaces or special characters
  - cannot start with a number
- Names are available left-to-right only.
- A later declaration cannot be referenced by an earlier expression.

## Array / Spill Playbook

- Many array formulas expand automatically.
- Debug them in a scratch column with free space below the target cell.
- If the scalar version works but the array version fails, inspect the returned shape and neighboring cells.

## `IMPORTRANGE` Playbook

- First-use access can produce `#REF!` until the source sheet is connected.
- Chains of `IMPORTRANGE` increase latency and freshness lag.
- Imported payloads are capped at 10 MB per request.
- `IMPORTRANGE` cannot directly or indirectly reference `NOW`, `RAND`, or `RANDBETWEEN`.
- Before rewriting the formula, check:
  - source access
  - imported range size
  - chain depth
  - volatile dependencies
  - whether the source can pre-aggregate the data

## Whitespace Playbook

- `TRIM` matters when text participates in formulas or data validation.
- Non-breaking space is not removed by `TRIM`.
- If trimming does not fix a lookup, inspect the actual character content instead of changing the formula blindly.

## Recommended Debug Flow

1. Reproduce the issue with the narrowest range or formula.
2. Read or analyze the referenced data.
3. Run `sheets_formula_debug` if execution evidence is needed.
4. Classify parse vs evaluation vs data-assumption problem.
5. Only then propose a write.
