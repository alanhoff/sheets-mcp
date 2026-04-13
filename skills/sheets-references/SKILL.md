---
name: sheets-references
description: Shared doctrine for the Sheets skills. Use when you need deeper guidance on tool boundaries, request shaping, retries, mutation safety, performance, formula playbooks, visualization, or skill authoring. Do not start here for ordinary spreadsheet tasks; start with sheets-read, sheets-write, or sheets-diagnose.
---

# Sheets References

Use this skill as the shared doctrine library behind the main Sheets skills.

## Use When

- A main Sheets skill points here for deeper detail.
- You need cross-cutting guidance that applies to more than one Sheets tool.
- You need a compact playbook for performance, formula edge cases, visualization, or mutation safety.
- You are maintaining this skill pack and need the skill-authoring doctrine that informed it.

## Do Not Use When

- The user simply wants to read, write, or diagnose a spreadsheet task. Start with `sheets-read`, `sheets-write`, or `sheets-diagnose`.
- You already know the exact main skill and do not need deeper doctrine.

## Reference Index

| File | Load when |
|---|---|
| `references/tool-catalog.md` | You need tool boundaries, side effects, cheapest-first selection, or advanced `sheets_edit` vs `sheets_style` routing |
| `references/request-shaping.md` | You need batching, range limits, field-mask guidance, response minimization, or payload-shaping rules |
| `references/performance-and-scale.md` | You need throughput, large-sheet, import-chain, or API-efficiency guidance |
| `references/quota-and-retry.md` | You need lane behavior, quotas, retry classes, or operational pacing guidance |
| `references/mutation-safety.md` | You need dry-run discipline, sequencing, atomicity nuance, or verify-after-write guidance |
| `references/error-taxonomy.md` | You need compact failure-class guidance and operator response rules |
| `references/formula-debugging-playbooks.md` | You need high-signal playbooks for lookups, filters, arrays, `LET`, `IMPORTRANGE`, whitespace, or key-quality issues |
| `references/formatting-and-visualization.md` | You need guidance for conditional formatting, report tabs, dashboards, or advanced visual request routing |

## Loading Rules

- Load only the smallest relevant reference file.
- Prefer a single one-hop reference over chains of references.
- Return to the main skill after loading deeper doctrine.
- Keep the reference skill secondary: it is support material, not the main entrypoint.
