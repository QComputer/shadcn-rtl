#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const useExistingDb = process.env.AI_MEDIA_HERMETIC_USE_EXISTING_DB === "true";
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
let containerName = "";

function run(name, args, env = process.env) {
  const result = spawnSync(name, args, {
    stdio: "inherit",
    env,
  });
  if (result.error) {
    console.error(result.error.message);
  }
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
  const result = spawnSync(name, args, {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${name} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function createDockerDatabase() {
  containerName = `bazar-baz-ai-media-hermetic-${stamp}`;
  const databaseName = `bazar_baz_ai_media_hermetic_${stamp}`;
  capture("docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    "POSTGRES_USER=postgres",
    "-e",
    `POSTGRES_DB=${databaseName}`,
    "-p",
    "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);

  let portLine = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      portLine = capture("docker", ["port", containerName, "5432/tcp"]);
      if (portLine) break;
    } catch {
      // retry
    }
    sleep(500);
  }
  const port = portLine.split(":").pop();
  if (!port) throw new Error("Unable to determine disposable Postgres port");

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName], {
      stdio: "ignore",
    });
    if (ready.status === 0) {
      return {
        databaseName,
        databaseUrl: `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public`,
      };
    }
    sleep(500);
  }
  throw new Error("Disposable Postgres did not become ready");
}

function cleanupDockerDatabase() {
  if (!containerName) return;
  spawnSync("docker", ["rm", "-f", containerName], {
    stdio: "inherit",
  });
}

function buildHermeticEnv(databaseUrl) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NODE_ENV: "test",
    LOCAL_BASELINE_BOOTSTRAP_DISPOSABLE: "true",
    AI_MEDIA_APPLICATION_STORAGE_ADAPTER: "local-test",
    SMS_DRY_RUN: "true",
    EMAIL_DRY_RUN: "true",
    WEB_PUSH_REAL_SEND_ENABLED: "false",
    DOMAIN_PROVIDER_MUTATION_ENABLED: "false",
    TENANT_PROVISIONING_EXECUTION_ENABLED: "false",
    AI_MEDIA_PAID_PROVIDER_ENABLED: "false",
    AI_MEDIA_REAL_GENERATION_ENABLED: "false",
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require=./scripts/e2e/register-server-only.cjs"].filter(Boolean).join(" "),
  };
}

try {
  const database = useExistingDb
    ? { databaseUrl: process.env.DATABASE_URL || "" }
    : createDockerDatabase();
  const env = buildHermeticEnv(database.databaseUrl);

  runPnpm(["exec", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);
  run(process.execPath, ["scripts/quality/validate-ai-media-hermetic-environment.mjs"], env);
  run(process.execPath, ["scripts/quality/validate-ai-media-p04a-p06a.mjs"], env);
  runPnpm(["exec", "tsx", "scripts/e2e/ai-media-hermetic-lifecycle.mts"], env);
  runPnpm(["exec", "tsx", "scripts/e2e/ai-media-hermetic-concurrency.mts"], env);

  console.log(JSON.stringify({
    ok: true,
    database: "LOCAL_DISPOSABLE",
    baseline: "prisma-migrate-deploy",
    productionMigrationCommand: false,
    productionBlobCalls: 0,
    liveRenderWrite: false,
    realGeneration: false,
  }));
  console.log("Hermetic AI media acceptance passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (!useExistingDb) cleanupDockerDatabase();
}
