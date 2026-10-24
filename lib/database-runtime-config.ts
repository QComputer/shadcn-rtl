export type DatabaseRuntimeConfiguration = {
  adapter: "neon" | "postgresql";
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
};

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
export function resolveDatabaseRuntimeConfiguration(databaseUrl: string, env: Readonly<Record<string, string | undefined>>): DatabaseRuntimeConfiguration {
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("Invalid database runtime URL."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error("Invalid database runtime URL.");
  }
  const adapter = env.DATABASE_RUNTIME_ADAPTER?.trim() || "neon";
  if (adapter !== "neon" && adapter !== "postgresql") throw new Error("Unsupported DATABASE_RUNTIME_ADAPTER.");
  return {
    adapter,
    connectionString: databaseUrl,
    max: positiveInteger(env.DATABASE_POOL_MAX, 5, 100, "DATABASE_POOL_MAX"),
    connectionTimeoutMillis: positiveInteger(env.DATABASE_CONNECT_TIMEOUT_MS, 10_000, 120_000, "DATABASE_CONNECT_TIMEOUT_MS"),
    idleTimeoutMillis: positiveInteger(env.DATABASE_IDLE_TIMEOUT_MS, 10_000, 300_000, "DATABASE_IDLE_TIMEOUT_MS"),
  };
}
