/* eslint-disable @typescript-eslint/no-require-imports -- Node preload test. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
test("synthetic fixture blocks provider sockets before network access", () => {
  const url = "postgresql://hero_test:local_admin_fixture_only@127.0.0.1:55439/retail_hero_test";
  const guard = path.resolve("scripts/e2e/hotel-claim-network-guard.cjs");
  const code = `const s = require("node:net").connect(443, "restful.inoti.com"); s.on("connect", () => process.exit(9)); s.on("error", e => process.exit(e.code === "SYNTHETIC_EXTERNAL_NETWORK_BLOCKED" ? 0 : 8));`;
  const result = spawnSync(process.execPath, ["--require", guard, "-e", code], { env: { ...process.env, NODE_OPTIONS: "", NODE_ENV: "development", DATABASE_URL: url, DIRECT_URL: url }, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
});
