# Sheets Formula Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `sheets-references` with a complete Google Sheets formula doctrine bundle, wire discoverability from the existing skill entrypoints, and add automated repo-level checks that assert the shipped skill docs stay valid.

**Architecture:** Add one small TypeScript helper plus one Node test file under `src/skills/` so the repository can validate skill frontmatter, metadata, and relative doc links. Then add five focused formula reference markdown files under `skills/sheets-references/references/`, wire them into `sheets-references`, add targeted deep-links from `sheets-read` and `sheets-diagnose`, and update `README.md` so the new doctrine is discoverable without introducing a new top-level skill.

**Tech Stack:** TypeScript, Node test runner, Markdown skill docs, YAML metadata, Biome, npm test

---

## File Structure

- Create: `src/skills/skill-docs.ts`
  Responsibility: repo-local helpers for reading skill docs, extracting frontmatter, resolving relative references, and locating skill directories.
- Create: `src/skills/skill-docs.test.ts`
  Responsibility: automated assertions that the repository ships structurally valid skills and that the new formula doctrine bundle stays discoverable.
- Create: `skills/sheets-references/references/formulas-index.md`
  Responsibility: formula doctrine landing page and routing table.
- Create: `skills/sheets-references/references/formulas-lookup-and-joins.md`
  Responsibility: lookup, join, virtual table, and key-normalization guidance.
- Create: `skills/sheets-references/references/formulas-arrays-and-shaping.md`
  Responsibility: spill-aware reshaping, virtual tables, and array pipeline patterns.
- Create: `skills/sheets-references/references/formulas-text-date-cleanup.md`
  Responsibility: coercion, cleanup, readability, regex, and locale-sensitive patterns.
- Create: `skills/sheets-references/references/formulas-pitfalls-and-anti-patterns.md`
  Responsibility: formulas and patterns agents should avoid by default, plus safer replacements.
- Modify: `skills/sheets-references/SKILL.md:1-40`
  Responsibility: index the formula docs and keep support-skill boundary explicit.
- Modify: `skills/sheets-read/SKILL.md:52-82,267-271`
  Responsibility: point formula inventory and read-only inspection workflows at the new doctrine.
- Modify: `skills/sheets-diagnose/SKILL.md:51-95,250-254`
  Responsibility: point diagnosis flows at the new doctrine without replacing the debug playbooks.
- Modify: `README.md:197-219`
  Responsibility: expose formula doctrine in the support-skill section while keeping three top-level main skills.

## Task 1: Add Baseline Skill-Doc Validation Harness

**Files:**
- Create: `src/skills/skill-docs.ts`
- Create: `src/skills/skill-docs.test.ts`
- Test: `src/skills/skill-docs.test.ts`

- [ ] **Step 1: Write the failing test that expects a reusable skill-doc helper module**

Create `src/skills/skill-docs.test.ts` with this exact content:

```ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { describe, it } from "node:test";
import {
  extractFrontmatter,
  listSkillDirs,
  readRepoText,
  repoPath,
  resolveRelativeDocRef,
  skillRelativeDocRefs,
} from "#skills/skill-docs.ts";

const EXPECTED_SKILLS = [
  "skills/sheets-diagnose",
  "skills/sheets-read",
  "skills/sheets-references",
  "skills/sheets-write",
] as const;

describe("skill docs", () => {
  it("ships exactly the expected top-level skill directories", () => {
    assert.deepEqual(listSkillDirs(), [...EXPECTED_SKILLS]);
  });

  it("gives every skill valid frontmatter and an H1 heading", () => {
    for (const skillDir of EXPECTED_SKILLS) {
      const skillDoc = readRepoText(`${skillDir}/SKILL.md`);
      const frontmatter = extractFrontmatter(skillDoc);
      const expectedName = basename(skillDir);

      assert.match(frontmatter, new RegExp(`^name:\\s*${expectedName}$`, "m"));
      assert.match(frontmatter, /^description:\s*".+"$/m);
      assert.match(skillDoc, /^# .+$/m);
    }
  });

  it("ships OpenAI agent metadata for every skill", () => {
    for (const skillDir of EXPECTED_SKILLS) {
      const relPath = `${skillDir}/agents/openai.yaml`;
      assert.ok(existsSync(repoPath(relPath)), `missing ${relPath}`);

      const yaml = readRepoText(relPath);
      assert.match(yaml, /^interface:\s*$/m);
      assert.match(yaml, /^\s+display_name:\s*".+"$/m);
      assert.match(yaml, /^\s+short_description:\s*".+"$/m);
    }
  });

  it("resolves every relative markdown reference mentioned by a skill doc", () => {
    for (const skillDir of EXPECTED_SKILLS) {
      const skillDoc = readRepoText(`${skillDir}/SKILL.md`);
      for (const relRef of skillRelativeDocRefs(skillDoc)) {
        const absolutePath = resolveRelativeDocRef(skillDir, relRef);
        assert.ok(existsSync(absolutePath), `${skillDir} references missing file ${relRef}`);
      }
    }
  });
});
```

