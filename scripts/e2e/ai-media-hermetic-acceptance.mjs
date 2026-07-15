#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(name, args, env = process.env) {
  const result = spawnSync(name, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.error) {
    console.error(result.error.message);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["scripts/quality/validate-ai-media-hermetic-environment.mjs"], {
  ...process.env,
  AI_MEDIA_APPLICATION_STORAGE_ADAPTER: process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER || "local-test",
});
run(process.execPath, ["scripts/quality/validate-ai-media-p04a-p06a.mjs"]);
run("pnpm", ["exec", "tsx", "scripts/e2e/ai-media-hermetic-lifecycle.mts"], {
  ...process.env,
  NODE_ENV: "test",
  AI_MEDIA_APPLICATION_STORAGE_ADAPTER: process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER || "local-test",
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require=./scripts/e2e/register-server-only.cjs"].filter(Boolean).join(" "),
});
console.log("Hermetic AI media acceptance passed.");
