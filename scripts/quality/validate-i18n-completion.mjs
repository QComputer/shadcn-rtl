#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["fa", "en", "ar"];
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

function flatten(value, prefix = "", out = new Map()) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, value);
  return out;
}

function walk(dir, extensions, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "generated"].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) walk(rel, extensions, out);
    else if (extensions.some((ext) => rel.endsWith(ext))) out.push(rel);
  }
  return out;
}

const parsed = new Map();
for (const locale of locales) {
  const rel = `dictionaries/${locale}.json`;
  if (!exists(rel)) {
    add(`${rel} exists`, false);
    continue;
  }
  add(`${rel} exists`, true);
  try {
    const dictionary = JSON.parse(read(rel));
    parsed.set(locale, dictionary);
    add(`${rel} parses`, true);
  } catch (error) {
    add(`${rel} parses`, false, error.message);
  }
}

const keyMaps = new Map();
for (const locale of locales) {
  const dictionary = parsed.get(locale);
  if (!dictionary) continue;
  const map = flatten(dictionary);
  keyMaps.set(locale, map);
  add(`${locale} dictionary has keys`, map.size > 0, `${map.size}`);

  const emptyValues = [...map.entries()].filter(([, value]) => typeof value !== "string" || value.trim().length === 0);
  add(`${locale} dictionary values are non-empty strings`, emptyValues.length === 0, emptyValues.slice(0, 12).map(([key]) => key).join(", "));
}

const base = keyMaps.get("fa") ?? new Map();
const baseKeys = new Set(base.keys());
for (const locale of ["en", "ar"]) {
  const current = keyMaps.get(locale) ?? new Map();
  const currentKeys = new Set(current.keys());
  const missing = [...baseKeys].filter((key) => !currentKeys.has(key));
  const extra = [...currentKeys].filter((key) => !baseKeys.has(key));
  add(`${locale} dictionary has no missing keys vs fa`, missing.length === 0, missing.slice(0, 15).join(", "));
  add(`${locale} dictionary has no extra keys vs fa`, extra.length === 0, extra.slice(0, 15).join(", "));
}

const i18nSource = exists("lib/i18n.ts") ? read("lib/i18n.ts") : "";
for (const locale of locales) {
  add(`supportedLocales includes ${locale}`, i18nSource.includes(`"${locale}"`) || i18nSource.includes(`'${locale}'`));
}
add("default locale helper returns fa", /getDefaultLocale\(\)[\s\S]*?return\s+["']fa["']/.test(i18nSource));
add("unknown dictionary fallback returns fa", /return\s+loaders\.fa\(\)/.test(i18nSource));
add("fa locale is rtl", /fa:\s*{[\s\S]*?dir:\s*["']rtl["']/.test(i18nSource));
add("ar locale is rtl", /ar:\s*{[\s\S]*?dir:\s*["']rtl["']/.test(i18nSource));
add("en locale is ltr", /en:\s*{[\s\S]*?dir:\s*["']ltr["']/.test(i18nSource));

const rootPageSource = exists("app/page.tsx") ? read("app/page.tsx") : "";
add("root page exists for first-visit locale redirect", exists("app/page.tsx"));
add("root page redirects first-time visitors to fa", /redirect\(["']\/fa["']\)/.test(rootPageSource));

const layoutSource = exists("app/[locale]/layout.tsx") ? read("app/[locale]/layout.tsx") : "";
add("locale layout sets html lang", /<html[^>]+lang=/.test(layoutSource));
add("locale layout sets html dir", /<html[^>]+dir=/.test(layoutSource));
add("locale layout has no stale ShopifyX metadata", !/ShopifyX|Trendy Online Store|Discover trending fashion/i.test(layoutSource));

const uiFiles = [
  ...walk("app", [".ts", ".tsx"]),
  ...walk("components", [".ts", ".tsx"]),
  ...walk("lib", [".ts", ".tsx"]),
].filter((rel) => !rel.endsWith(".d.ts") && !rel.includes("/generated/"));

const staleBrandFiles = [];
for (const file of uiFiles) {
  const text = read(file);
  if (/ShopifyX|Trendy Online Store|Discover trending fashion/i.test(text)) staleBrandFiles.push(file);
}
add("no stale brand text in app/components/lib", staleBrandFiles.length === 0, staleBrandFiles.slice(0, 12).join(", "));

const hardcodedRtl = [];
for (const file of uiFiles) {
  const text = read(file);
  const matches = text.match(/[\u0600-\u06FF]/g) ?? [];
  if (matches.length > 0) hardcodedRtl.push({ file, count: matches.length });
}
warn(
  "hardcoded RTL-script characters in TS/TSX remain for later copy cleanup",
  `${hardcodedRtl.length} files; ${hardcodedRtl.reduce((sum, item) => sum + item.count, 0)} chars; sample: ${hardcodedRtl.slice(0, 12).map((item) => item.file).join(", ")}`,
);

console.table(results);
if (warnings.length) {
  console.log("\nP31 i18n completion warnings (non-blocking debt):");
  console.table(warnings);
}

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`P31 i18n completion failed with ${failed.length} blocking issue(s).`);
  process.exit(1);
}

console.log("P31 i18n completion passed. Locale key drift is closed for FA/EN/AR.");
