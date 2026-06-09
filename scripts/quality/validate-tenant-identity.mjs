#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
}

function walk(dir, exts, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;

  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if ([".git", ".next", "node_modules", "lib/generated"].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) walk(rel, exts, out);
    else if (exts.some((ext) => rel.endsWith(ext))) out.push(rel);
  }

  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const sourceFiles = [
  ...walk("app", [".ts", ".tsx", ".js", ".mjs"]),
  ...walk("lib", [".ts", ".tsx", ".js", ".mjs"]),
  ...walk("components", [".ts", ".tsx", ".js", ".mjs"]),
];

const checks = [
  {
    name: "no slug value assigned to organizationId field",
    pattern: /organizationId\s*:\s*(?:order\.)?organizationSlug\b/g,
    reason: "organizationId must store Organization.id; slug values must use organizationSlug.",
  },
  {
    name: "no organizationId variable used as organizationSlug selector",
    pattern: /where\s*:\s*\{\s*organizationSlug\s*:\s*organizationId\s*[,}]/g,
    reason: "resolve Organization.id to slug before querying slug-keyed settings.",
  },
  {
    name: "no customerId_organizationId selector receives organizationSlug",
    pattern: /customerId_organizationId\s*:\s*\{[\s\S]{0,160}organizationId\s*:\s*(?:order\.)?organizationSlug\b/g,
    reason: "Follow/customer unique selectors require Organization.id, not slug.",
  },
];

for (const check of checks) {
  const offenders = [];
  for (const file of sourceFiles) {
    const text = read(file);
    if (check.pattern.test(text)) offenders.push(file);
    check.pattern.lastIndex = 0;
  }
  offenders.length ? fail(check.name, `${check.reason} Offenders: ${offenders.join(", ")}`) : ok(check.name);
}

const orderService = "lib/services/order.service.ts";
if (fs.existsSync(path.join(root, orderService))) {
  const text = read(orderService);
  text.includes("organizationId: organization.id") && text.includes("organizationSlug: organization.slug")
    ? ok("driver order access checks use resolved organization id and slug")
    : fail("driver order access checks use resolved organization id and slug", orderService);
}

const notificationService = "lib/services/notification.service.ts";
if (fs.existsSync(path.join(root, notificationService))) {
  const text = read(notificationService);
  text.includes("where: { id: organizationId }") && text.includes("organizationSlug: organization.slug")
    ? ok("notification settings resolve organization id to slug")
    : fail("notification settings resolve organization id to slug", notificationService);
}

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Tenant identity validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}

console.log("Tenant identity validation passed.");
