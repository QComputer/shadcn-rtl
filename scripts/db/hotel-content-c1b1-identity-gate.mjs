import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const TASK_LABEL = "hotel-content-c1b1-db-acceptance";
const DATABASE_USER = "c1b1_test";
const IMAGE = "postgres:17-alpine";

function fail(message) {
  throw new Error(message);
}

export function parseCommandJson({ status, stdout, stderr = "" }, label) {
  if (status !== 0) {
    const detail = String(stderr || stdout || "").trim().slice(0, 500);
    fail(`${label} command failed (exit ${status ?? "unknown"})${detail ? `: ${detail}` : ""}`);
  }
  const text = String(stdout ?? "").trim();
  if (!text) fail(`${label} returned empty output`);
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") fail(`${label} returned a non-object JSON value`);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${label} returned invalid JSON`);
    throw error;
  }
}

export function validateDatabaseIdentity(identity, expected) {
  if (!identity || typeof identity !== "object") fail("identity result is missing");
  if (identity.database !== expected.database) fail("database identity mismatch");
  if (identity.user !== expected.user) fail("database user mismatch");
  if (identity.schema !== "public") fail("unexpected database schema");
  if (Number(identity.majorVersion) !== 17) fail("PostgreSQL major version must be 17");
  if (!Number.isInteger(Number(identity.publicObjectCount)) || Number(identity.publicObjectCount) !== 0) fail("public schema must be empty before migration");
  if (identity.migrationLedger !== null) fail("Prisma migration ledger already exists");
  return identity;
}

export function assertMatchingIdentitySources(dockerIdentity, hostIdentity) {
  for (const key of ["database", "user", "schema", "majorVersion", "publicObjectCount", "migrationLedger"]) {
    if (dockerIdentity[key] !== hostIdentity[key]) fail(`Docker-side and host-side identity disagree on ${key}`);
  }
  return hostIdentity;
}

function command(file, args) {
  let result;
  try {
    result = execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    return { status: 0, stdout: result, stderr: "" };
  } catch (error) {
    return {
      status: Number.isInteger(error?.status) ? error.status : null,
      stdout: String(error?.stdout ?? ""),
      stderr: String(error?.stderr ?? error?.message ?? ""),
    };
  }
}

function runJson(file, args, label) {
  return parseCommandJson(command(file, args), label);
}

export function expectedContext(env = process.env) {
  const runId = env.HOTEL_CONTENT_C1B1_RUN_ID?.toLowerCase();
  const containerId = env.HOTEL_CONTENT_C1B1_CONTAINER_ID;
  const volumeName = env.HOTEL_CONTENT_C1B1_VOLUME_NAME;
  const databaseUrl = env.DATABASE_URL;
  if (env.HOTEL_CONTENT_C1B1_PG_ACCEPTANCE !== "1" || env.AI_MEDIA_LOCAL_DOCKER_E2E !== "1") fail("explicit C1B1 and local Docker acceptance guards are required");
  if (!runId || !/^[a-f0-9]{8,16}$/.test(runId)) fail("run ID must be 8-16 lowercase hex characters");
  if (!containerId || !/^[a-f0-9]{64}$/i.test(containerId)) fail("full Docker container ID is required");
  if (volumeName !== `hotel-content-c1b1-${runId}`) fail("task volume name does not match run ID");
  if (!databaseUrl || env.DIRECT_URL !== databaseUrl) fail("DATABASE_URL and DIRECT_URL must be explicitly set to the same target");

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL is malformed");
  }
  const database = `bazarbaaz_hotel_c1b1_${runId}`;
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || !url.port) fail("database URL must use a published loopback PostgreSQL port");
  if (decodeURIComponent(url.username) !== DATABASE_USER || decodeURIComponent(url.pathname.slice(1)) !== database) fail("database URL user or database does not match the task identity");
  return { runId, containerId: containerId.toLowerCase(), volumeName, database, user: DATABASE_USER, port: url.port, databaseUrl };
}

export function taskRunFilters(runId) {
  if (!/^[a-f0-9]{8,16}$/.test(runId ?? "")) fail("run-scoped Docker filters require a valid run ID");
  return ["--filter", `label=codex.task=${TASK_LABEL}`, "--filter", `label=codex.run_id=${runId}`];
}

