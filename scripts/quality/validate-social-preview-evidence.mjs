#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function expectFile(rel) {
  add(`${rel} exists`, exists(rel), rel);
}

function expectIncludes(rel, needle, label) {
  if (!exists(rel)) {
    add(label, false, `${rel} missing`);
    return;
  }
  add(label, read(rel).includes(needle), needle);
}

for (const rel of [
  "scripts/release/archive-social-preview-evidence.mjs",
  "scripts/quality/validate-social-preview-evidence.mjs",
  "docs/PHASE_58_SOCIAL_PREVIEW_ARTIFACT_REVIEW.md",
  "docs/PHASE_58_OVERLAY_MANIFEST.md",
  "docs/RELEASE_NOTES_TEMPLATE.md",
]) {
  expectFile(rel);
}

expectIncludes("scripts/release/archive-social-preview-evidence.mjs", "test-results/deployed-social-preview/manifest.json", "evidence script reads deployed capture manifest by default");
expectIncludes("scripts/release/archive-social-preview-evidence.mjs", ".release/social-preview-evidence", "evidence script writes under release artifact space");
expectIncludes("scripts/release/archive-social-preview-evidence.mjs", "REVIEW.md", "evidence script writes review checklist");
expectIncludes("scripts/release/archive-social-preview-evidence.mjs", "Persian generated card", "evidence review checklist includes Persian generated card review");
expectIncludes("scripts/release/archive-social-preview-evidence.mjs", "uploaded/static social preview image", "evidence review checklist includes uploaded/static image review");
expectIncludes("scripts/release/archive-social-preview-evidence.mjs", "evidence.json", "evidence script writes machine-readable evidence summary");
expectIncludes("scripts/release/archive-social-preview-evidence.mjs", "gitCommit", "evidence script records git commit");
expectIncludes("docs/PHASE_58_SOCIAL_PREVIEW_ARTIFACT_REVIEW.md", "release:social-preview-evidence", "P58 docs include evidence archive command");
expectIncludes("docs/PHASE_58_SOCIAL_PREVIEW_ARTIFACT_REVIEW.md", "not be committed", "P58 docs keep generated evidence out of source");
expectIncludes("docs/RELEASE_NOTES_TEMPLATE.md", "Social Preview Evidence", "release notes template includes social preview evidence section");

const packageJson = JSON.parse(read("package.json"));
add(
  "package.json exposes release:social-preview-evidence",
  packageJson.scripts?.["release:social-preview-evidence"] === "node scripts/release/archive-social-preview-evidence.mjs",
);
add(
  "package.json exposes quality:social-preview-evidence",
  packageJson.scripts?.["quality:social-preview-evidence"] === "node scripts/quality/validate-social-preview-evidence.mjs",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`P58 social preview evidence validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("P58 social preview evidence validation passed.");
