const DEFAULT_APP_URL = "http://127.0.0.1:3107";
const EXPECTED_PORT = "5436";

function parseTarget(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Retail recovery refused: ${label} must be a valid URL.`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`Retail recovery refused: ${label} must use PostgreSQL.`);
  }
  if (url.hostname !== "127.0.0.1" || url.port !== EXPECTED_PORT) {
    throw new Error(`Retail recovery refused: ${label} must target 127.0.0.1:${EXPECTED_PORT}.`);
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^retail_ui_e2e_[a-z0-9_]+$/i.test(database)) {
    throw new Error(`Retail recovery refused: ${label} must name a disposable retail_ui_e2e_* database.`);
  }
  return database;
}

export function assertRetailRecoveryEnvironment(env = process.env) {
  if (env.RETAIL_RECOVERY_DISPOSABLE !== "true") {
    throw new Error("Retail recovery refused: set RETAIL_RECOVERY_DISPOSABLE=true only for an isolated disposable database.");
  }
  if (env.NODE_ENV === "production" || env.VERCEL || env.VERCEL_ENV === "production") {
    throw new Error("Retail recovery refused: production deployment environment detected.");
  }

  const base = new URL(env.E2E_BASE_URL || DEFAULT_APP_URL);
  if (base.protocol !== "http:" || base.hostname !== "127.0.0.1" || base.port !== "3107" || base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
    throw new Error("Retail recovery refused: E2E_BASE_URL must be http://127.0.0.1:3107.");
  }

  const database = parseTarget(env.DATABASE_URL || "", "DATABASE_URL");
  const directDatabase = parseTarget(env.DIRECT_URL || "", "DIRECT_URL");
  const dbUrl = new URL(env.DATABASE_URL);
  const directUrl = new URL(env.DIRECT_URL);
  const hasAllowedQuery = (url) => [...url.searchParams].every(([key, value]) => key === "schema" && value === "public");
  if (!hasAllowedQuery(dbUrl) || !hasAllowedQuery(directUrl) || env.DATABASE_RUNTIME_ADAPTER !== "postgresql") {
    throw new Error("Retail recovery refused: database URLs may only use schema=public and the PostgreSQL runtime adapter.");
  }
  if (database !== directDatabase || env.E2E_DATABASE_NAME !== database || env.LOCAL_PRISMA_EXPECTED_PORT !== EXPECTED_PORT) {
    throw new Error("Retail recovery refused: DATABASE_URL, DIRECT_URL, and E2E_DATABASE_NAME must identify the same disposable database.");
  }
  return { appUrl: DEFAULT_APP_URL, databaseName: database };
}
