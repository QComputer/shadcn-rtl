import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  ApiError,
  requireCurrentOrganizationId,
  requireImageManageAccess,
  requireOrderAccess,
  requireOrgAccess,
  requireProductAccess,
  requireRole,
  requireServiceAccess,
} from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { isDashboardNavigationItemVisible } from "@/lib/dashboard/navigation-policy";
import { evaluateOrganizationCollaborationGrant } from "@/lib/collaboration-grants";
import {
  listCustomerInteractions,
  recordCustomerInteraction,
  resolveCustomerIdentity,
} from "@/lib/customer-identity/customer-identity.service";
import { GET as getPublicShop } from "@/app/api/public/organizations/[slug]/shop/route";
import { GET as getUploadedFile } from "@/app/uploads/[filename]/route";
import { orderService } from "@/lib/services/order.service";
import { appointmentService } from "@/lib/services/appointment.service";
import {
  createOrganizationIntegration,
  getOrganizationIntegration,
  listOrganizationIntegrations,
  sanitizeIntegrationConfig,
  updateOrganizationIntegrationStatus,
} from "@/lib/integrations/organization-integrations";
import {
  listBusinessEventsForOrganization,
  recordBusinessEvent,
} from "@/lib/integrations/runtime/business-events";
import { checkIntegrationRuntimeHealth } from "@/lib/integrations/runtime/service";
import { startUssdSession } from "@/lib/integrations/runtime/ussd-sessions";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "tenant-context.local.test.ts refuses to run against a non-local database",
);

function fixtureId(label: string) {
  return `${label}_${randomUUID().replaceAll("-", "")}`;
}

