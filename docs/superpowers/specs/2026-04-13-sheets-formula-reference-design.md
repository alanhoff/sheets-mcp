# Google Sheets Formula Reference Design

Date: 2026-04-13
Status: Approved design
Scope: `skills/` support-doc expansion only

## Summary

Expand `sheets-references` with a formula-focused doctrine set that gives AI agents a complete, discoverable, high-signal reference for Google Sheets formulas. Keep existing main skill boundaries intact. Do not add a new top-level skill. Make formula guidance reachable from the current support skill, visible from the main skills, and consistent with repo documentation.

## Goals

- Create a complete formula reference for:
  - common formulas agents reach for first
  - tips and tricks that reduce brittle spreadsheet logic
  - virtual-table joins and shaping patterns
  - debugging clues and failure triage
  - pitfalls and anti-patterns
  - formulas and patterns that should usually be avoided
- Preserve current skill surface:
  - `sheets-read`
  - `sheets-write`
  - `sheets-diagnose`
  - `sheets-references`
- Improve discoverability without adding top-level skill sprawl.
- Assert repository skill validity through documentation consistency and repo-level verification.

## Non-Goals

- Do not create a new top-level skill such as `sheets-formulas`.
- Do not change runtime tool behavior.
- Do not turn the reference into a generic human tutorial disconnected from repo tools.
- Do not duplicate all formula-debug content already covered well elsewhere without adding routing value.

## Current State

- Formula guidance exists, but mostly as compact troubleshooting doctrine in `skills/sheets-references/references/formula-debugging-playbooks.md`.
- Main skills route by task intent, not by formula family.
- Support skill already acts as doctrine library for deeper guidance.
- `README.md` documents the skill pack and current top-level entrypoints.

## Design Principles

- Agents first: optimize for routing and action, not textbook completeness for its own sake.
- Smallest relevant load: agents should load one focused reference file, not entire library.
- Task-first routing: reference must say when to read, diagnose, debug, or avoid rewriting formulas.
- Boundary integrity: main skills remain entrypoints; formula docs remain support doctrine.
- High-signal examples: show patterns compactly, with reasons and failure modes.

## Proposed File Layout

Keep top-level skill set unchanged. Add formula doctrine files under `skills/sheets-references/references/`.

New files:

- `skills/sheets-references/references/formulas-index.md`
- `skills/sheets-references/references/formulas-lookup-and-joins.md`
- `skills/sheets-references/references/formulas-arrays-and-shaping.md`
- `skills/sheets-references/references/formulas-text-date-cleanup.md`
- `skills/sheets-references/references/formulas-pitfalls-and-anti-patterns.md`

Updated files:

- `skills/sheets-references/SKILL.md`
- `skills/sheets-diagnose/SKILL.md`
- `skills/sheets-read/SKILL.md`
- `README.md`

Optional update, only if short-description drift appears after edits:

- `skills/sheets-references/agents/openai.yaml`

## Content Model

### 1. `formulas-index.md`

Purpose: landing page for formula doctrine.

Must include:

- when to load each deeper formula file
- quick routing for common asks:
  - lookups
  - joins
  - virtual tables
  - array pipelines
  - cleanup/coercion
  - aggregation
  - anti-pattern review
  - debugging
- escalation rules:
  - when `sheets-read` is enough
  - when to use `sheets_analyze`
  - when to use `sheets_formula_debug`
  - when not to rewrite formula until data assumptions are checked

### 2. `formulas-lookup-and-joins.md`

Purpose: lookup logic and table-join patterns.

Must include:

- `XLOOKUP`
- `INDEX` + `MATCH`
- `XMATCH`
- `FILTER`-based joins
- `QUERY` as join helper, with limits
- array-literal virtual tables such as `{A:A, B:B}` and shaped variants
- `HSTACK` and `VSTACK` where they improve join setup
- key normalization patterns using `TRIM`, `CLEAN`, `SUBSTITUTE`, `TEXT`, coercion
- duplicate/null/mixed-type pitfalls
- when `VLOOKUP` is legacy-only and should not be first choice

### 3. `formulas-arrays-and-shaping.md`

Purpose: spill-aware transformation and virtual-table construction.

Must include:

- `ARRAYFORMULA`
- `FILTER`
- `SORT`
- `SORTN`
- `UNIQUE`
- `CHOOSECOLS`
- `CHOOSEROWS`
- `TAKE`
- `DROP`
- `TOCOL`
- `TOROW`
- `WRAPROWS`
- `WRAPCOLS`
- `HSTACK`
- `VSTACK`
- `MAP`
- `BYROW`
- `BYCOL`
- `SCAN`
- `REDUCE`
- `MAKEARRAY`

Must explain:

