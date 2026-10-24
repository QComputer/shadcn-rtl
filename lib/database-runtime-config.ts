export type DatabaseRuntimeConfiguration = {
  adapter: "neon" | "postgresql";
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
};

function postgresUrlFromEnvironment(env: Readonly<Record<string, string | undefined>>) {
  const host = env.PGHOST?.trim();
  const database = env.PGDATABASE;
  const user = env.PGUSER;
  const password = env.PGPASSWORD;
  const port = positiveInteger(env.PGPORT, 5432, 65_535, "PGPORT");
  if (!host || !database || !user || password === undefined) {
    throw new Error("Invalid PostgreSQL environment configuration: required PGHOST, PGDATABASE, PGUSER, and PGPASSWORD.");
  }
  if (/[\s/@?#]/.test(host) || /[\u0000-\u001f\u007f]/.test(database + user + password)) {
    throw new Error("Invalid PostgreSQL environment configuration.");
  }
  const urlHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${urlHost}:${port}/${encodeURIComponent(database)}`;
  try {
    const parsed = new URL(connectionString);
    if (!parsed.hostname || !parsed.pathname.slice(1)) throw new Error();
  } catch {
    throw new Error("Invalid PostgreSQL environment configuration.");
  }
  return connectionString;
}

/** Supplies Prisma CLI URLs only for explicit PostgreSQL adapter selection. */
export function applyPrismaPostgresEnvironment(env: Record<string, string | undefined>) {
  if (env.DATABASE_RUNTIME_ADAPTER?.trim() !== "postgresql") return;
  if (env.DATABASE_URL) return;
  const connectionString = postgresUrlFromEnvironment(env);
  env.DATABASE_URL = connectionString;
  if (env.DIRECT_URL === undefined) env.DIRECT_URL = connectionString;
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number, name: string) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`Invalid database configuration: ${name}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`Invalid database configuration: ${name}.`);
  }
  return parsed;
}

/** Explicit transport selection; never infer a provider or disable TLS from a hostname. */
export function resolveDatabaseRuntimeConfiguration(databaseUrl: string | undefined, env: Readonly<Record<string, string | undefined>>): DatabaseRuntimeConfiguration {
  const adapter = env.DATABASE_RUNTIME_ADAPTER?.trim() || "neon";
  if (adapter !== "neon" && adapter !== "postgresql") throw new Error("Unsupported DATABASE_RUNTIME_ADAPTER.");
  if (!databaseUrl && adapter === "postgresql") databaseUrl = postgresUrlFromEnvironment(env);
  if (!databaseUrl) throw new Error("Database runtime configuration is missing DATABASE_URL.");
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("Invalid database runtime URL."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error("Invalid database runtime URL.");
  }
  return {
    adapter,
    connectionString: databaseUrl,
    max: positiveInteger(env.DATABASE_POOL_MAX, 5, 100, "DATABASE_POOL_MAX"),
    connectionTimeoutMillis: positiveInteger(env.DATABASE_CONNECT_TIMEOUT_MS, 10_000, 120_000, "DATABASE_CONNECT_TIMEOUT_MS"),
    idleTimeoutMillis: positiveInteger(env.DATABASE_IDLE_TIMEOUT_MS, 10_000, 300_000, "DATABASE_IDLE_TIMEOUT_MS"),
  };
}
