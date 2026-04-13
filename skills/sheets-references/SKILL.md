---
name: sheets-references
description: "Shared doctrine for the Sheets skills. Use when you need deeper guidance on tool boundaries, request shaping, retries, mutation safety, formula doctrine, visualization, performance, or skill authoring. Do not start here for ordinary spreadsheet tasks; start with sheets-read, sheets-write, or sheets-diagnose."
---

# Sheets References

Use this skill as the shared doctrine library behind the main Sheets skills.

## Use When

- A main Sheets skill points here for deeper detail.
- You need cross-cutting guidance that applies to more than one Sheets tool.
- You need compact doctrine for formula design, formula debugging, visualization, mutation safety, or operational pacing.
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
| `references/formulas-index.md` | Load first for formula-heavy requests so you can route to the right formula doctrine file quickly |
| `references/formulas-lookup-and-joins.md` | You need lookups, virtual joins, key normalization, or join-specific pitfalls |
| `references/formulas-arrays-and-shaping.md` | You need spill behavior, virtual tables, array pipelines, or formula-only reshaping |
| `references/formulas-text-date-cleanup.md` | You need text cleanup, coercion, regex, date normalization, or safer `LET` / `IFNA` usage |
| `references/formulas-pitfalls-and-anti-patterns.md` | You need to challenge volatile, brittle, slow, or unreadable formula patterns |
| `references/formula-debugging-playbooks.md` | You need high-signal playbooks for lookups, filters, arrays, `LET`, `IMPORTRANGE`, whitespace, or key-quality issues |
| `references/formatting-and-visualization.md` | You need guidance for conditional formatting, report tabs, dashboards, or advanced visual request routing |

## Loading Rules

- Load only the smallest relevant reference file.
- Load `references/formulas-index.md` first for formula-heavy requests.
- Prefer a single one-hop reference over chains of references.
- Return to the main skill after loading deeper doctrine.
- Keep the reference skill secondary: it is support material, not the main entrypoint.
