# Error Taxonomy

## Shared API Classes

- `AUTH_ERROR`
  - Typical causes: expired auth, missing permissions, forbidden spreadsheet access
  - Response: surface to user; do not blind-retry

- `RATE_LIMITED`
  - Typical cause: quota throttling (`429`)
  - Response: reduce volume, batch harder, allow retry policy to work

- `NOT_FOUND`
  - Typical causes: wrong spreadsheet ID, wrong range, deleted resource
  - Response: fix identifier or path

- `INVALID_INPUT`
  - Typical causes: bad request shape, invalid field mask, invalid ranges
  - Response: fix request before retry

- `TRANSIENT_ERROR`
  - Typical causes: `500`, `502`, `503`, `504`
  - Response: retryable

- `UNKNOWN_ERROR`
  - Response: inspect raw message and failing request context

## Formula Debug Classification

- `PARSE_ERROR`
  - Meaning: Sheets reported `errorType="ERROR"`
  - Typical causes: malformed syntax, bad function spelling, broken expression structure

- `EVALUATION_ERROR`
  - Meaning: formula parsed, but failed during execution
  - Typical causes: `REF`, `VALUE`, `DIV_ZERO`, `NAME`, `N_A`, `NULL`

## Important User-Facing Nuance

- A user-visible `#N/A` is not always a bug:
  - `FILTER` can return `#N/A` when no rows match.
  - `XLOOKUP` returns `#N/A` by default when no match is found.
- A `#REF!` involving `IMPORTRANGE` may mean access has not yet been granted.
- “Duplicate-looking” values may still differ because of hidden spaces or formatting.

## Operator Rules

- Fix invalid input before retry.
- Surface permission failures early.
- Prefer broad diagnostics with `sheets_analyze` before scratch writes when the issue is ambiguous.
- When the result might be a legitimate empty-match condition, inspect data assumptions before rewriting the formula.
