import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const TASK = "hotel-website-c1b2-db-acceptance";
const USER = "c1b2_test";
const IMAGE = "postgres:17-alpine";
const fail = (message) => { throw new Error(message); };

function command(file, args) {
  try { return { status: 0, stdout: execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }), stderr: "" }; }
  catch (error) { return { status: Number.isInteger(error?.status) ? error.status : null, stdout: String(error?.stdout ?? ""), stderr: String(error?.stderr ?? error?.message ?? "") }; }
}

function jsonResult(result, label) {
  if (result.status !== 0) fail(`${label} failed with exit ${result.status ?? "unknown"}`);
  try { const value = JSON.parse(String(result.stdout).trim()); if (!value || typeof value !== "object") fail(`${label} returned invalid data`); return value; }
  catch (error) { if (error instanceof SyntaxError) fail(`${label} returned malformed JSON`); throw error; }
}

const sql = `SELECT json_build_object(
  'database', current_database(), 'user', current_user, 'schema', current_schema(),
  'serverVersionNum', current_setting('server_version_num')::int,
  'publicObjectCount', (SELECT count(*) FROM (
    SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_type WHERE typnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_operator WHERE oprnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_opclass WHERE opcnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_opfamily WHERE opfnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_collation WHERE collnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_conversion WHERE connamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_ts_config WHERE cfgnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_ts_dict WHERE dictnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_ts_parser WHERE prsnamespace='public'::regnamespace
    UNION ALL SELECT oid FROM pg_ts_template WHERE tmplnamespace='public'::regnamespace
  ) objects),
  'migrationLedger', to_regclass('public._prisma_migrations')::text
)::text;`;

export function parsePsql(text, expected) {
  const value = JSON.parse(String(text).trim());
  if (!value || typeof value !== "object") fail("SQL identity was not an object");
  const identity = { database: value.database, user: value.user, schema: value.schema, majorVersion: Math.floor(Number(value.serverVersionNum) / 10000), publicObjectCount: Number(value.publicObjectCount), migrationLedger: value.migrationLedger };
  if (identity.database !== expected.database || identity.user !== USER || identity.schema !== "public" || identity.majorVersion !== 17 || identity.publicObjectCount !== 0 || identity.migrationLedger !== null) fail("container-side SQL identity did not match the empty PostgreSQL 17 target");
  return identity;
}

async function hostSql(databaseUrl) {
  const rootRequire = createRequire(import.meta.url);
  const adapterEntry = rootRequire.resolve("@prisma/adapter-pg");
  const adapterRequire = createRequire(adapterEntry);
  const { Client } = adapterRequire("pg");
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query(sql);
    if (result.rows.length !== 1 || typeof result.rows[0]?.json_build_object !== "string") fail("host-side SQL returned an unexpected result");
    return parsePsql(result.rows[0].json_build_object, { database: new URL(databaseUrl).pathname.slice(1) });
  } finally { await client.end().catch(() => {}); }
}

async function main() {
  const env = process.env;
  if (env.HOTEL_WEBSITE_C1B2_PG_ACCEPTANCE !== "1" || env.AI_MEDIA_LOCAL_DOCKER_E2E !== "1") fail("explicit C1B2 and local Docker acceptance guards are required");
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") fail("production runtime is forbidden");
  const runId = env.HOTEL_WEBSITE_C1B2_RUN_ID?.toLowerCase();
  const containerId = env.HOTEL_WEBSITE_C1B2_CONTAINER_ID?.toLowerCase();
  const volumeName = env.HOTEL_WEBSITE_C1B2_VOLUME_NAME;
  if (!runId || !/^[a-f0-9]{8,16}$/.test(runId) || !containerId || !/^[a-f0-9]{64}$/.test(containerId)) fail("random run ID and full exact container ID are required");
  if (volumeName !== `hotel-website-c1b2-${runId}` || !env.DATABASE_URL || env.DIRECT_URL !== env.DATABASE_URL) fail("exact task volume and identical explicit process-local database URLs are required");
  const url = new URL(env.DATABASE_URL);
  const database = `bazarbaaz_hotel_c1b2_${runId}`;
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || !url.port || decodeURIComponent(url.username) !== USER || decodeURIComponent(url.pathname.slice(1)) !== database) fail("database URL does not match the loopback C1B2 target identity");

  const filters = ["--filter", `label=codex.task=${TASK}`, "--filter", `label=codex.run_id=${runId}`];
  const ids = command("docker", ["ps", "-aq", "--no-trunc", ...filters]);
  if (ids.status !== 0) fail("could not enumerate task-owned Docker container");
  const foundIds = ids.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (foundIds.length !== 1 || foundIds[0].toLowerCase() !== containerId) fail("exact task-owned container is missing or ambiguous");
  const containers = jsonResult(command("docker", ["inspect", containerId]), "Docker inspect");
  if (!Array.isArray(containers) || containers.length !== 1) fail("Docker inspect identity is malformed");
  const container = containers[0];
  if (container.Id.toLowerCase() !== containerId || container.Config.Image !== IMAGE || container.Config.Labels?.["codex.task"] !== TASK || container.Config.Labels?.["codex.run_id"] !== runId || container.State.Running !== true) fail("container identity, labels, image or runtime state mismatch");
  if (!container.Mounts?.some((mount) => mount.Type === "volume" && mount.Name === volumeName && mount.Destination === "/var/lib/postgresql/data")) fail("task volume is not mounted on this exact PostgreSQL container");
  const bindings = container.NetworkSettings.Ports["5432/tcp"];
  if (!Array.isArray(bindings) || bindings.length !== 1 || bindings[0].HostIp !== "127.0.0.1" || bindings[0].HostPort !== url.port) fail("PostgreSQL port is not bound exclusively to the expected loopback address");
  const volumes = command("docker", ["volume", "inspect", volumeName]);
  const volumeRows = jsonResult(volumes, "volume inspect");
  if (!Array.isArray(volumeRows) || volumeRows.length !== 1 || volumeRows[0].Labels?.["codex.task"] !== TASK || volumeRows[0].Labels?.["codex.run_id"] !== runId) fail("volume identity or labels mismatch");

  const psql = command("docker", ["exec", containerId, "psql", "-X", "-A", "-t", "-U", USER, "-d", database, "-c", sql]);
  if (psql.status !== 0) fail("container-side SQL identity command failed");
  const inside = parsePsql(psql.stdout, { database });
  const outside = await hostSql(env.DATABASE_URL);
  if (JSON.stringify(inside) !== JSON.stringify(outside)) fail("Docker-side and host-side SQL identities disagree");
  if (url.port !== bindings[0].HostPort) fail("host connection is not using the verified task port");
  console.log(JSON.stringify({ result: "PASS", runId, containerId, volumeName, database, user: USER, schema: "public", postgresMajor: 17, publicObjectCount: 0, migrationLedger: null, loopbackOnly: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`C1B2 identity gate failed: ${error.message}`); process.exitCode = 1; });
}
