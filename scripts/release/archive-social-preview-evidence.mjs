#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);

function valueAfter(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function normalize(relOrAbs) {
  return relOrAbs.replaceAll(path.sep, "/");
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function copyFileIfPresent(sourceAbs, destinationAbs) {
  if (!fs.existsSync(sourceAbs)) return false;
  fs.mkdirSync(path.dirname(destinationAbs), { recursive: true });
  fs.copyFileSync(sourceAbs, destinationAbs);
  return true;
}

function gitValue(commandArgs) {
  const result = spawnSync("git", commandArgs, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

const manifestRel = valueAfter(
  "--manifest",
  process.env.SOCIAL_PREVIEW_CAPTURE_MANIFEST || "test-results/deployed-social-preview/manifest.json",
);
const manifestAbs = path.resolve(root, manifestRel);
if (!fs.existsSync(manifestAbs)) {
  console.error(`Social preview capture manifest not found: ${manifestRel}`);
  console.error("Run `DEPLOYED_URL=https://bazar-baz.ir pnpm run e2e:deployed:social-preview` first.");
  process.exit(1);
}

const manifest = readJson(manifestAbs);
const outRel = valueAfter(
  "--out",
  process.env.SOCIAL_PREVIEW_EVIDENCE_DIR ||
    `.release/social-preview-evidence/${safeTimestamp()}`,
);
const outAbs = path.resolve(root, outRel);
const capturesOutAbs = path.join(outAbs, "captures");
fs.rmSync(outAbs, { recursive: true, force: true });
fs.mkdirSync(capturesOutAbs, { recursive: true });

const copiedCaptures = [];
for (const capture of manifest.captures || []) {
  if (!capture?.file) continue;
  const sourceAbs = path.resolve(root, capture.file);
  const destinationAbs = path.join(capturesOutAbs, path.basename(capture.file));
  if (copyFileIfPresent(sourceAbs, destinationAbs)) {
    copiedCaptures.push({
      label: capture.label,
      url: capture.url,
      file: normalize(path.relative(outAbs, destinationAbs)),
      bytes: capture.bytes,
      contentType: capture.contentType,
    });
  }
}

const evidence = {
  baseUrl: manifest.baseUrl || "",
  capturedAt: manifest.createdAt || "",
  archivedAt: new Date().toISOString(),
  gitCommit: gitValue(["rev-parse", "HEAD"]),
  gitBranch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
  sourceManifest: normalize(manifestRel),
  captureCount: copiedCaptures.length,
  generatedCaptureCount: copiedCaptures.filter((capture) => /\/og-image/i.test(capture.url || "")).length,
  uploadedCaptureCount: copiedCaptures.filter((capture) => capture.url && !/\/og-image/i.test(capture.url)).length,
  captures: copiedCaptures,
};

fs.writeFileSync(path.join(outAbs, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outAbs, "evidence.json"), JSON.stringify(evidence, null, 2));

const generatedCapture = copiedCaptures.find((capture) => /\/og-image/i.test(capture.url || ""));
const uploadedCapture = copiedCaptures.find((capture) => capture.url && !/\/og-image/i.test(capture.url));
const reviewMarkdown = `# Social Preview Evidence Review

Archived: ${evidence.archivedAt}
Source capture: ${manifest.createdAt || "unknown"}
Base URL: ${evidence.baseUrl || "unknown"}
Commit: ${evidence.gitCommit || "unknown"}

## Checklist

- [ ] Persian generated card is present and readable.
- [ ] At least one uploaded/static social preview image is present and readable.
- [ ] Generated fallback cards are not blank and include tenant-specific title context.
- [ ] Captured images match expected 1200x630 social-preview framing.
- [ ] Stale category sitemap candidates, if any, are noted as non-blocking deployed data debt.
- [ ] Evidence folder is kept under .release or external release storage, not committed source.

## Captures

- Generated fallback: ${generatedCapture ? `${generatedCapture.file} (${generatedCapture.bytes} bytes)` : "missing"}
- Uploaded/static candidate: ${uploadedCapture ? `${uploadedCapture.file} (${uploadedCapture.bytes} bytes)` : "missing"}
- Total copied captures: ${copiedCaptures.length}

## Release Note Snippet

Deployed social-preview evidence was captured for ${evidence.baseUrl || "the production URL"} at ${evidence.archivedAt}. The archive includes the deployed manifest, generated Persian OG card evidence, and at least one uploaded/static image candidate where available.
`;

fs.writeFileSync(path.join(outAbs, "REVIEW.md"), reviewMarkdown);
console.log(`Social preview evidence archived at: ${normalize(path.relative(root, outAbs))}`);
