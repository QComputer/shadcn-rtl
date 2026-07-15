#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function collect(dir, predicate = () => true, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", ".next", ".tmp", "test-results", "playwright-report"].includes(entry.name)) {
        collect(rel, predicate, out);
      }
    } else if (predicate(rel)) {
      out.push(rel);
    }
  }
  return out;
}

const sourceFiles = ["app", "components", "lib"].flatMap((dir) => collect(dir, (file) => /\.(ts|tsx|js|mjs|mts)$/.test(file)));
const gateway = read("lib/storage/application-storage.ts");
const localRefs = sourceFiles.filter((file) => file !== "lib/storage/local-test-storage.ts" && /local-test-storage|createLocalTestApplicationStorage/.test(read(file)));
const blobImports = sourceFiles.filter((file) => /@vercel\/blob/.test(read(file)));
const clientSecretRefs = sourceFiles.filter((file) => /"use client"|^'use client'/.test(read(file)))
  .filter((file) => /BLOB_READ_WRITE_TOKEN|AI_MEDIA_SERVICE_INTERNAL_KEY|VAPID_PRIVATE_KEY|SMS_IR_API_KEY|@vercel\/blob|AI_MEDIA_SERVICE_URL/.test(read(file)));

add("production gateway has no local adapter import path", !/local-test-storage|createLocalTestApplicationStorage/.test(gateway));
add("local test adapter is not referenced from app/components/lib feature graph", localRefs.length === 0, localRefs.join(", "));
add("only production adapter imports @vercel/blob", blobImports.length === 1 && blobImports[0] === "lib/storage/vercel-blob-storage.ts", blobImports.join(", "));
add("client components do not reference provider or storage secrets", clientSecretRefs.length === 0, clientSecretRefs.join(", "));
add("hermetic harness injects local adapter explicitly", /setApplicationStorageAdapterForTesting/.test(read("scripts/e2e/ai-media-hermetic-lifecycle.mts")) && /createLocalTestApplicationStorage/.test(read("scripts/e2e/ai-media-hermetic-lifecycle.mts")));

const nextRoot = path.join(root, ".next");
if (fs.existsSync(nextRoot)) {
  const nextFiles = collect(".next", (file) => /\.(js|mjs|json|nft\.json)$/.test(file));
  const forbiddenServerPatterns = [
    "createLocalTestApplicationStorage",
    "local-test-storage",
    ".tmp/ai-media-acceptance",
    "AI media local contract MOCK listening",
    "local-ai-media-test-key",
  ];
  const forbiddenClientPatterns = [
    "BLOB_READ_WRITE_TOKEN",
    "AI_MEDIA_SERVICE_INTERNAL_KEY",
    "SMS_IR_API_KEY",
    "VAPID_PRIVATE_KEY",
    "DATABASE_URL",
  ];
  const serverLeaks = [];
  const clientLeaks = [];
  for (const file of nextFiles) {
    const text = read(file);
    if (file.startsWith(".next/server/") && forbiddenServerPatterns.some((pattern) => text.includes(pattern))) {
      serverLeaks.push(file);
    }
    if (file.startsWith(".next/static/") && forbiddenClientPatterns.some((pattern) => text.includes(pattern))) {
      clientLeaks.push(file);
    }
  }
  add(".next server output has no local/mock/test storage leakage", serverLeaks.length === 0, serverLeaks.slice(0, 10).join(", "));
  add(".next client output has no secret identifier leakage", clientLeaks.length === 0, clientLeaks.slice(0, 10).join(", "));
} else {
  add(".next bundle scan skipped until build exists", true, "no .next directory");
}

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`AI media production import graph validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("AI media production import graph validation passed.");