describe("explicit tenant context against the disposable local database", () => {
  it("allows the exact membership and rejects an unrelated organization", async () => {
    const membership = await prisma.organizationMember.findFirst({
      where: { isActive: true, user: { role: { not: "SUPER_ADMIN" }, isActive: true } },
      include: { user: true },
    });
    assert.ok(membership, "local seed must contain an active organization membership");

    const unrelated = await prisma.organization.findFirst({
      where: {
        id: { not: membership.organizationId },
        members: { none: { userId: membership.userId, isActive: true } },
        isActive: true,
      },
    });
    assert.ok(unrelated, "local seed must contain an unrelated organization");

    const session = {
      user: {
        id: membership.userId,
        role: membership.user.role,
        organizationId: membership.organizationId,
      },
    };
    const own = await requireTenantContext(session, membership.organizationId, [membership.role]);
    assert.equal(own.organizationId, membership.organizationId);

    await assert.rejects(
      requireTenantContext(session, unrelated.id, [membership.role]),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );
  });

  it("immediately rejects revoked membership and a disabled organization", async () => {
    const membership = await prisma.organizationMember.findFirstOrThrow({
      where: { isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF"] } },
      select: { id: true, userId: true, organizationId: true, role: true },
    });
    const session = {
      user: {
        id: membership.userId,
        role: membership.role,
        organizationId: membership.organizationId,
      },
    };

    await prisma.organizationMember.update({ where: { id: membership.id }, data: { isActive: false } });
    try {
      await assert.rejects(
        requireTenantContext(session, membership.organizationId, [membership.role]),
        (error: unknown) => Number((error as { status?: number }).status) === 403,
      );
    } finally {
      await prisma.organizationMember.update({ where: { id: membership.id }, data: { isActive: true } });
    }

    await prisma.organization.update({ where: { id: membership.organizationId }, data: { isActive: false } });
    try {
      await assert.rejects(
        requireTenantContext(session, membership.organizationId, [membership.role]),
        (error: unknown) => Number((error as { status?: number }).status) === 404,
      );
    } finally {
      await prisma.organization.update({ where: { id: membership.organizationId }, data: { isActive: true } });
    }
  });

  it("seeds explicit zero, single, and mixed capability organization states", async () => {
    const organizations = await prisma.organization.findMany({
      select: { id: true, capabilitiesInitializedAt: true, capabilities: { where: { status: "ACTIVE" } } },
    });
    assert.ok(organizations.length > 0);
    for (const organization of organizations) {
      assert.ok(organization.capabilitiesInitializedAt);
    }
    const bySlug = await prisma.organization.findMany({
      where: { slug: { in: ["zero-capability-demo", "mixed-capability-demo", "sicily", "tikal"] } },
      select: { slug: true, capabilities: { where: { status: "ACTIVE" }, select: { key: true } } },
    });
    const capabilities = new Map(bySlug.map((organization) => [organization.slug, organization.capabilities.map((item) => item.key).sort()]));
    assert.deepEqual(capabilities.get("zero-capability-demo"), []);
    assert.deepEqual(capabilities.get("sicily"), ["SHOP"]);
    assert.deepEqual(capabilities.get("tikal"), ["APPOINTMENT"]);
    assert.deepEqual(capabilities.get("mixed-capability-demo"), ["APPOINTMENT", "SHOP"]);
  });

  it("rejects URL, query, body, and resource tenant overrides even when the user belongs to both organizations", async () => {
    const userId = fixtureId("tenant_user");
    const orgAId = fixtureId("tenant_a");
    const orgBId = fixtureId("tenant_b");
    const slugA = fixtureId("tenant-a-slug").toLowerCase();
    const slugB = fixtureId("tenant-b-slug").toLowerCase();
    await prisma.user.create({ data: { id: userId, name: fixtureId("tenant-admin"), password: "demo", role: "ADMIN" } });
    await prisma.organization.createMany({ data: [
      { id: orgAId, name: "Tenant A", slug: slugA, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: orgBId, name: "Tenant B", slug: slugB, type: "SHOP", capabilitiesInitializedAt: new Date() },
    ] });
    await prisma.organizationMember.createMany({ data: [
      { id: fixtureId("member_a"), userId, organizationId: orgAId, organizationSlug: slugA, role: "ADMIN" },
      { id: fixtureId("member_b"), userId, organizationId: orgBId, organizationSlug: slugB, role: "ADMIN" },
    ] });

    const session = { user: { id: userId, role: "ADMIN" as const, organizationId: orgAId } };
    try {
      await assert.rejects(requireTenantContext(session, orgBId, ["ADMIN"]), (error: unknown) => error instanceof ApiError && error.status === 403);
      await assert.rejects(requireCurrentOrganizationId(session, orgBId), (error: unknown) => error instanceof ApiError && error.status === 403);
      await assert.rejects(requireOrgAccess(session, orgBId, ["ADMIN"]), (error: unknown) => error instanceof ApiError && error.status === 403);
      assert.throws(() => requireRole(session, ["SUPER_ADMIN"]), (error: unknown) => error instanceof ApiError && error.status === 403);
      assert.equal((await requireTenantContext(session, orgAId, ["ADMIN"])).organizationId, orgAId);
    } finally {
      await prisma.organizationMember.deleteMany({ where: { userId } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("rejects order/customer/product/service/image IDOR and never serves a PRIVATE upload", async () => {
    const adminId = fixtureId("idor_admin");
    const customerAId = fixtureId("idor_customer_a");
    const customerBId = fixtureId("idor_customer_b");
    const orgAId = fixtureId("idor_org_a");
    const orgBId = fixtureId("idor_org_b");
    const slugA = fixtureId("idor-a-slug").toLowerCase();
    const slugB = fixtureId("idor-b-slug").toLowerCase();
    const productCategoryId = fixtureId("idor_product_category");
    const productId = fixtureId("idor_product");
    const serviceCategoryId = fixtureId("idor_service_category");
    const serviceId = fixtureId("idor_service");
    const orderId = fixtureId("idor_order");
    const imageId = fixtureId("idor_image");
    const filename = `${fixtureId("private")}.png`;

    await prisma.user.createMany({ data: [
      { id: adminId, name: fixtureId("idor-admin-name"), password: "demo", role: "ADMIN" },
      { id: customerAId, name: fixtureId("idor-customer-a-name"), password: "demo", role: "CUSTOMER" },
      { id: customerBId, name: fixtureId("idor-customer-b-name"), password: "demo", role: "CUSTOMER" },
    ] });
    await prisma.organization.createMany({ data: [
      { id: orgAId, name: "IDOR A", slug: slugA, type: "SHOP" },
      { id: orgBId, name: "IDOR B", slug: slugB, type: "SHOP" },
    ] });
    await prisma.organizationMember.create({ data: { id: fixtureId("idor_member"), userId: adminId, organizationId: orgAId, organizationSlug: slugA, role: "ADMIN" } });
    await prisma.productCategory.create({ data: { id: productCategoryId, name: "IDOR category", organizationId: orgBId, organizationSlug: slugB } });
    await prisma.product.create({ data: { id: productId, name: "IDOR product", basePrice: 1, organizationId: orgBId, organizationSlug: slugB, categoryId: productCategoryId } });
    await prisma.serviceCategory.create({ data: { id: serviceCategoryId, name: "IDOR service category", organizationId: orgBId } });
    await prisma.service.create({ data: { id: serviceId, name: "IDOR service", price: 1, duration: 30, organizationId: orgBId, categoryId: serviceCategoryId } });
    await prisma.order.create({ data: { id: orderId, orderNumber: fixtureId("IDOR-ORDER"), type: "PICK_UP", subtotal: 1, total: 1, organizationSlug: slugB, customerId: customerBId } });
    await prisma.image.create({ data: { id: imageId, filename, url: `/uploads/${filename}`, access: "PRIVATE", organizationId: orgBId } });

    const adminSession = { user: { id: adminId, role: "ADMIN" as const, organizationId: orgAId } };
    const customerSession = { user: { id: customerAId, role: "CUSTOMER" as const, organizationId: orgAId } };
    try {
      await assert.rejects(requireProductAccess(adminSession, productId), (error: unknown) => error instanceof ApiError && error.status === 403);
      await assert.rejects(requireServiceAccess(adminSession, serviceId), (error: unknown) => error instanceof ApiError && error.status === 403);
      await assert.rejects(requireImageManageAccess(adminSession, imageId), (error: unknown) => error instanceof ApiError && error.status === 403);
      await assert.rejects(requireOrderAccess(adminSession, orderId), (error: unknown) => error instanceof ApiError && error.status === 403);
      await assert.rejects(requireOrderAccess(customerSession, orderId, ["CUSTOMER"]), (error: unknown) => error instanceof ApiError && error.status === 403);

      const response = await getUploadedFile(
        new NextRequest(`http://127.0.0.1:3100/uploads/${filename}`),
        { params: Promise.resolve({ filename }) },
      );
      assert.equal(response.status, 404);
    } finally {
      await prisma.image.deleteMany({ where: { id: imageId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
      await prisma.product.deleteMany({ where: { id: productId } });
      await prisma.productCategory.deleteMany({ where: { id: productCategoryId } });
      await prisma.service.deleteMany({ where: { id: serviceId } });
      await prisma.serviceCategory.deleteMany({ where: { id: serviceCategoryId } });
      await prisma.organizationMember.deleteMany({ where: { userId: adminId } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [adminId, customerAId, customerBId] } } });
    }
  });

  it("preserves historical SHOP data through disable/re-enable and keeps public/manage/cache views tenant-scoped", async () => {
    const orgAId = fixtureId("cap_org_a");
    const orgBId = fixtureId("cap_org_b");
    const slugA = fixtureId("cap-a-slug").toLowerCase();
    const slugB = fixtureId("cap-b-slug").toLowerCase();
    const categoryId = fixtureId("cap_category");
    const productId = fixtureId("cap_product");
    const orderId = fixtureId("cap_order");
    const serviceCategoryId = fixtureId("cap_service_category");
    const serviceId = fixtureId("cap_service");
    const customerId = fixtureId("cap_customer");
    await prisma.organization.createMany({ data: [
      { id: orgAId, name: "Brand Tenant A", slug: slugA, logo: "/brand-a.png", type: "APPOINTMENT", capabilitiesInitializedAt: new Date() },
      { id: orgBId, name: "Brand Tenant B", slug: slugB, logo: "/brand-b.png", type: "SHOP", capabilitiesInitializedAt: new Date() },
    ] });
    await prisma.organizationCapability.createMany({ data: [
      { id: fixtureId("cap_a"), organizationId: orgAId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("cap_a_appointment"), organizationId: orgAId, key: "APPOINTMENT", status: "INACTIVE", disabledAt: new Date() },
      { id: fixtureId("cap_b"), organizationId: orgBId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    ] });
    await prisma.user.create({ data: { id: customerId, name: fixtureId("cap-customer"), password: "demo", role: "CUSTOMER" } });
    await prisma.productCategory.create({ data: { id: categoryId, name: "Historical category", organizationId: orgAId, organizationSlug: slugA } });
    await prisma.product.create({ data: { id: productId, name: "Historical product", basePrice: 10, organizationId: orgAId, organizationSlug: slugA, categoryId } });
    await prisma.serviceCategory.create({ data: { id: serviceCategoryId, name: "Historical service category", organizationId: orgAId } });
    await prisma.service.create({ data: { id: serviceId, name: "Historical service", price: 10, duration: 30, organizationId: orgAId, categoryId: serviceCategoryId } });
    await prisma.order.create({ data: { id: orderId, orderNumber: fixtureId("CAP-ORDER"), type: "PICK_UP", subtotal: 10, total: 10, organizationSlug: slugA } });

    const before = {
      products: await prisma.product.count({ where: { organizationId: orgAId } }),
      orders: await prisma.order.count({ where: { organizationSlug: slugA } }),
      services: await prisma.service.count({ where: { organizationId: orgAId } }),
    };
    try {
      const responseA1 = await getPublicShop(new NextRequest(`http://127.0.0.1/api/public/organizations/${slugA}/shop`), { params: Promise.resolve({ slug: slugA }) });
      const responseB = await getPublicShop(new NextRequest(`http://127.0.0.1/api/public/organizations/${slugB}/shop`), { params: Promise.resolve({ slug: slugB }) });
      const responseA2 = await getPublicShop(new NextRequest(`http://127.0.0.1/api/public/organizations/${slugA}/shop`), { params: Promise.resolve({ slug: slugA }) });
      assert.equal((await responseA1.json()).organization.name, "Brand Tenant A");
      assert.equal((await responseB.json()).organization.name, "Brand Tenant B");
      assert.equal((await responseA2.json()).organization.logo, "/brand-a.png");

      await prisma.organizationCapability.update({
        where: { organizationId_key: { organizationId: orgAId, key: "SHOP" } },
        data: { status: "INACTIVE", disabledAt: new Date() },
      });
      await assert.rejects(
        requireActiveOrganizationCapability({ organizationId: orgAId, capability: "SHOP" }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );
      await assert.rejects(
        orderService.create({ organizationSlug: slugA, type: "PICK_UP", autoCompleteEndTimes: false }, customerId),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );
      await assert.rejects(
        appointmentService.create(customerId, {
          serviceId,
          date: "2030-01-01",
          startTime: "2030-01-01T08:00:00.000Z",
        }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );
      const disabledResponse = await getPublicShop(new NextRequest(`http://127.0.0.1/api/public/organizations/${slugA}/shop`), { params: Promise.resolve({ slug: slugA }) });
      assert.equal(disabledResponse.status, 404);
      assert.equal(isDashboardNavigationItemVisible("orders", "ADMIN", []), false);
      assert.deepEqual({
        products: await prisma.product.count({ where: { organizationId: orgAId } }),
        orders: await prisma.order.count({ where: { organizationSlug: slugA } }),
        services: await prisma.service.count({ where: { organizationId: orgAId } }),
      }, before);

      await prisma.organizationCapability.update({
        where: { organizationId_key: { organizationId: orgAId, key: "SHOP" } },
        data: { status: "ACTIVE", enabledAt: new Date(), disabledAt: null },
      });
      await requireActiveOrganizationCapability({ organizationId: orgAId, capability: "SHOP" });
      const enabledResponse = await getPublicShop(new NextRequest(`http://127.0.0.1/api/public/organizations/${slugA}/shop`), { params: Promise.resolve({ slug: slugA }) });
      assert.equal(enabledResponse.status, 200);
      assert.equal((await enabledResponse.json()).organization.name, "Brand Tenant A");
      assert.deepEqual({
        products: await prisma.product.count({ where: { organizationId: orgAId } }),
        orders: await prisma.order.count({ where: { organizationSlug: slugA } }),
        services: await prisma.service.count({ where: { organizationId: orgAId } }),
      }, before);
    } finally {
      await prisma.order.deleteMany({ where: { id: orderId } });
      await prisma.product.deleteMany({ where: { id: productId } });
      await prisma.productCategory.deleteMany({ where: { id: categoryId } });
      await prisma.service.deleteMany({ where: { id: serviceId } });
      await prisma.serviceCategory.deleteMany({ where: { id: serviceCategoryId } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { id: customerId } });
    }
  });

  it("denies collaboration without scope and after revocation", async () => {
    const collaboration = {
      ownerOrgId: "tenant-a",
      partnerOrgId: "tenant-b",
      status: "ACTIVE" as const,
      scopes: [{ scope: "ORDER_VISIBILITY" as const, ownerToPartner: true, partnerToOwner: false, writeAccess: false }],
    };
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration,
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "CUSTOMER_PROFILE",
      access: "READ",
    }), false);
    assert.equal(evaluateOrganizationCollaborationGrant({
      collaboration: { ...collaboration, status: "REVOKED" },
      actorOrganizationId: "tenant-b",
      resourceOrganizationId: "tenant-a",
      scope: "ORDER_VISIBILITY",
      access: "READ",
    }), false);
  });

  it("manages organization integrations by capability and tenant boundary", async () => {
    const orgAId = fixtureId("integration_org_a");
    const orgBId = fixtureId("integration_org_b");
    const zeroOrgId = fixtureId("integration_zero");
    const legacyOrgId = fixtureId("integration_legacy");
    const slugA = fixtureId("integration-a").toLowerCase();
    const slugB = fixtureId("integration-b").toLowerCase();
    const zeroSlug = fixtureId("integration-zero").toLowerCase();
    const legacySlug = fixtureId("integration-legacy").toLowerCase();
    await prisma.organization.createMany({ data: [
      { id: orgAId, name: "Integration Tenant A", slug: slugA, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: orgBId, name: "Integration Tenant B", slug: slugB, type: "APPOINTMENT", capabilitiesInitializedAt: new Date() },
      { id: zeroOrgId, name: "Integration Zero", slug: zeroSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: legacyOrgId, name: "Integration Legacy", slug: legacySlug, type: "SHOP" },
    ] });
    await prisma.organizationCapability.createMany({ data: [
      { id: fixtureId("integration_shop"), organizationId: orgAId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("integration_ussd"), organizationId: orgAId, key: "USSD", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("integration_crm"), organizationId: orgAId, key: "CRM", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("integration_ebc"), organizationId: orgAId, key: "EBC", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("integration_appointment"), organizationId: orgBId, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
    ] });

    try {
      assert.throws(
        () => sanitizeIntegrationConfig({ publicCode: "ok", apiKey: "must-not-be-stored" }),
        /secret reference/,
      );

      const imenu = await createOrganizationIntegration({
        organizationId: orgAId,
        provider: "INOTI_IMENU",
        codeName: "imenu-alpha",
        configuration: { publicCode: "menu-alpha" },
      });
      assert.equal(imenu.type, "IMENU");
      assert.deepEqual(imenu.capabilityKeys, ["SHOP"]);
      assert.equal(imenu.configuration.publicCode, "menu-alpha");
      assert.equal(imenu.secret.configured, false);

      const ussd = await createOrganizationIntegration({
        organizationId: orgAId,
        provider: "INOTI_USSD",
        status: "ACTIVE",
        codeName: "ussd_alpha",
        credentialProfileKey: "INOTI_DEFAULT",
        capabilityKeys: ["USSD"],
        configuration: { serviceCode: "87788778" },
      });
      assert.equal(ussd.type, "USSD");
      assert.deepEqual(ussd.capabilityKeys, ["USSD"]);
      assert.equal(ussd.secret.configured, true);

      const health = await checkIntegrationRuntimeHealth({
        organizationId: orgAId,
        integrationId: ussd.id,
      });
      assert.equal(health.healthStatus, "CONNECTED");
      assert.equal(health.connected, true);
      assert.equal(health.metadata.dryRun, true);

      await assert.rejects(
        recordBusinessEvent({
          organizationId: orgAId,
          integrationId: ussd.id,
          type: "CUSTOMER_CREATED",
          payload: { password: "must-not-be-stored" },
        }),
        /secret reference/,
      );
      await assert.rejects(
        recordBusinessEvent({
          organizationId: orgBId,
          integrationId: ussd.id,
          type: "CUSTOMER_CREATED",
          payload: { source: "cross-tenant" },
        }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      const businessEvent = await recordBusinessEvent({
        organizationId: orgAId,
        integrationId: ussd.id,
        type: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: "customer-alpha",
        payload: { source: "local-test" },
      });
      assert.equal(businessEvent.organizationId, orgAId);
      assert.equal((await listBusinessEventsForOrganization({ organizationId: orgAId })).some((event) => event.id === businessEvent.id), true);
      assert.equal((await listBusinessEventsForOrganization({ organizationId: orgBId })).length, 0);

      const customerIdentity = await resolveCustomerIdentity({
        organizationId: orgAId,
        phone: "+989121234567",
        metadata: { source: "local-test" },
      });
      assert.equal(customerIdentity.organizationId, orgAId);
      assert.equal(customerIdentity.phone, "09121234567");
      const sameCustomerIdentity = await resolveCustomerIdentity({
        organizationId: orgAId,
        phone: "0912-123-4567",
      });
      assert.equal(sameCustomerIdentity.id, customerIdentity.id);
      const otherTenantIdentity = await resolveCustomerIdentity({
        organizationId: orgBId,
        phone: "+989121234567",
      });
      assert.notEqual(otherTenantIdentity.id, customerIdentity.id);
      assert.notEqual(otherTenantIdentity.phoneHash, customerIdentity.phoneHash);
      await assert.rejects(
        recordBusinessEvent({
          organizationId: orgBId,
          customerIdentityId: customerIdentity.id,
          type: "CUSTOMER_CREATED",
          payload: { source: "cross-tenant-customer" },
        }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      const customerEvent = await recordBusinessEvent({
        organizationId: orgAId,
        integrationId: ussd.id,
        customerIdentityId: customerIdentity.id,
        type: "CUSTOMER_CREATED",
        entityType: "CustomerIdentity",
        entityId: customerIdentity.id,
        payload: { source: "identity-foundation" },
      });
      assert.equal(customerEvent.customerIdentityId, customerIdentity.id);
      const customerInteraction = await recordCustomerInteraction({
        organizationId: orgAId,
        customerIdentityId: customerIdentity.id,
        integrationId: ussd.id,
        businessEventId: customerEvent.id,
        type: "CUSTOMER_CREATED",
        entityType: "CustomerIdentity",
        entityId: customerIdentity.id,
        summary: "Customer identity resolved",
        metadata: { source: "local-test" },
      });
      assert.equal(customerInteraction.customerIdentityId, customerIdentity.id);
      assert.equal((await listCustomerInteractions({
        organizationId: orgAId,
        customerIdentityId: customerIdentity.id,
      })).length, 1);
      await assert.rejects(
        listCustomerInteractions({
          organizationId: orgBId,
          customerIdentityId: customerIdentity.id,
        }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      await assert.rejects(
        resolveCustomerIdentity({
          organizationId: orgAId,
          phone: "+989121234568",
          metadata: { accessToken: "must-not-be-stored" },
        }),
        /secret reference/,
      );

      const ussdSession = await startUssdSession({
        organizationId: orgAId,
        integrationId: ussd.id,
        sessionIdHash: "a".repeat(64),
        phone: "+989129999999",
        metadata: { serviceCode: "87788778" },
      });
      assert.equal(ussdSession.organizationId, orgAId);
      assert.equal(ussdSession.integrationId, ussd.id);
      assert.ok(ussdSession.customerIdentityId);
      assert.equal(ussdSession.status, "STARTED");
      const ussdCustomerInteractions = await listCustomerInteractions({
        organizationId: orgAId,
        customerIdentityId: ussdSession.customerIdentityId,
      });
      assert.equal(ussdCustomerInteractions.some((interaction) => interaction.type === "USSD_SESSION_STARTED"), true);
      await assert.rejects(
        startUssdSession({
          organizationId: orgBId,
          integrationId: ussd.id,
          sessionIdHash: "b".repeat(64),
        }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      const ebc = await createOrganizationIntegration({
        organizationId: orgAId,
        provider: "INOTI_EBC",
        codeName: "ebc-alpha",
      });
      assert.equal(ebc.type, "EBC");
      assert.deepEqual(ebc.capabilityKeys, ["CRM", "EBC"]);

      assert.equal((await listOrganizationIntegrations(orgAId)).length, 3);
      assert.equal((await listOrganizationIntegrations(orgBId)).length, 0);
      await assert.rejects(
        getOrganizationIntegration({ organizationId: orgBId, integrationId: imenu.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      const disabled = await updateOrganizationIntegrationStatus({
        organizationId: orgAId,
        integrationId: imenu.id,
        status: "DISABLED",
      });
      assert.equal(disabled.status, "DISABLED");
      assert.ok(disabled.disabledAt);
      const enabled = await updateOrganizationIntegrationStatus({
        organizationId: orgAId,
        integrationId: imenu.id,
        status: "ACTIVE",
      });
      assert.equal(enabled.status, "ACTIVE");
      assert.equal(enabled.disabledAt, null);

      await updateOrganizationIntegrationStatus({
        organizationId: orgAId,
        integrationId: ussd.id,
        status: "DISABLED",
      });
      await assert.rejects(
        startUssdSession({
          organizationId: orgAId,
          integrationId: ussd.id,
          sessionIdHash: "c".repeat(64),
        }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );

      await assert.rejects(
        createOrganizationIntegration({
          organizationId: orgBId,
          provider: "INOTI_IMENU",
          codeName: "imenu-denied",
        }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );
      await assert.rejects(
        createOrganizationIntegration({
          organizationId: zeroOrgId,
          provider: "INOTI_USSD",
          codeName: "ussd-denied",
        }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );

      const legacy = await createOrganizationIntegration({
        organizationId: legacyOrgId,
        provider: "INOTI_IMENU",
        codeName: "legacy-imenu",
      });
      assert.deepEqual(legacy.capabilityKeys, ["SHOP"]);
    } finally {
      await prisma.customerInteraction.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, zeroOrgId, legacyOrgId] } } });
      await prisma.businessEvent.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, zeroOrgId, legacyOrgId] } } });
      await prisma.ussdSession.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, zeroOrgId, legacyOrgId] } } });
      await prisma.customerIdentity.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, zeroOrgId, legacyOrgId] } } });
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, zeroOrgId, legacyOrgId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId, zeroOrgId, legacyOrgId] } } });
    }
  });
});
