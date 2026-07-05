#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const ROOT = process.cwd()
const LOCAL_ENV = path.join(ROOT, ".env")
const VERCEL_SCOPE = process.env.VERCEL_SCOPE || "ahmads-projects-1b4ce1dc"
const ENVIRONMENT = "production"

function loadLocalEnv() {
  const content = fs.readFileSync(LOCAL_ENV, "utf8")
  const entries = new Map()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    entries.set(key, value)
  }
  return entries
}

function getVercelEnvList() {
  const stdout = execSync(`vercel env ls ${ENVIRONMENT} --scope ${VERCEL_SCOPE}`, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).toString()

  const names = []
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(">") || line.startsWith(" ")) continue
    const name = line.split(/\s+/)[0]
    if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      names.push(name)
    }
  }
  return names
}

function vercelEnvUpdate(key, value) {
  try {
    const input = value.replace(/"/g, '\\"')
    execSync(
      `echo "${input}" | vercel env update ${key} ${ENVIRONMENT} --scope ${VERCEL_SCOPE} -y`,
      { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    )
    return true
  } catch (err) {
    const msg = err.stderr?.toString() || err.stdout?.toString() || err.message || ""
    throw new Error(`Failed to update ${key}: ${msg}`)
  }
}

async function main() {
  console.log("Syncing existing Vercel production env vars from local .env...")
  const local = loadLocalEnv()
  const remoteNames = getVercelEnvList()
  const remoteSet = new Set(remoteNames)

  let updated = 0
  let skipped = 0
  let missing = 0

  for (const [key, value] of local) {
    if (!remoteSet.has(key)) {
      missing++
      continue
    }
    console.log(`UPDATE ${key}`)
    try {
      vercelEnvUpdate(key, value)
      updated++
    } catch (err) {
      console.error(`  FAILED: ${err.message}`)
      skipped++
    }
  }

  console.log("")
  console.log(`Updated: ${updated}`)
  console.log(`Skipped/failed: ${skipped}`)
  console.log(`Not in Vercel (not touched): ${missing}`)
  console.log(`Total remote vars: ${remoteNames.length}`)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
