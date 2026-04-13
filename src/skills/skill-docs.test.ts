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

  it("ships the formula doctrine bundle with stable section headings", () => {
    for (const relPath of FORMULA_DOCS) {
      const markdown = readRepoText(relPath);
      assert.match(markdown, /^# .+$/m, `${relPath} needs an H1`);

      for (const heading of REQUIRED_FORMULA_HEADINGS) {
        assert.match(markdown, new RegExp(`^${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`, "m"));
      }
    }

    const indexDoc = readRepoText("skills/sheets-references/references/formulas-index.md");
    for (const relPath of FORMULA_DOCS.slice(1)) {
      const fileName = relPath.split("/").at(-1);
      assert.ok(fileName, `missing file name for ${relPath}`);
      assert.match(indexDoc, new RegExp(fileName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")));
    }
  });

  it("indexes formula doctrine from sheets-references", () => {
    const supportDoc = readRepoText("skills/sheets-references/SKILL.md");

    assert.match(supportDoc, /formula doctrine/i);
    assert.match(supportDoc, /formulas-index\.md/);

    for (const relPath of FORMULA_DOCS.slice(1)) {
      const fileName = relPath.split("/").at(-1);
      assert.ok(fileName, `missing file name for ${relPath}`);
      assert.match(supportDoc, new RegExp(fileName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")));
    }

    assert.match(supportDoc, /Load `references\/formulas-index\.md` first for formula-heavy requests\./);
  });

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
});
