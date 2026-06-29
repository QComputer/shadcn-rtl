#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const zipPath = path.resolve(root, process.env.CLEAN_SOURCE_ZIP || process.argv[2] || "dist/bazar-baz-clean-source.zip")
const checks = []

function add(name, pass, detail = "") {
  checks.push({ name, pass: Boolean(pass), detail })
}

function run(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8" })
}

function walk(absDir, out = []) {
  if (!fs.existsSync(absDir)) return out
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name)
    if (entry.isDirectory()) walk(abs, out)
    else if (entry.isFile()) out.push(abs)
  }
  return out
}

function normalize(rel) {
  return rel.replaceAll(path.sep, "/")
}

add("clean source ZIP exists", fs.existsSync(zipPath), path.relative(root, zipPath))

const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bazar-baz-clean-source-"))
if (fs.existsSync(zipPath)) {
  const expand = run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${extractRoot.replaceAll("'", "''")}' -Force`,
  ])
  add("clean source ZIP expands", expand.status === 0, expand.stderr || expand.stdout)

  if (expand.status === 0) {
    const hygiene = run(process.execPath, ["scripts/quality/validate-release-artifact.mjs", extractRoot])
    add("expanded source passes release artifact hygiene", hygiene.status === 0, hygiene.stderr || hygiene.stdout)
  }
}

const files = walk(extractRoot)
const relFiles = files.map((abs) => normalize(path.relative(extractRoot, abs)))
const forbiddenPathPatterns = [
  /^\.env(?:$|\.)/,
  /^\.git\//,
  /^node_modules\//,
  /^\.next\//,
  /^\.vercel\//,
  /^test-results\//,
  /^\.release\//,
  /(^|\/)dev\.db$/,
  /\.sqlite3?$/i,
  /\.db$/i,
]

const forbiddenPaths = relFiles.filter((rel) => {
  if (rel === ".env.example") return false
  return forbiddenPathPatterns.some((pattern) => pattern.test(rel))
})
add("ZIP excludes forbidden paths", forbiddenPaths.length === 0, forbiddenPaths.slice(0, 10).join(", "))

const smsIrCanary = "bYh" + "Hp0ax"
const blobTokenPrefix = "vercel_blob" + "_rw_"
const vercelTokenPrefix = "vcp_"
const secretPatterns = [
  new RegExp(smsIrCanary, "i"),
  new RegExp(`${blobTokenPrefix}[A-Za-z0-9_:-]{12,}`),
  new RegExp(`${vercelTokenPrefix}[A-Za-z0-9_:-]{12,}`),
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
]
const postgresUrlPattern = /postgres(?:ql)?:\/\/[^:\s"'`]+:[^@\s"'`]+@[^\s"'`]+/gi

function isDocumentedPostgresPlaceholder(url) {
  return /^postgres(?:ql)?:\/\/user:pass@localhost(?::\d+)?\//i.test(url) ||
    /^postgres(?:ql)?:\/\/OLD_USER:OLD_PASSWORD@OLD_HOST\//.test(url)
}

const secretFindings = []
for (const abs of files) {
  const rel = normalize(path.relative(extractRoot, abs))
  if (rel === ".env.example") continue
  const ext = path.extname(rel).toLowerCase()
  if (![".env", ".json", ".js", ".mjs", ".ts", ".tsx", ".md", ".prisma", ".sql", ".yml", ".yaml", ".ps1", ".css", ".html", ".svg", ".txt"].includes(ext)) continue
  const text = fs.readFileSync(abs, "utf8")
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      secretFindings.push(`${rel}:${pattern}`)
      break
    }
  }
  for (const match of text.matchAll(postgresUrlPattern)) {
    const url = match[0]
    if (!isDocumentedPostgresPlaceholder(url)) {
      secretFindings.push(`${rel}:postgres-url`)
      break
    }
  }
}
add("ZIP contains no real-looking secret values", secretFindings.length === 0, secretFindings.slice(0, 10).join(", "))

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail.trim().slice(0, 240)})` : ""}`)
}

fs.rmSync(extractRoot, { recursive: true, force: true })

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`\n${failed.length} clean-source ZIP validation check(s) failed.`)
  process.exit(1)
}