function inspectOwnedResources(expected) {
  const filters = taskRunFilters(expected.runId);
  const containerResult = command("docker", ["ps", "-aq", "--no-trunc", ...filters]);
  if (containerResult.status !== 0) fail("task container listing failed");
  const containerIds = String(containerResult.stdout).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (containerIds.length !== 1 || String(containerIds[0]).toLowerCase() !== expected.containerId) fail("unexpected or missing task-owned container");

  const volumesResult = command("docker", ["volume", "ls", ...filters, "--format", "{{.Name}}"]);
  if (volumesResult.status !== 0) parseCommandJson(volumesResult, "task volume listing");
  const volumes = String(volumesResult.stdout).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (volumes.length !== 1 || volumes[0] !== expected.volumeName) fail("unexpected or missing task-owned volume");
  const volume = runJson("docker", ["volume", "inspect", expected.volumeName], "volume inspect");
  if (!Array.isArray(volume) || volume.length !== 1 || volume[0].Name !== expected.volumeName || volume[0].Labels?.["codex.task"] !== TASK_LABEL || volume[0].Labels?.["codex.run_id"] !== expected.runId) fail("volume identity or task/run labels mismatch");

  const container = runJson("docker", ["inspect", expected.containerId], "container inspect");
  if (!Array.isArray(container) || container.length !== 1) fail("container inspect returned an invalid shape");
  const item = container[0];
  if (String(item.Id).toLowerCase() !== expected.containerId) fail("container ID mismatch");
  if (item.Config?.Image !== IMAGE || item.Config?.Labels?.["codex.task"] !== TASK_LABEL || item.Config?.Labels?.["codex.run_id"] !== expected.runId) fail("container image or task/run labels mismatch");
  if (item.State?.Running !== true) fail("task container is not running");
  if (!item.Mounts?.some((mount) => mount.Type === "volume" && mount.Name === expected.volumeName && mount.Destination === "/var/lib/postgresql/data")) fail("task-owned volume is not mounted at the PostgreSQL data path");
  const bindings = item.NetworkSettings?.Ports?.["5432/tcp"];
  if (!Array.isArray(bindings) || bindings.length !== 1 || bindings[0].HostIp !== "127.0.0.1" || bindings[0].HostPort !== expected.port) fail("PostgreSQL must have exactly one matching 127.0.0.1 binding");
  return item;
}

const identitySql = `SELECT json_build_object(
  'database', current_database(),
  'user', current_user,
  'schema', current_schema(),
  'majorVersion', split_part(current_setting('server_version'), '.', 1)::int,
  'publicObjectCount', (
    SELECT count(*) FROM (
      SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_type WHERE typnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_operator WHERE oprnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_opclass WHERE opcnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_opfamily WHERE opfnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_collation WHERE collnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_conversion WHERE connamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_ts_config WHERE cfgnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_ts_dict WHERE dictnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_ts_parser WHERE prsnamespace = 'public'::regnamespace
      UNION ALL SELECT oid FROM pg_ts_template WHERE tmplnamespace = 'public'::regnamespace
    ) AS public_objects
  ),
  'migrationLedger', to_regclass('public._prisma_migrations')::text
)::text`;

async function hostIdentity(expected) {
  const rootRequire = createRequire(import.meta.url);
  const adapterEntry = rootRequire.resolve("@prisma/adapter-pg");
  const adapterRequire = createRequire(adapterEntry);
  const { Client } = adapterRequire("pg");
  const client = new Client({ connectionString: expected.databaseUrl, connectionTimeoutMillis: 5000, ssl: false, application_name: "hotel-content-c1b1-identity-gate" });
  try {
    await client.connect();
    const result = await client.query(identitySql);
    if (result.rowCount !== 1 || typeof result.rows[0]?.json_build_object !== "string") fail("host PostgreSQL identity query returned an invalid result");
    return parseCommandJson({ status: 0, stdout: result.rows[0].json_build_object }, "host PostgreSQL identity query");
  } catch (error) {
    const message = String(error?.message ?? "connection failed")
      .replace(expected.databaseUrl, "<DATABASE_URL redacted>")
      .replace(/postgres(?:ql)?:\/\/[^\s@]+:[^\s@]+@/gi, "postgresql://<credentials redacted>@");
    fail(`host PostgreSQL identity query failed: ${message.slice(0, 300)}`);
  } finally {
    await client.end().catch(() => {});
  }
}

function dockerIdentity(expected) {
  const sql = identitySql;
  const output = command("docker", ["exec", expected.containerId, "psql", "-X", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--username", expected.user, "--dbname", expected.database, "--command", sql]);
  return parseCommandJson(output, "container-side psql identity query");
}

export async function runIdentityGate(env = process.env) {
  const expected = expectedContext(env);
  inspectOwnedResources(expected);
  const dockerResult = validateDatabaseIdentity(dockerIdentity(expected), expected);
  const hostResult = validateDatabaseIdentity(await hostIdentity(expected), expected);
  assertMatchingIdentitySources(dockerResult, hostResult);
  const report = { status: "PASS", runId: expected.runId, containerId: expected.containerId, volumeName: expected.volumeName, host: "127.0.0.1", port: Number(expected.port), identity: hostResult };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runIdentityGate().catch((error) => {
    process.stderr.write(`IDENTITY_GATE_BLOCKED: ${String(error?.message ?? error).slice(0, 500)}\n`);
    process.exitCode = 1;
  });
}
