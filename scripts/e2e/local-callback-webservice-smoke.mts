#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = 3000;
const HOST = "127.0.0.1";
const PUBLIC_ID = "1b6e8958-6e2a-4d4d-8d62-6d36be2284de";

const env = {
  ...process.env,
  DATABASE_URL: "postgresql://bazarbaaz:farhad_pg_dev_2026@127.0.0.1:45432/bazarbaaz_org_shell",
  DIRECT_URL: "postgresql://bazarbaaz:farhad_pg_dev_2026@127.0.0.1:45432/bazarbaaz_org_shell",
  LOCAL_PRISMA_EXPECTED_PORT: "45432",
  AI_MEDIA_LOCAL_DOCKER_E2E: "1",
  NODE_ENV: "production",
  PORT: String(PORT),
  HOSTNAME: HOST,
};

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start in time")), 120000);
    const check = () => {
      http.get(`http://${HOST}:${PORT}/api/health`, (res) => {
        clearTimeout(timer);
        resolve();
      }).on("error", () => {
        setTimeout(check, 1000);
      });
    };
    check();
  });
}

function request(pathname, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://${HOST}:${PORT}${pathname}`);
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Starting Next.js server for callback smoke test...");
  const server = spawn(
    process.platform === "win32" ? "next.cmd" : "next",
    ["start"],
    { env, stdio: "inherit", shell: process.platform === "win32" }
  );

  try {
    await waitForServer();
    console.log("Server ready, running smoke tests...\n");

    const expectedStatus = 200; const cases = [
      { path: `/api/integrations/inoti/ussd/${PUBLIC_ID}`, name: "known Platform publicIntegrationId" },
      { path: `/api/integrations/inoti/ussd/00000000-0000-0000-0000-000000000000`, name: "unknown valid UUID" },
      { path: `/api/integrations/inoti/ussd/not-a-uuid`, name: "malformed publicIntegrationId" },
      { path: `/api/integrations/inoti/ussd/${PUBLIC_ID}?providerCallback=malformed`, name: "malformed provider callback input" },
    ];

    for (const tc of cases) {
      const result = await request(tc.path);
      const ok = result.status === expectedStatus && !result.body.includes("<!DOCTYPE") && !result.body.includes("html");
      console.log(`${ok ? "PASS" : "FAIL"}: ${tc.name}`);
      console.log(`  URL: ${tc.path}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Body: ${result.body.slice(0, 200)}`);
      console.log();
    }
  } finally {
    console.log("Shutting down server...");
    server.kill("SIGTERM");
    setTimeout(() => server.kill("SIGKILL"), 5000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
