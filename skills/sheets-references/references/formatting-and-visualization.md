# Formatting And Visualization

## Routing Rules

- Use `sheets_style` for:
  - borders
  - merges
  - banding
  - conditional formatting
  - auto-resize
  - style-oriented sheet properties
- Use `sheets_edit` for:
  - values and formulas that feed a report
  - advanced raw `spreadsheets.batchUpdate` request families not covered by `sheets_style`
  - structural edits that support a dashboard or report layout

## Conditional Formatting Playbook

- Custom formulas can format one or more cells based on other cells.
- Conditional-format custom formulas can only reference the same sheet directly; cross-sheet logic needs an indirection pattern.
- Rules are evaluated in listed order.
- Common high-signal uses:
  - duplicate highlighting
  - threshold alerts
  - full-row status highlighting
  - color scales for numeric ranges

## Report-Tab Playbook

1. Write or refresh the source values and formulas.
2. Apply number formats, headers, and emphasis.
3. Add conditional formatting or banding.
4. Auto-resize for readability.
5. Verify the exact target ranges.

## Dashboard-Source Playbook

- Clean headers first.
- Ensure numeric columns are truly numeric before visual emphasis or summary layers.
- Keep source ranges stable before layering visuals on top.

## Pivot-Friendly Guidance

- Pivot-style source data should have one header row.
- If the source table shape is weak, fix the data before building the summary layer.
- When a pivot-like summary behaves oddly, inspect the source headers, blanks, and numeric typing first.

## Safety Rules

- Scope formatting requests to the narrowest range possible.
- Preserve request order intentionally.
- Prefer dry-runs for complex visual or advanced structural request specs.
