#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

function fail(message) {
  console.error(`Vercel env push validation failed: ${message}`);
  process.exit(1);
}

function requireFile(path) {
  if (!existsSync(path)) fail(`missing ${path}`);
  return readFileSync(path, "utf8");
}

const ps1 = requireFile("scripts/ops/push-vercel-env.ps1");
requireFile("PUSH_VERCEL_ENV.cmd");
requireFile("docs/PHASE_61C_VERCEL_ENV_NATIVE_STDERR_HOTFIX.md");

if (ps1.includes("&&")) {
  fail("PowerShell script must not contain && because it breaks older Windows PowerShell parsing");
}

if (ps1.includes("--force")) {
  fail("PowerShell script must not use --force; it should explicitly add or update");
}

for (const required of [
  "Invoke-VercelCommand",
  "Get-ExistingVercelEnvKeys",
  "ErrorActionPreference = \"Continue\"",
  "cmd.exe /d /s /c",
  '"env", "ls"',
  '"env", "update"',
  '"env", "add"',
  "DryRun",
  "Redeploy",
]) {
  if (!ps1.includes(required)) fail(`missing required script marker: ${required}`);
}

console.log("Vercel env push validation passed.");
