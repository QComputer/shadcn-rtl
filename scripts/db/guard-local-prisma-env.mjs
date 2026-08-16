import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function parsePostgresUrl(name, value) {
  if (!value) return { ok: false, error: `${name} is required for local Prisma verification.` };
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: `${name} must be a valid PostgreSQL URL.` };
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    return { ok: false, error: `${name} must use postgres/postgresql protocol.` };
  }
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    return { ok: false, error: `${name} must point to localhost/127.0.0.1 for local verification.` };
  }
  if (/neon|supabase|render|amazonaws|azure|google|cloud/i.test(parsed.hostname)) {
    return { ok: false, error: `${name} appears to be remote, not local.` };
  }
  return {
    ok: true,
    url: {
      host: host === "localhost" ? "127.0.0.1" : host,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, ""),
    },
  };
}

export function validateLocalPrismaEnvironment(env = process.env) {
  const expectedPort = env.LOCAL_PRISMA_EXPECTED_PORT;
  const database = parsePostgresUrl("DATABASE_URL", env.DATABASE_URL);
  const direct = parsePostgresUrl("DIRECT_URL", env.DIRECT_URL);
  const errors = [];

  if (!database.ok) errors.push(database.error);
  if (!direct.ok) errors.push(direct.error);
  if (!expectedPort || !/^\d{2,5}$/.test(expectedPort)) {
    errors.push("LOCAL_PRISMA_EXPECTED_PORT must be set to the disposable local PostgreSQL port.");
  }
  if (database.ok && direct.ok) {
    if (database.url.host !== direct.url.host) errors.push("DATABASE_URL and DIRECT_URL must resolve to the same local host.");
    if (database.url.port !== direct.url.port) errors.push("DATABASE_URL and DIRECT_URL must use the same local port.");
    if (database.url.database !== direct.url.database) errors.push("DATABASE_URL and DIRECT_URL must use the same local database.");
    if (expectedPort && (database.url.port !== expectedPort || direct.url.port !== expectedPort)) {
      errors.push("DATABASE_URL and DIRECT_URL must match LOCAL_PRISMA_EXPECTED_PORT.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function runGuardedCommand(argv = process.argv.slice(2), env = process.env, spawnImpl = spawn) {
  const separatorIndex = argv.indexOf("--");
  const commandArgs = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : argv;
  const command = commandArgs[0];
  const args = commandArgs.slice(1);
  const validation = validateLocalPrismaEnvironment(env);

  if (!validation.ok) {
    console.error("Refusing to run local Prisma command:");
    for (const error of validation.errors) console.error(`- ${error}`);
    return Promise.resolve(1);
  }
  if (!command) {
    console.error("No command provided after --.");
    return Promise.resolve(1);
  }

  const executable = process.platform === "win32" && !/\.(cmd|exe)$/i.test(command)
    ? `${command}.cmd`
    : command;

  return new Promise((resolve) => {
    const child = spawnImpl(executable, args, { stdio: "inherit", env });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      resolve(1);
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await runGuardedCommand();
  process.exitCode = code;
}
