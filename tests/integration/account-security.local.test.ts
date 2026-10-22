import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { compare, hash } from "bcryptjs";

test("P1.4 credential revocation, recovery lifecycle, abuse limits and concurrent changes", {
  skip: process.env.ACCOUNT_SECURITY_PG_ACCEPTANCE !== "1", concurrency: false,
}, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "54713"); assert.equal(url.pathname, "/retail_p0_20261019");
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL); assert.match(url.username, /^consol_[a-f0-9]+$/);
  const [{ PrismaClient }, security, recovery, sessions, bindings] = await Promise.all([
    import("@prisma/client"), import("@/lib/security/password.server"), import("@/lib/security/recovery.server"),
    import("@/lib/security/session-credential.server"), import("@/lib/security/credential-binding"),
  ]);
  const db = new PrismaClient();
  const ident = await db.$queryRaw<Array<{ db: string; version: number }>>`SELECT current_database() db,current_setting('server_version_num')::int version`;
  assert.equal(ident[0].db, "retail_p0_20261019"); assert.ok(ident[0].version >= 160000 && ident[0].version < 170000);
  const suffix = randomUUID(), secret = randomBytes(32).toString("hex"), initial = randomBytes(24).toString("hex");
  let userId = "";
  const received: string[] = [];
  try {
    const user = await db.user.create({ data: { name: `p14-${suffix}`, email: `p14-${suffix}@example.test`, password: await hash(initial, 12), role: "CUSTOMER" } }); userId = user.id;
    const a = { id: user.id, credentialBinding: bindings.credentialBinding(user.id, user.password, secret) };
    const b = { ...a };
    const legacy = { id: user.id, iat: Math.floor(Date.now() / 1000) - 60 };
    assert.ok(await sessions.validateSessionCredential(a, secret)); assert.ok(await sessions.validateSessionCredential(legacy, secret));
    const next = randomBytes(24).toString("hex");
    await assert.rejects(security.changeAccountPassword(user.id, "incorrect-current-password", next, db), /صحیح نیست/);
    assert.ok((await db.user.findUniqueOrThrow({ where: { id: user.id } })).password === user.password, "incorrect current password leaves credential unchanged");
    await security.changeAccountPassword(user.id, initial, next, db);
    assert.ok(await sessions.validateSessionCredential(a, secret) === null); assert.ok(await sessions.validateSessionCredential(b, secret) === null);
    assert.ok(await sessions.validateSessionCredential(legacy, secret) === null, "old raw legacy token cannot acquire current credential binding");
    const changed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(await compare(initial, changed.password), false); assert.equal(await compare(next, changed.password), true);
    const fresh = { id: user.id, credentialBinding: bindings.credentialBinding(user.id, changed.password, secret) };
    assert.ok(await sessions.validateSessionCredential(fresh, secret));
    await assert.rejects(security.changeAccountPassword(user.id, next, "a".repeat(73), db), /۷۲/);

    const disabled = new recovery.PasswordRecoveryService(db);
    assert.equal(disabled.available, false); await assert.rejects(disabled.request(user.name!, "disabled-ip"), e => e instanceof security.AccountSecurityError && e.status === 503);
    const channel = { deliver: async (message: { token: string }) => { received.push(message.token); } };
    const service = new recovery.PasswordRecoveryService(db, channel);
    await service.request(user.name!, "unverified-ip"); assert.equal(received.length, 0, "unverified contact never receives recovery credentials");
    await db.emailVerification.create({ data: { userId: user.id, email: user.email!, token: randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 60000), verifiedAt: new Date() } });
    await service.request(`unknown-${suffix}`, "unknown-ip"); assert.equal(received.length, 0);
    await service.request(user.name!, "issue-ip-1"); assert.equal(received.length, 1);
    const stored = await db.passwordReset.findFirstOrThrow({ where: { userId: user.id, usedAt: null } });
    assert.ok(stored.token !== received[0], "only a recovery digest is persisted"); assert.equal(stored.token.includes(received[0]), false);
    await db.passwordReset.update({ where: { id: stored.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(service.consume(received[0], randomBytes(24).toString("hex"), "expired-ip"), /منقضی/);
    await service.request(user.name!, "issue-ip-2");
    const recoveryPassword = randomBytes(24).toString("hex");
    await service.consume(received[1], recoveryPassword, "consume-ip");
    assert.ok(await sessions.validateSessionCredential(fresh, secret) === null);
    await assert.rejects(service.consume(received[1], randomBytes(24).toString("hex"), "replay-ip"), /قبلاً/);
    assert.equal(await compare(recoveryPassword, (await db.user.findUniqueOrThrow({ where: { id: user.id } })).password), true);

    for (let i = 0; i < 5; i++) await service.request("absent-user", "limited-ip");
    await assert.rejects(service.request("absent-user", "limited-ip"), e => e instanceof security.AccountSecurityError && e.status === 429);
    for (let i = 0; i < 10; i++) await assert.rejects(service.consume("invalid", recoveryPassword, "limited-consume-ip"), /نامعتبر/);
    await assert.rejects(service.consume("invalid", recoveryPassword, "limited-consume-ip"), e => e instanceof security.AccountSecurityError && e.status === 429);

    // Hold the row until both credential updates are observed waiting in PG.
    let release!: () => void, locked!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }); const ready = new Promise<void>(resolve => { locked = resolve; });
    const lock = db.$transaction(async tx => { await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`; locked(); await gate; }, { timeout: 20000 });
    await ready;
    const contenders = [randomBytes(24).toString("hex"), randomBytes(24).toString("hex")];
    const racing = contenders.map(value => security.changeAccountPassword(user.id, recoveryPassword, value, db));
    const settled = Promise.allSettled(racing);
    let waiters = 0;
    try {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const rows = await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%user%'`;
        waiters = rows[0].n; if (waiters >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } finally { release(); await lock; }
    const outcomes = await settled;
    assert.ok(waiters >= 2, "two overlapping updates observed waiting on the real PG row lock");
    assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter(x => x.status === "rejected").length, 1);
    const beforeRecoveryRace = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const beforeRecoverySession = { id: user.id, credentialBinding: bindings.credentialBinding(user.id, beforeRecoveryRace.password, secret) };
    await service.request(user.name!, "issue-ip-3"); assert.equal(received.length, 3);
    const concurrentRecoveryPassword = randomBytes(24).toString("hex");
    const recovering = await Promise.allSettled([
      service.consume(received[2], concurrentRecoveryPassword, "race-consume-ip-1"),
      service.consume(received[2], concurrentRecoveryPassword, "race-consume-ip-2"),
    ]);
    assert.equal(recovering.filter(x => x.status === "fulfilled").length, 1);
    assert.ok(await sessions.validateSessionCredential(beforeRecoverySession, secret) === null);
    const audit = JSON.stringify(await db.auditLog.findMany({ where: { entityId: user.id } }));
    for (const sensitive of [initial, next, recoveryPassword, ...received]) assert.equal(audit.includes(sensitive), false);
    assert.ok(audit.includes("allPreviousSessionsRevoked"));
  } finally {
    if (userId) { await db.passwordReset.deleteMany({ where: { userId } }); await db.emailVerification.deleteMany({ where: { userId } }); await db.auditLog.deleteMany({ where: { OR: [{ entityId: userId }, { userId }] } }); await db.user.delete({ where: { id: userId } }); }
    // Delete only this test's rate-limit rows through exact fixture IP hashes.
    const { createHash } = await import("node:crypto");
    const ids = ["unverified-ip", "unknown-ip", "issue-ip-1", "issue-ip-2", "issue-ip-3", "limited-ip"].map(ip => createHash("sha256").update(`recovery:request:${ip}`).digest("hex"))
      .concat(["expired-ip", "consume-ip", "replay-ip", "limited-consume-ip", "race-consume-ip-1", "race-consume-ip-2"].map(ip => createHash("sha256").update(`recovery:consume:${ip}`).digest("hex")));
    await db.auditLog.deleteMany({ where: { entityType: "AccountRecoveryAttempt", entityId: { in: ids } } });
    await db.$disconnect();
  }
});
