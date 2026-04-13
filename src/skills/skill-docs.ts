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
  return Array.from(markdown.matchAll(/`((?:\.\.\/|\.\/|references\/)[^`\n]+?\.(?:md|yaml))`/g), (match) => match[1]);
}

export function resolveRelativeDocRef(skillDir: string, relRef: string) {
  return resolve(repoPath(skillDir), relRef);
}
