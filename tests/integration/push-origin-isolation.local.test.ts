import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import webpush from "web-push";
import prisma from "@/lib/db";
import { webPushFoundationService } from "@/lib/services/web-push-foundation.service";
import { buildOrderPushTargetUrl } from "@/lib/push-target-url";

const ORIGIN_A = "http://127.0.0.1:3100";
const ORIGIN_B = "http://localhost:3100";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "push-origin-isolation.local.test.ts refuses to run against a non-local database",
);

function unique(label: string) {
  return `${label}_${randomUUID().replaceAll("-", "")}`;
}

describe("origin-aware Push persistence on disposable local database", () => {
  it("keeps the same endpoint unique per user/origin and unsubscribes only the selected origin", async () => {
    const organization = await prisma.organization.findFirstOrThrow({ where: { isActive: true, deletedAt: null, capabilities: { some: { key: "SHOP", status: "ACTIVE" } } } });
    const customerId = unique("push_customer");
    const endpoint = `https://push.example.test/${unique("endpoint")}`;
    await prisma.user.create({ data: { id: customerId, name: unique("push-customer-name"), password: "demo", role: "CUSTOMER" } });

    try {
      for (const origin of [ORIGIN_A, ORIGIN_B]) {
        await webPushFoundationService.subscribe({
          organizationSlug: organization.slug,
          customerId,
          origin,
          subscription: { endpoint, keys: { p256dh: "p256dh", auth: "auth" } },
          source: "TEST",
        });
      }
      await webPushFoundationService.subscribe({
        organizationSlug: organization.slug,
        customerId,
        origin: ORIGIN_A,
        subscription: { endpoint, keys: { p256dh: "p256dh-updated", auth: "auth-updated" } },
        source: "TEST",
      });

      const subscriptions = await prisma.pushSubscription.findMany({
        where: { organizationId: organization.id, customerId, endpoint },
        orderBy: { origin: "asc" },
      });
      assert.equal(subscriptions.length, 2);
      assert.deepEqual(new Set(subscriptions.map((subscription) => subscription.origin)), new Set([ORIGIN_A, ORIGIN_B]));
      assert.equal(subscriptions.find((subscription) => subscription.origin === ORIGIN_A)?.p256dh, "p256dh-updated");

      const result = await webPushFoundationService.unsubscribe({
        organizationSlug: organization.slug,
        customerId,
        origin: ORIGIN_A,
        endpoint,
        source: "TEST",
      });
      assert.equal(result.updated, 1);
      const after = await prisma.pushSubscription.findMany({ where: { organizationId: organization.id, customerId, endpoint } });
      assert.equal(after.find((subscription) => subscription.origin === ORIGIN_A)?.isActive, false);
      assert.equal(after.find((subscription) => subscription.origin === ORIGIN_B)?.isActive, true);
      const preference = await prisma.notificationPreference.findUnique({
        where: { organizationId_customerId_channel: { organizationId: organization.id, customerId, channel: "WEB_PUSH" } },
      });
      assert.equal(preference?.transactionalEnabled, true);
    } finally {
      await prisma.notificationPermissionEvent.deleteMany({ where: { customerId } });
      await prisma.pushSubscription.deleteMany({ where: { customerId } });
      await prisma.notificationPreference.deleteMany({ where: { customerId } });
      await prisma.auditLog.deleteMany({ where: { userId: customerId } });
      await prisma.user.deleteMany({ where: { id: customerId } });
    }
  });

  it("cleans up only the expired subscription and never stores a cross-tenant absolute deep link", async () => {
    const organizations = await prisma.organization.findMany({
      where: { isActive: true, deletedAt: null, capabilities: { some: { key: "SHOP", status: "ACTIVE" } } },
      take: 2,
    });
    assert.equal(organizations.length, 2);
    const [tenantA, tenantB] = organizations;
    const customerId = unique("expired_push_customer");
    const endpoint = `https://push.example.test/${unique("expired")}`;
    const existingDomain = await prisma.organizationDomain.findFirst({ where: { organizationId: tenantA.id } });
    const customHost = existingDomain?.normalizedDomain || `${unique("push-custom")}.example.test`;
    const customOrigin = `https://${customHost}`;
    await prisma.user.create({ data: { id: customerId, name: unique("expired-push-name"), password: "demo", role: "CUSTOMER" } });
    if (existingDomain) {
      await prisma.organizationDomain.update({
        where: { id: existingDomain.id },
        data: { status: "ACTIVE", deletedAt: null },
      });
    } else {
      await prisma.organizationDomain.create({
        data: {
          organizationId: tenantA.id,
          domain: customHost,
          normalizedDomain: customHost,
          status: "ACTIVE",
          isPrimary: true,
        },
      });
    }
    await webPushFoundationService.subscribe({
      organizationSlug: tenantA.slug,
      customerId,
      origin: customOrigin,
      subscription: { endpoint, keys: { p256dh: "p256dh", auth: "auth" } },
      source: "TEST",
    });

    const envKeys = [
      "WEB_PUSH_ENABLED",
      "WEB_PUSH_PROVIDER",
      "WEB_PUSH_DRY_RUN",
      "WEB_PUSH_REAL_SEND_ENABLED",
      "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY",
      "WEB_PUSH_VAPID_PRIVATE_KEY",
      "WEB_PUSH_VAPID_SUBJECT",
    ] as const;
    const envBefore = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const originalSetVapidDetails = webpush.setVapidDetails;
    const originalSendNotification = webpush.sendNotification;
    try {
      process.env.WEB_PUSH_ENABLED = "true";
      process.env.WEB_PUSH_PROVIDER = "test";
      process.env.WEB_PUSH_DRY_RUN = "false";
      process.env.WEB_PUSH_REAL_SEND_ENABLED = "true";
      process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = "test-public";
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "test-private";
      process.env.WEB_PUSH_VAPID_SUBJECT = "mailto:test@example.test";
      webpush.setVapidDetails = (() => undefined) as typeof webpush.setVapidDetails;
      webpush.sendNotification = (async (_subscription, payload) => {
        const parsed = JSON.parse(String(payload));
        assert.deepEqual(Object.keys(parsed).sort(), ["body", "title", "url"]);
        assert.equal(parsed.url, "/order/ORD-A");
        assert.equal(String(parsed.url).includes(tenantB.slug), false);
        const error = new Error("expired subscription") as Error & { statusCode: number };
        error.statusCode = 410;
        throw error;
      }) as typeof webpush.sendNotification;

      const result = await webPushFoundationService.sendToCustomer({
        organizationId: tenantA.id,
        customerId,
        title: "Ready",
        body: "Order ORD-A is ready",
        targetUrl: buildOrderPushTargetUrl({ organizationSlug: tenantA.slug, orderNumber: "ORD-A", audience: "CUSTOMER" }),
        preferenceKind: "transactional",
      });
      assert.equal(result.removedCount, 1);
      assert.equal(result.failureCount, 1);
      const subscription = await prisma.pushSubscription.findFirstOrThrow({ where: { organizationId: tenantA.id, customerId, endpoint } });
      assert.equal(subscription.isActive, false);
      assert.ok(subscription.unsubscribedAt);
      const delivery = await prisma.webPushDelivery.findFirstOrThrow({ where: { organizationId: tenantA.id, customerId, subscriptionId: subscription.id } });
      assert.equal(delivery.subscriptionOrigin, customOrigin);
      assert.equal(delivery.targetUrl, "/order/ORD-A");
      assert.equal(delivery.targetUrl?.includes(tenantB.slug), false);
    } finally {
      webpush.setVapidDetails = originalSetVapidDetails;
      webpush.sendNotification = originalSendNotification;
      for (const key of envKeys) {
        const value = envBefore[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await prisma.webPushDelivery.deleteMany({ where: { customerId } });
      await prisma.notificationDeliveryAttempt.deleteMany({ where: { targetUserId: customerId } });
      await prisma.notificationPermissionEvent.deleteMany({ where: { customerId } });
      await prisma.pushSubscription.deleteMany({ where: { customerId } });
      await prisma.notificationPreference.deleteMany({ where: { customerId } });
      await prisma.auditLog.deleteMany({ where: { userId: customerId } });
      if (existingDomain) {
        await prisma.organizationDomain.update({
          where: { id: existingDomain.id },
          data: { status: existingDomain.status, deletedAt: existingDomain.deletedAt },
        });
      } else {
        await prisma.organizationDomain.deleteMany({ where: { normalizedDomain: customHost } });
      }
      await prisma.user.deleteMany({ where: { id: customerId } });
    }
  });
});
