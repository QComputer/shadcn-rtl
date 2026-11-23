import assert from "node:assert/strict";
import { test } from "node:test";
import { runReadOnlyAudit, validateAuditEnvironment } from "../../scripts/audit/runflare-db-audit.mjs";

const validEnv = () => ({
  DB_REMOTE_URI: "postgresql://c1b2_test:synthetic-only@127.0.0.1:5432/bazarbaaz_hotel_c1b2_a1b2c3d4?sslmode=disable",
  RUNFLARE_DB_AUDIT_TARGET: "disposable-local",
  RUNFLARE_DB_AUDIT_READ_ONLY_AUTHORIZATION: "LOCAL_DISPOSABLE_CONFIRMED",
});

test("requires DB_REMOTE_URI directly and never uses alternate URI variables", () => {
  for (const alternative of ["DATABASE_URL", "DIRECT_URL", "BB_PRODUCTION_READONLY_URL"]) {
    const env = { ...validEnv(), DB_REMOTE_URI: "", [alternative]: validEnv().DB_REMOTE_URI };
    assert.throws(() => validateAuditEnvironment(env), /DB_REMOTE_URI is required/);
  }
});

test("fails closed for absent authorization, remote hosts, wrong databases and roles", () => {
  const missingAuthorization = validEnv();
  delete missingAuthorization.RUNFLARE_DB_AUDIT_READ_ONLY_AUTHORIZATION;
  assert.throws(() => validateAuditEnvironment(missingAuthorization), /authorization is required/);

  const remote = validEnv();
  remote.DB_REMOTE_URI = "postgresql://c1b2_test:synthetic-only@db.example:5432/bazarbaaz_hotel_c1b2_a1b2c3d4";
  assert.throws(() => validateAuditEnvironment(remote), /Remote database targets are disabled/);

  const productionNamedDatabase = validEnv();
  productionNamedDatabase.DB_REMOTE_URI = "postgresql://c1b2_test:synthetic-only@127.0.0.1:5432/maindb";
  assert.throws(() => validateAuditEnvironment(productionNamedDatabase), /not an approved disposable/);

  const wrongRole = validEnv();
  wrongRole.DB_REMOTE_URI = "postgresql://postgres:synthetic-only@127.0.0.1:5432/bazarbaaz_hotel_c1b2_a1b2c3d4";
  assert.throws(() => validateAuditEnvironment(wrongRole), /not the disposable C1B2 test role/);
});

test("accepts only the explicitly authorized loopback disposable fixture", () => {
  const config = validateAuditEnvironment(validEnv());
  assert.deepEqual({ database: config.database, username: config.username, hostname: config.hostname }, {
    database: "bazarbaaz_hotel_c1b2_a1b2c3d4", username: "c1b2_test", hostname: "127.0.0.1",
  });
  assert.equal(JSON.stringify({ database: config.database, username: config.username }).includes("synthetic-only"), false);
});

test("audit uses one read-only transaction, verifies identity, and emits only metadata", async () => {
  const calls = [];
  class FakeClient {
    constructor(options) { this.options = options; }
    async connect() { calls.push("connect"); }
    async query(sql) {
      calls.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
      if (/current_database/.test(sql)) return { rows: [{ database_name: "bazarbaaz_hotel_c1b2_a1b2c3d4", user_name: "c1b2_test", transaction_read_only: "on", server_version_num: 170004 }], rowCount: 1 };
      if (/public\._prisma_migrations/.test(sql)) return { rows: [{ migration_name: "fixture_migration", successful: true }], rowCount: 1 };
      if (/information_schema\.tables/.test(sql)) return { rows: [{ table_name: "Fixture" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    async end() { calls.push("end"); }
  }

  const result = await runReadOnlyAudit(validateAuditEnvironment(validEnv()), FakeClient);
  assert.equal(result.connection.transactionReadOnly, true);
  assert.equal(result.connection.postgresMajorVersion, 17);
  assert.equal(result.publicTableCount, 1);
  assert.deepEqual(result.migrations, [{ name: "fixture_migration", successful: true }]);
  assert.ok(calls.some((call) => call === "BEGIN READ ONLY"));
  assert.ok(calls.includes("ROLLBACK"));
  assert.equal(JSON.stringify(result).includes("synthetic-only"), false);
});

test("rejects a mismatched or writable database identity and rolls back", async () => {
  const calls = [];
  class FakeClient {
    async connect() {}
    async query(sql) {
      calls.push(sql.trim());
      if (/current_database/.test(sql)) return { rows: [{ database_name: "other", user_name: "c1b2_test", transaction_read_only: "off", server_version_num: 170004 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    async end() {}
  }
  await assert.rejects(() => runReadOnlyAudit(validateAuditEnvironment(validEnv()), FakeClient), /identity or read-only transaction verification failed/);
  assert.ok(calls.includes("ROLLBACK"));
  assert.equal(calls.some((sql) => /_prisma_migrations|information_schema\.tables/.test(sql)), false);
});
