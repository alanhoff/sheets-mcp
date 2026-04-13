# Array And Shaping Formulas

## Use When

- User needs spill formulas, virtual tables, pivot-like reshaping, or formula-only data pipelines.
- Task depends on filtering, sorting, stacking, slicing, or row/column transforms.
- Problem is about how array-returning formulas compose.

## Avoid When

- A persistent helper table or write step would be clearer than one giant formula.
- User only needs one scalar lookup or simple arithmetic expression.
- Debugging needs execution evidence more than formula selection.

## High-Yield Formulas Or Patterns

```gs
=FILTER(A2:F, A2:A<>"")
=SORT(UNIQUE(A2:A), 1, TRUE)
=LET(src, FILTER(A2:F, A2:A<>""), CHOOSECOLS(src, 1, 3, 5))
=LET(src, FILTER(A2:F, A2:A<>""), SORT(CHOOSECOLS(src, 1, 3, 5), 2, FALSE))
=HSTACK(A2:A, C2:C, F2:F)
=VSTACK(Header!A1:F1, FILTER(Data!A2:F, Data!A2:A<>""))
=TOCOL(B2:D, 1)
=WRAPROWS(TOCOL(B2:D, 1), 3)
=MAP(A2:A, B2:B, LAMBDA(a, b, a & "-" & b))
=BYROW(B2:E, LAMBDA(row, SUM(row)))
=SCAN(0, B2:B, LAMBDA(acc, value, acc + value))
=REDUCE(0, FILTER(B2:B, B2:B<>""), LAMBDA(acc, value, acc + value))
```

- Use `FILTER`, `SORT`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, and `DROP` as first-choice shaping primitives.
- Use `HSTACK`, `VSTACK`, array literals, `TOCOL`, and `TOROW` to build virtual tables.
- Use `MAP`, `BYROW`, `BYCOL`, `SCAN`, and `REDUCE` when each element or row needs computed logic.
- Reserve `QUERY` for cases where SQL-like grouping truly improves clarity over dedicated array functions.

## Tips And Tricks

- Treat spill range shape as part of the contract: know how many rows and columns each stage returns.
- Wrap expensive intermediate arrays in `LET` so the same expression is not recomputed.
- Use `TAKE` and `DROP` to trim staged arrays before downstream functions consume them.
- Prefer multi-stage `LET` pipelines over unreadable nested calls when shaping gets complex.

## Common Pitfalls

- Spill collisions from occupied cells below or beside the target.
- Mixing row-oriented and column-oriented ranges in one `FILTER`.
- Overusing `ARRAYFORMULA` when newer spill functions already return arrays naturally.
- Building one huge pipeline when a helper column or support tab would be easier to inspect.
- Using open-ended ranges with expensive transforms on very large sheets.

## Debugging Clues

- If a spill formula works in isolation but not in-sheet, inspect adjacent cells for blocking content.
- If a stage returns the wrong shape, test that stage alone with `LET` or a scratch cell.
- If row counts disagree, compare the filtered source range and every predicate range length.
- If a `MAP` or `BYROW` result looks wrong, verify lambda inputs match the intended array shape.

## Escalation Path

- Use `sheets-read` to inspect stored formulas and current spill neighborhoods.
- Use `sheets_analyze` when shaping logic depends on source cleanliness or duplicate keys.
- Use `sheets_formula_debug` when comparing candidate array pipelines or isolating one broken stage.
- Use `sheets-write` when a helper tab or persistent reshaped output should replace a formula-only pipeline.
