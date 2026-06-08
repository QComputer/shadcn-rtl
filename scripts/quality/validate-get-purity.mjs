#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "app", "api");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile() && entry.name === "route.ts") out.push(abs);
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractFunction(source, name) {
  const match = source.match(new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\(`));
  if (!match) return null;

  const start = match.index ?? 0;
  const bodyStart = source.indexOf("{", start);
  if (bodyStart === -1) return null;

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  return source.slice(start);
}

const forbidden = [
  { name: "create", pattern: /\.(create|createMany)\s*\(/ },
  { name: "update", pattern: /\.(update|updateMany)\s*\(/ },
  { name: "upsert", pattern: /\.upsert\s*\(/ },
  { name: "delete", pattern: /\.(delete|deleteMany)\s*\(/ },
  { name: "mutation delegation", pattern: /return\s+(POST|PUT|PATCH|DELETE)\s*\(/ },
];

const results = [];
for (const file of walk(apiRoot)) {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  const getBody = extractFunction(source, "GET");
  if (!getBody) continue;

  for (const rule of forbidden) {
    const match = getBody.match(rule.pattern);
    if (match) {
      results.push({
        file: path.relative(root, file).replaceAll(path.sep, "/"),
        rule: rule.name,
        match: match[0],
      });
    }
  }
}

if (results.length > 0) {
  console.table(results);
  console.error(`GET purity validation failed with ${results.length} issue(s).`);
  process.exit(1);
}

console.log("GET purity validation passed.");
