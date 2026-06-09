#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["fa", "en", "ar"];
const requiredFiles = locales.map((locale) => `dictionaries/${locale}.json`);
const results = [];
const warnings = [];

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function warn(name, detail = "") {
  warnings.push({ name, detail });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function flatten(value, prefix = "", out = []) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push(prefix);
  return out;
}

function walk(dir, extensions, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) walk(rel, extensions, out);
    else if (extensions.some((ext) => rel.endsWith(ext))) out.push(rel);
  }
  return out;
}

const parsed = new Map();
for (const rel of requiredFiles) {
  if (!exists(rel)) {
    add(`${rel} exists`, false);
    continue;
  }
  add(`${rel} exists`, true);
  try {
    parsed.set(rel, JSON.parse(read(rel)));
    add(`${rel} parses`, true);
  } catch (error) {
    add(`${rel} parses`, false, error.message);
  }
}

const keySets = new Map();
for (const locale of locales) {
  const rel = `dictionaries/${locale}.json`;
  const dictionary = parsed.get(rel);
  if (!dictionary) continue;
  const keys = new Set(flatten(dictionary).filter(Boolean));
  keySets.set(locale, keys);
  add(`${locale} dictionary has keys`, keys.size > 0, `${keys.size}`);
}

const baseKeys = keySets.get("fa") ?? new Set();
for (const locale of ["en", "ar"]) {
  const keys = keySets.get(locale) ?? new Set();
  const missing = [...baseKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baseKeys.has(key));
  warn(`${locale} missing keys vs fa`, `${missing.length}${missing.length ? `; sample: ${missing.slice(0, 12).join(", ")}` : ""}`);
  warn(`${locale} extra keys vs fa`, `${extra.length}${extra.length ? `; sample: ${extra.slice(0, 12).join(", ")}` : ""}`);
}

const i18nSource = exists("lib/i18n.ts") ? read("lib/i18n.ts") : "";
for (const locale of locales) {
  add(`supportedLocales includes ${locale}`, i18nSource.includes(`"${locale}"`) || i18nSource.includes(`'${locale}'`));
}
add("fa locale is rtl", /fa:\s*{[\s\S]*?dir:\s*["']rtl["']/.test(i18nSource));
add("ar locale is rtl", /ar:\s*{[\s\S]*?dir:\s*["']rtl["']/.test(i18nSource));
add("en locale is ltr", /en:\s*{[\s\S]*?dir:\s*["']ltr["']/.test(i18nSource));

const layoutSource = exists("app/[locale]/layout.tsx") ? read("app/[locale]/layout.tsx") : "";
add("locale layout sets html lang", /<html[^>]+lang=/.test(layoutSource));
add("locale layout sets html dir", /<html[^>]+dir=/.test(layoutSource));

const uiFiles = [
  ...walk("app", [".ts", ".tsx"]),
  ...walk("components", [".ts", ".tsx"]),
  ...walk("lib", [".ts", ".tsx"]),
].filter((rel) => !rel.endsWith(".d.ts") && !rel.includes("/generated/"));

const rtlTextPattern = /[\u0600-\u06FF]/g;
const hardcodedRtl = [];
for (const file of uiFiles) {
  const text = read(file);
  const count = (text.match(rtlTextPattern) ?? []).length;
  if (count > 0) hardcodedRtl.push({ file, count });
}
warn("hardcoded RTL-script characters in TS/TSX", `${hardcodedRtl.length} files; ${hardcodedRtl.reduce((sum, item) => sum + item.count, 0)} chars; sample: ${hardcodedRtl.slice(0, 12).map((item) => item.file).join(", ")}`);

const staleBrandFiles = [];
for (const file of uiFiles) {
  const text = read(file);
  if (/ShopifyX|Trendy Online Store|Discover trending fashion/i.test(text)) staleBrandFiles.push(file);
}
warn("stale brand text occurrences", `${staleBrandFiles.length}${staleBrandFiles.length ? `; sample: ${staleBrandFiles.slice(0, 12).join(", ")}` : ""}`);

console.table(results);
if (warnings.length) {
  console.log("\nP27 i18n/RTL audit warnings (non-blocking in this audit phase):");
  console.table(warnings);
}

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`P27 i18n/RTL audit failed with ${failed.length} blocking issue(s).`);
  process.exit(1);
}

console.log("P27 i18n/RTL audit passed. Translation/key drift warnings are documented debt, not blockers in P27.");
