#!/usr/bin/env node
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const useExistingDb = process.env.AI_MEDIA_HERMETIC_USE_EXISTING_DB === "true";
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
let containerName = "";

function run(name, args, env = process.env) {
  const result = spawnSync(name, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
}

function runPnpm(args, env = process.env) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args], env);
    return;
  }
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, env);
}

function capture(name, args) {
  const result = spawnSync(name, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function createDockerDatabase() {
  containerName = `bazar-baz-ai-media-import-${stamp}`;
  const databaseName = `bazar_baz_ai_media_import_${stamp}`;
  capture("docker", ["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres", "-e", `POSTGRES_DB=${databaseName}`, "-p", "127.0.0.1::5432", "postgres:16-alpine"]);

  let portLine = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      portLine = capture("docker", ["port", containerName, "5432/tcp"]);
      if (portLine) break;
    } catch { /* retry */ }
    sleep(500);
  }
  const port = portLine.split(":").pop();
  if (!port) throw new Error("Unable to determine disposable Postgres port");

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], { stdio: "ignore" });
    if (ready.status === 0) {
      return { databaseName, databaseUrl: `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public` };
    }
    sleep(500);
  }
  throw new Error("Disposable Postgres did not become ready");
}

function cleanupDockerDatabase() {
  if (!containerName) return;
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "inherit" });
}

let contractMockProcess = null;
let contractMockPort = "";

function startContractMock() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to start local contract MOCK in Vercel production.");
  }
  contractMockPort = process.env.AI_MEDIA_CONTRACT_MOCK_PORT || "4765";
  contractMockProcess = spawn(process.execPath, ["scripts/ai-media/local-contract-mock.mjs"], {
    env: { ...process.env, AI_MEDIA_CONTRACT_MOCK_PORT: contractMockPort, AI_MEDIA_SERVICE_INTERNAL_KEY: process.env.AI_MEDIA_SERVICE_INTERNAL_KEY },
    stdio: "ignore",
    detached: true,
  });
  const mockUrl = `http://127.0.0.1:${contractMockPort}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const probe = spawnSync("node", ["-e", `fetch(${JSON.stringify(`${mockUrl}/health`)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`], { stdio: "ignore" });
    if (probe.status === 0) return mockUrl;
    sleep(250);
  }
  throw new Error("Local contract MOCK did not become ready");
}

function stopContractMock() {
  if (contractMockProcess && contractMockProcess.pid) {
    try { process.kill(-contractMockProcess.pid); } catch { /* ignore */ }
  }
}

function buildEnv(databaseUrl, mockUrl) {
  const env = { ...process.env };
  delete env.npm_execpath;
  delete env.npm_lifecycle_event;
  if (/^https?:\/\//i.test(mockUrl) && !/^https?:\/\/(127\.0\.0\.1|localhost|::1)(:\d+)?(\/|$)/i.test(mockUrl)) {
    throw new Error(`Refusing to run local contract MOCK with non-local service URL: ${mockUrl}`);
  }
  return {
    ...env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NODE_ENV: "test",
    LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE: "true",
    AI_MEDIA_APPLICATION_STORAGE_ADAPTER: "local-test",
    AI_MEDIA_LOCAL_DOCKER_E2E: "1",
    AI_MEDIA_LOCAL_STORAGE_ROOT: path.join(process.cwd(), ".tmp", "ai-media-app-managed-import", "storage"),
    SMS_DRY_RUN: "true",
    EMAIL_DRY_RUN: "true",
    WEB_PUSH_REAL_SEND_ENABLED: "false",
    DOMAIN_PROVIDER_MUTATION_ENABLED: "false",
    TENANT_PROVISIONING_EXECUTION_ENABLED: "false",
    AI_MEDIA_PAID_PROVIDER_ENABLED: "false",
    AI_MEDIA_REAL_GENERATION_ENABLED: "false",
    AI_MEDIA_PREVIEW_MOCK_WRITES_ENABLED: "true",
    AI_MEDIA_PREVIEW_ISOLATION_VERIFIED: "true",
    AI_MEDIA_RENDER_PINNED_CONTRACT_VERIFIED: "true",
    AI_MEDIA_PREVIEW_DB_NON_ISOLATED_WRITE_ACCEPTED: "true",
    AI_MEDIA_PREVIEW_PROVIDER: "MOCK",
    AI_MEDIA_SERVICE_ENABLED: "true",
    AI_MEDIA_SERVICE_URL: mockUrl,
    AI_MEDIA_SERVICE_BASE_URL: mockUrl,
    AI_MEDIA_LOCAL_CONTRACT_MOCK: "1",
    AI_MEDIA_SERVICE_TIMEOUT_MS: "60000",
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require=./scripts/e2e/register-server-only.cjs"].filter(Boolean).join(" "),
  };
}

try {
  const database = useExistingDb ? { databaseUrl: process.env.DATABASE_URL || "" } : createDockerDatabase();
  const mockUrl = startContractMock();
  const env = buildEnv(database.databaseUrl, mockUrl);

  run(process.execPath, ["scripts/db/local-baseline-bootstrap.mjs"], env);
  runPnpm(["exec", "tsx", "scripts/e2e/ai-media-local-docker-import-e2e.mts"], env);

  console.log("AI media app-managed import local Docker E2E passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  stopContractMock();
  if (!useExistingDb) cleanupDockerDatabase();
  try { fs.rmSync(path.join(process.cwd(), ".tmp", "ai-media-app-managed-import"), { recursive: true, force: true }); } catch { /* ignore */ }
}
