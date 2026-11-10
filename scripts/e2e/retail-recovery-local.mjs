import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (!process.argv.includes("--disposable-local") || process.versions.node.split(".")[0] !== "24") {
  throw new Error("Use Node 24 and --disposable-local; this command creates and drops its own local test database.");
}
if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.VERCEL_ENV === "production") {
  throw new Error("Refusing hosted/Production execution.");
}
process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", () => reject(new Error("Local test port 3107 is occupied; no existing server will be reused.")));
  probe.listen(3107, "127.0.0.1", () => probe.close(resolve));
});
const require = createRequire(import.meta.url);
// Reuse the PostgreSQL driver from the locked adapter; do not install an extra dependency.
const pg = createRequire(require.resolve("@prisma/adapter-pg"))("pg");
const stamp = `${Date.now()}${randomBytes(4).toString("hex")}`;
const name = `retail_ui_e2e_${stamp}`;
const out = `.tmp/retail-recovery/${stamp}`;
fs.mkdirSync(out, { recursive: true });
const dockerArgs = process.platform === "win32" ? ["--host", "npipe:////./pipe/docker_engine_linux"] : [];
const [container] = JSON.parse(execFileSync("docker", [...dockerArgs, "inspect", "pg-cron"], { timeout: 8000, encoding: "utf8" }));
if (!/^postgres(?::|@)/.test(container.Config.Image) ||
    !container.NetworkSettings.Ports?.["5432/tcp"]?.some(port => port.HostPort === "5436")) {
  throw new Error("Expected local PostgreSQL test container pg-cron published on port 5436.");
}
const config = Object.fromEntries(container.Config.Env.map(value => {
  const index = value.indexOf("="); return [value.slice(0, index), value.slice(index + 1)];
}));
const admin = new pg.Client({ host: "127.0.0.1", port: 5436, user: config.POSTGRES_USER ?? "postgres",
  password: config.POSTGRES_PASSWORD, database: "postgres", connectionTimeoutMillis: 3000 });
const result = { database: name, sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
  status: "FAILED", exitCode: 1, cleanup: "NOT_RUN", commands: [] };
let created = false, server;
const serverLog = fs.openSync(`${out}/server.log`, "w");
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  const url = new URL(`postgresql://127.0.0.1:5436/${name}`);
  url.username = config.POSTGRES_USER ?? "postgres"; url.password = config.POSTGRES_PASSWORD;
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: url.href, DIRECT_URL: url.href,
    DATABASE_RUNTIME_ADAPTER: "postgresql", LOCAL_PRISMA_EXPECTED_PORT: "5436", LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE: "true",
    RETAIL_RECOVERY_DISPOSABLE: "true", E2E_DATABASE_NAME: name, E2E_STAMP: stamp, E2E_BASE_URL: "http://127.0.0.1:3107",
    E2E_OUTPUT_DIR: out, AUTH_URL: "http://127.0.0.1:3107", NEXTAUTH_URL: "http://127.0.0.1:3107",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3107", AUTH_TRUST_HOST: "true", NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
    HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED: "0", HOTEL_CRON_SCHEDULER_ENABLED: "0", CUSTOMER_AUTH_SMS_WORKER_ENABLED: "0",
    AI_MEDIA_APPLICATION_STORAGE_ADAPTER: "local-test" };
  function run(label, args, timeout = 240000) {
    const descriptor = fs.openSync(`${out}/${label}.log`, "w");
    const command = { label, args, exitCode: 1 }; result.commands.push(command);
    try {
      execFileSync(process.execPath, args, { env, timeout, stdio: ["ignore", descriptor, descriptor], windowsHide: true });
      command.exitCode = 0; console.log(`${label}: exit 0`);
    } catch { throw new Error(`${label} failed; inspect ${out}/${label}.log`); }
    finally { fs.closeSync(descriptor); }
  }
  run("migrations", ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run("seed", ["--import", "tsx", "--require", "./scripts/e2e/register-server-only.cjs", "tests/e2e/retail-recovery/seed.mts"]);
  run("cafe-regression", ["--import", "tsx", "--require", "./scripts/e2e/register-server-only.cjs", "--test", "tests/integration/cafe-leo-import.local.test.ts"]);
  run("checkout-regression", ["--import", "tsx", "--require", "./scripts/e2e/register-server-only.cjs", "--test", "tests/integration/retail-recovery-checkout.local.test.ts"]);
  const servicesOnly = process.argv.includes("--services-only");
  if (servicesOnly) {
    result.serverMode = "services-only";
  } else {
    const built = process.argv.includes("--built");
    result.serverMode = built ? "built-local" : "development-local";
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...(built ? ["start"] : ["dev", "--webpack"]), "--hostname", "127.0.0.1", "--port", "3107"],
      { env: { ...env, NODE_ENV: built ? "production" : "development" }, stdio: ["ignore", serverLog, serverLog], windowsHide: true });
    let ready = false;
    for (let i = 0; i < 90 && server.exitCode === null; i++) {
      try { if ((await fetch("http://127.0.0.1:3107/api/auth/csrf", { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* Wait only for this owned server. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Isolated server readiness failed; inspect server.log.");
    run("browser", ["tests/e2e/retail-recovery/retail-ui-e2e-runner.mjs"], 900000);
    const browserResult = JSON.parse(fs.readFileSync(`${out}/browser-results.json`, "utf8"));
    if (browserResult.status !== "PASSED" || browserResult.exitCode !== 0 || browserResult.passed !== 7 || browserResult.failed !== 0) {
      throw new Error("Browser acceptance result is incomplete or failed.");
    }
    result.browser = browserResult;
  }
  result.status = "PASSED"; result.exitCode = 0;
} catch (error) { console.log(error.message); }
finally {
  if (server?.pid) {
    try {
      if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      else server.kill("SIGTERM");
    } catch { /* The owned server may already have exited. */ }
  }
  fs.closeSync(serverLog);
  try {
    if (created) { await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); result.cleanup = "PASSED"; }
  } catch {
    result.cleanup = "FAILED"; result.status = "FAILED"; result.exitCode = 1;
  }
  await admin.end();
  fs.writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, output: out }));
}
process.exitCode = result.exitCode;