- spill behavior
- array shape mismatches
- helper-column vs single-cell pipeline tradeoffs
- pivot-like shaping without writes
- when `QUERY` is useful vs when dedicated functions are clearer

### 4. `formulas-text-date-cleanup.md`

Purpose: cleanup, coercion, and readability patterns that stabilize formulas.

Must include:

- `LET`
- `IFERROR`
- `IFNA`
- `TEXT`
- `TEXTJOIN`
- `SPLIT`
- `REGEXEXTRACT`
- `REGEXREPLACE`
- `REGEXMATCH`
- `TRIM`
- `CLEAN`
- `SUBSTITUTE`
- date coercion and locale-sensitive parsing patterns
- numeric/text normalization patterns

Must explain:

- non-breaking space pitfalls
- locale-sensitive separators and date parsing
- when `LET` improves maintainability
- when broad `IFERROR` masks real defects

### 5. `formulas-pitfalls-and-anti-patterns.md`

Purpose: cautionary reference for brittle or costly patterns.

Must include:

- volatile functions:
  - `NOW`
  - `TODAY`
  - `RAND`
  - `RANDBETWEEN`
- `INDIRECT`
- `OFFSET`
- open-ended whole-column patterns when expensive
- deep nested `IF`
- unreadable monster formulas
- brittle `QUERY` strings
- `IMPORTRANGE` chains
- legacy-first `VLOOKUP`
- premature single-cell cleverness when helper columns are clearer

Must explain:

- why each pattern causes maintenance, performance, freshness, or debugging pain
- acceptable exceptions, if any
- safer replacements or mitigation patterns

## Reference Shape Requirements

Each formula reference file should keep a stable structure:

1. Use when
2. Avoid when
3. High-yield formulas or patterns
4. Tips and tricks
5. Common pitfalls
6. Debugging clues
7. Escalation path to repo tools

Reason: keeps documents scannable and predictable for agents.

## Discoverability Plan

### `skills/sheets-references/SKILL.md`

- Add formula docs to reference index table.
- Add one-line “load when” guidance for each formula file.
- Make `formulas-index.md` default first load for formula-heavy requests.

### `skills/sheets-diagnose/SKILL.md`

- Deep-link formula docs where users need diagnosis context:
  - lookup/join issues
  - array/spill issues
  - cleanup/coercion issues
  - anti-pattern review before rewrite
- Keep existing formula-debug playbook link. Do not replace it.

### `skills/sheets-read/SKILL.md`

- Add deep-links for formula inventory and formula-text inspection tasks.
- Clarify when read-only formula inspection should stay in `sheets_read_values` with `FORMULA` render mode before escalating to diagnose.

### `README.md`

- Update support-skill section to mention formula doctrine explicitly.
- Keep wording consistent with support-only boundary: no new main skill.

## Validity Assertions

“All skills are valid” means:

- every `SKILL.md` keeps valid frontmatter shape
- every relative path referenced from a skill doc exists
- every new formula file is reachable from at least one skill doc
- discoverability docs match actual repo structure
- no top-level skill descriptions contradict file boundaries
- repo verification still passes after doc updates

This design does not claim runtime invocation proof for external installers or third-party environments. It asserts repository-level validity and internal consistency.

## Verification Plan

Run after implementation:

1. Targeted graph checks
   - grep for `formulas-` references from updated skill docs
   - verify every referenced file exists
   - verify no broken relative links in edited skill docs
2. Repo checks
   - `npm test`
3. Manual spot review
   - confirm `README.md` skill table/support section matches actual layout
   - confirm main skills still route to support docs instead of becoming formula encyclopedias

## Risks

- Reference duplication may drift if formula-debugging guidance is copied instead of linked.
- Too much human-style tutorial content may make reference harder for agents to scan.
- Overusing `QUERY` examples may imply it is default answer for every shaping task.
- Anti-pattern section may become dogmatic if it does not explain tradeoffs and exceptions.

## Mitigations

- Link to `formula-debugging-playbooks.md` instead of duplicating troubleshooting prose.
- Keep examples compact and operational.
- Pair every “avoid” rule with reason and safer alternative.
- Keep reference split by intent so agents load only needed file.

## Acceptance Criteria

- New formula doctrine files exist under `skills/sheets-references/references/`.
- `sheets-references/SKILL.md` indexes them with clear “load when” guidance.
- `sheets-read/SKILL.md` and `sheets-diagnose/SKILL.md` contain targeted deep-links to relevant formula docs.
- `README.md` mentions formula doctrine under support-skill discoverability.
- No new top-level skill is introduced.
- Existing skill boundaries remain intact.
- Relative links are valid.
- `npm test` passes.

## Open Decisions Already Resolved

- No new top-level formula skill.
- Audience is agents first.
- Validation target is repo-level proof, not external install smoke.
- Discoverability should come from support-skill indexing plus deep-links from main skills.
