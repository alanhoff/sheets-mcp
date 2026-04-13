# Sheets MCP

MCP server for Google Sheets. It exposes a focused set of tools for metadata reads, value reads, grid inspection, data-quality analysis, formula debugging, batched edits, and styling.

## Requirements

- Node.js `>=22.0.0`
- A Google Cloud project with the Sheets API enabled
- OAuth client credentials (`key.json`)

## Google Cloud Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or select an existing one).

2. Enable the **Google Sheets API**:
   - Navigate to **APIs & Services → Library**
   - Search for "Google Sheets API"
   - Click **Enable**

3. Configure the **OAuth consent screen**:
   - Navigate to **APIs & Services → OAuth consent screen**
   - Select **External** user type (or Internal if using Google Workspace)
   - Fill in the required fields (app name, user support email, developer contact)
   - Add the scope `https://www.googleapis.com/auth/spreadsheets`
   - Add your Google account as a test user (required while the app is in "Testing" status)

4. Create **OAuth client credentials**:
   - Navigate to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth client ID**
   - Choose **Desktop app** (recommended) or **Web application**
   - Click **Create**, then **Download JSON**

5. Place the downloaded JSON file at the default credentials path for your platform:

   | Platform | Default path |
   |----------|-------------|
   | Linux | `~/.config/sheets-mcp/key.json` |
   | macOS | `~/Library/Application Support/sheets-mcp/key.json` |
   | Windows | `%APPDATA%\sheets-mcp\key.json` |

   Create the directory if it doesn't exist:

   ```bash
   # Linux
   mkdir -p ~/.config/sheets-mcp && mv ~/Downloads/client_secret_*.json ~/.config/sheets-mcp/key.json

   # macOS
   mkdir -p ~/Library/Application\ Support/sheets-mcp && mv ~/Downloads/client_secret_*.json ~/Library/Application\ Support/sheets-mcp/key.json
   ```

The credentials file should have either an `installed` or `web` root key — both are auto-detected:

**Desktop app** (recommended):
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "project_id": "YOUR_PROJECT_ID",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "redirect_uris": ["http://localhost"]
  }
}
```

**Web application**:
```json
{
  "web": {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "project_id": "YOUR_PROJECT_ID",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "redirect_uris": ["YOUR_REDIRECT_URI"]
  }
}
```

You can override the credentials path with `--credentials`:

```bash
npx github:alanhoff/sheets-mcp --credentials /path/to/key.json
```

## Authentication

Run the OAuth bootstrap once (or whenever tokens expire and cannot refresh):

```bash
npx github:alanhoff/sheets-mcp auth
```

This will:
1. Print a consent URL for you to open in a browser
2. Ask you to authorize access to your Google Sheets
3. Prompt you to paste the redirect URL (containing `code=...`)
4. Exchange the code for tokens and persist them to the credentials file

To use a custom credentials path with auth:

```bash
npx github:alanhoff/sheets-mcp auth --credentials /path/to/key.json
```

## MCP Client Config

### Claude Desktop

```json
{
  "mcpServers": {
    "sheets": {
      "command": "npx",
      "args": ["github:alanhoff/sheets-mcp"]
    }
  }
}
```

### Claude Code

```json
{
  "mcpServers": {
    "sheets": {
      "command": "npx",
      "args": ["github:alanhoff/sheets-mcp"]
    }
  }
}
```

### Cursor / VS Code

```json
{
  "mcpServers": {
    "sheets": {
      "command": "npx",
      "args": ["github:alanhoff/sheets-mcp"]
    }
  }
}
```

To use a custom credentials path in your MCP config:

```json
{
  "mcpServers": {
    "sheets": {
      "command": "npx",
      "args": ["github:alanhoff/sheets-mcp", "--credentials", "/path/to/key.json"]
    }
  }
}
```

## Tool Surface

This server registers 7 tools:

- `sheets_get`: Read spreadsheet metadata via `spreadsheets.get`.
- `sheets_read_values`: Batch-read one or many value ranges via `spreadsheets.values.batchGet`.
- `sheets_read_grid`: Read grid-level data (formulas, notes, formats, merges) via `spreadsheets.get`.
- `sheets_analyze`: Profile ranges (null ratios, inferred types, duplicate keys, outlier hints, optional formula map).
- `sheets_formula_debug`: Validate one or many formulas with optional setup/cleanup ranges.
- `sheets_edit`: Perform batched updates/appends/clears/structural requests with optional dry-run.
- `sheets_style`: Apply ordered style-focused `spreadsheets.batchUpdate` requests with optional dry-run.

## Reliability and Throughput Behavior

- Retries: transient Google API failures are retried with exponential backoff + jitter.
- Retryable statuses: `429`, `500`, `502`, `503`, `504`.
- Max attempts: `4` (default).
- `Retry-After` headers are respected when present.

- Rate limiting is lane-based:
- Read lane defaults: `maxConcurrent=4`, `tokensPerInterval=20`, `intervalMs=1000`, `burst=20`.
- Write lane defaults: `maxConcurrent=2`, `tokensPerInterval=10`, `intervalMs=1000`, `burst=10`.

You can tune rate limits with environment variables:

- `SHEETS_RATE_LIMIT_READ_MAX_CONCURRENCY`
- `SHEETS_RATE_LIMIT_READ_TOKENS_PER_INTERVAL`
- `SHEETS_RATE_LIMIT_READ_INTERVAL_MS`
- `SHEETS_RATE_LIMIT_READ_BURST`
- `SHEETS_RATE_LIMIT_WRITE_MAX_CONCURRENCY`
- `SHEETS_RATE_LIMIT_WRITE_TOKENS_PER_INTERVAL`
- `SHEETS_RATE_LIMIT_WRITE_INTERVAL_MS`
- `SHEETS_RATE_LIMIT_WRITE_BURST`

## Skills

This repository ships AI agent skills in the `skills/` directory. Install them with:

```bash
npx skills add github:alanhoff/sheets-mcp
```

### Main Skills

Use one of these three domain skills as the normal entrypoint:

| Skill | Covers | Use when |
|---|---|---|
| `sheets-read` | `sheets_get`, `sheets_read_values`, `sheets_read_grid` | Reading spreadsheet metadata, values, formulas, notes, merges, or formatting structures |
| `sheets-diagnose` | `sheets_analyze`, `sheets_formula_debug` | Profiling data quality or debugging formulas |
| `sheets-write` | `sheets_edit`, `sheets_style` | Changing data, structure, or formatting |

### Support Skill

- `sheets-references` — shared reference library for tool boundaries, request shaping, retries, mutation safety, formula doctrine, and failure handling

Start with a main skill for the user task. Load `sheets-references` only when you need deeper cross-cutting guidance, including formula doctrine for joins, spill shaping, cleanup, or anti-pattern review.

## Development

- Run lint + typecheck + tests:

```bash
npm test
```

- Apply lint fixes:

```bash
npm run fix
```

## Notes

- Keep `key.json` out of commits; it contains OAuth client secrets and tokens.
- Prefer `dry_run=true` when using `sheets_edit` or `sheets_style` in automation before applying live mutations.
