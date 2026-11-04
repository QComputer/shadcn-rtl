/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preloads must be CommonJS before Next starts. */
const path = require("node:path");
const { createRequire } = require("node:module");

const databaseName = "retail_hero_test";
const port = "55439";
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  let url;
  try { url = new URL(process.env[key] || ""); }
  catch { throw new Error(`${key} is required for the isolated local Retail theme demo.`); }
  if (!/^postgres(ql)?:$/.test(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== port || url.pathname !== `/${databaseName}`) {
    throw new Error(`${key} must target 127.0.0.1:${port}/${databaseName}.`);
  }
}
if (process.env.LOCAL_PRISMA_EXPECTED_PORT !== port
  || process.env.RETAIL_HERO_EXPECTED_DATABASE !== databaseName
  || process.env.DATABASE_RUNTIME_ADAPTER !== "postgresql") {
  throw new Error("The isolated local Retail theme database guard is missing.");
}

process.env.NODE_ENV = "development";
const projectRequire = createRequire(path.join(process.cwd(), "scripts", "dev", "isolated-next-env.cjs"));
const nextRequire = createRequire(projectRequire.resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env");
const emptyEnvDirectory = path.join(__dirname, ".empty-env");
// Cache an empty environment file set inside each Node process before the Next
// CLI loads. Next's own loadEnvConfig call then reuses this cache, never reading
// the repository's preservation .env file. NODE_OPTIONS repeats this preloader
// in Next's development workers and keeps the same localhost/database guard.
loadEnvConfig(emptyEnvDirectory, true, { warn() {}, info() {}, error() {} }, true);
