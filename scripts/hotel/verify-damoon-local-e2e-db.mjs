import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

export function validateLocalDamoonTarget(env = process.env) {
  const errors = [];
  if (env.DAMOON_LOCAL_E2E !== "1") errors.push("Explicit DAMOON_LOCAL_E2E=1 opt-in is required.");
  if (env.DAMOON_E2E_ENABLED !== "1") errors.push("DAMOON_E2E_ENABLED=1 is required.");
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") errors.push("Production execution is forbidden.");
  if (!env.LOCAL_PRISMA_EXPECTED_PORT || !/^\d{2,5}$/.test(env.LOCAL_PRISMA_EXPECTED_PORT) || env.LOCAL_PRISMA_EXPECTED_PORT === "5432") {
    errors.push("LOCAL_PRISMA_EXPECTED_PORT must be an explicitly opted-in non-default test port.");
  }
  if (!env.DATABASE_URL || env.DATABASE_URL !== env.DIRECT_URL) errors.push("DATABASE_URL and DIRECT_URL must be identical.");

  let url;
  try { url = new URL(env.DATABASE_URL || ""); } catch { errors.push("DATABASE_URL must be a valid PostgreSQL URL."); }
  if (!url) return { ok: false, errors };

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const suffix = databaseName.startsWith("damoon_") ? databaseName.slice("damoon_".length) : "";
  if (url.protocol !== "postgresql:") errors.push("DATABASE_URL must use postgresql.");
  if (url.hostname !== "127.0.0.1") errors.push("DATABASE_URL must use the IPv4 loopback host.");
  if (url.port !== env.LOCAL_PRISMA_EXPECTED_PORT) errors.push("DATABASE_URL port must match LOCAL_PRISMA_EXPECTED_PORT.");
  if (!/^[a-f0-9]{16}$/i.test(suffix)) errors.push("Database name must be damoon_<16 hex characters>.");
  if (!suffix || decodeURIComponent(url.username) !== `damoon_test_${suffix}`) errors.push("Database URL must use its dedicated matching test role.");
  if (!decodeURIComponent(url.password) || decodeURIComponent(url.password) === "postgres") errors.push("A unique test-role password is required.");
  if (url.searchParams.size !== 1 || url.searchParams.get("schema") !== "public" || url.hash) errors.push("Only the public schema may be selected.");
  if (env.DAMOON_CI_DATABASE_NAME !== databaseName) errors.push("DAMOON_CI_DATABASE_NAME must match DATABASE_URL.");
  if (env.DAMOON_E2E_DATABASE_USER !== decodeURIComponent(url.username)) errors.push("DAMOON_E2E_DATABASE_USER must match the URL role.");

  return { ok: errors.length === 0, errors, databaseName, databaseUser: decodeURIComponent(url.username), expectedPort: env.LOCAL_PRISMA_EXPECTED_PORT };
}

export async function verifyLocalDamoonDatabase(env = process.env) {
  const target = validateLocalDamoonTarget(env);
  if (!target.ok) throw new Error(target.errors.join(" "));

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRaw`
      SELECT current_database() AS "databaseName",
             current_user AS "userName",
             current_schema() AS "schemaName",
             current_setting('server_version_num')::int AS "version",
             inet_server_port() AS "serverPort",
             inet_server_addr()::text AS "serverAddress"
    `;
    if (
      identity?.databaseName !== target.databaseName ||
      identity.userName !== target.databaseUser ||
      identity.schemaName !== "public" ||
      identity.version < 170000 || identity.version >= 180000 ||
      identity.serverPort !== 5432 || !identity.serverAddress
    ) {
      throw new Error("Connected target identity does not match the isolated PostgreSQL 17 test database.");
    }
    return { databaseName: identity.databaseName, databaseUser: identity.userName, schemaName: identity.schemaName, serverMajor: 17, serverPort: identity.serverPort };
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const identity = await verifyLocalDamoonDatabase();
    console.log(`Verified disposable PostgreSQL ${identity.serverMajor} identity for ${identity.databaseName} as ${identity.databaseUser}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database identity verification failed.";
    console.error(`Damoon local database preflight refused to continue: ${message}`);
    process.exitCode = 1;
  }
}
