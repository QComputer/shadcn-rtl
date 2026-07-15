#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tests = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  const files = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "test-results", "playwright-report"].includes(entry.name)) continue;
      files.push(...walk(rel));
    } else if (/\.(ts|tsx|mts|mjs|js|json)$/.test(rel)) {
      files.push(rel);
    }
  }
  return files;
}

function test(name, fn) {
  try {
    const detail = fn();
    tests.push({ name, ok: true, detail: detail || "" });
  } catch (error) {
    tests.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const db = read("lib/db.ts");
const dbRuntime = read("lib/db-runtime.ts");
const schema = read("prisma/schema.prisma");
const prismaConfig = read("prisma.config.ts");
const health = read("app/api/health/route.ts");
const connectivity = read("scripts/ops/check-neon-runtime-connectivity.ts");
const packageJson = JSON.parse(read("package.json"));
const appFiles = walk("app");
const componentFiles = walk("components");
const libFiles = walk("lib");

test("canonical Prisma client uses PrismaNeon", () => {
  assert(/new PrismaNeon/.test(dbRuntime), "PrismaNeon constructor missing");
  assert(/new PrismaClient\(\{\s*adapter,/s.test(dbRuntime), "PrismaClient is not constructed with adapter");
});

test("runtime URL comes from DATABASE_URL", () => {
  assert(/process\.env\.DATABASE_URL/.test(dbRuntime), "DATABASE_URL not read by runtime");
  assert(!/process\.env\.DIRECT_URL/.test(dbRuntime), "runtime should not read DIRECT_URL");
});

test("direct migration URL remains separate", () => {
  assert(/directUrl\s*=\s*env\("DIRECT_URL"\)/.test(schema), "schema directUrl missing");
  assert(/url:\s*env\("DIRECT_URL"\)/.test(prismaConfig), "Prisma config does not route CLI to DIRECT_URL");
});

test("missing runtime URL gives safe config error", () => {
  assert(/missing DATABASE_URL/.test(dbRuntime), "safe missing DATABASE_URL error missing");
  assert(!/password|username|hostname/i.test(dbRuntime.match(/missing DATABASE_URL[\s\S]{0,160}/)?.[0] || ""), "config error includes sensitive labels");
});

test("URL values are never printed", () => {
  const files = [...appFiles, ...componentFiles, ...libFiles, ...walk("scripts")];
  const offenders = files.filter((file) => /console\.(log|error|warn)\([^)]*process\.env\.(DATABASE_URL|DIRECT_URL|DATABASE_URL_UNPOOLED)/.test(read(file)));
  assert(offenders.length === 0, offenders.join(", "));
});

test("application runtime has no unauthorized Prisma constructors", () => {
  const offenders = [...appFiles, ...componentFiles, ...libFiles].filter((file) => /new\s+PrismaClient\s*\(/.test(read(file)) && file !== "lib/db-runtime.ts");
  assert(offenders.length === 0, offenders.join(", "));
});

test("adapter singleton is reused in development", () => {
  assert(/globalThis/.test(dbRuntime) && /bazarBazPrisma/.test(dbRuntime), "global singleton missing");
});

test("browser/client code cannot import Prisma module", () => {
  const offenders = [...appFiles, ...componentFiles, ...libFiles].filter((file) => {
    const content = read(file).trim();
    return /^["']use client["'];?/.test(content) && /@\/lib\/db|@\/lib\/db-runtime|@prisma\/client/.test(content);
  });
  assert(offenders.length === 0, offenders.join(", "));
});

test("Proxy does not directly import Prisma", () => {
  const proxy = read("proxy.ts");
  assert(!/@\/lib\/db|@\/lib\/db-runtime|@prisma\/client|new\s+PrismaClient/.test(proxy), "proxy imports DB code");
});

test("read-only connectivity script does not mutate data", () => {
  assert(/\$queryRaw`SELECT 1`/.test(connectivity), "SELECT 1 smoke missing");
  assert(!/\.(create|update|upsert|delete|deleteMany|createMany)\s*\(/.test(connectivity), "connectivity script contains mutation call");
});

test("transaction patterns remain covered", () => {
  const services = read("lib/services/order.service.ts") + read("lib/services/product.service.ts") + read("lib/services/import-hub.service.ts");
  assert(/\$transaction\(async\s*\(/.test(services), "interactive transaction pattern not found");
  assert(/\$transaction\(\s*\[/.test(services), "array transaction pattern not found");
});

test("raw query behavior remains covered", () => {
  assert(/\$queryRaw`SELECT 1`/.test(health), "health raw query missing");
});

test("health output is redacted", () => {
  assert(/Database connectivity check failed/.test(health), "generic DB health error missing");
  assert(!/DATABASE_URL|DIRECT_URL|connectionString/.test(health), "health route contains URL identifiers");
});

test("build does not run migrations", () => {
  assert(!/migrate|db push|seed/i.test(packageJson.scripts?.build || ""), "build script contains migration/seed command");
});

test("external provider gates remain disabled", () => {
  const envExample = read(".env.example");
  assert(/CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=false/.test(envExample), "custom domain mutation gate not disabled");
  assert(/SMS_REAL_SEND_ENABLED=false/.test(envExample), "SMS real-send gate not disabled");
});

test("P13 dry-run remains mutation-free", () => {
  assert(!exists("app/api/dashboard/tenant-provisioning-plans/[planId]/execute/route.ts"), "P13 execute route exists");
  const service = read("lib/tenant-provisioning/tenant-provisioning-plan.service.ts");
  assert(/NO_ORGANIZATION_CREATED/.test(service) && /NO_NOTIFICATION_SENT/.test(service), "P13 dry-run declarations missing");
});

console.table(tests);
const failed = tests.filter((item) => !item.ok);
if (failed.length) {
  console.error(`Neon serverless runtime tests failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Neon serverless runtime tests passed.");
