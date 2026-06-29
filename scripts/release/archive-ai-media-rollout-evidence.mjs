#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const evidenceInput = process.env.AI_MEDIA_ROLLOUT_EVIDENCE_FILE || "test-results/deployed-ai-media-rollout/evidence.json";
const outDir = process.env.AI_MEDIA_ROLLOUT_EVIDENCE_OUT || `.release/ai-media-rollout-evidence/${safeTimestamp()}`;

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function normalize(relOrAbs) {
  return path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs);
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

const inputAbs = normalize(evidenceInput);
if (!fs.existsSync(inputAbs)) {
  console.error(`AI media rollout evidence not found: ${evidenceInput}`);
  console.error("Run: DEPLOYED_URL=https://bazar-baz.ir pnpm run e2e:deployed:ai-media");
  process.exit(1);
}

const evidence = JSON.parse(fs.readFileSync(inputAbs, "utf8"));
const outAbs = normalize(outDir);
fs.mkdirSync(outAbs, { recursive: true });

const archive = {
  archivedAt: new Date().toISOString(),
  gitCommit: gitCommit(),
  sourceEvidence: path.relative(root, inputAbs).replaceAll(path.sep, "/"),
  deployedBaseUrl: evidence.canonicalBaseUrl || evidence.configuredBaseUrl || "unknown",
  summary: evidence.summary || {},
};

fs.copyFileSync(inputAbs, path.join(outAbs, "evidence.json"));
fs.writeFileSync(path.join(outAbs, "manifest.json"), `${JSON.stringify(archive, null, 2)}\n`);
fs.writeFileSync(path.join(outAbs, "REVIEW.md"), `# AI Media Rollout Evidence Review

Archived: ${archive.archivedAt}
Commit: ${archive.gitCommit}
Deployment: ${archive.deployedBaseUrl}

## Required Checks

- [ ] Authenticated Bazar Baz AI media status is ready or the rollout exception is documented.
- [ ] Usage summary is available and quota-shaped.
- [ ] \`paidGenerationEnabled\` is false unless an explicit paid-provider rollout has been approved.
- [ ] Cost telemetry is present and daily/monthly estimated costs are within approved guardrails.
- [ ] Rollback status is reviewed; paid provider is paused only with a documented reason.
- [ ] Unauthenticated dashboard AI media routes are blocked.
- [ ] Direct Render MOCK checks are present when service URL/key values were intentionally provided.
- [ ] Blob-backed image selection evidence is present only for an operator-approved product.
- [ ] No secrets, raw tokens, database URLs, or passwords are present in \`evidence.json\`.

## Notes

Keep this archive with external release records when needed. Do not commit \`.release/ai-media-rollout-evidence\`.
`);

console.log(`AI media rollout evidence archived at: ${path.relative(root, outAbs).replaceAll(path.sep, "/")}`);
