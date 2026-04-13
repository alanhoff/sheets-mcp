# Performance And Scale

## API Efficiency

- Use field masks on `spreadsheets.get` to return only what is needed.
- Batch related updates together when they naturally belong in one request.
- Use explicit A1 ranges and avoid whole-sheet reads unless they are truly required.
- Limit the use of `includeGridData` on large spreadsheets.
- Keep payloads moderate and split oversized work into smaller slices.
- Heavy or complex spreadsheets benefit from serialized access rather than many overlapping requests.

## Spreadsheet Design Realities

- Large spreadsheets with many complex formulas are more likely to hit latency and `503` pressure.
- Google explicitly calls out `IMPORTRANGE`, `QUERY`, and other complex formulas as contributors to spreadsheet complexity pressure.
- Limit chains of `IMPORTRANGE`.
- Summarize at the source before importing large datasets into another sheet.
- Consider splitting very large workflows across multiple spreadsheets instead of concentrating everything in one file.

## Skill-Specific Guidance

### Reads

- Use `sheets_get` plus `fields` for reconnaissance.
- Use `sheets_read_values` instead of `sheets_read_grid` whenever notes / merges / formats are not required.
- Use `FORMULA` reads rather than grid reads when formula text alone is enough.

### Diagnose

- Use `sheets_analyze` before formula debug when the issue may be data shape or key quality.
- Keep formula maps and sample sizes small unless there is a clear reason to widen them.
- Debug import formulas with attention to access, freshness, and import-chain depth.

### Writes

- Prefer dry-runs for advanced or high-impact changes.
- Apply data and formulas first, then style.
- Verify complex writes with a targeted read-back.

## `IMPORTRANGE` Specific Guidance

- First-use access prompts can surface as `#REF!`.
- Chains of imports create cascading reloads and long freshness delays.
- Imported ranges are capped at 10 MB per request.
- Import formulas cannot directly or indirectly depend on `NOW`, `RAND`, or `RANDBETWEEN`.
