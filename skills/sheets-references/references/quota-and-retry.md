# Quota And Retry

## Built-In Behavior

- Every Sheets API operation runs through a shared request executor.
- Read-only operations use the `read` lane.
- Mutating operations use the `write` lane.
- `sheets_formula_debug` uses both because it writes setup cells and reads results.
- `Retry-After` is respected when present.
- Backoff is exponential with jitter.

## Repository Defaults

- Read lane defaults:
  - `maxConcurrent=4`
  - `tokensPerInterval=20`
  - `intervalMs=1000`
  - `burst=20`
- Write lane defaults:
  - `maxConcurrent=2`
  - `tokensPerInterval=10`
  - `intervalMs=1000`
  - `burst=10`

## Google Sheets API Facts To Respect

- Sheets API quotas are per minute, not per day burstless.
- The public default quota guidance is:
  - read requests: 300 / minute / project, 60 / minute / user / project
  - write requests: 300 / minute / project, 60 / minute / user / project
- Google recommends keeping request payloads around 2 MB or less when practical.
- Google may time out requests that take longer than 180 seconds to process.
- Each batch request still counts as one API request toward usage limits.
- Google explicitly recommends limiting concurrent requests to a large or complex spreadsheet to about 1 request per second when trying to reduce `503` errors.

## Retry Policy

- Retryable statuses: `429`, `500`, `502`, `503`, `504`
- Do not blind-retry invalid requests.
- Do not blind-retry auth or permission failures.
- Reduce request volume before retrying broad failure patterns.

## Operational Guidance

- Prefer fewer larger batches over many small calls.
- Use A1 ranges and field masks to keep reads narrow.
- Avoid repeated `includeGridData` reads against large sheets.
- For one hot spreadsheet, serialize heavy work instead of fanning out concurrent requests.
- If a request repeatedly hits size or timeout pressure, split the work into smaller targeted slices.
