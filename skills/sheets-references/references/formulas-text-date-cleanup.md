# Text Date And Cleanup Formulas

## Use When

- Keys need normalization before lookup, join, or dedupe.
- Task involves regex extraction, cleanup, coercion, formatting, or locale-sensitive date handling.
- Formula readability is degrading and `LET` would stabilize repeated expressions.

## Avoid When

- User only needs sheet-level validation or profiling first.
- Cleanup should happen as a durable write step instead of inside every formula.
- Broad error suppression would hide defects the user needs to see.

## High-Yield Formulas Or Patterns

```gs
=LET(clean_key, TRIM(SUBSTITUTE(CLEAN(A2), CHAR(160), " ")), clean_key)
=IFNA(XLOOKUP(A2, Ref!A:A, Ref!B:B), "missing")
=TEXTJOIN(", ", TRUE, FILTER(B2:B, B2:B<>""))
=SPLIT(A2, "|")
=REGEXEXTRACT(A2, "([A-Z]{3})-(\\d+)")
=REGEXREPLACE(A2, "[^0-9]", "")
=REGEXMATCH(A2, "^[A-Z]{2}\\d{6}$")
=VALUE(SUBSTITUTE(A2, ",", ""))
=DATEVALUE(TEXT(A2, "yyyy-mm-dd"))
=LET(raw, TRIM(SUBSTITUTE(CLEAN(A2), CHAR(160), " ")), IF(raw="", "", raw))
```

- Use `LET` to name cleanup stages once and reuse them safely.
- Prefer `IFNA` over blanket `IFERROR` when only missing-lookup cases should be masked.
- Use `TEXTJOIN` and `SPLIT` for compact list assembly and tokenization.
- Use regex functions for structured extraction instead of brittle `LEFT`/`MID` chains when patterns are explicit.

## Tips And Tricks

- Normalize non-breaking spaces with `SUBSTITUTE(text, CHAR(160), " ")` before `TRIM`.
- Keep locale-sensitive number and date coercion explicit; display formatting and stored values are not same thing.
- If text numbers are inconsistent, normalize once in `LET` and reuse the normalized result everywhere.
- Prefer narrow `IFERROR(expression, fallback)` only when fallback is truly intended for every failure mode.

## Common Pitfalls

- Assuming `TRIM` removes non-breaking spaces. It does not.
- Hiding malformed formulas or bad references with broad `IFERROR`.
- Relying on display format instead of stable numeric/date values.
- Forgetting that separators, decimal conventions, and date parsing vary by locale.

## Debugging Clues

- If cleaned text still does not match, compare `LEN()` before and after normalization to expose hidden characters.
- If a date formula behaves inconsistently, inspect locale and whether the source is text or a serial number.
- If regex extraction fails, test the pattern against one known-good and one known-bad sample before broad rollout.
- If lookups succeed only after manual edit, suspect hidden whitespace or coercion drift.

## Escalation Path

- Use `sheets-read` for raw formula text and unformatted value inspection.
- Use `sheets_analyze` when cleanup issues reflect broader mixed-type or null-heavy source columns.
- Use `sheets_formula_debug` for candidate cleanup formulas or coercion experiments.
- Use `sheets-write` when cleanup should become a durable helper column or sheet rewrite.
