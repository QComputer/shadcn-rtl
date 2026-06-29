#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const evidenceInput = process.env.PWA_PUSH_SMS_ROLLOUT_EVIDENCE_FILE || "test-results/deployed-pwa-push-sms/evidence.json"
const outDir = process.env.PWA_PUSH_SMS_ROLLOUT_EVIDENCE_OUT || `.release/pwa-push-sms-rollout-evidence/${safeTimestamp()}`

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-")
}

function normalize(relOrAbs) {
  return path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs)
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim() : "unknown"
}

const inputAbs = normalize(evidenceInput)
if (!fs.existsSync(inputAbs)) {
  console.error(`PWA/Push/SMS rollout evidence not found: ${evidenceInput}`)
  console.error("Run: DEPLOYED_URL=https://www.bazar-baz.ir pnpm run e2e:deployed:pwa-push-sms")
  process.exit(1)
}

const evidence = JSON.parse(fs.readFileSync(inputAbs, "utf8"))
const serialized = JSON.stringify(evidence)
if (/123456|DATABASE_URL=|BLOB_READ_WRITE_TOKEN=|WEB_PUSH_VAPID_PRIVATE_KEY=|SMS_IR_API_KEY=/.test(serialized)) {
  console.error("Refusing to archive PWA/Push/SMS rollout evidence because it appears to contain a secret.")
  process.exit(1)
}

const passed = Array.isArray(evidence.checks) ? evidence.checks.filter((check) => check.ok).length : 0
const failed = Array.isArray(evidence.checks) ? evidence.checks.filter((check) => !check.ok).length : 0
const outAbs = normalize(outDir)
fs.mkdirSync(outAbs, { recursive: true })

const archive = {
  archivedAt: new Date().toISOString(),
  gitCommit: gitCommit(),
  sourceEvidence: path.relative(root, inputAbs).replaceAll(path.sep, "/"),
  deployedBaseUrl: evidence.canonicalBaseUrl || evidence.configuredBaseUrl || "unknown",
  locale: evidence.locale || "fa",
  requireDryRun: evidence.requireDryRun !== false,
  enableDryRunSend: evidence.enableDryRunSend === true,
  summary: { passed, failed },
}

fs.copyFileSync(inputAbs, path.join(outAbs, "evidence.json"))
fs.writeFileSync(path.join(outAbs, "manifest.json"), `${JSON.stringify(archive, null, 2)}\n`)
fs.writeFileSync(path.join(outAbs, "REVIEW.md"), `# PWA Push SMS Rollout Evidence Review

Archived: ${archive.archivedAt}
Commit: ${archive.gitCommit}
Deployment: ${archive.deployedBaseUrl}
Locale: ${archive.locale}
Checks: ${passed} passed, ${failed} failed

## Required Checks

- [ ] First no-locale visit resolves to the Persian \`/fa\` experience.
- [ ] Manifest, service worker, and offline shell are reachable after deployment.
- [ ] Dashboard notification operations API is authenticated and secret-safe.
- [ ] Customer Web Push status and notification preferences are readable.
- [ ] Web Push real sends are disabled unless this is an approved canary.
- [ ] SMS real sends are disabled unless this is an approved canary.
- [ ] Provider readiness in \`/fa/dashboard/notification-operations\` matches the intended rollout stage.
- [ ] No secrets, raw tokens, database URLs, private keys, API keys, or passwords are present in \`evidence.json\`.
- [ ] Rollback owner, approval owner, and monitoring owner are recorded in the release notes.

## Notes

Keep this archive with external release records when needed. Do not commit \`.release/pwa-push-sms-rollout-evidence\`.
`)

console.log(`PWA/Push/SMS rollout evidence archived at: ${path.relative(root, outAbs).replaceAll(path.sep, "/")}`)
