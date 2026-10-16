#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const EXPECTED_TARGET = resolve("scripts/ops/production-migration-target.expected.json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
function parseArgs(argv) {
  const result = { targetConfig: EXPECTED_TARGET, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--target-config" && argv[index + 1]) result.targetConfig = resolve(argv[++index]);
    else if (value === "--output" && argv[index + 1]) result.output = resolve(argv[++index]);
    else throw new Error("Usage: node scripts/ops/inspect-production-migration-metadata.mjs [--target-config file] --output new-file.json");
  }
  if (!result.output) throw new Error("An explicit new --output path is required.");
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateProductionAttestations(target) {
  if (target.mode === "synthetic") {
    if (process.env.BB_SYNTHETIC_INSPECTION_ONLY !== "1") throw new Error("Synthetic mode requires BB_SYNTHETIC_INSPECTION_ONLY=1.");
    if (!/^(127\.0\.0\.1|localhost)$/.test(target.host) || !String(target.database).startsWith("bb_reconciliation_synthetic_")) {
      throw new Error("Synthetic mode is restricted to loopback and a task-named synthetic database.");
    }
    return;
  }

  if (target.mode !== "production") throw new Error("Target mode must be explicitly production or synthetic.");
  if (typeof target.readOnlyRole !== "string" || !target.readOnlyRole.trim()) {
    throw new Error("An approved least-privilege read-only role must be configured; no connection attempted.");
  }
  if (process.env.BB_PRODUCTION_READONLY_INSPECTION_APPROVED !== "YES") {
    throw new Error("Production inspection is disabled until separate explicit read-only authorization is set.");
  }
  const runtimePath = process.env.BB_PRODUCTION_RUNTIME_ATTESTATION_PATH;
  const neonPath = process.env.BB_NEON_ENDPOINT_ATTESTATION_PATH;
  if (!runtimePath || !neonPath) throw new Error("Fresh sanitized Production runtime and Neon endpoint attestation files are required.");
  const runtime = readJson(resolve(runtimePath));
  const neon = readJson(resolve(neonPath));
  const maxAgeMs = 24 * 60 * 60 * 1000;
  const recent = value => {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp <= maxAgeMs;
  };
  const valuesMatch = [
    runtime?.verified === true,
    runtimeDeploymentMatches(runtime, target),
    recent(runtime?.verifiedAt),
    runtime?.database?.host === target.host,
    runtime?.database?.name === target.database,
    runtime?.database?.projectId === target.projectId,
    runtime?.database?.branchId === target.branchId,
    runtime?.database?.endpointId === target.endpointId,
    neon?.verified === true,
    recent(neon?.verifiedAt),
    neon?.projectId === target.projectId,
    neon?.branchId === target.branchId,
    neon?.endpointId === target.endpointId,
    neon?.host === target.host,
    neon?.database === target.database,
  ].every(Boolean);
  if (!valuesMatch) throw new Error("Current runtime/Neon attestation does not match the approved target; no connection attempted.");
}

function validateConnectionUrl(url, target) {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const role = decodeURIComponent(parsed.username);
  if (parsed.hostname !== target.host || database !== target.database || role !== target.readOnlyRole) {
    throw new Error(`Explicit read-only connection target mismatch (host=${parsed.hostname === target.host}, database=${database === target.database}, role=${role === target.readOnlyRole}); no connection attempted.`);
  }
  if (target.mode === "production" && parsed.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Production inspection requires sslmode=verify-full; no connection attempted.");
  }
  if (target.mode === "synthetic" && !/^(127\.0\.0\.1|localhost)$/.test(parsed.hostname)) {
    throw new Error("Synthetic inspection refuses non-loopback database hosts.");
  }
  return parsed;
}

export function neonServerIdentityMatches(identity, target) {
  if (target.mode !== "production") return true;
  return identity.neonProjectId === target.projectId
    && identity.neonBranchId === target.branchId
    && identity.neonEndpointId === target.endpointId;
}

export function runtimeDeploymentMatches(runtime, target) {
  return typeof target.deploymentId === "string"
    && target.deploymentId.length > 0
    && runtime?.deploymentId === target.deploymentId;
}

async function collectInspection(client, target) {
  return client.$transaction(async transaction => {
    // Fixed SQL only; transaction is made read-only before any inspection query.
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    await transaction.$executeRaw`SET LOCAL statement_timeout = '20s'`;
    await transaction.$executeRaw`SET LOCAL lock_timeout = '3s'`;

    const identityRows = await transaction.$queryRaw`
      SELECT current_database()::text AS "database",
             current_user::text AS "effectiveRole",
             session_user::text AS "sessionRole",
             current_schema()::text AS schema,
             (current_setting('server_version_num')::integer / 10000)::integer AS "postgresMajor",
             current_setting('transaction_read_only')::text AS "transactionReadOnly",
             current_setting('neon.project_id', true)::text AS "neonProjectId",
             current_setting('neon.branch_id', true)::text AS "neonBranchId",
             current_setting('neon.endpoint_id', true)::text AS "neonEndpointId"
    `;
    const identity = identityRows[0];
    if (identity.database !== target.database || identity.effectiveRole !== target.readOnlyRole || identity.sessionRole !== target.readOnlyRole || identity.schema !== "public" || identity.postgresMajor !== target.expectedPostgresMajor || identity.transactionReadOnly !== "on" || !neonServerIdentityMatches(identity, target)) {
      throw new Error("Connected database identity or transaction mode differs from the attested target; inspection aborted.");
    }

    const roleRows = await transaction.$queryRaw`
      SELECT r.rolsuper AS "superuser",
             r.rolcreatedb AS "createDatabase",
             r.rolcreaterole AS "createRole",
             r.rolreplication AS "replication",
             r.rolbypassrls AS "bypassRls",
             has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
             has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
             NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS "noRoleMemberships",
             NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
                 AND (has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE')
                   OR has_table_privilege(current_user,c.oid,'DELETE') OR has_table_privilege(current_user,c.oid,'TRUNCATE')
                   OR has_table_privilege(current_user,c.oid,'TRIGGER'))
             ) AS "noPublicTableWritePrivileges",
             NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'S'
                 AND (has_sequence_privilege(current_user,c.oid,'USAGE') OR has_sequence_privilege(current_user,c.oid,'SELECT') OR has_sequence_privilege(current_user,c.oid,'UPDATE'))
             ) AS "noPublicSequencePrivileges",
             NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
                 AND c.relname <> '_prisma_migrations'
                 AND has_table_privilege(current_user,c.oid,'SELECT')
             ) AS "noPublicApplicationDataSelect"
      FROM pg_roles r WHERE r.rolname = current_user
    `;
    const role = roleRows[0];
    if (!role || role.superuser || role.createDatabase || role.createRole || role.replication || role.bypassRls || role.databaseCreate || role.schemaCreate || !role.noRoleMemberships || !role.noPublicTableWritePrivileges || !role.noPublicSequencePrivileges || !role.noPublicApplicationDataSelect) {
      throw new Error("Database role is not least-privilege read-only; inspection aborted before reading migration or schema metadata.");
    }

    const migrations = await transaction.$queryRaw`
      SELECT migration_name::text AS "migrationName",
             checksum::text AS checksum,
             started_at AS startedAt,
             finished_at AS finishedAt,
             rolled_back_at AS rolledBackAt,
             CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'SUCCEEDED'
                  WHEN rolled_back_at IS NOT NULL THEN 'ROLLED_BACK'
                  ELSE 'INCOMPLETE' END::text AS state
      FROM public._prisma_migrations
      ORDER BY started_at, migration_name
    `;

    const columns = await transaction.$queryRaw`
      SELECT c.relname::text AS "tableName", a.attname::text AS "columnName",
             format_type(a.atttypid, a.atttypmod)::text AS "dataType",
             t.typname::text AS "udtName",
             (NOT a.attnotnull) AS "nullable"
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum
    `;
    const constraints = await transaction.$queryRaw`
      SELECT c.conrelid::regclass::text AS "relation",
             c.conname::text AS "name",
             c.contype::text AS "type",
             pg_get_constraintdef(c.oid, true)::text AS "definition"
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = (SELECT relnamespace FROM pg_class WHERE oid = c.conrelid)
      WHERE n.nspname = 'public'
      ORDER BY relation, name
    `;
    const indexes = await transaction.$queryRaw`
      SELECT schemaname::text AS "schema", tablename::text AS "table",
             indexname::text AS "name", indexdef::text AS "definition"
      FROM pg_indexes WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    const enums = await transaction.$queryRaw`
      SELECT n.nspname::text AS "schema", t.typname::text AS "name",
             e.enumlabel::text AS "label", e.enumsortorder::real AS "order"
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `;
    return { identity, role, migrations, columns, constraints, indexes, enums };
  }, { timeout: 30_000, maxWait: 5_000 });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = readJson(args.targetConfig);
  validateProductionAttestations(target);
  const explicitUrl = process.env.BB_PRODUCTION_READONLY_URL;
  if (!explicitUrl) throw new Error("BB_PRODUCTION_READONLY_URL is required; DATABASE_URL and DIRECT_URL are never used.");
  const parsedUrl = validateConnectionUrl(explicitUrl, target);
  if (target.mode === "synthetic" && process.env.DATABASE_URL) {
    // Prevent accidental reuse of a repository .env value in synthetic validation.
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
  }
  const client = new PrismaClient({
    datasources: { db: { url: parsedUrl.toString() } },
    log: [],
  });
  try {
    const data = await collectInspection(client, target);
    const output = {
      status: "READ_ONLY_INSPECTION_PASSED",
      generatedAt: new Date().toISOString(),
      target: {
        mode: target.mode,
        projectId: target.projectId,
        branchId: target.branchId,
        endpointId: target.endpointId,
        host: target.host,
        database: data.identity.database,
        role: data.identity.effectiveRole,
        schema: data.identity.schema,
        postgresMajor: data.identity.postgresMajor,
        neonServerIdentity: {
          projectId: data.identity.neonProjectId,
          branchId: data.identity.neonBranchId,
          endpointId: data.identity.neonEndpointId,
        },
      },
      transactionReadOnly: data.identity.transactionReadOnly === "on",
      rolePrivileges: data.role,
      migrations: data.migrations,
      schema: { columns: data.columns, constraints: data.constraints, indexes: data.indexes, enums: data.enums },
    };
    writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`READ_ONLY_INSPECTION_PASSED output=${args.output}\n`);
  } finally {
    await client.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch(error => {
    const message = typeof error?.message === "string" ? error.message : "";
    const safeMessages = [
      "Usage:", "An explicit new --output path is required.",
      "Synthetic mode requires", "Synthetic mode is restricted", "Target mode must be",
      "Production inspection is disabled", "Fresh sanitized Production runtime",
      "An approved least-privilege read-only role",
      "Current runtime/Neon attestation", "Explicit read-only connection target mismatch",
      "Production inspection requires", "Synthetic inspection refuses",
      "BB_PRODUCTION_READONLY_URL is required", "Connected database identity",
      "Database role is not least-privilege read-only",
    ];
    const safe = safeMessages.find(prefix => message.startsWith(prefix));
    const code = typeof error?.code === "string" && /^[A-Z][0-9]{4}$/.test(error.code) ? ` (database error ${error.code})` : "";
    fail(safe ? message : `Inspection failed${code}; details suppressed and no evidence file was written.`);
  });
}
