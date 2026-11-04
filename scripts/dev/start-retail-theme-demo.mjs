import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const expectedDatabase = "retail_hero_test";
const expectedPort = "55439";
const host = "127.0.0.1";
const port = "3027";

function assertDatabaseTarget() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    let url;
    try { url = new URL(process.env[key] ?? ""); }
    catch { throw new Error(`${key} is required for the isolated local Retail theme demo.`); }
    if (!/^postgres(ql)?:$/.test(url.protocol) || url.hostname !== host || url.port !== expectedPort || url.pathname !== `/${expectedDatabase}`) {
      throw new Error(`${key} must target ${host}:${expectedPort}/${expectedDatabase}.`);
    }
  }
  if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== expectedPort || process.env.RETAIL_HERO_EXPECTED_DATABASE !== expectedDatabase || process.env.DATABASE_RUNTIME_ADAPTER !== "postgresql") {
    throw new Error("The local Retail theme database guard is missing.");
  }
}

function localAppEnvironment() {
  const allowedSystem = ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];
  const env = Object.fromEntries(allowedSystem.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
  for (const key of ["DATABASE_URL", "DIRECT_URL", "LOCAL_PRISMA_EXPECTED_PORT", "RETAIL_HERO_EXPECTED_DATABASE", "DATABASE_RUNTIME_ADAPTER"]) env[key] = process.env[key];
  const mediaRoot = path.join(os.tmpdir(), "codex-retail-theme-demo-media");
  const envPreloader = path.join(projectRoot, "scripts", "dev", "isolated-next-env.cjs");
  Object.assign(env, {
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXTAUTH_URL: `http://${host}:${port}`,
    NEXTAUTH_URL_INTERNAL: `http://${host}:${port}`,
    NEXTAUTH_SECRET: "codex-local-retail-theme-demo-secret-2026-only",
    AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_APP_URL: `http://${host}:${port}`,
    NEXT_PUBLIC_DEPLOYED_APP_URL: `http://${host}:${port}`,
    BAZAR_BAZ_PLATFORM_HOSTS: `localhost,127.0.0.1,${host}`,
    APPLICATION_STORAGE_ADAPTER: "persistent-disk",
    MEDIA_STORAGE_ROOT: mediaRoot,
    SMS_PROVIDER: "DRY_RUN",
    SMS_DRY_RUN: "true",
    SMS_REAL_SEND_ENABLED: "false",
    SMS_GUEST_REAL_SEND_ENABLED: "false",
    EMAIL_PROVIDER: "DRY_RUN",
    EMAIL_REAL_SEND_ENABLED: "false",
    CUSTOM_DOMAIN_PROVIDER_ENABLED: "false",
    CUSTOM_DOMAIN_REAL_MUTATION_ENABLED: "false",
    VERCEL_DOMAIN_AUTOMATION_DRY_RUN: "true",
    RUNFLARE_DOMAIN_AUTOMATION_DRY_RUN: "true",
    WEB_PUSH_ENABLED: "false",
    WEB_PUSH_REAL_SEND_ENABLED: "false",
    BLOB_READ_WRITE_TOKEN: "",
    VERCEL_API_TOKEN: "",
    VERCEL_ACCESS_TOKEN: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `--require=${envPreloader.replaceAll("\\", "/")}`,
  });
  const externalCredentialKeys = ["BLOB_READ_WRITE_TOKEN", "VERCEL_API_TOKEN", "VERCEL_ACCESS_TOKEN", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
  if (externalCredentialKeys.some(key => env[key] !== "")) throw new Error("External provider credentials must be disabled for the local theme demo.");
  return env;
}

async function assertFixtureExists(env) {
  const localRequire = createRequire(import.meta.url);
  const PrismaClient = localRequire("@prisma/client").PrismaClient;
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    const [identity] = await prisma.$queryRaw`SELECT current_database()::text AS database, current_setting('server_version_num')::int AS version`;
    if (identity.database !== expectedDatabase || identity.version < 170000 || identity.version >= 180000) throw new Error("Database identity is not the isolated PostgreSQL 17 fixture target.");
    const product = await prisma.product.findFirst({ where: { slug: "theme-card-synthetic-demo", organization: { slug: "codex-local-retail-theme-demo" }, deletedAt: null }, select: { id: true, gallerySettings: true } });
    if (!product) throw new Error("Seed the synthetic product first with scripts/dev/retail-theme-media-fixture.ts.");
    const user = await prisma.user.findUnique({ where: { email: "retail-theme-demo@example.test" }, select: { id: true, isActive: true, isTeamMember: true } });
    const membership = user && await prisma.organizationMember.findFirst({ where: { userId: user.id, organization: { slug: "codex-local-retail-theme-demo" }, role: "ADMIN", isActive: true }, select: { id: true } });
    if (!user?.isActive || !user.isTeamMember || !membership) throw new Error("The normal local admin membership is missing; reseed the synthetic fixture.");
    const settings = product.gallerySettings;
    const groups = settings && typeof settings === "object" && !Array.isArray(settings) ? settings.appearanceGroups : undefined;
    if (!Array.isArray(groups) || groups.length !== 4) throw new Error("The synthetic appearance save/read fixture is incomplete; reseed it first.");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assertDatabaseTarget();
  const env = localAppEnvironment();
  await assertFixtureExists(env);

  const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextCli, "dev", "--hostname", host, "--port", port], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Local Retail theme demo failed to start.");
  process.exitCode = 1;
});
