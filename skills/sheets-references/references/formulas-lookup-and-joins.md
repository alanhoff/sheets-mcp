# Lookup And Join Formulas

## Use When

- User needs exact-match lookup, left lookup, multi-column return, or multi-match retrieval.
- Task involves building virtual tables before lookup.
- Problem likely depends on duplicate keys, dirty keys, or range-shape mistakes.

## Avoid When

- User only needs broad data profiling first. Use `sheets_analyze`.
- Task is better expressed as a sheet mutation or persistent helper-column build. Use `sheets-write`.
- Request is really about parse/evaluation proof for one specific formula. Use `sheets_formula_debug`.

## High-Yield Formulas Or Patterns

```gs
=XLOOKUP(A2, Ref!A:A, Ref!C:C, "missing")
=INDEX(Ref!C:C, MATCH(A2, Ref!A:A, 0))
=FILTER(Ref!C:C, Ref!A:A=A2)
=XLOOKUP(A2&"♦"&B2, Ref!A:A&"♦"&Ref!B:B, HSTACK(Ref!C:C, Ref!D:D), "missing")
=LET(keys, ARRAYFORMULA(TRIM(SUBSTITUTE(Orders!A2:A, CHAR(160), " "))), XLOOKUP(TRIM(SUBSTITUTE(A2, CHAR(160), " ")), keys, Orders!D2:D, "missing"))
```

- Prefer `XLOOKUP` for exact-match readability and explicit fallback.
- Use `INDEX` + `MATCH` when left lookup or older-sheet compatibility matters.
- Use `FILTER` when multiple matches are expected and spill output is acceptable.
- Use `HSTACK`, `VSTACK`, or array literals such as `{Ref!A:A, Ref!C:C}` to assemble lookup tables without mutating sheet layout.
- Use `XMATCH` when you need match position first and retrieval second.

## Tips And Tricks

- Normalize keys on both lookup and reference sides with the same cleanup logic.
- Check duplicate keys before trusting a single-match lookup.
- Keep lookup range and return range shapes aligned; many “formula bugs” are actually shape bugs.
- If result should return several columns, shape the return area first instead of chaining multiple parallel lookups.

## Common Pitfalls

- `VLOOKUP` column-index brittleness after inserted columns.
- Mixed text/number keys that look identical in the UI.
- Hidden spaces, non-breaking spaces, or casing drift.
- Using open-ended full-column joins on very large sheets when narrower ranges are available.
- Forcing `QUERY` joins when a direct lookup is easier to debug.

## Debugging Clues

- Run `sheets_analyze` with `duplicate_key_columns` on both source and reference keys.
- Read the stored formulas with `value_render_option=FORMULA` to confirm the active logic.
- Compare one failing key row end-to-end before rewriting the entire lookup.
- If `XLOOKUP` returns `#N/A`, determine whether that means “no match” or dirty key mismatch.

## Escalation Path

- Use `sheets-read` to inspect referenced ranges and stored formulas.
- Use `sheets_analyze` for duplicates, nulls, and mixed-type evidence.
- Use `sheets_formula_debug` to compare candidate lookup formulas side by side.
- Use `sheets-write` only after join logic is settled and needs to be applied live.
