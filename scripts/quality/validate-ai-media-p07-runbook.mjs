#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docPath = path.join(root, "docs/ai-media/AI_MEDIA_P07_CONTROLLED_PRODUCTION_IMPORT_RUNBOOK.md");
const text = fs.readFileSync(docPath, "utf8");
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

add("P07 runbook exists", fs.existsSync(docPath));
add("runbook is prepared only", /prepared only/i.test(text) && /Do not execute/i.test(text));
add("runbook contains exact authorization wording", /I explicitly authorize one controlled Production AI-media result import through\s+the deployed Bazar Baz application storage gateway\.\s+This authorization does not grant direct Blob access or reveal Blob\s+credentials\./m.test(text));
add("runbook forbids direct Blob access", /Direct Production Blob access by Codex/.test(text) && /Blob token retrieval or printing/.test(text));
add("runbook requires deployed application storage gateway", /deployed Bazar Baz server call the application storage gateway/.test(text));
add("runbook forbids migrations seed and tenant provisioning", /Production database migration/.test(text) && /seed or tenant provisioning/.test(text));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`AI media P07 runbook validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("AI media P07 runbook validation passed.");
