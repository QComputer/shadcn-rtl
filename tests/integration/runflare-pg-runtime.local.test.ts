import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.RUNFLARE_PG_ACCEPTANCE === "1";
const EXPECTED_DATABASE = "bazarbaaz_retail_r2";
const EXPECTED_ROLE = "retail_r2";
const EXPECTED_PORT = "55432";

function assertTargetConfiguration() {
  assert.equal(process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production", false);
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");

  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL must be supplied by the isolated PostgreSQL wrapper");
  assert.ok(process.env.DIRECT_URL === databaseUrl, "DIRECT_URL must exactly match DATABASE_URL");

  const target = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "DATABASE_URL must use PostgreSQL");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, EXPECTED_PORT);
  assert.equal(target.pathname, `/${EXPECTED_DATABASE}`);
  assert.equal(target.username, EXPECTED_ROLE);

  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "5");
  assert.ok(Number.isSafeInteger(poolMax) && poolMax >= 2 && poolMax <= 100, "DATABASE_POOL_MAX must allow two independent connections");
}

async function countApplicationTables(db: PrismaClient) {
  const [row] = await db.$queryRaw<Array<{ count: number }>>`
    SELECT count(*)::int AS count
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_temp_%'
      AND n.nspname NOT LIKE 'pg_toast_temp_%'
  `;
  return row.count;
}

test("Runflare R6.2 PostgreSQL runtime adapter preserves isolated transaction behavior", { skip: !enabled, concurrency: false }, async (t) => {
  assertTargetConfiguration();
  const { prisma } = await import("@/lib/db-runtime");
  await prisma.$connect();

  try {
    const [identity] = await prisma.$queryRaw<Array<{ database: string; role: string; major: number }>>`
      SELECT current_database()::text AS database,
        current_user::text AS role,
        current_setting('server_version_num')::int / 10000 AS major
    `;
    assert.deepEqual(identity, { database: EXPECTED_DATABASE, role: EXPECTED_ROLE, major: 17 });

    const tableCountBefore = await countApplicationTables(prisma);

    await t.test("transactional temp-table writes and row-lock syntax roll back without schema changes", async () => {
      const tableName = `tmp_r62_${randomBytes(8).toString("hex")}`;
      const quotedTableName = `"${tableName}"`;
      const rollbackSentinel = new Error("R6.2 expected transaction rollback");

      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`CREATE TEMP TABLE ${quotedTableName} ("id" integer PRIMARY KEY, "value" text NOT NULL) ON COMMIT DROP`);
          await tx.$executeRawUnsafe(`INSERT INTO ${quotedTableName} ("id", "value") VALUES (1, 'before')`);
          await tx.$executeRawUnsafe(`UPDATE ${quotedTableName} SET "value" = 'after' WHERE "id" = 1`);
          const locked = await tx.$queryRawUnsafe<Array<{ id: number; value: string }>>(`SELECT "id", "value" FROM ${quotedTableName} ORDER BY "id" FOR UPDATE SKIP LOCKED`);
          assert.deepEqual(locked, [{ id: 1, value: "after" }]);
          throw rollbackSentinel;
        }, { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 15_000 }),
        (error) => error === rollbackSentinel,
      );

      assert.equal(await countApplicationTables(prisma), tableCountBefore);
    });

    await t.test("RepeatableRead and Serializable use the requested PostgreSQL isolation", async () => {
      for (const isolationLevel of ["RepeatableRead", "Serializable"] as const) {
        const observed = await prisma.$transaction(async (tx) => {
          const [row] = await tx.$queryRaw<Array<{ isolation: string }>>`SELECT current_setting('transaction_isolation')::text AS isolation`;
          return row.isolation;
        }, { isolationLevel, maxWait: 5_000, timeout: 15_000 });
        assert.equal(observed, isolationLevel === "RepeatableRead" ? "repeatable read" : "serializable");
      }
    });

    await t.test("same-UUID advisory transaction lock is held until release on independent backends", async () => {
      const lockId = randomUUID();
      let notifyHeld!: (pid: number) => void;
      let releaseHolder!: () => void;
      const held = new Promise<number>((resolve) => { notifyHeld = resolve; });
      const barrier = new Promise<void>((resolve) => { releaseHolder = resolve; });

      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockId}::text, 0))::text`;
        const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
        notifyHeld(row.pid);
        await barrier;
        return row.pid;
      }, { maxWait: 5_000, timeout: 20_000 });

      let holderPid: number;
      try {
        holderPid = await Promise.race([
          held,
          holder.then(() => { throw new Error("Advisory lock holder completed before the test barrier"); }),
        ]);
      } catch (error) {
        releaseHolder();
        throw error;
      }
      try {
        const [probe] = await prisma.$queryRaw<Array<{ pid: number; acquired: boolean }>>`
          SELECT pg_backend_pid()::int AS pid,
            pg_try_advisory_xact_lock(hashtextextended(${lockId}::text, 0)) AS acquired
        `;
        assert.notEqual(probe.pid, holderPid, "the lock probe must use a second PostgreSQL backend");
        assert.equal(probe.acquired, false, "the second backend must fail to acquire the held lock");
      } finally {
        releaseHolder();
      }

      assert.equal(await holder, holderPid);
      const [afterRelease] = await prisma.$queryRaw<Array<{ pid: number; acquired: boolean }>>`
        SELECT pg_backend_pid()::int AS pid,
          pg_try_advisory_xact_lock(hashtextextended(${lockId}::text, 0)) AS acquired
      `;
      // Either idle backend may be reused after commit; no pool scheduling policy is required.
      assert.ok(Number.isInteger(afterRelease.pid));
      assert.equal(afterRelease.acquired, true, "the lock must become available after the holder commits");
    });

    await t.test("failed transaction rolls back and its PostgreSQL connection is reusable", async () => {
      let failedBackendPid = 0;
      await assert.rejects(prisma.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
        failedBackendPid = row.pid;
        await tx.$queryRaw`SELECT 1 / 0`;
      }, { maxWait: 5_000, timeout: 15_000 }));

      const [reused] = await prisma.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw<Array<{ pid: number; isolation: string }>>`
          SELECT pg_backend_pid()::int AS pid, current_setting('transaction_isolation')::text AS isolation
        `;
        return [row];
      }, { maxWait: 5_000, timeout: 15_000 });
      assert.notEqual(failedBackendPid, 0);
      assert.equal(reused.pid, failedBackendPid, "the pool should return the rolled-back backend to service");
      assert.equal(reused.isolation, "read committed");
    });

    assert.equal(await countApplicationTables(prisma), tableCountBefore);
  } finally {
    await prisma.$disconnect();
  }
});
