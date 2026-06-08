#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootArg = process.argv[2] || process.cwd();
const root = path.resolve(rootArg);
const results = [];

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function walk(absDir, out = []) {
  if (!fs.existsSync(absDir)) return out;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    const rel = path.relative(root, abs).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      walk(abs, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

if (!fs.existsSync(root)) {
  console.error(`Release artifact root does not exist: ${root}`);
  process.exit(1);
}

const files = walk(root);
const fileSet = new Set(files);

const forbiddenExactFiles = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
  "prisma/dev.db",
  "public/myResume.pdf",
  "test-results/.last-run.json",
];

for (const rel of forbiddenExactFiles) {
  add(`forbidden file absent: ${rel}`, !fileSet.has(rel), rel);
}

const forbiddenDirs = [
  ".git/",
  ".next/",
  "node_modules/",
  "coverage/",
  "test-results/",
  "public/uploads/",
  "uploads/",
  "lib/generated/prisma/",
];

for (const dir of forbiddenDirs) {
  const offenders = files.filter((rel) => rel.startsWith(dir));
  add(`forbidden directory absent: ${dir}`, offenders.length === 0, offenders.slice(0, 5).join(", "));
}

const forbiddenExtensions = [/\.pem$/i, /\.sqlite$/i, /\.db$/i, /\.zip$/i, /\.rar$/i, /\.7z$/i];
for (const pattern of forbiddenExtensions) {
  const offenders = files.filter((rel) => pattern.test(rel));
  add(`forbidden extension absent: ${pattern}`, offenders.length === 0, offenders.slice(0, 5).join(", "));
}

const suspiciousSecretNames = files.filter((rel) => {
  const base = path.basename(rel).toLowerCase();
  if (base === ".env.example") return false;
  return /secret|credential|private[-_]?key|service[-_]?account/.test(base);
});
add("no suspicious secret-like filenames", suspiciousSecretNames.length === 0, suspiciousSecretNames.slice(0, 5).join(", "));
add("artifact root exists", fs.existsSync(root), root);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`Release artifact hygiene validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}

console.log(`Release artifact hygiene validation passed for ${root}.`);
