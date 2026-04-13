# Formula Pitfalls And Anti-Patterns

## Use When

- User asks which formulas or patterns should be avoided.
- Performance, freshness, readability, or maintainability is deteriorating.
- Existing sheet uses volatile or brittle constructs and needs safer replacements.

## Avoid When

- User only needs one exact formula answer and there is no design tradeoff to discuss.
- Task is strictly about current values or metadata, not formula design.
- The real blocker is permissions, range selection, or data quality rather than formula choice.

## High-Yield Formulas Or Patterns

- Prefer `XLOOKUP` or `INDEX` + `MATCH` over legacy-first `VLOOKUP`.
- Prefer `CHOOSECOLS`, `TAKE`, `DROP`, `HSTACK`, and `VSTACK` over `OFFSET` or `INDIRECT` when shaping static ranges.
- Prefer `IFS`, lookup tables, helper columns, or named functions over deep nested `IF`.
- Prefer one staged `IMPORTRANGE` boundary over long import chains.

## Tips And Tricks

- Constrain ranges when source size is large or formulas are expensive.
- Split giant formulas with `LET`, helper columns, or support tabs before they become opaque.
- Use dedicated array functions before reaching for brittle `QUERY` strings.
- Document intentional exceptions in comments or nearby notes when a volatile function is unavoidable.

## Common Pitfalls

- Volatile functions such as `NOW`, `TODAY`, `RAND`, and `RANDBETWEEN` recalc more often than many sheets can tolerate.
- `INDIRECT` and `OFFSET` are harder to trace, optimize, and debug than direct references.
- Whole-column transforms on large sheets can amplify recalculation cost.
- Nested `IF` trees become unreadable and risky to change.
- `QUERY` strings break easily under quoting mistakes, column-order drift, or locale assumptions.
- `IMPORTRANGE` chains introduce latency, freshness lag, and permission complexity.
- One-cell “wizard” formulas often outgrow human review.

## Debugging Clues

- If a sheet feels slow but formulas look innocent, search for volatile functions and open-ended ranges first.
- If dependencies are hard to trace, suspect `INDIRECT`, `OFFSET`, or import chains.
- If a formula edit keeps breaking unrelated logic, inspect whether one monster formula has become a hidden dependency hub.
- If `QUERY` output shifts after column edits, verify positional assumptions and quoted clauses.

## Escalation Path

- Use `sheets-read` to inventory the current formulas before replacing them.
- Use `sheets_analyze` to confirm whether sheet slowness is formula-related or data-shape-related.
- Use `sheets_formula_debug` to compare safer candidate replacements before live rollout.
- Use `sheets-write` when a safer helper-column or support-tab design should replace a brittle formula.
