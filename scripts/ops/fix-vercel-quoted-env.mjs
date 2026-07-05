#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const ROOT = process.cwd()
const LOCAL_ENV = path.join(ROOT, ".env")
const VERCEL_SCOPE = process.env.VERCEL_SCOPE || "ahmads-projects-1b4ce1dc"
const ENVIRONMENT = "production"

const FIX_KEYS = new Set([
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_DEPLOYED_APP_URL",
  "DEPLOYED_URL",
  "AUTH_TRUST_HOST",
  "NEXTAUTH_SECRET",
])

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

function vercelEnvUpdate(key, value) {
  const input = value.replace(/"/g, '\\"')
  execSync(
    `echo "${input}" | vercel env update ${key} ${ENVIRONMENT} --scope ${VERCEL_SCOPE} -y`,
    { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  )
}

async function main() {
  console.log("Fixing quoted URL env vars in Vercel production...")
  const local = loadLocalEnv()

  for (const key of FIX_KEYS) {
    const value = local.get(key)
    if (!value) {
      console.log(`SKIP ${key}: not found in local .env`)
      continue
    }

    const clean = value.replace(/^["']|["']$/g, "").trim()
    if (clean !== value) {
      console.log(`FIX ${key}: stripped quotes/whitespace`)
      console.log(`  before: ${JSON.stringify(value)}`)
      console.log(`  after:  ${JSON.stringify(clean)}`)
    } else {
      console.log(`OK ${key}: ${JSON.stringify(clean)}`)
    }

    vercelEnvUpdate(key, clean)
  }

  console.log("\nDone. Trigger a new Vercel deploy to apply.")
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
