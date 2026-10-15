import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { validateDatabaseIdentity, assertMatchingIdentitySources } from "../db/hotel-content-c1b1-identity-gate.mjs";

// No repository .env connection is consumed: every DB child receives the exact
// task-created loopback URL, verified independently from Docker and host SQL.
assert.equal(process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production", false);
const require = createRequire(import.meta.url);
const { Client } = createRequire(require.resolve("@prisma/adapter-pg"))("pg");
const runId = randomBytes(6).toString("hex");
const task = "hotel-secure-onboarding";
const name = `${task}-${runId}`;
const database = `hotel_onboarding_${runId}`;
const user = "hotel_onboarding_test";
const password = randomBytes(32).toString("hex");
const artifacts = path.resolve(".tmp", name);
await mkdir(artifacts, { recursive: true });
const report = { runId, task, artifacts, status: "RUNNING", cleanup: "PENDING", migrations: 0, checks: [] };
let containerId;
let volumeCreated = false;
let client;
let port;
let server;
let serverLog = "";
const docker = (args, env = process.env) => execFileSync("docker", args, { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim();
function command(label, args, env) {
  const result = execFileSync(process.execPath, args, { encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  report.checks.push({ label, exitCode: 0 });
  console.log(`${label}: PASS`);
  return result;
}
async function unusedPort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
  const value = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return value;
}
const identitySql = `SELECT json_build_object('database',current_database()::text,'user',current_user::text,'schema',current_schema()::text,
 'majorVersion',current_setting('server_version_num')::int / 10000,
 'publicObjectCount',(SELECT count(*)::int FROM (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace UNION ALL SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace UNION ALL SELECT oid FROM pg_type WHERE typnamespace='public'::regnamespace) objects),
 'migrationLedger',to_regclass('public._prisma_migrations')::text)::text AS identity`;
try {
  assert.equal(docker(["info", "--format", "{{.ServerVersion}}"] ).length > 0, true);
  docker(["image", "inspect", "postgres:17-alpine", "--format", "{{.Id}}"]);
  docker(["volume", "create", "--label", `codex.task=${task}`, "--label", `codex.run_id=${runId}`, name]);
  volumeCreated = true;
  containerId = docker(["run", "--pull=never", "-d", "--name", name, "--label", `codex.task=${task}`, "--label", `codex.run_id=${runId}`,
    "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_USER", "--env", "POSTGRES_DB", "-p", "127.0.0.1::5432", "--mount", `type=volume,src=${name},dst=/var/lib/postgresql/data`, "postgres:17-alpine"],
    { ...process.env, POSTGRES_PASSWORD: password, POSTGRES_USER: user, POSTGRES_DB: database });
  assert.match(containerId, /^[a-f0-9]{64}$/);
  report.containerId = containerId;
  report.volume = name;
  for (let attempt = 0; ; attempt++) {
    try { docker(["exec", containerId, "pg_isready", "-h", "127.0.0.1", "-U", user, "-d", database]); break; }
    catch { if (attempt >= 60) throw new Error("TASK_DATABASE_NOT_READY"); await pause(250); }
  }
  const [container] = JSON.parse(docker(["inspect", containerId]));
  const [volume] = JSON.parse(docker(["volume", "inspect", name]));
  assert.equal(container.Config.Labels["codex.task"], task);
  assert.equal(container.Config.Labels["codex.run_id"], runId);
  assert.equal(container.Config.Image, "postgres:17-alpine");
  assert.equal(volume.Labels["codex.run_id"], runId);
  assert.ok(container.Mounts.some((mount) => mount.Name === name && mount.Destination === "/var/lib/postgresql/data"));
  const bindings = container.NetworkSettings.Ports["5432/tcp"];
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].HostIp, "127.0.0.1");
  port = Number(bindings[0].HostPort);
  report.host = "127.0.0.1";
  report.port = port;
  const databaseUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
  client = new Client({ connectionString: databaseUrl, ssl: false, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const hostIdentity = JSON.parse((await client.query(identitySql)).rows[0].identity);
  await client.query("ROLLBACK");
  const dockerIdentity = JSON.parse(docker(["exec", containerId, "psql", "-XAtq", "--set", "ON_ERROR_STOP=1", "-U", user, "-d", database, "-c", `BEGIN READ ONLY; ${identitySql}; ROLLBACK;`]));
  validateDatabaseIdentity(hostIdentity, { database, user });
  validateDatabaseIdentity(dockerIdentity, { database, user });
  assertMatchingIdentitySources(hostIdentity, dockerIdentity);
  report.identity = hostIdentity;
  console.log("Docker and host READ ONLY identity probes: PASS; empty public schema; absent migration ledger");
  const env = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, NODE_ENV: "test", VERCEL_ENV: "development", AI_MEDIA_LOCAL_DOCKER_E2E: "1",
    HOTEL_ONBOARDING_PG_ACCEPTANCE: "1", HOTEL_ONBOARDING_RUN_ID: runId, HOTEL_ONBOARDING_CONTAINER_ID: containerId, HOTEL_ONBOARDING_ARTIFACTS: artifacts };
  const prisma = require.resolve("prisma/build/index.js");
  const names = (await readdir("prisma/migrations", { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort();
  assert.equal(names.at(-1), "20261015160000_bound_organization_invitations");
  await writeFile(path.join(artifacts, "migrate-deploy.log"), command("Migration deploy", [prisma, "migrate", "deploy"], env));
  const ledger = (await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
  assert.deepEqual(ledger.map((row) => row.migration_name), names);
  for (const row of ledger) {
    assert.ok(row.finished_at && !row.rolled_back_at);
    const sql = await readFile(path.join("prisma/migrations", row.migration_name, "migration.sql"));
    assert.equal(row.checksum, createHash("sha256").update(sql).digest("hex"));
  }
  report.migrations = ledger.length;
  await writeFile(path.join(artifacts, "migration-manifest.json"), JSON.stringify(ledger, null, 2));
  console.log(`${ledger.length}/${names.length} migrations and file checksums verified`);
  await writeFile(path.join(artifacts, "postgres-tests.log"), command("PostgreSQL acceptance", ["--import", "tsx", "--require=./scripts/e2e/register-server-only.cjs", "--test", "tests/integration/organization-onboarding.postgres.local.test.ts"], env));
  if (process.argv.includes("--security")) {
    await writeFile(path.join(artifacts, "release-safety-tests.log"), command("Release safety PostgreSQL acceptance", ["--import", "tsx", "--require=./scripts/e2e/register-server-only.cjs", "--test", "tests/integration/release-safety.postgres.local.test.ts"], env));
  }
  if (process.argv.includes("--browser") || process.argv.includes("--production-browser")) {
    const productionBrowser = process.argv.includes("--production-browser");
    const appPort = await unusedPort();
    report.applicationPort = appPort;
    const appEnv = { ...env, NODE_ENV: productionBrowser ? "production" : "development", NEXTAUTH_SECRET: randomBytes(32).toString("hex"), AUTH_TRUST_HOST: "true", NEXTAUTH_URL: `http://bazarbaaz.ir:${appPort}`,
      NEXT_PUBLIC_APP_URL: `http://bazarbaaz.ir:${appPort}`, NEXT_TELEMETRY_DISABLED: "1", HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED: "1",
      HOTEL_ONBOARDING_SERVER_MODE: productionBrowser ? "PRODUCTION" : "DEVELOPMENT", HOTEL_ONBOARDING_APP_PORT: String(appPort), HOTEL_ONBOARDING_TEST_PASSWORD: randomBytes(24).toString("base64url"), PWA_ENABLED: "false", NEXT_PUBLIC_PWA_ENABLED: "false",
      GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", VERCEL: "", APP_PATH: "", NEXT_PUBLIC_APP_BASE_PATH: "" };
    server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...(productionBrowser ? ["start"] : ["dev", "--webpack"]), "--hostname", "127.0.0.1", "--port", String(appPort)], { env: appEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const collect = (chunk) => { const text = chunk.toString().split(databaseUrl).join("<task-db>").split(password).join("<redacted>"); serverLog += text; appendFileSync(path.join(artifacts, "application.log"), text); };
    server.stdout.on("data", collect);
    server.stderr.on("data", collect);
    for (let attempt = 0; ; attempt++) {
      if (server.exitCode !== null) throw new Error("TASK_SERVER_EXITED");
      if (serverLog.includes("Ready in")) break;
      if (attempt > 120) throw new Error("TASK_SERVER_NOT_READY");
      await pause(500);
    }
    const browserLog = await new Promise((resolve, reject) => {
      const browser = spawn(process.execPath, ["--import", "tsx", "--require=./scripts/e2e/register-server-only.cjs", "tests/organization-onboarding.browser.ts"], { env: appEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      let output = "";
      browser.stdout.on("data", (chunk) => { output += chunk.toString(); process.stdout.write(chunk); });
      browser.stderr.on("data", (chunk) => { output += chunk.toString(); process.stderr.write(chunk); });
      browser.once("error", reject);
      browser.once("exit", (code) => { writeFile(path.join(artifacts, "browser-tests.log"), output).then(() => code === 0 ? resolve(output) : reject(new Error("BROWSER_ACCEPTANCE_FAILED")), reject); });
    });
    report.checks.push({ label: productionBrowser ? "Authenticated production-server browser acceptance" : "Authenticated development-server browser acceptance", exitCode: 0 });
    console.log(browserLog);
  }
  report.status = "PASSED";
  report.exitCode = 0;
} catch (error) {
  report.status = "FAILED";
  report.exitCode = 1;
  report.error = String(error.message).split(password).join("<redacted>").replace(/postgres(?:ql)?:\/\/[^\s]+/g, "<redacted-db-url>").slice(0, 400);
  if (error.stdout) await writeFile(path.join(artifacts, "failed-command.log"), String(error.stdout).replaceAll(password, "<redacted>"));
  console.error(`Acceptance failed: ${report.error}`);
} finally {
  if (server?.pid && server.exitCode === null) {
    if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch {} }
    else server.kill("SIGTERM");
  }
  if (serverLog) await writeFile(path.join(artifacts, "application.log"), serverLog);
  if (client) await client.end().catch(() => {});
  try {
    if (containerId) {
      const [owned] = JSON.parse(docker(["inspect", containerId]));
      assert.equal(owned.Id, containerId);
      assert.equal(owned.Config.Labels["codex.task"], task);
      assert.equal(owned.Config.Labels["codex.run_id"], runId);
      if (report.status !== "PASSED") {
        try { await writeFile(path.join(artifacts, "postgres-container.log"), execFileSync("docker", ["logs", containerId], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).replaceAll(password, "<redacted>")); } catch {}
      }
      docker(["rm", "-f", containerId]);
      assert.equal(docker(["ps", "-aq", "--no-trunc", "--filter", `id=${containerId}`]), "");
    }
    if (volumeCreated) {
      const [owned] = JSON.parse(docker(["volume", "inspect", name]));
      assert.equal(owned.Labels["codex.task"], task);
      assert.equal(owned.Labels["codex.run_id"], runId);
      docker(["volume", "rm", name]);
      assert.equal(docker(["volume", "ls", "--filter", `name=^${name}$`, "--format", "{{.Name}}"]), "");
    }
    if (port) {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      const open = await new Promise((resolve) => { socket.once("connect", () => resolve(true)); socket.once("error", () => resolve(false)); socket.setTimeout(3000, () => resolve(true)); });
      socket.destroy();
      assert.equal(open, false);
    }
    report.cleanup = "PASSED";
  } catch { report.cleanup = "FAILED"; report.exitCode = 1; }
  await writeFile(path.join(artifacts, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exitCode = report.exitCode ?? 1;
}
