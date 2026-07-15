#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function add(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
}

function read(rel) {
  const fullPath = path.join(root, rel);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir, predicate = () => true) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "test-results", "playwright-report"].includes(entry.name)) continue;
      out.push(...walk(rel, predicate));
    } else if (predicate(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function sourceFiles(dirs) {
  return dirs.flatMap((dir) => walk(dir, (file) => /\.(ts|tsx|mts|mjs|js|md|json|prisma)$/.test(file)));
}

const packageJson = JSON.parse(read("package.json"));
const schema = read("prisma/schema.prisma");
const prismaConfig = read("prisma.config.ts");
const db = read("lib/db.ts");
const dbRuntime = read("lib/db-runtime.ts");
const envExample = read(".env.example");
const proxy = read("proxy.ts");
const health = read("app/api/health/route.ts");
const checkScript = read("scripts/ops/check-neon-runtime-connectivity.ts");
const sourceTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const readme = read("README.md");

const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
const prismaVersion = packageJson.devDependencies?.prisma || packageJson.dependencies?.prisma || "";
const clientVersion = packageJson.dependencies?.["@prisma/client"] || packageJson.devDependencies?.["@prisma/client"] || "";
const adapterVersion = deps["@prisma/adapter-neon"] || "";
const neonVersion = packageJson.dependencies?.["@neondatabase/serverless"] || "";

add("@prisma/adapter-neon installed", Boolean(adapterVersion));
add("@neondatabase/serverless installed as runtime dependency", Boolean(neonVersion));
add("ws installed as runtime dependency", Boolean(packageJson.dependencies?.ws));
add("server-only installed", Boolean(packageJson.dependencies?.["server-only"]));
add("Prisma packages remain version 6", /^(\^)?6\./.test(prismaVersion) && /^(\^)?6\./.test(clientVersion));
add("Prisma Neon adapter matches resolved Prisma 6.19.3", adapterVersion === "6.19.3");
add("Prisma major was not upgraded to 7", !/^(\^)?7\./.test(prismaVersion + clientVersion + adapterVersion));

add("datasource uses pooled DATABASE_URL", /url\s*=\s*env\("DATABASE_URL"\)/.test(schema));
add("datasource uses direct DIRECT_URL", /directUrl\s*=\s*env\("DIRECT_URL"\)/.test(schema));
add("prisma.config routes CLI to DIRECT_URL", /datasource[\s\S]*url:\s*env\("DIRECT_URL"\)/.test(prismaConfig));
add("migration command remains prisma migrate deploy", packageJson.scripts?.["db:migrate"] === "prisma migrate deploy");

add("application server-only Prisma boundary exists", /import\s+["']server-only["']/.test(db) && /@\/lib\/db-runtime/.test(db));
add("canonical runtime uses PrismaNeon", /PrismaNeon/.test(dbRuntime) && /@prisma\/adapter-neon/.test(dbRuntime));
add("canonical runtime uses Neon serverless driver", /@neondatabase\/serverless/.test(dbRuntime) && /neonConfig\.webSocketConstructor/.test(dbRuntime));
add("canonical runtime reads DATABASE_URL only", /process\.env\.DATABASE_URL/.test(dbRuntime) && !/process\.env\.DIRECT_URL/.test(dbRuntime));
add("canonical runtime implements development singleton", /globalThis/.test(dbRuntime) && /bazarBazPrisma/.test(dbRuntime) && /NODE_ENV !== "production"/.test(dbRuntime));
add("canonical runtime has safe missing URL error", /missing DATABASE_URL/.test(dbRuntime) && !/connectionString.*console/.test(dbRuntime));

const runtimeConstructorFiles = sourceFiles(["app", "components", "lib"]).filter((file) => /new\s+PrismaClient\s*\(/.test(read(file)));
add("unauthorized runtime new PrismaClient calls absent", runtimeConstructorFiles.length === 1 && runtimeConstructorFiles[0] === "lib/db-runtime.ts", runtimeConstructorFiles.join(", "));

const allowedScriptConstructors = ["prisma/seed.ts", "scripts/db/repair-known-database-drift.mjs", "scripts/quality/validate-database-drift.mjs"];
const scriptConstructors = sourceFiles(["prisma", "scripts"]).filter((file) => /new\s+PrismaClient\s*\(/.test(read(file)));
add("plain Prisma script constructors are narrow documented exceptions", scriptConstructors.every((file) => allowedScriptConstructors.includes(file)), scriptConstructors.join(", "));

const clientDbImports = sourceFiles(["app", "components", "lib"]).filter((file) => {
  const content = read(file);
  return /^["']use client["'];?/.test(content.trim()) && /@\/lib\/db|@\/lib\/db-runtime|@prisma\/client/.test(content);
});
add("client components do not import Prisma modules", clientDbImports.length === 0, clientDbImports.join(", "));
add("proxy does not import or instantiate Prisma", !/@\/lib\/db|@\/lib\/db-runtime|@prisma\/client|new\s+PrismaClient/.test(proxy));

const edgeDbRoutes = sourceFiles(["app"]).filter((file) => /runtime\s*=\s*["']edge["']/.test(read(file)) && /@\/lib\/db|@\/lib\/db-runtime/.test(read(file)));
add("Edge runtime DB routes absent", edgeDbRoutes.length === 0, edgeDbRoutes.join(", "));
add("health route uses canonical client and redacts errors", /@\/lib\/db/.test(health) && /\$queryRaw`SELECT 1`/.test(health) && /Database connectivity check failed/.test(health) && !/catch\s*\(\s*error\s*\)[\s\S]*error/.test(health));
add("health route is Node runtime", /runtime\s*=\s*["']nodejs["']/.test(health));

add("Neon runtime check script exists", exists("scripts/ops/check-neon-runtime-connectivity.ts"));
add("Neon runtime check uses canonical runtime client", /import\("\.\.\/\.\.\/lib\/db-runtime"\)/.test(checkScript));
add("Neon runtime check is read-only", /\$queryRaw`SELECT 1`/.test(checkScript) && !/\.(create|update|upsert|delete|deleteMany|createMany)\s*\(/.test(checkScript) && !/\$executeRaw/.test(checkScript));
add("Neon runtime check redacts URL values", !/console\.(log|error)\([^)]*process\.env\.(DATABASE_URL|DIRECT_URL|DATABASE_URL_UNPOOLED)/.test(checkScript));

add(".env.example has empty DATABASE_URL placeholder", /^DATABASE_URL=$/m.test(envExample));
add(".env.example has empty DIRECT_URL placeholder", /^DIRECT_URL=$/m.test(envExample));
add(".env.example retains empty DATABASE_URL_UNPOOLED compatibility placeholder", /^DATABASE_URL_UNPOOLED=$/m.test(envExample));
add("no NEXT_PUBLIC database URL placeholder introduced", !/NEXT_PUBLIC_.*DATABASE|NEXT_PUBLIC_DATABASE_URL/.test(envExample + read("package.json")));

const sourceForSecrets = sourceFiles(["app", "components", "lib", "scripts", "docs", "prisma"]).filter((file) => !file.includes("handoff/"));
const suspiciousDbUrls = sourceForSecrets.filter((file) => {
  const content = read(file);
  const matches = content.match(/postgres(?:ql)?:\/\/[^\s'")`]+/gi) || [];
  return matches.some((match) => !/USER:PASSWORD|user:pass|OLD_USER:OLD_PASSWORD|postgresql:\/\/\.\.\./i.test(match));
});
add("no concrete PostgreSQL URLs in source/docs", suspiciousDbUrls.length === 0, suspiciousDbUrls.join(", "));

const filesThatLogEnvUrls = sourceFiles(["app", "components", "lib", "scripts"]).filter((file) => /console\.(log|error|warn)\([^)]*process\.env\.(DATABASE_URL|DIRECT_URL|DATABASE_URL_UNPOOLED)/.test(read(file)));
add("database URL values are not logged", filesThatLogEnvUrls.length === 0, filesThatLogEnvUrls.join(", "));

const buildScript = packageJson.scripts?.build || "";
add("build does not run migrations or seed", !/migrate|db push|seed/i.test(buildScript));
add("dev/start do not run migrations or seed", !/migrate|db push|seed/i.test((packageJson.scripts?.dev || "") + (packageJson.scripts?.start || "")));
add("P11 provider mutation gates remain disabled in env example", /CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=false/.test(envExample) && /VERCEL_DOMAIN_AUTOMATION_DRY_RUN=true/.test(envExample));
add("P13 execution endpoint absent", !exists("app/api/dashboard/tenant-provisioning-plans/[planId]/execute/route.ts"));

add("array transactions remain present for compatibility review", /\$transaction\(\s*\[/.test(read("lib/services/import-hub.service.ts") + read("app/[locale]/dashboard/organizations/page.tsx")));
add("interactive transactions remain present for compatibility review", /\$transaction\(async\s*\(/.test(read("lib/services/order.service.ts") + read("lib/services/product.service.ts")));
add("raw query usage remains limited and reviewed", /\$queryRaw`SELECT 1`/.test(health) && /\$queryRaw/.test(read("scripts/quality/validate-database-drift.mjs")));

add("runtime architecture doc exists", exists("docs/database/NEON_SERVERLESS_RUNTIME_ARCHITECTURE.md"));
add("connection variable policy doc exists", exists("docs/database/NEON_CONNECTION_VARIABLE_POLICY.md"));
add("Prisma 6 adapter migration doc exists", exists("docs/database/NEON_PRISMA_6_ADAPTER_MIGRATION.md"));
add("runtime validation report exists", exists("docs/database/NEON_RUNTIME_VALIDATION_REPORT.md"));
add("migration and CLI policy doc exists", exists("docs/database/NEON_MIGRATION_AND_CLI_POLICY.md"));
add("README updated for Neon runtime", /Neon Serverless/.test(readme));
add("source of truth updated for DB-NEON-01", /DB-NEON-01/.test(sourceTruth) && /Neon Serverless/.test(sourceTruth));
add("roadmap updated for DB-NEON-02", /DB-NEON-02/.test(roadmap));
add("package exposes db:neon:check", packageJson.scripts?.["db:neon:check"] === "tsx scripts/ops/check-neon-runtime-connectivity.ts");
add("package exposes Neon validator", packageJson.scripts?.["quality:neon-serverless-runtime"] === "node scripts/quality/validate-neon-serverless-runtime.mjs");
add("package exposes focused Neon tests", packageJson.scripts?.["test:neon-serverless-runtime"] === "node scripts/quality/test-neon-serverless-runtime.mjs");

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Neon serverless runtime validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Neon serverless runtime validation passed.");
