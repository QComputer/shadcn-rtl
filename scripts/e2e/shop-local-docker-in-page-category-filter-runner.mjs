#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const startedAt = Date.now();
const timeoutMs = Number(process.env.SHOP_FILTER_E2E_TIMEOUT_MS || 10 * 60 * 1000);
const tempDir = path.join(process.cwd(), ".tmp", "shop-in-page-category-filter");
const bootstrapLog = path.join(tempDir, "bootstrap.log");
let timeout = null;

function marker(message) {
  const elapsed = Date.now() - startedAt;
  const line = `[shop-filter-e2e ${elapsed}ms] ${message}\n`;
  fs.mkdirSync(tempDir, { recursive: true });
  fs.appendFileSync(bootstrapLog, line, "utf8");
  process.stderr.write(line);
}

function cleanup() {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

process.stdin.pause();
marker("bootstrap-start");
marker("temp-dir-created");

process.on("unhandledRejection", (reason) => {
  marker(`unhandledRejection ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
  process.exitCode = 1;
});

process.on("uncaughtException", (error) => {
  marker(`uncaughtException ${error.stack || error.message}`);
  process.exitCode = 1;
});

process.on("SIGINT", () => {
  marker("SIGINT");
  process.exit(130);
});

process.on("SIGTERM", () => {
  marker("SIGTERM");
  process.exit(143);
});

timeout = setTimeout(() => {
  marker(`overall-timeout ${timeoutMs}ms`);
  process.exit(124);
}, timeoutMs);

try {
  marker("before-dynamic-import");
  const e2eModule = await import("./shop-local-docker-in-page-category-filter.mjs");
  marker("after-dynamic-import");
  if (typeof e2eModule.main !== "function") {
    throw new Error("Expected shop-filter E2E module to export main()");
  }
  marker("before-main");
  await e2eModule.main();
  marker("after-main");
} catch (error) {
  marker(`runner-error ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (timeout) clearTimeout(timeout);
  marker("runner-before-cleanup");
  cleanup();
  process.exit(process.exitCode || 0);
}