- [ ] **Step 2: Run the targeted test and verify it fails because the helper module does not exist yet**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: FAIL with an import or module-resolution error for `#skills/skill-docs.ts`.

- [ ] **Step 3: Implement the helper module with repo-path, frontmatter, and reference-resolution utilities**

Create `src/skills/skill-docs.ts` with this exact content:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

export function repoPath(relPath: string) {
  return join(REPO_ROOT, relPath);
}

export function readRepoText(relPath: string) {
  return readFileSync(repoPath(relPath), "utf8");
}

export function extractFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]+?)\n---\n/);
  if (!match) {
    throw new Error("expected YAML frontmatter block");
  }

  return match[1];
}

export function listSkillDirs() {
  return readdirSync(repoPath("skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `skills/${entry.name}`)
    .sort();
}

export function skillRelativeDocRefs(markdown: string) {
  return Array.from(
    markdown.matchAll(/`((?:\.\.\/|\.\/|references\/)[^`\n]+?\.(?:md|yaml))`/g),
    (match) => match[1],
  );
}

export function resolveRelativeDocRef(skillDir: string, relRef: string) {
  return resolve(repoPath(skillDir), relRef);
}
```

- [ ] **Step 4: Run the targeted test and verify the baseline validator passes**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: PASS with 4 passing subtests and zero failures.

- [ ] **Step 5: Commit the validation harness**

Run:

```bash
git add src/skills/skill-docs.ts src/skills/skill-docs.test.ts
git commit -m "test: add skill doc validation harness"
```

Expected: commit succeeds and only adds the helper plus baseline test.

## Task 2: Add Formula Doctrine Bundle Under `sheets-references`

**Files:**
- Modify: `src/skills/skill-docs.test.ts`
- Create: `skills/sheets-references/references/formulas-index.md`
- Create: `skills/sheets-references/references/formulas-lookup-and-joins.md`
- Create: `skills/sheets-references/references/formulas-arrays-and-shaping.md`
- Create: `skills/sheets-references/references/formulas-text-date-cleanup.md`
- Create: `skills/sheets-references/references/formulas-pitfalls-and-anti-patterns.md`
- Test: `src/skills/skill-docs.test.ts`

- [ ] **Step 1: Extend the validator so the new formula bundle becomes a hard requirement**

Append this block near the top of `src/skills/skill-docs.test.ts`, directly below `EXPECTED_SKILLS`:

```ts
const FORMULA_DOCS = [
  "skills/sheets-references/references/formulas-index.md",
  "skills/sheets-references/references/formulas-lookup-and-joins.md",
  "skills/sheets-references/references/formulas-arrays-and-shaping.md",
  "skills/sheets-references/references/formulas-text-date-cleanup.md",
  "skills/sheets-references/references/formulas-pitfalls-and-anti-patterns.md",
] as const;

const REQUIRED_FORMULA_HEADINGS = [
  "## Use When",
  "## Avoid When",
  "## High-Yield Formulas Or Patterns",
  "## Tips And Tricks",
  "## Common Pitfalls",
  "## Debugging Clues",
  "## Escalation Path",
] as const;
```

Append this new test at the bottom of the `describe("skill docs", ...)` block:

```ts
  it("ships the formula doctrine bundle with stable section headings", () => {
    for (const relPath of FORMULA_DOCS) {
      const markdown = readRepoText(relPath);
      assert.match(markdown, /^# .+$/m, `${relPath} needs an H1`);

      for (const heading of REQUIRED_FORMULA_HEADINGS) {
        assert.match(markdown, new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
      }
    }

    const indexDoc = readRepoText("skills/sheets-references/references/formulas-index.md");
    for (const relPath of FORMULA_DOCS.slice(1)) {
      assert.match(indexDoc, new RegExp(relPath.split("/").at(-1)!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
```

- [ ] **Step 2: Run the targeted test and verify it fails because the formula files do not exist yet**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: FAIL with missing-file errors for `skills/sheets-references/references/formulas-index.md` and the other new formula docs.

- [ ] **Step 3: Create `formulas-index.md` and `formulas-lookup-and-joins.md` with concrete routing and join guidance**

Create `skills/sheets-references/references/formulas-index.md` with this exact content:

````md
# Formula Doctrine Index

## Use When

- User asks which Google Sheets formula family to use.
- Task involves lookups, joins, virtual tables, spill pipelines, cleanup, or anti-pattern review.
- Main skill needs deeper formula doctrine before proposing a read, diagnose, or write step.

## Avoid When

- User only needs ordinary metadata or value reads already covered by `sheets-read`.
- User already needs live mutation more than formula selection. Route to `sheets-write`.
- User already has a narrow failing candidate formula and execution proof is next. Route to `sheets_formula_debug`.

## High-Yield Formulas Or Patterns

- Lookup and join requests: load `formulas-lookup-and-joins.md`.
- Spill reshaping or virtual-table construction: load `formulas-arrays-and-shaping.md`.
- Text cleanup, type coercion, regex, or locale cleanup: load `formulas-text-date-cleanup.md`.
- Performance, brittleness, and “should we avoid this?” questions: load `formulas-pitfalls-and-anti-patterns.md`.
- Parse-vs-evaluation debugging: pair this index with `formula-debugging-playbooks.md`.

## Tips And Tricks

- Read formula text first with `sheets_read_values` using `value_render_option=FORMULA` before assuming the stored formula matches the user’s description.
- For joins, inspect key columns with `sheets_analyze` before rewriting lookup logic.
- Treat virtual tables as formula-level staging areas: `HSTACK`, `VSTACK`, and array literals are often safer than mutating the sheet early.
- Prefer `LET` when a formula reuses the same expensive subexpression.

## Common Pitfalls

- Rewriting formulas before checking duplicates, nulls, or mixed key types.
- Treating `#N/A` as syntax failure when it often means “no match”.
- Using `QUERY` as default answer even when dedicated array functions are clearer.
- Hiding real defects with broad `IFERROR(...)`.

## Debugging Clues

- If values look equal but do not match, suspect hidden whitespace, text-vs-number drift, or non-breaking spaces.
- If a spill formula fails only in-sheet, inspect blocking cells around the target range.
- If an import-based formula is flaky, check permissions, chain depth, and payload size before changing syntax.

## Escalation Path

- Stay in `sheets-read` for formula inventory or read-only inspection.
- Move to `sheets_analyze` when key quality, duplicates, nulls, or mixed types may be root cause.
- Move to `sheets_formula_debug` when candidate execution evidence is required.
- Move to `sheets-write` only after formula choice is settled and a persistent sheet change is desired.
````

Create `skills/sheets-references/references/formulas-lookup-and-joins.md` with this exact content:

````md
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
=XLOOKUP(A2, HSTACK(Ref!A:A, Ref!B:B), TAKE(HSTACK(Ref!C:C, Ref!D:D),,2), "missing")
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
````

- [ ] **Step 4: Create the remaining three formula docs with spill, cleanup, and anti-pattern doctrine**

Create `skills/sheets-references/references/formulas-arrays-and-shaping.md` with this exact content:

````md
# Array And Shaping Formulas

## Use When

- User needs spill formulas, virtual tables, pivot-like reshaping, or formula-only data pipelines.
- Task depends on filtering, sorting, stacking, slicing, or row/column transforms.
- Problem is about how array-returning formulas compose.

## Avoid When

- A persistent helper table or write step would be clearer than one giant formula.
- User only needs one scalar lookup or simple arithmetic expression.
- Debugging needs execution evidence more than formula selection.

## High-Yield Formulas Or Patterns

```gs
=FILTER(A2:F, A2:A<>"")
=SORT(UNIQUE(A2:A), 1, TRUE)
=LET(src, FILTER(A2:F, A2:A<>""), CHOOSECOLS(src, 1, 3, 5))
=LET(src, FILTER(A2:F, A2:A<>""), SORT(CHOOSECOLS(src, 1, 3, 5), 2, FALSE))
=HSTACK(A2:A, C2:C, F2:F)
=VSTACK(Header!A1:F1, FILTER(Data!A2:F, Data!A2:A<>""))
=TOCOL(B2:D, 1)
=WRAPROWS(TOCOL(B2:D, 1), 3)
=MAP(A2:A, B2:B, LAMBDA(a, b, a & "-" & b))
=BYROW(B2:E, LAMBDA(row, SUM(row)))
=SCAN(0, B2:B, LAMBDA(acc, value, acc + value))
=REDUCE(0, FILTER(B2:B, B2:B<>""), LAMBDA(acc, value, acc + value))
```

- Use `FILTER`, `SORT`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, and `DROP` as first-choice shaping primitives.
- Use `HSTACK`, `VSTACK`, array literals, `TOCOL`, and `TOROW` to build virtual tables.
- Use `MAP`, `BYROW`, `BYCOL`, `SCAN`, and `REDUCE` when each element or row needs computed logic.
- Reserve `QUERY` for cases where SQL-like grouping truly improves clarity over dedicated array functions.

## Tips And Tricks

- Treat spill range shape as part of the contract: know how many rows and columns each stage returns.
- Wrap expensive intermediate arrays in `LET` so the same expression is not recomputed.
- Use `TAKE` and `DROP` to trim staged arrays before downstream functions consume them.
- Prefer multi-stage `LET` pipelines over unreadable nested calls when shaping gets complex.

## Common Pitfalls

- Spill collisions from occupied cells below or beside the target.
- Mixing row-oriented and column-oriented ranges in one `FILTER`.
- Overusing `ARRAYFORMULA` when newer spill functions already return arrays naturally.
- Building one huge pipeline when a helper column or support tab would be easier to inspect.
- Using open-ended ranges with expensive transforms on very large sheets.

## Debugging Clues

- If a spill formula works in isolation but not in-sheet, inspect adjacent cells for blocking content.
- If a stage returns the wrong shape, test that stage alone with `LET` or a scratch cell.
- If row counts disagree, compare the filtered source range and every predicate range length.
- If a `MAP` or `BYROW` result looks wrong, verify lambda inputs match the intended array shape.

## Escalation Path

- Use `sheets-read` to inspect stored formulas and current spill neighborhoods.
- Use `sheets_analyze` when shaping logic depends on source cleanliness or duplicate keys.
- Use `sheets_formula_debug` when comparing candidate array pipelines or isolating one broken stage.
- Use `sheets-write` when a helper tab or persistent reshaped output should replace a formula-only pipeline.
````

Create `skills/sheets-references/references/formulas-text-date-cleanup.md` with this exact content:

````md
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
````

Create `skills/sheets-references/references/formulas-pitfalls-and-anti-patterns.md` with this exact content:

````md
# Formula Pitfalls And Anti-Patterns

## Use When

- User asks which formulas or patterns should be avoided.
- Performance, freshness, readability, or maintainability is deteriorating.
- Existing sheet uses volatile or brittle constructs and needs safer replacements.

## Avoid When

- User only needs one exact formula answer and there is no design tradeoff to discuss.
- Task is strictly about current values or metadata, not formula design.
- The real blocker is permissions, range selection, or data quality rather than formula choice.

## High-Yield Formulas Or Patterns

- Prefer `XLOOKUP` or `INDEX` + `MATCH` over legacy-first `VLOOKUP`.
- Prefer `CHOOSECOLS`, `TAKE`, `DROP`, `HSTACK`, and `VSTACK` over `OFFSET` or `INDIRECT` when shaping static ranges.
- Prefer `IFS`, lookup tables, helper columns, or named functions over deep nested `IF`.
- Prefer one staged `IMPORTRANGE` boundary over long import chains.

## Tips And Tricks

- Constrain ranges when source size is large or formulas are expensive.
- Split giant formulas with `LET`, helper columns, or support tabs before they become opaque.
- Use dedicated array functions before reaching for brittle `QUERY` strings.
- Document intentional exceptions in comments or nearby notes when a volatile function is unavoidable.

## Common Pitfalls

- Volatile functions such as `NOW`, `TODAY`, `RAND`, and `RANDBETWEEN` recalc more often than many sheets can tolerate.
- `INDIRECT` and `OFFSET` are harder to trace, optimize, and debug than direct references.
- Whole-column transforms on large sheets can amplify recalculation cost.
- Nested `IF` trees become unreadable and risky to change.
- `QUERY` strings break easily under quoting mistakes, column-order drift, or locale assumptions.
- `IMPORTRANGE` chains introduce latency, freshness lag, and permission complexity.
- One-cell “wizard” formulas often outgrow human review.

## Debugging Clues

- If a sheet feels slow but formulas look innocent, search for volatile functions and open-ended ranges first.
- If dependencies are hard to trace, suspect `INDIRECT`, `OFFSET`, or import chains.
- If a formula edit keeps breaking unrelated logic, inspect whether one monster formula has become a hidden dependency hub.
- If `QUERY` output shifts after column edits, verify positional assumptions and quoted clauses.

## Escalation Path

- Use `sheets-read` to inventory the current formulas before replacing them.
- Use `sheets_analyze` to confirm whether sheet slowness is formula-related or data-shape-related.
- Use `sheets_formula_debug` to compare safer candidate replacements before live rollout.
- Use `sheets-write` when a safer helper-column or support-tab design should replace a brittle formula.
````

- [ ] **Step 5: Run the targeted test and verify the formula bundle now passes structural validation**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: PASS for the new formula-bundle test plus the baseline tests.

- [ ] **Step 6: Commit the formula doctrine bundle**

Run:

```bash
git add src/skills/skill-docs.test.ts skills/sheets-references/references/formulas-*.md
git commit -m "docs: add Sheets formula doctrine bundle"
```

Expected: commit succeeds and includes only the new formula docs plus validator expansion.

## Task 3: Wire `sheets-references` Discoverability

**Files:**
- Modify: `src/skills/skill-docs.test.ts`
- Modify: `skills/sheets-references/SKILL.md`
- Test: `src/skills/skill-docs.test.ts`

- [ ] **Step 1: Extend the validator so `sheets-references` must index the formula docs explicitly**

Append this new test inside `src/skills/skill-docs.test.ts`:

```ts
  it("indexes formula doctrine from sheets-references", () => {
    const supportDoc = readRepoText("skills/sheets-references/SKILL.md");

    assert.match(supportDoc, /formula doctrine/i);
    assert.match(supportDoc, /formulas-index\.md/);

    for (const relPath of FORMULA_DOCS.slice(1)) {
      assert.match(supportDoc, new RegExp(relPath.split("/").at(-1)!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(supportDoc, /Load `references\/formulas-index\.md` first for formula-heavy requests\./);
  });
```

- [ ] **Step 2: Run the targeted test and verify it fails because `sheets-references` does not mention the new docs yet**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: FAIL on `indexes formula doctrine from sheets-references`.

- [ ] **Step 3: Update `skills/sheets-references/SKILL.md` to index the new formula doctrine**

Change the frontmatter description line and the reference index section so the file contains this exact updated content:

```md
---
name: sheets-references
description: Shared doctrine for the Sheets skills. Use when you need deeper guidance on tool boundaries, request shaping, retries, mutation safety, formula doctrine, visualization, performance, or skill authoring. Do not start here for ordinary spreadsheet tasks; start with sheets-read, sheets-write, or sheets-diagnose.
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
```

- [ ] **Step 4: Run the targeted test and verify the support-skill routing now passes**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: PASS for the new discoverability assertion plus earlier tests.

- [ ] **Step 5: Commit the support-skill wiring**

Run:

```bash
git add src/skills/skill-docs.test.ts skills/sheets-references/SKILL.md
git commit -m "docs: wire formula doctrine into sheets-references"
```

Expected: commit succeeds and contains only the support-skill discoverability changes plus test update.

## Task 4: Wire Main Skill Deep-Links And README Discoverability

**Files:**
- Modify: `src/skills/skill-docs.test.ts`
- Modify: `skills/sheets-read/SKILL.md`
- Modify: `skills/sheets-diagnose/SKILL.md`
- Modify: `README.md`
- Test: `src/skills/skill-docs.test.ts`

- [ ] **Step 1: Extend the validator so the main skills and README must expose the formula doctrine**

Append this new test inside `src/skills/skill-docs.test.ts`:

```ts
  it("exposes formula doctrine from the main skills and README without adding a new top-level skill", () => {
    const readSkill = readRepoText("skills/sheets-read/SKILL.md");
    const diagnoseSkill = readRepoText("skills/sheets-diagnose/SKILL.md");
    const readme = readRepoText("README.md");

    assert.match(readSkill, /formulas-index\.md/);
    assert.match(readSkill, /formulas-text-date-cleanup\.md/);

    assert.match(diagnoseSkill, /formulas-index\.md/);
    assert.match(diagnoseSkill, /formulas-lookup-and-joins\.md/);
    assert.match(diagnoseSkill, /formulas-arrays-and-shaping\.md/);
    assert.match(diagnoseSkill, /formulas-text-date-cleanup\.md/);
    assert.match(diagnoseSkill, /formulas-pitfalls-and-anti-patterns\.md/);
    assert.match(diagnoseSkill, /formula-debugging-playbooks\.md/);

    assert.match(readme, /formula doctrine/i);
    assert.match(readme, /`sheets-references`/);
    assert.ok((readme.match(/\| `sheets-(read|diagnose|write)` \|/g) ?? []).length === 3);
  });
```

- [ ] **Step 2: Run the targeted test and verify it fails because the main skills and README do not mention the formula docs yet**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: FAIL on the new discoverability assertion.

- [ ] **Step 3: Update `skills/sheets-read/SKILL.md` so read-only formula work discovers the new doctrine**

Replace the `### Formula Inventory` subsection and the “Load deeper doctrine only when needed” bullets with this exact content:

```md
### Formula Inventory

Use `sheets_read_values` with `value_render_option=FORMULA` when the user wants to know which formulas are present but does not need full `CellData`. Load `../sheets-references/references/formulas-index.md` when the next step is picking or critiquing a formula family rather than only listing formulas.

## Cross-Cutting Rules

- Batch related ranges into one call whenever schema limits allow it.
- Prefer explicit A1 ranges over broad whole-sheet reads.
- Prefer the smallest useful response shape.
- Use `fields` on `sheets_get` before reaching for `include_grid_data`.
- Use `value_render_option=FORMULA` instead of `sheets_read_grid` when formula text alone is enough.
- Use `date_time_render_option=SERIAL_NUMBER` when stable date math matters more than presentation.
- Reserve `sheets_read_grid` for questions that truly depend on notes, merges, formatting, or row/column metadata.
- Load deeper doctrine only when needed:
  - `../sheets-references/references/tool-catalog.md`
  - `../sheets-references/references/request-shaping.md`
  - `../sheets-references/references/performance-and-scale.md`
  - `../sheets-references/references/formatting-and-visualization.md`
  - `../sheets-references/references/formulas-index.md`
  - `../sheets-references/references/formulas-text-date-cleanup.md`
```

- [ ] **Step 4: Update `skills/sheets-diagnose/SKILL.md` so diagnosis flows point to the formula doctrine**

Replace the `## High-Yield Playbooks` section and the “Load deeper doctrine only when needed” bullets with this exact content:

```md
## High-Yield Playbooks

### Lookup And Join Failures

- Check duplicates, nulls, and mixed types in the key columns before changing the formula.
- Suspect whitespace or hidden-text differences when values “look the same” but do not match.
- Remember that `XLOOKUP` requires lookup and result ranges with compatible shape and returns `#N/A` by default when no match is found.
- Load `../sheets-references/references/formulas-lookup-and-joins.md` when the question is more about join design than immediate execution proof.

### `FILTER` Surprises

- Verify that each condition range has the same length as the filtered range.
- Do not mix row conditions and column conditions in one `FILTER`.
- Treat `#N/A` carefully: it may mean that no rows matched, not that the formula is malformed.
- Load `../sheets-references/references/formulas-arrays-and-shaping.md` when spill or shaping behavior is central.

### `LET` Failures

- Ensure the declared names are identifiers, not cell references.
- Evaluate names left to right; later expressions cannot use names declared later in the same `LET`.
- Load `../sheets-references/references/formulas-text-date-cleanup.md` when the problem is cleanup, coercion, or formula readability.

### `IMPORTRANGE` Problems

- Distinguish permission failures from formula syntax failures.
- Large imports, chained imports, volatile upstream references, and freshness delays can all look like formula bugs.
- Debug permission and range size before rewriting the formula.
- Load `../sheets-references/references/formulas-pitfalls-and-anti-patterns.md` when import chains or volatile dependencies are suspected.

### Array Behavior

- Many array-returning formulas expand into neighboring cells automatically.
- Use a scratch target cell with clear space below it when debugging array-producing formulas.
- Load `../sheets-references/references/formulas-arrays-and-shaping.md` when selecting between spill patterns.

## Cross-Cutting Rules

- `sheets_analyze` is cheaper and read-only; prefer it for broad overview work.
- `sheets_formula_debug` straddles read and write lanes because it writes evaluation cells before reading results.
- Use scratch cells or scratch sheets for formula validation whenever possible.
- Use `cleanup=true` for disposable checks unless the user explicitly wants the debug cells left in place.
- Seed only the minimal `context_values` needed to reproduce the behavior.
- When comparing candidate formulas, batch them into one debug run instead of repeating one-by-one calls.
- Normalize key and range assumptions before blaming the formula.
- Load deeper doctrine only when needed:
  - `../sheets-references/references/formulas-index.md`
  - `../sheets-references/references/formulas-lookup-and-joins.md`
  - `../sheets-references/references/formulas-arrays-and-shaping.md`
  - `../sheets-references/references/formulas-text-date-cleanup.md`
  - `../sheets-references/references/formulas-pitfalls-and-anti-patterns.md`
  - `../sheets-references/references/formula-debugging-playbooks.md`
  - `../sheets-references/references/tool-catalog.md`
  - `../sheets-references/references/request-shaping.md`
  - `../sheets-references/references/performance-and-scale.md`
  - `../sheets-references/references/error-taxonomy.md`
```

- [ ] **Step 5: Update `README.md` support-skill copy so formula doctrine is discoverable without adding a new main skill**

Replace the support-skill bullets in `README.md` with this exact content:

```md
### Support Skill

- `sheets-references` — shared reference library for tool boundaries, request shaping, retries, mutation safety, formula doctrine, and failure handling

Start with a main skill for the user task. Load `sheets-references` only when you need deeper cross-cutting guidance, including formula doctrine for joins, spill shaping, cleanup, or anti-pattern review.
```

- [ ] **Step 6: Run the targeted validator and confirm the discoverability graph now passes**

Run:

```bash
node --experimental-transform-types --no-warnings --test src/skills/skill-docs.test.ts
```

Expected: PASS with all discoverability tests green.

- [ ] **Step 7: Spot-check the graph with grep before full repo validation**

Run:

```bash
rg -n "formula doctrine|formulas-(index|lookup-and-joins|arrays-and-shaping|text-date-cleanup|pitfalls-and-anti-patterns)" skills README.md
```

Expected: hits in `skills/sheets-references/SKILL.md`, `skills/sheets-read/SKILL.md`, and `skills/sheets-diagnose/SKILL.md`. `README.md` should mention formula doctrine but not introduce a `sheets-formulas` main skill.

- [ ] **Step 8: Run full repo validation**

Run:

```bash
npm test
```

Expected: PASS for `biome check`, `tsc --noEmit`, and Node tests with coverage thresholds still satisfied.

- [ ] **Step 9: Commit the main-skill and README discoverability changes**

Run:

```bash
git add README.md skills/sheets-read/SKILL.md skills/sheets-diagnose/SKILL.md src/skills/skill-docs.test.ts
git commit -m "docs: expose Sheets formula doctrine"
```

Expected: commit succeeds after the full repo validation pass.

## Self-Review Checklist

- Spec coverage:
  - formula bundle files created -> Task 2
  - support-skill indexing -> Task 3
  - main-skill deep-links -> Task 4
  - README discoverability -> Task 4
  - repo-level validity proof -> Tasks 1-4 through `src/skills/skill-docs.test.ts` and `npm test`
- Placeholder scan:
  - no placeholder language remains anywhere in the plan
- Type consistency:
  - helper exports in `src/skills/skill-docs.ts` match test imports
  - formula doc filenames stay identical across tests, docs, and skill links
  - discoverability assertions in tests match planned markdown content exactly

## Execution Notes

- Plan written in current working tree because brainstorming handoff already happened here. Actual implementation should still prefer an isolated execution flow via subagents or a worktree if available.
- Keep edits ASCII-only.
- Do not add a new top-level `sheets-formulas` skill.
- Do not replace `formula-debugging-playbooks.md`; complement it.
