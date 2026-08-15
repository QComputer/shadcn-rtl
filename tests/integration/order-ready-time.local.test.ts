import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import prisma from "@/lib/db";
import { orderService } from "@/lib/services/order.service";
import { ApiError } from "@/lib/api-guards";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "order-ready-time.local.test.ts refuses to run against a non-local database",
);

describe("order ready-time transaction on disposable local database", () => {
  it("records actor/reason/previous estimate, rejects invalid durations, and permits only one concurrent version", async () => {
    const membership = await prisma.organizationMember.findFirst({
      where: { isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF"] } },
      include: { organization: true },
    });
    assert.ok(membership);

    const progress = await prisma.progress.create({ data: {} });
    const previousEstimatedReadyAt = new Date(Date.now() + 12 * 60_000);
    const order = await prisma.order.create({
      data: {
        orderNumber: `LOCAL-READY-${randomUUID()}`,
        type: "PICK_UP",
        subtotal: 100,
        total: 100,
        organizationSlug: membership.organization.slug,
        preparationProgressId: progress.id,
        estimatedReadyAt: previousEstimatedReadyAt,
      },
    });

    try {
      for (const preparationMinutes of [-1, 0, 1441, 2.5]) {
        await assert.rejects(
          orderService.updateReadyTime(order.id, {
            preparationMinutes,
            reason: "invalid duration verification",
            expectedVersion: 0,
          }, membership.userId),
          (error: unknown) => error instanceof ApiError && error.status === 400,
        );
      }
      assert.equal(await prisma.orderReadyTimeHistory.count({ where: { orderId: order.id } }), 0);

      const startedAt = Date.now();
      const concurrent = await Promise.allSettled([
        orderService.updateReadyTime(order.id, {
          preparationMinutes: 25,
          reason: "concurrent update 25",
          expectedVersion: 0,
        }, membership.userId),
        orderService.updateReadyTime(order.id, {
          preparationMinutes: 30,
          reason: "concurrent update 30",
          expectedVersion: 0,
        }, membership.userId),
      ]);
      assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);

      const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const history = await prisma.orderReadyTimeHistory.findUniqueOrThrow({
        where: { orderId_version: { orderId: order.id, version: 1 } },
      });
      assert.equal(updated.readyTimeVersion, 1);
      assert.equal(history.changedById, membership.userId);
      assert.equal(history.previousEstimatedReadyAt?.getTime(), previousEstimatedReadyAt.getTime());
      assert.ok(["concurrent update 25", "concurrent update 30"].includes(history.reason));
      assert.equal(history.preparationMinutes, updated.preparationMinutesSnapshot);
      const expectedDelta = history.preparationMinutes * 60_000;
      assert.ok(history.estimatedReadyAt.getTime() >= startedAt + expectedDelta - 2_000);
      assert.ok(history.estimatedReadyAt.getTime() <= Date.now() + expectedDelta + 2_000);
      assert.match(history.estimatedReadyAt.toISOString(), /Z$/);

      await assert.rejects(
        orderService.updateReadyTime(order.id, {
          preparationMinutes: 30,
          reason: "stale local update",
          expectedVersion: 0,
        }, membership.userId),
        /version conflict/,
      );
      assert.equal(await prisma.orderReadyTimeHistory.count({ where: { orderId: order.id } }), 1);
    } finally {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
      await prisma.progress.delete({ where: { id: progress.id } }).catch(() => undefined);
    }
  });

  it("creates ready-time notifications only for the order customer and assigned driver", async () => {
    const membership = await prisma.organizationMember.findFirst({
      where: { isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF"] } },
      include: { organization: true },
    });
    assert.ok(membership);
    const customerId = `ready_customer_${randomUUID().replaceAll("-", "")}`;
    const driverId = `ready_driver_${randomUUID().replaceAll("-", "")}`;
    const progress = await prisma.progress.create({ data: {} });
    await prisma.user.createMany({ data: [
      { id: customerId, name: `ready-customer-${randomUUID()}`, password: "demo", role: "CUSTOMER" },
      { id: driverId, name: `ready-driver-${randomUUID()}`, password: "demo", role: "DRIVER" },
    ] });
    await prisma.organizationMember.create({ data: {
      id: `ready_member_${randomUUID().replaceAll("-", "")}`,
      organizationId: membership.organizationId,
      organizationSlug: membership.organization.slug,
      userId: driverId,
      role: "DRIVER",
    } });
    const order = await prisma.order.create({ data: {
      orderNumber: `LOCAL-READY-RECIPIENT-${randomUUID()}`,
      type: "PICK_UP",
      subtotal: 100,
      total: 100,
      organizationSlug: membership.organization.slug,
      customerId,
      driverId,
      preparationProgressId: progress.id,
    } });
    const startedAt = new Date(Date.now() - 1_000);

    try {
      await orderService.updateReadyTime(order.id, {
        preparationMinutes: 20,
        reason: "recipient isolation verification",
        expectedVersion: 0,
      }, membership.userId);
      const notifications = await prisma.notification.findMany({
        where: {
          organizationId: membership.organizationId,
          type: "ORDER_READY_TIME_UPDATED",
          createdAt: { gte: startedAt },
          targetUserId: { in: [customerId, driverId] },
        },
        select: { targetUserId: true, context: true },
      });
      assert.deepEqual(new Set(notifications.map((notification) => notification.targetUserId)), new Set([customerId, driverId]));
      assert.equal(notifications.length, 2);
      assert.ok(notifications.every((notification) => notification.context.includes(order.orderNumber)));
      assert.equal(await prisma.notification.count({
        where: {
          organizationId: { not: membership.organizationId },
          type: "ORDER_READY_TIME_UPDATED",
          createdAt: { gte: startedAt },
          targetUserId: { in: [customerId, driverId] },
        },
      }), 0);
    } finally {
      await prisma.notification.deleteMany({ where: { targetUserId: { in: [customerId, driverId] } } });
      await prisma.notificationDeliveryAttempt.deleteMany({ where: { targetUserId: { in: [customerId, driverId] } } });
      await prisma.order.deleteMany({ where: { id: order.id } });
      await prisma.progress.deleteMany({ where: { id: progress.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: driverId } });
      await prisma.user.deleteMany({ where: { id: { in: [customerId, driverId] } } });
    }
  });
});
