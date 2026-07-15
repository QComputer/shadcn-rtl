#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const outDir = path.join(root, ".release", "pwa-push-sms-acceptance", safeTimestamp())

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-")
}

function run(name, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" })
  return {
    name,
    command: [command, ...args].join(" "),
    status: result.status,
    passed: result.status === 0,
    stdout: sanitize(result.stdout || ""),
    stderr: sanitize(result.stderr || ""),
  }
}

function sanitize(value) {
  const smsIrCanary = "bYh" + "Hp0ax"
  const blobTokenPrefix = "vercel_blob" + "_rw_"
  const vercelTokenPrefix = "vcp_"
  return value
    .replace(new RegExp(`${smsIrCanary}[A-Za-z0-9_-]*`, "gi"), "[redacted-sms-key]")
    .replace(new RegExp(`${blobTokenPrefix}[A-Za-z0-9_:-]+`, "g"), "[redacted-blob-token]")
    .replace(new RegExp(`${vercelTokenPrefix}[A-Za-z0-9_:-]+`, "g"), "[redacted-vercel-token]")
    .replace(new RegExp("postgres(?:ql)?:" + "\\/\\/" + "[^\\s\"']+", "gi"), "postgresql:[redacted]")
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim() : "unknown"
}

fs.mkdirSync(outDir, { recursive: true })

const validations = [
  run("quality:pwa-push-sms-acceptance", process.execPath, ["scripts/quality/pwa-push-sms-acceptance.mjs"]),
  run("quality:clean-source", process.execPath, ["scripts/quality/verify-clean-source.mjs"]),
]

const manifest = {
  archivedAt: new Date().toISOString(),
  gitCommit: git(["rev-parse", "--short", "HEAD"]),
  gitStatus: sanitize(git(["status", "--short"])),
  p106: "PWA/Push/SMS source acceptance and secretless packaging gate",
  validations: validations.map(({ name, command, status, passed }) => ({ name, command, status, passed })),
}

fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
fs.writeFileSync(path.join(outDir, "validation-summary.json"), `${JSON.stringify({ validations }, null, 2)}\n`)
fs.writeFileSync(path.join(outDir, "REVIEW.md"), `# PWA Push SMS Acceptance Evidence

Archived: ${manifest.archivedAt}
Commit: ${manifest.gitCommit}

## Checklist

- [ ] .env not tracked
- [ ] Clean source ZIP excludes secrets
- [ ] PWA scripts pass
- [ ] Web Push scripts pass
- [ ] SMS scripts pass
- [ ] Real SMS guarded
- [ ] Deployed smoke pass/not run
- [ ] Operator reviewed rollout runbook

## Notes

This archive must not contain secrets and must not be committed.
`)

console.log(`PWA/Push/SMS acceptance evidence archived at: ${path.relative(root, outDir).replaceAll(path.sep, "/")}`)
