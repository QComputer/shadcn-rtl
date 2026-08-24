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
import { listOrganizationCustomers } from "@/lib/customer-crm/customer-crm.service";
import { getCustomerSummary } from "@/lib/customer-crm/customer-summary.service";
import {
  createDemoSession,
  verifyDemoSession,
} from "@/lib/demo-universe/demo-session.service";
import {
  getDemoScenario,
  getIntegrationShowcaseReadiness,
  transitionDemoOrder,
} from "@/lib/demo-universe/demo-scenario.service";
import {
  approveExternalCatalogItems,
  createExternalCatalogConnection,
  executeApprovedExternalCatalogImport,
  generateExternalCatalogMappings,
  listExternalCatalogConnections,
  previewExternalCatalogImport,
  rejectExternalCatalogItems,
  reviewExternalCatalogPreview,
  runExternalCatalogSyncDryRun,
} from "@/lib/external-catalog/external-catalog.service";
import {
  createSocialConnection,
  createSocialPostPlaceholder,
  getBusinessEntityGraph,
  upsertBusinessEntityMetadata,
} from "@/lib/business-entity/business-entity.service";
import {
  analyzeOrganizationEntity,
  generateSchemaHints,
} from "@/lib/seo-intelligence/seo-intelligence.service";
import {
  approveContentPublication,
  approveSeoContentRequest,
  createSeoContentRequest,
  getDemoSeoContentReadiness,
  getSeoContentRequest,
  listSeoContentRequests,
  listSeoOpportunities,
  planContentDistribution,
  reviewSeoContentResult,
  runSeoContentRequestDryRun,
  updateSeoOpportunityStatus,
} from "@/lib/seo-content/seo-content.service";
import { getContentProviderAdapter } from "@/lib/seo-content/content-provider-adapters";
import { GET as getPublicDemoOrganizations } from "@/app/api/public/demo-organizations/route";
import { GET as getPublicHomepage } from "@/app/api/public/homepage/route";
import { POST as createPublicDemoSession } from "@/app/api/public/demo/[organizationSlug]/session/route";
import { GET as getDemoBusinessEntityGraph } from "@/app/api/demo/business-entities/graph/route";
import { GET as getDemoCustomerDashboard } from "@/app/api/demo/customer/dashboard/route";
import { GET as getDemoManagerDashboard } from "@/app/api/demo/manager/dashboard/route";
import { GET as getDemoPlatformDashboard } from "@/app/api/demo/platform/dashboard/route";
import { GET as getDemoPlatformSeoReadiness } from "@/app/api/demo/platform/seo-readiness/route";
import { GET as getDemoSeoIntelligence } from "@/app/api/demo/seo-intelligence/route";
import { GET as getDemoScenarioApi } from "@/app/api/demo/scenario/route";
import { POST as createDemoSeoContentRequest } from "@/app/api/demo/seo-content/route";
import { POST as approveDemoSeoContentRequest } from "@/app/api/demo/seo-content/[requestId]/approve/route";
import { POST as runDemoSeoContentDryRun } from "@/app/api/demo/seo-content/[requestId]/run-dry-run/route";
import { POST as reviewDemoSeoContentResult } from "@/app/api/demo/seo-content/[requestId]/review/route";
import { POST as createDemoOrderApi } from "@/app/api/demo/orders/create/route";
import { POST as prepareDemoOrderApi } from "@/app/api/demo/orders/[id]/prepare/route";
import { POST as readyDemoOrderApi } from "@/app/api/demo/orders/[id]/ready/route";
import { POST as deliverDemoOrderApi } from "@/app/api/demo/orders/[id]/deliver/route";
import { POST as approveDemoCatalogConnection } from "@/app/api/demo/catalog/connections/[connectionId]/approve/route";
import { POST as importDemoCatalogConnection } from "@/app/api/demo/catalog/connections/[connectionId]/import/route";
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
import {
  connectInotiServices,
  createInotiConnectionDraft,
  disableInotiService,
  getInotiAccountReadModel,
  checkInotiServiceHealth,
  listInotiServiceMappings,
} from "@/lib/integrations/inoti-account-management";
import {
  environmentInotiCredentialProvider,
  getInotiCredentialProfileState,
  INOTI_PLATFORM_ORGANIZATION_ID,
  INOTI_PLATFORM_ORGANIZATION_SLUG,
} from "@/lib/integrations/inoti-ussd/credentials";
import {
  createReviewRequestFromBusinessEvent,
  createReviewRequestLinkFromBusinessEvent,
  getCustomerSubmittedReviews,
  getOrganizationReputationOverview,
  getPublicReviewRequestByToken,
  getReviewSeoReadiness,
  listReputationIntegrationReadinessMappings,
  respondToReview,
  submitPublicReviewByToken,
  submitVerifiedReview,
} from "@/lib/customer-reputation/customer-reputation.service";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "tenant-context.local.test.ts refuses to run against a non-local database",
);

function fixtureId(label: string) {
  return `${label}_${randomUUID().replaceAll("-", "")}`;
}

function jsonPost(url: string, body: unknown, headers?: HeadersInit) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

function demoRequest(url: string, organizationSlug: string, token: string, method: "GET" | "POST" = "GET") {
  return new NextRequest(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "x-demo-organization-slug": organizationSlug,
    },
  });
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
      assert.equal(health.healthStatus, "DEGRADED");
      assert.equal(health.connected, false);
      assert.equal(health.metadata.readOnly, true);
      assert.equal(health.metadata.realPaymentExecution, false);

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

  it("manages iNoti account connection lifecycle through existing integrations", async () => {
    const orgId = fixtureId("inoti_account_org");
    const otherOrgId = fixtureId("inoti_account_other");
    const slug = fixtureId("inoti-account").toLowerCase();
    const otherSlug = fixtureId("inoti-account-other").toLowerCase();
    const planId = fixtureId("inoti_plan");
    const actorUserId = fixtureId("inoti_platform_operator");
    await prisma.user.create({
      data: {
        id: actorUserId,
        name: actorUserId,
        email: `${actorUserId}@example.test`,
        password: "demo",
        role: "SUPER_ADMIN",
        isTeamMember: true,
      },
    });
    await prisma.organization.createMany({ data: [
      { id: orgId, name: "iNoti Account Tenant", slug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: otherOrgId, name: "Other iNoti Tenant", slug: otherSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
    ] });
    await prisma.organizationCapability.createMany({ data: [
      { id: fixtureId("inoti_shop"), organizationId: orgId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("inoti_crm"), organizationId: orgId, key: "CRM", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("inoti_ebc"), organizationId: orgId, key: "EBC", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("inoti_ussd"), organizationId: orgId, key: "USSD", status: "ACTIVE", enabledAt: new Date() },
    ] });
    await prisma.organizationActivationPlan.create({
      data: {
        id: planId,
        organizationId: orgId,
        industryKey: "RESTAURANT",
        generatedFromTemplate: "RESTAURANT",
        recommendedActions: [],
        growthOpportunities: {},
        ownerOnboardingReadModel: {},
      },
    });
    await prisma.organizationActivationTask.create({
      data: {
        organizationId: orgId,
        activationPlanId: planId,
        taskKey: "integration-inoti-imenu",
        title: "Enable iMenu",
        category: "INTEGRATIONS",
        targetRoute: "/dashboard/organizations/test/integrations/inoti",
        metadata: { service: "iMenu", provider: "INOTI_IMENU" },
      },
    });

    try {
      const mappings = listInotiServiceMappings();
      assert.equal(mappings.find((mapping) => mapping.serviceKey === "INOTI_EBC")?.mappedGrowthFeatures.includes("Campaigns"), true);

      const empty = await getInotiAccountReadModel(orgId);
      assert.equal(empty.account.status, "NOT_CONNECTED");
      assert.equal(empty.services.find((service) => service.key === "iMenu")?.expected, true);
      assert.equal(empty.services.find((service) => service.key === "SMS")?.provider, "INOTI_SMS");

      const draft = await createInotiConnectionDraft({
        organizationId: orgId,
        externalAccountId: "acct-local",
        credentialProfileKey: "INOTI_DEFAULT",
        accountLabel: "Local iNoti",
        services: ["iMenu", "EBC", "USSD", "SMS"],
        actorUserId,
      });
      assert.equal(draft.account.status, "DRAFT");
      assert.equal(draft.services.filter((service) => service.detected).length, 4);
      assert.equal(JSON.stringify(draft).includes("INOTI_DEFAULT"), true);
      assert.equal(/password|apiKey|accessToken|secretValue/i.test(JSON.stringify(draft)), false);

      const connected = await connectInotiServices({
        organizationId: orgId,
        externalAccountId: "acct-local",
        credentialProfileKey: "INOTI_DEFAULT",
        accountLabel: "Local iNoti",
        services: ["iMenu", "EBC", "SMS"],
        actorUserId,
      });
      assert.equal(connected.account.status, "PARTIAL");
      assert.deepEqual(connected.account.connectedServices.sort(), ["EBC", "SMS", "iMenu"].sort());
      assert.equal(connected.activationImpact[0]?.readinessStatus, "AVAILABLE");

      const health = await checkInotiServiceHealth({
        organizationId: orgId,
        serviceKey: "USSD",
        actorUserId,
      });
      const ussdHealth = health.services.find((service) => service.key === "USSD");
      assert.equal(ussdHealth?.healthStatus, "BLOCKED");
      assert.equal(ussdHealth?.realExecution, "DISABLED");

      const disabled = await disableInotiService({
        organizationId: orgId,
        serviceKey: "USSD",
        actorUserId,
      });
      assert.equal(disabled.services.find((service) => service.key === "USSD")?.status, "DISABLED");

      assert.equal((await getInotiAccountReadModel(otherOrgId)).account.status, "NOT_CONNECTED");
      assert.equal(await prisma.auditLog.count({
        where: {
          organizationId: orgId,
          description: { in: ["INOTI_DRAFT", "INOTI_ACTIVE", "INOTI_HEALTH_CHECKED", "INOTI_SERVICE_DISABLED"] },
        },
      }) >= 4, true);
    } finally {
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.businessEvent.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organizationActivationTask.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organizationActivationPlan.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organizationIntegrationCapability.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
      await prisma.user.deleteMany({ where: { id: actorUserId } });
    }
  });

  it("isolates real iNoti credential profiles across Platform, AKA Shoes, Cafe Leo, and Italiano 13", async () => {
    const originalEnvironment = {
      INOTI_PLATFORM_USERNAME: process.env.INOTI_PLATFORM_USERNAME,
      INOTI_PLATFORM_PASSWORD: process.env.INOTI_PLATFORM_PASSWORD,
      INOTI_AKA_SHOES_USERNAME: process.env.INOTI_AKA_SHOES_USERNAME,
      INOTI_AKA_SHOES_PASSWORD: process.env.INOTI_AKA_SHOES_PASSWORD,
      INOTI_CAFE_LEO_USERNAME: process.env.INOTI_CAFE_LEO_USERNAME,
      INOTI_CAFE_LEO_PASSWORD: process.env.INOTI_CAFE_LEO_PASSWORD,
      INOTI_CAFE_LEO_USSD_CODE_NAME: process.env.INOTI_CAFE_LEO_USSD_CODE_NAME,
      INOTI_CAFE_LEO_SMS_TOKEN: process.env.INOTI_CAFE_LEO_SMS_TOKEN,
      INOTI_ITALIANO13_USERNAME: process.env.INOTI_ITALIANO13_USERNAME,
      INOTI_ITALIANO13_PASSWORD: process.env.INOTI_ITALIANO13_PASSWORD,
    };
    const createdOrgIds: string[] = [];
    async function ensurePilotOrg(slug: string) {
      const existing = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
      if (existing) return existing.id;
      const id = fixtureId(`inoti_profile_${slug.replace(/-/g, "_")}`);
      await prisma.organization.create({
        data: { id, name: slug, slug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      });
      createdOrgIds.push(id);
      return id;
    }

    try {
      process.env.INOTI_PLATFORM_USERNAME = "platform-user";
      process.env.INOTI_PLATFORM_PASSWORD = "platform-pass";
      process.env.INOTI_AKA_SHOES_USERNAME = "aka-user";
      process.env.INOTI_AKA_SHOES_PASSWORD = "aka-pass";
      process.env.INOTI_CAFE_LEO_USERNAME = "cafe-user";
      process.env.INOTI_CAFE_LEO_PASSWORD = "cafe-pass";
      process.env.INOTI_CAFE_LEO_USSD_CODE_NAME = "09126511010";
      delete process.env.INOTI_CAFE_LEO_SMS_TOKEN;
      delete process.env.INOTI_ITALIANO13_USERNAME;
      delete process.env.INOTI_ITALIANO13_PASSWORD;

      const akaOrgId = await ensurePilotOrg("aka-shoes");
      const cafeOrgId = await ensurePilotOrg("cafe-leo");
      const italianoOrgId = await ensurePilotOrg("italiano-13");
      const existingPlatformOrg = await prisma.organization.findUnique({ where: { slug: INOTI_PLATFORM_ORGANIZATION_SLUG }, select: { id: true } });
      const platformOrgId = existingPlatformOrg?.id ?? fixtureId("inoti_profile_platform_owner");
      if (!existingPlatformOrg) {
        await prisma.organization.create({
          data: {
            id: platformOrgId,
            name: "BazarBaaz Platform",
            slug: INOTI_PLATFORM_ORGANIZATION_SLUG,
            type: "SHOP",
            isPlatformOwner: true,
            capabilitiesInitializedAt: new Date(),
          },
        });
        createdOrgIds.push(platformOrgId);
      }

      assert.equal((await getInotiCredentialProfileState({ organizationId: INOTI_PLATFORM_ORGANIZATION_ID, profileKey: "local-env:inoti:platform" })).state, "CREDENTIALS_AVAILABLE");
      assert.equal((await getInotiCredentialProfileState({ organizationId: platformOrgId, profileKey: "local-env:inoti:platform" })).state, "CREDENTIALS_AVAILABLE");
      assert.equal((await getInotiCredentialProfileState({ organizationId: akaOrgId, profileKey: "local-env:inoti:aka-shoes" })).state, "CREDENTIALS_AVAILABLE");
      const cafeState = await getInotiCredentialProfileState({ organizationId: cafeOrgId, profileKey: "local-env:inoti:cafe-leo" });
      assert.equal(cafeState.state, "CREDENTIALS_AVAILABLE");
      assert.equal(cafeState.ussdCodeNameConfigured, true);
      assert.equal(cafeState.smsTokenConfigured, false);
      assert.equal((await getInotiCredentialProfileState({ organizationId: italianoOrgId, profileKey: "local-env:inoti:italiano-13" })).state, "NEEDS_CREDENTIALS");

      assert.equal(await environmentInotiCredentialProvider.resolveProfile(akaOrgId, "local-env:inoti:platform"), null);
      assert.equal(await environmentInotiCredentialProvider.resolveProfile(akaOrgId, "local-env:inoti:cafe-leo"), null);
      assert.equal(await environmentInotiCredentialProvider.resolveProfile(cafeOrgId, "local-env:inoti:platform"), null);
      assert.equal(await environmentInotiCredentialProvider.resolveProfile(cafeOrgId, "local-env:inoti:aka-shoes"), null);
      assert.equal(await environmentInotiCredentialProvider.resolveProfile(cafeOrgId, "local-env:inoti:italiano-13"), null);
      assert.equal(await environmentInotiCredentialProvider.resolveProfile(italianoOrgId, "local-env:inoti:cafe-leo"), null);
      assert.equal(await environmentInotiCredentialProvider.resolveProfile(INOTI_PLATFORM_ORGANIZATION_ID, "local-env:inoti:cafe-leo"), null);

      assert.equal((await environmentInotiCredentialProvider.resolveProfile(akaOrgId, "local-env:inoti:aka-shoes"))?.profileKey, "local-env:inoti:aka-shoes");
      assert.equal((await environmentInotiCredentialProvider.resolveProfile(cafeOrgId, "local-env:inoti:cafe-leo"))?.profileKey, "local-env:inoti:cafe-leo");
      assert.equal((await environmentInotiCredentialProvider.resolveProfile(INOTI_PLATFORM_ORGANIZATION_ID, "local-env:inoti:platform"))?.profileKey, "local-env:inoti:platform");
      assert.equal((await environmentInotiCredentialProvider.resolveProfile(platformOrgId, "local-env:inoti:platform"))?.profileKey, "local-env:inoti:platform");
    } finally {
      for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      if (createdOrgIds.length > 0) {
        await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
      }
    }
  });

  it("creates verified customer reputation from completed tenant interactions only", async () => {
    const orgId = fixtureId("review_org");
    const otherOrgId = fixtureId("review_other_org");
    const slug = fixtureId("review-org").toLowerCase();
    const otherSlug = fixtureId("review-other").toLowerCase();
    const userId = fixtureId("review_customer_user");
    const orgIds = [orgId, otherOrgId];

    await prisma.user.create({ data: { id: userId, name: "Review Customer", email: `${fixtureId("review")}@example.test`, phone: "09127770000", password: "demo", role: "CUSTOMER" } });
    await prisma.organization.createMany({ data: [
      { id: orgId, name: "Review Tenant", slug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: otherOrgId, name: "Other Review Tenant", slug: otherSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
    ] });
    await prisma.organizationCapability.createMany({ data: [
      { id: fixtureId("review_shop"), organizationId: orgId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("review_crm"), organizationId: orgId, key: "CRM", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("review_other_shop"), organizationId: otherOrgId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    ] });

    try {
      const customer = await resolveCustomerIdentity({
        organizationId: orgId,
        userId,
        phone: "+989127770000",
        email: `customer-${fixtureId("review")}@example.test`,
      });
      const otherCustomer = await resolveCustomerIdentity({
        organizationId: otherOrgId,
        phone: "+989127770000",
      });
      const completedEvent = await recordBusinessEvent({
        organizationId: orgId,
        customerIdentityId: customer.id,
        type: "ORDER_COMPLETED",
        entityType: "Order",
        entityId: "order-local-1",
        payload: { orderId: "order-local-1", productId: "pizza-margherita", contextType: "Order", contextId: "order-local-1" },
      });
      const completedInteraction = await recordCustomerInteraction({
        organizationId: orgId,
        customerIdentityId: customer.id,
        businessEventId: completedEvent.id,
        type: "ORDER_COMPLETED",
        entityType: "Order",
        entityId: "order-local-1",
        summary: "Order completed",
      });
      const invalidEvent = await recordBusinessEvent({
        organizationId: orgId,
        customerIdentityId: customer.id,
        type: "CAMPAIGN_CLICKED",
        payload: { source: "invalid-review-verification" },
      });

      const request = await createReviewRequestFromBusinessEvent({
        organizationId: orgId,
        businessEventId: completedEvent.id,
        customerInteractionId: completedInteraction.id,
      });
      assert.equal(request.status, "CREATED");
      await assert.rejects(
        createReviewRequestFromBusinessEvent({ organizationId: orgId, businessEventId: invalidEvent.id }),
        (error: unknown) => error instanceof ApiError && error.status === 400,
      );
      await assert.rejects(
        createReviewRequestFromBusinessEvent({ organizationId: otherOrgId, businessEventId: completedEvent.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      const review = await submitVerifiedReview({
        organizationId: orgId,
        customerIdentityId: customer.id,
        reviewRequestId: request.id,
        rating: 5,
        title: "Great experience",
        text: "The order was completed exactly as expected.",
      });
      assert.equal(review.verifiedInteraction, true);
      assert.equal(review.isVerifiedPurchase, true);
      assert.equal(review.status, "PUBLISHED");

      const tokenEvent = await recordBusinessEvent({
        organizationId: orgId,
        customerIdentityId: customer.id,
        type: "ORDER_COMPLETED",
        entityType: "Order",
        entityId: "order-local-2",
        payload: { orderId: "order-local-2", productId: "pizza-funghi", contextType: "Order", contextId: "order-local-2" },
      });
      const tokenInteraction = await recordCustomerInteraction({
        organizationId: orgId,
        customerIdentityId: customer.id,
        businessEventId: tokenEvent.id,
        type: "ORDER_COMPLETED",
        entityType: "Order",
        entityId: "order-local-2",
        summary: "Second order completed",
      });
      const issued = await createReviewRequestLinkFromBusinessEvent({
        organizationId: orgId,
        businessEventId: tokenEvent.id,
        customerInteractionId: tokenInteraction.id,
      });
      assert.equal(typeof issued.token, "string");
      assert.equal(issued.signedPath, `/review/${issued.token}`);
      assert.equal(/password|phone|email|secret/i.test(JSON.stringify(issued)), false);
      const publicRequest = await getPublicReviewRequestByToken(issued.token);
      assert.equal(publicRequest.organization.name, "Review Tenant");
      assert.equal(/0912|example\.test|customerIdentityId/i.test(JSON.stringify(publicRequest)), false);
      const publicSubmission = await submitPublicReviewByToken({
        token: issued.token,
        rating: 4,
        serviceQualityRating: 5,
        title: "Fast follow-up",
        text: "The second order was also completed.",
        imageMetadata: { label: "receipt", uploadPending: true },
      });
      assert.equal(publicSubmission.review.verifiedInteraction, true);
      await assert.rejects(
        getPublicReviewRequestByToken(issued.token),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      const expired = await createReviewRequestLinkFromBusinessEvent({
        organizationId: orgId,
        businessEventId: tokenEvent.id,
        customerInteractionId: tokenInteraction.id,
        expiresAt: new Date(Date.now() - 1000),
      });
      await prisma.reviewRequest.update({ where: { id: expired.reviewRequest.id }, data: { status: "CREATED" } });
      await assert.rejects(
        getPublicReviewRequestByToken(expired.token),
        (error: unknown) => error instanceof ApiError && error.status === 410,
      );
      await assert.rejects(
        getPublicReviewRequestByToken("invalid-token"),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      const response = await respondToReview({
        organizationId: orgId,
        reviewPublicId: review.publicId,
        responseText: "Thank you for sharing your experience.",
        actorUserId: userId,
      });
      assert.equal(response.responseText, "Thank you for sharing your experience.");
      await assert.rejects(
        respondToReview({
          organizationId: otherOrgId,
          reviewPublicId: review.publicId,
          responseText: "Cross tenant response",
          actorUserId: userId,
        }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      await assert.rejects(
        submitVerifiedReview({
          organizationId: orgId,
          customerIdentityId: customer.id,
          businessEventId: invalidEvent.id,
          rating: 5,
        }),
        (error: unknown) => error instanceof ApiError && error.status === 400,
      );
      await assert.rejects(
        getCustomerSubmittedReviews({ organizationId: otherOrgId, customerIdentityId: customer.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      const overview = await getOrganizationReputationOverview({ organizationId: orgId });
      assert.equal(overview.factors.reviewCount, 2);
      assert.equal(overview.factors.averageRating, 4.5);
      assert.equal(overview.factors.verifiedReviewRatio, 1);
      assert.equal(overview.reputationScore > 0, true);
      assert.equal(overview.publicReviews.some((item) => item.businessResponse?.text === "Thank you for sharing your experience."), true);
      assert.equal(/0912|example\.test|phone|email/i.test(JSON.stringify(overview.publicReviews)), false);

      const customerReviews = await getCustomerSubmittedReviews({ organizationId: orgId, customerIdentityId: customer.id });
      assert.equal(customerReviews.reviews.length, 2);
      assert.equal(/0912|example\.test|phone|email/i.test(JSON.stringify(customerReviews)), false);

      const seoReadiness = await getReviewSeoReadiness({ organizationId: orgId });
      assert.equal(seoReadiness.schemaReadiness.AggregateRating, true);
      assert.equal(seoReadiness.schemaReadiness.publicSchemaInjected, false);
      assert.equal(listReputationIntegrationReadinessMappings().some((mapping) => mapping.target === "USSD"), true);
      assert.equal(seoReadiness.seoSignals.reputationTrend, "INSUFFICIENT_DATA");

      const graph = await getBusinessEntityGraph({ organizationId: orgId });
      assert.equal(graph.entities.some((entity) => entity.entityType === "REVIEW"), true);
      assert.equal(graph.relations.some((relation) => relation.relationType === "HAS_REVIEW"), true);
      assert.equal((await getOrganizationReputationOverview({ organizationId: otherOrgId })).factors.reviewCount, 0);
      assert.notEqual(otherCustomer.id, customer.id);
      assert.equal(await prisma.auditLog.count({ where: { organizationId: orgId, description: "REVIEW_RESPONSE_UPDATED" } }) > 0, true);
    } finally {
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEntityRelation.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEntityMetadata.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.seoContentBrief.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.seoContentRequest.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.seoOpportunity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.review.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEntity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.reviewRequest.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.customerInteraction.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEvent.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("serves CRM read models and demo universe flows with tenant and role isolation", async () => {
    const orgAId = fixtureId("demo_sicily");
    const orgBId = fixtureId("demo_tikal");
    const zeroOrgId = fixtureId("demo_zero");
    const appointmentOrgId = fixtureId("demo_appointment");
    const mixedOrgId = fixtureId("demo_mixed");
    const legacyOrgId = fixtureId("demo_legacy");
    const normalOrgId = fixtureId("demo_normal");
    const orgASlug = fixtureId("demo-sicily").toLowerCase();
    const orgBSlug = fixtureId("demo-tikal").toLowerCase();
    const zeroSlug = fixtureId("demo-zero").toLowerCase();
    const appointmentSlug = fixtureId("demo-appointment").toLowerCase();
    const mixedSlug = fixtureId("demo-mixed").toLowerCase();
    const legacySlug = fixtureId("demo-legacy").toLowerCase();
    const normalSlug = fixtureId("demo-normal").toLowerCase();
    const customerUserId = fixtureId("demo_customer_user");
    const driverUserId = fixtureId("demo_driver_user");
    const guestCustomerId = fixtureId("demo_guest");
    const orderId = fixtureId("demo_order");
    const orgIds = [orgAId, orgBId, zeroOrgId, appointmentOrgId, mixedOrgId, legacyOrgId, normalOrgId];

    await prisma.organization.createMany({ data: [
      { id: orgAId, name: "Demo Sicily", slug: orgASlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: orgBId, name: "Demo Tikal", slug: orgBSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: zeroOrgId, name: "Demo Zero", slug: zeroSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: appointmentOrgId, name: "Demo Appointment", slug: appointmentSlug, type: "APPOINTMENT", capabilitiesInitializedAt: new Date() },
      { id: mixedOrgId, name: "Demo Mixed", slug: mixedSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
      { id: legacyOrgId, name: "Demo Legacy", slug: legacySlug, type: "SHOP" },
      { id: normalOrgId, name: "Normal Tenant", slug: normalSlug, type: "SHOP", capabilitiesInitializedAt: new Date() },
    ] });
    await prisma.organizationSettings.createMany({ data: [
      { id: fixtureId("demo_settings_a"), organizationSlug: orgASlug, settings: { demo: { enabled: true, roles: ["PLATFORM_ADMIN", "ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF", "DRIVER"] } } },
      { id: fixtureId("demo_settings_b"), organizationSlug: orgBSlug, settings: { demo: { enabled: true, roles: ["CUSTOMER", "MANAGER"] } } },
      { id: fixtureId("demo_settings_zero"), organizationSlug: zeroSlug, settings: { demo: { enabled: true, roles: ["CUSTOMER", "MANAGER"] } } },
      { id: fixtureId("demo_settings_appointment"), organizationSlug: appointmentSlug, settings: { demo: { enabled: true, roles: ["CUSTOMER", "MANAGER"] } } },
      { id: fixtureId("demo_settings_mixed"), organizationSlug: mixedSlug, settings: { demo: { enabled: true, roles: ["CUSTOMER", "MANAGER"] } } },
      { id: fixtureId("demo_settings_legacy"), organizationSlug: legacySlug, settings: { demo: { enabled: true, roles: ["CUSTOMER", "MANAGER"] } } },
      { id: fixtureId("demo_settings_normal"), organizationSlug: normalSlug, settings: { demo: { enabled: false, roles: ["CUSTOMER"] } } },
    ] });
    await prisma.organizationCapability.createMany({ data: [
      { id: fixtureId("demo_cap_shop"), organizationId: orgAId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("demo_cap_shop_ussd"), organizationId: orgAId, key: "USSD", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("demo_cap_b_shop"), organizationId: orgBId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("demo_cap_appointment"), organizationId: appointmentOrgId, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("demo_cap_mixed_shop"), organizationId: mixedOrgId, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      { id: fixtureId("demo_cap_mixed_appointment"), organizationId: mixedOrgId, key: "APPOINTMENT", status: "ACTIVE", enabledAt: new Date() },
    ] });
    await prisma.user.createMany({ data: [
      { id: customerUserId, name: fixtureId("demo-customer"), password: "demo", role: "CUSTOMER", phone: "09125550000", email: `${fixtureId("demo_customer")}@example.test` },
      { id: driverUserId, name: fixtureId("demo-driver"), password: "demo", role: "DRIVER" },
    ] });
    await prisma.guestCustomer.create({
      data: { id: guestCustomerId, name: "Demo Guest", sessionId: fixtureId("demo_guest_session"), phone: "09125550001" },
    });
    await prisma.order.create({
      data: {
        id: orderId,
        orderNumber: fixtureId("demo-order"),
        type: "DELIVERY",
        status: "PLACED",
        subtotal: 100,
        total: 100,
        organizationSlug: orgASlug,
        customerId: customerUserId,
        driverId: driverUserId,
      },
    });

    try {
      const orgAIdentity = await resolveCustomerIdentity({
        organizationId: orgAId,
        userId: customerUserId,
        phone: "09125550000",
        metadata: { demoUniverse: true },
      });
      const orgBIdentity = await resolveCustomerIdentity({
        organizationId: orgBId,
        phone: "09125550000",
      });
      assert.notEqual(orgAIdentity.id, orgBIdentity.id);

      const customerCreatedEvent = await recordBusinessEvent({
        organizationId: orgAId,
        customerIdentityId: orgAIdentity.id,
        type: "CUSTOMER_CREATED",
        entityType: "CustomerIdentity",
        entityId: orgAIdentity.id,
        payload: { demoUniverse: true },
      });
      await recordCustomerInteraction({
        organizationId: orgAId,
        customerIdentityId: orgAIdentity.id,
        businessEventId: customerCreatedEvent.id,
        type: "CUSTOMER_CREATED",
        entityType: "CustomerIdentity",
        entityId: orgAIdentity.id,
        metadata: { demoUniverse: true },
      });

      const orgACustomers = await listOrganizationCustomers({ organizationId: orgAId, search: "09125550000" });
      assert.equal(orgACustomers.total, 1);
      assert.equal(orgACustomers.customers[0].identity.id, orgAIdentity.id);
      assert.match(orgACustomers.customers[0].identity.contact.phoneMasked ?? "", /\*/);
      const orgBCustomers = await listOrganizationCustomers({ organizationId: orgBId });
      assert.equal(orgBCustomers.total, 1);
      assert.equal(orgBCustomers.customers[0].identity.id, orgBIdentity.id);
      await assert.rejects(
        getCustomerSummary({ organizationId: orgBId, customerIdentityId: orgAIdentity.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );

      await assert.rejects(
        createDemoSession({ organizationId: orgBId, role: "DRIVER" }),
        (error: unknown) => error instanceof ApiError && error.status === 403,
      );
      const customerDemoSession = await createDemoSession({ organizationId: orgAId, role: "CUSTOMER", ttlMinutes: 5 });
      assert.equal(customerDemoSession.session.role, "CUSTOMER");
      assert.equal(customerDemoSession.session.demoRole, "CUSTOMER");
      await prisma.demoSessionToken.update({
        where: { id: customerDemoSession.session.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      await assert.rejects(
        verifyDemoSession({ organizationId: orgAId, token: customerDemoSession.token }),
        (error: unknown) => error instanceof ApiError && error.status === 401,
      );
      const activeCustomerDemoSession = await createDemoSession({ organizationId: orgAId, role: "CUSTOMER", ttlMinutes: 5 });
      await assert.rejects(
        verifyDemoSession({ organizationId: orgBId, token: activeCustomerDemoSession.token }),
        (error: unknown) => error instanceof ApiError && error.status === 401,
      );
      await assert.rejects(
        verifyDemoSession({ organizationId: orgAId, token: activeCustomerDemoSession.token, allowedRoles: ["MANAGER"] }),
        (error: unknown) => error instanceof ApiError && error.status === 403,
      );
      const managerDemoSession = await createDemoSession({ organizationId: orgAId, role: "MANAGER", ttlMinutes: 5 });
      await verifyDemoSession({ organizationId: orgAId, token: managerDemoSession.token, allowedRoles: ["MANAGER"] });
      const platformDemoSession = await createDemoSession({ organizationId: orgAId, role: "PLATFORM_ADMIN", ttlMinutes: 5 });
      assert.equal(platformDemoSession.session.role, "SUPER_ADMIN");
      assert.equal(platformDemoSession.session.demoRole, "PLATFORM_ADMIN");
      const ownerDemoSession = await createDemoSession({ organizationId: orgAId, role: "ORGANIZATION_OWNER", ttlMinutes: 5 });
      assert.equal(ownerDemoSession.session.role, "ADMIN");
      assert.equal(ownerDemoSession.session.demoRole, "ORGANIZATION_OWNER");

      const publicCatalogResponse = await getPublicDemoOrganizations();
      const publicCatalog = await publicCatalogResponse.json();
      assert.equal(publicCatalog.organizations.some((org: { slug: string }) => org.slug === orgASlug), true);
      assert.equal(publicCatalog.organizations.some((org: { slug: string }) => org.slug === normalSlug), false);
      const homepageResponse = await getPublicHomepage();
      assert.equal(homepageResponse.status, 200);

      const publicSessionResponse = await createPublicDemoSession(
        jsonPost(`http://127.0.0.1/api/public/demo/${orgASlug}/session`, { role: "ORGANIZATION_OWNER" }),
        { params: Promise.resolve({ organizationSlug: orgASlug }) },
      );
      assert.equal(publicSessionResponse.status, 200);
      const publicSession = await publicSessionResponse.json();
      assert.equal(publicSession.role, "ORGANIZATION_OWNER");
      assert.equal(publicSession.internalRole, "ADMIN");

      const customerDashboardResponse = await getDemoCustomerDashboard(demoRequest("http://127.0.0.1/api/demo/customer/dashboard", orgASlug, activeCustomerDemoSession.token));
      assert.equal(customerDashboardResponse.status, 200);
      const managerDeniedResponse = await getDemoManagerDashboard(demoRequest("http://127.0.0.1/api/demo/manager/dashboard", orgASlug, activeCustomerDemoSession.token));
      assert.equal(managerDeniedResponse.status, 403);
      const managerDashboardResponse = await getDemoManagerDashboard(demoRequest("http://127.0.0.1/api/demo/manager/dashboard", orgASlug, ownerDemoSession.token));
      assert.equal(managerDashboardResponse.status, 200);
      const platformDashboardResponse = await getDemoPlatformDashboard(demoRequest("http://127.0.0.1/api/demo/platform/dashboard", orgASlug, platformDemoSession.token));
      assert.equal(platformDashboardResponse.status, 200);
      const initialScenario = await getDemoScenario({ organizationId: orgAId, session: activeCustomerDemoSession.session });
      assert.deepEqual(initialScenario.steps.map((step) => step.key), [
        "customer-place-order",
        "staff-prepare-order",
        "staff-ready-order",
        "driver-deliver-order",
      ]);
      assert.equal(initialScenario.steps.every((step) => step.completedAt === null), true);
      const scenarioResponse = await getDemoScenarioApi(demoRequest("http://127.0.0.1/api/demo/scenario", orgASlug, activeCustomerDemoSession.token));
      assert.equal(scenarioResponse.status, 200);
      const scenarioPayload = await scenarioResponse.json();
      assert.equal(scenarioPayload.scenario.steps.length, 4);
      await assert.rejects(
        getDemoScenario({ organizationId: normalOrgId, session: null }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );

      await assert.rejects(
        transitionDemoOrder({ organizationId: orgAId, orderId, actorRole: "CUSTOMER", nextStatus: "ACCEPTED" }),
        (error: unknown) => error instanceof ApiError && error.status === 403,
      );
      await transitionDemoOrder({ organizationId: orgAId, orderId, actorRole: "MANAGER", nextStatus: "ACCEPTED" });
      await transitionDemoOrder({ organizationId: orgAId, orderId, actorRole: "STAFF", nextStatus: "READY" });
      await transitionDemoOrder({ organizationId: orgAId, orderId, actorRole: "DRIVER", nextStatus: "PICKED_UP" });

      const apiCreatedOrderResponse = await createDemoOrderApi(demoRequest("http://127.0.0.1/api/demo/orders/create", orgASlug, activeCustomerDemoSession.token, "POST"));
      assert.equal(apiCreatedOrderResponse.status, 200);
      const apiCreatedOrder = await apiCreatedOrderResponse.json();
      const apiOrderId = apiCreatedOrder.order.id;
      let progressedScenario = await getDemoScenario({ organizationId: orgAId, session: activeCustomerDemoSession.session });
      assert.notEqual(progressedScenario.steps.find((step) => step.key === "customer-place-order")?.completedAt, null);
      assert.equal(
        await prisma.demoProgress.count({ where: { organizationId: orgBId } }),
        0,
      );
      const prepareDeniedResponse = await prepareDemoOrderApi(
        demoRequest(`http://127.0.0.1/api/demo/orders/${apiOrderId}/prepare`, orgASlug, activeCustomerDemoSession.token, "POST"),
        { params: Promise.resolve({ id: apiOrderId }) },
      );
      assert.equal(prepareDeniedResponse.status, 403);
      const staffDemoSession = await createDemoSession({ organizationId: orgAId, role: "STAFF", ttlMinutes: 5 });
      const driverDemoSession = await createDemoSession({ organizationId: orgAId, role: "DRIVER", ttlMinutes: 5 });
      assert.equal((await prepareDemoOrderApi(
        demoRequest(`http://127.0.0.1/api/demo/orders/${apiOrderId}/prepare`, orgASlug, staffDemoSession.token, "POST"),
        { params: Promise.resolve({ id: apiOrderId }) },
      )).status, 200);
      assert.equal((await readyDemoOrderApi(
        demoRequest(`http://127.0.0.1/api/demo/orders/${apiOrderId}/ready`, orgASlug, staffDemoSession.token, "POST"),
        { params: Promise.resolve({ id: apiOrderId }) },
      )).status, 200);
      assert.equal((await deliverDemoOrderApi(
        demoRequest(`http://127.0.0.1/api/demo/orders/${apiOrderId}/deliver`, orgASlug, driverDemoSession.token, "POST"),
        { params: Promise.resolve({ id: apiOrderId }) },
      )).status, 200);
      progressedScenario = await getDemoScenario({ organizationId: orgAId, session: staffDemoSession.session });
      assert.notEqual(progressedScenario.steps.find((step) => step.key === "staff-prepare-order")?.completedAt, null);
      assert.notEqual(progressedScenario.steps.find((step) => step.key === "staff-ready-order")?.completedAt, null);
      const driverProgressedScenario = await getDemoScenario({ organizationId: orgAId, session: driverDemoSession.session });
      assert.notEqual(driverProgressedScenario.steps.find((step) => step.key === "driver-deliver-order")?.completedAt, null);

      const summary = await getCustomerSummary({ organizationId: orgAId, customerIdentityId: orgAIdentity.id });
      assert.equal(summary.identity.id, orgAIdentity.id);
      assert.equal(summary.metrics.orderCount, 1);
      assert.equal(summary.latestBusinessEvents.some((event) => event.type === "ORDER_READY"), true);
      assert.equal(summary.recentInteractions.some((interaction) => interaction.type === "ORDER_OUT_FOR_DELIVERY"), true);

      const zeroReadiness = await getIntegrationShowcaseReadiness(zeroOrgId);
      const shopReadiness = await getIntegrationShowcaseReadiness(orgAId);
      const appointmentReadiness = await getIntegrationShowcaseReadiness(appointmentOrgId);
      const mixedReadiness = await getIntegrationShowcaseReadiness(mixedOrgId);
      const legacyReadiness = await getIntegrationShowcaseReadiness(legacyOrgId);
      assert.equal(zeroReadiness.iMenu.ready, false);
      assert.equal(zeroReadiness.ussd.ready, false);
      assert.equal(shopReadiness.iMenu.ready, true);
      assert.equal(shopReadiness.ussd.ready, true);
      assert.equal(appointmentReadiness.iMenu.ready, false);
      assert.equal(mixedReadiness.iMenu.ready, true);
      assert.equal(legacyReadiness.iMenu.ready, true);

      const beforeProductCount = await prisma.product.count({ where: { organizationId: orgAId } });
      const catalogConnection = await createExternalCatalogConnection({
        organizationId: orgAId,
        provider: "SNAPPFOOD",
        externalUrl: "https://example.test/sicily-menu",
      });
      await assert.rejects(
        createExternalCatalogConnection({
          organizationId: orgAId,
          provider: "EZY",
          externalUrl: "https://example.test/secret-menu",
          metadata: { apiKey: "must-not-be-stored" },
        }),
        (error: unknown) => error instanceof ApiError && error.status === 400,
      );
      await assert.rejects(
        previewExternalCatalogImport({ organizationId: orgBId, connectionId: catalogConnection.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      const catalogPreview = await previewExternalCatalogImport({
        organizationId: orgAId,
        connectionId: catalogConnection.id,
      });
      assert.equal(catalogPreview.preview.products > 0, true);
      assert.equal(await prisma.product.count({ where: { organizationId: orgAId } }), beforeProductCount);
      assert.equal((await listExternalCatalogConnections({ organizationId: orgBId })).length, 0);
      assert.equal((await prisma.externalCatalogItem.count({ where: { organizationId: orgAId } })) > 0, true);

      const review = await reviewExternalCatalogPreview({ organizationId: orgAId, connectionId: catalogConnection.id });
      assert.equal(review.items.some((item) => item.status === "DISCOVERED"), true);
      const mappings = await generateExternalCatalogMappings({ organizationId: orgAId, connectionId: catalogConnection.id });
      assert.equal(mappings.mappings.length > 0, true);
      const rejectedImage = review.items.find((item) => item.externalType === "IMAGE");
      if (rejectedImage) {
        const rejected = await rejectExternalCatalogItems({
          organizationId: orgAId,
          connectionId: catalogConnection.id,
          itemIds: [rejectedImage.id],
        });
        assert.equal(rejected.rejectedItems, 1);
      }
      const approveResult = await approveExternalCatalogItems({
        organizationId: orgAId,
        connectionId: catalogConnection.id,
        itemIds: review.items.filter((item) => item.externalType === "CATEGORY" || item.externalType === "PRODUCT").map((item) => item.id),
      });
      assert.equal(approveResult.approvedItems > 0, true);
      const dryRunBeforeImport = await runExternalCatalogSyncDryRun({
        organizationId: orgAId,
        connectionId: catalogConnection.id,
        entityType: "PRODUCT",
      });
      assert.equal(dryRunBeforeImport.job.status, "DRY_RUN_COMPLETED");
      assert.equal(dryRunBeforeImport.changes.some((change) => change.changeType === "NEW_ITEM"), true);
      const imported = await executeApprovedExternalCatalogImport({
        organizationId: orgAId,
        connectionId: catalogConnection.id,
        demo: true,
      });
      assert.equal(imported.imported.some((item) => item.entityType === "PRODUCT"), true);
      assert.equal(await prisma.product.count({ where: { organizationId: orgAId } }) > beforeProductCount, true);
      assert.equal(await prisma.externalCatalogItem.count({ where: { organizationId: orgAId, status: "IMPORTED" } }) > 0, true);
      assert.equal(await prisma.businessEntity.count({ where: { organizationId: orgAId, entityType: "PRODUCT" } }) > 0, true);
      assert.equal(await prisma.businessEntityRelation.count({ where: { organizationId: orgAId, relationType: "HAS_PRODUCT" } }) > 0, true);
      const seoAnalysis = await analyzeOrganizationEntity(orgAId);
      assert.equal(seoAnalysis.indexedCount > 1, true);
      assert.equal(seoAnalysis.graph.relationTypes.includes("HAS_PRODUCT"), true);
      assert.equal(seoAnalysis.graph.relationTypes.includes("HAS_CATEGORY"), true);
      assert.equal(seoAnalysis.schemaHints.some((hint) => hint.schemaType === "Product"), true);
      assert.equal(seoAnalysis.schemaHints.some((hint) => hint.schemaType === "Restaurant"), true);
      assert.equal(seoAnalysis.opportunities.some((opportunity) => opportunity.opportunityType === "PRODUCT_DESCRIPTION_MISSING"), true);
      assert.equal(seoAnalysis.opportunities.some((opportunity) => opportunity.opportunityType === "SOCIAL_CONTENT_MISSING"), true);
      const graph = await getBusinessEntityGraph({ organizationId: orgAId, rootEntityId: seoAnalysis.root.id });
      assert.equal(graph.entities.some((entity) => entity.entityType === "PRODUCT"), true);
      assert.equal(graph.relations.every((relation) => relation.organizationId === orgAId), true);
      await assert.rejects(
        getBusinessEntityGraph({ organizationId: orgBId, rootEntityId: seoAnalysis.root.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      const productEntity = graph.entities.find((entity) => entity.entityType === "PRODUCT");
      assert.ok(productEntity, "external catalog import must create a product business entity");
      await assert.rejects(
        upsertBusinessEntityMetadata({
          organizationId: orgAId,
          entityId: productEntity.id,
          metadata: { accessToken: "must-not-be-stored" },
        }),
        /secret reference/,
      );
      await upsertBusinessEntityMetadata({
        organizationId: orgAId,
        entityId: productEntity.id,
        seoTitle: "Demo imported product",
        seoDescription: "Structured product metadata for future iAM content requests",
        schemaType: "Product",
        keywords: ["demo", "catalog"],
        metadata: { source: "local-test" },
      });
      const socialConnection = await createSocialConnection({
        organizationId: orgAId,
        network: "INSTAGRAM",
        handle: "sicily-demo",
        metadata: { ecosystem: "iAM" },
      });
      const socialPost = await createSocialPostPlaceholder({
        organizationId: orgAId,
        businessEntityId: productEntity.id,
        connectionId: socialConnection.id,
        network: "INSTAGRAM",
        caption: "Demo placeholder only",
        metadata: { externalSync: false },
      });
      assert.equal(socialPost.status, "DRAFT");
      const productCompletenessHints = await generateSchemaHints({ organizationId: orgAId, entityId: productEntity.id });
      assert.equal(productCompletenessHints.every((hint) => hint.schemaType === "Product"), true);
      const demoSeoDeniedResponse = await getDemoSeoIntelligence(
        demoRequest("http://127.0.0.1/api/demo/seo-intelligence", orgASlug, activeCustomerDemoSession.token),
      );
      assert.equal(demoSeoDeniedResponse.status, 403);
      const demoSeoResponse = await getDemoSeoIntelligence(
        demoRequest("http://127.0.0.1/api/demo/seo-intelligence", orgASlug, ownerDemoSession.token),
      );
      assert.equal(demoSeoResponse.status, 200);
      const demoSeoPayload = await demoSeoResponse.json();
      assert.equal(demoSeoPayload.graph.relationTypes.includes("HAS_PRODUCT"), true);
      const demoGraphResponse = await getDemoBusinessEntityGraph(
        demoRequest("http://127.0.0.1/api/demo/business-entities/graph", orgASlug, ownerDemoSession.token),
      );
      assert.equal(demoGraphResponse.status, 200);
      const demoGraphPayload = await demoGraphResponse.json();
      assert.equal(demoGraphPayload.relations.every((relation: { organizationId: string }) => relation.organizationId === orgAId), true);
      const providerAdapter = getContentProviderAdapter("INOTI_IAM");
      assert.ok(providerAdapter, "iAM dry-run content adapter must be registered");
      assert.equal(providerAdapter.getReadiness().code, "DRY_RUN_READY");
      assert.equal(providerAdapter.getReadiness().metadata.externalNetwork, false);
      assert.equal(providerAdapter.validateConfiguration({ accessToken: "must-not-be-stored" }).ok, false);

      const productOpportunity = seoAnalysis.opportunities.find((opportunity) => (
        opportunity.opportunityType === "PRODUCT_DESCRIPTION_MISSING" && opportunity.entityId === productEntity.id
      ));
      assert.ok(productOpportunity, "product entity should have a product content opportunity");
      const dismissed = await updateSeoOpportunityStatus({
        organizationId: orgAId,
        opportunityId: productOpportunity.id,
        status: "DISMISSED",
      });
      assert.equal(dismissed.status, "DISMISSED");
      await assert.rejects(
        createSeoContentRequest({
          organizationId: orgAId,
          businessEntityId: productEntity.id,
          seoOpportunityId: productOpportunity.id,
        }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );
      const accepted = await updateSeoOpportunityStatus({
        organizationId: orgAId,
        opportunityId: productOpportunity.id,
        status: "ACCEPTED",
      });
      assert.equal(accepted.status, "ACCEPTED");
      await assert.rejects(
        createSeoContentRequest({
          organizationId: orgBId,
          businessEntityId: productEntity.id,
          seoOpportunityId: productOpportunity.id,
        }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      const contentRequest = await createSeoContentRequest({
        organizationId: orgAId,
        businessEntityId: productEntity.id,
        seoOpportunityId: productOpportunity.id,
        targetKeywords: ["پیتزا شهرکرد", "سفارش آنلاین غذا شهرکرد"],
        targetLocation: "شهرکرد",
        createdByUserId: null,
      });
      assert.equal(contentRequest.contentType, "PRODUCT_CONTENT");
      assert.equal(contentRequest.status, "READY_FOR_REVIEW");
      assert.equal(contentRequest.brief?.primaryKeyword, "پیتزا شهرکرد");
      assert.equal(JSON.stringify(contentRequest.brief?.factualContext).includes("customerIdentity"), false);
      const duplicateContentRequest = await createSeoContentRequest({
        organizationId: orgAId,
        businessEntityId: productEntity.id,
        seoOpportunityId: productOpportunity.id,
      });
      assert.equal(duplicateContentRequest.id, contentRequest.id);
      await assert.rejects(
        runSeoContentRequestDryRun({ organizationId: orgAId, requestId: contentRequest.id }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );
      const approvedContentRequest = await approveSeoContentRequest({
        organizationId: orgAId,
        requestId: contentRequest.id,
        approvedByUserId: null,
      });
      assert.equal(approvedContentRequest.approvalState, "GENERATION_APPROVED");
      const completedContentRequest = await runSeoContentRequestDryRun({
        organizationId: orgAId,
        requestId: contentRequest.id,
      });
      assert.equal(completedContentRequest.status, "RESULT_RECEIVED");
      assert.equal(completedContentRequest.approvalState, "RESULT_REVIEW_REQUIRED");
      assert.equal(completedContentRequest.contentAssets.length, 1);
      const generatedAsset = completedContentRequest.contentAssets[0];
      assert.equal(generatedAsset.status, "REVIEW_REQUIRED");
      assert.equal(generatedAsset.source, "PROVIDER_DRY_RUN");
      assert.equal(generatedAsset.sourceProvider, "INOTI_IAM");
      assert.equal(generatedAsset.publishedAt, null);
      assert.equal(generatedAsset.distributions.some((distribution) => distribution.target === "WEBSITE" && distribution.status === "PLANNED"), true);
      await assert.rejects(
        getSeoContentRequest({ organizationId: orgBId, requestId: contentRequest.id }),
        (error: unknown) => error instanceof ApiError && error.status === 404,
      );
      const reviewedAsset = await reviewSeoContentResult({
        organizationId: orgAId,
        requestId: contentRequest.id,
        assetId: generatedAsset.id,
        approved: true,
        reviewerUserId: null,
      });
      assert.equal(reviewedAsset.status, "APPROVED");
      const publicationApprovedRequest = await approveContentPublication({
        organizationId: orgAId,
        requestId: contentRequest.id,
        approvedByUserId: null,
      });
      assert.equal(publicationApprovedRequest.approvalState, "PUBLICATION_APPROVED");
      assert.equal(publicationApprovedRequest.contentAssets[0].publishedAt, null);
      const socialDistribution = await planContentDistribution({
        organizationId: orgAId,
        contentAssetId: generatedAsset.id,
        target: "INSTAGRAM",
        provider: "INOTI_IAM",
        metadata: { noExternalPublication: true },
      });
      assert.equal(socialDistribution.status, "PLANNED");
      assert.equal(await listSeoContentRequests({ organizationId: orgAId }).then((requests) => requests.length > 0), true);
      assert.equal((await listSeoOpportunities({ organizationId: orgAId })).some((opportunity) => opportunity.status === "CONTENT_REQUESTED"), true);

      const demoContentDeniedResponse = await createDemoSeoContentRequest(
        jsonPost("http://127.0.0.1/api/demo/seo-content", {
          businessEntityId: productEntity.id,
          seoOpportunityId: productOpportunity.id,
        }, {
          authorization: `Bearer ${activeCustomerDemoSession.token}`,
          "x-demo-organization-slug": orgASlug,
        }),
      );
      assert.equal(demoContentDeniedResponse.status, 403);
      const demoContentResponse = await createDemoSeoContentRequest(
        jsonPost("http://127.0.0.1/api/demo/seo-content", {
          businessEntityId: productEntity.id,
          seoOpportunityId: productOpportunity.id,
          targetKeywords: ["منوی سیسیلی"],
        }, {
          authorization: `Bearer ${managerDemoSession.token}`,
          "x-demo-organization-slug": orgASlug,
        }),
      );
      assert.equal(demoContentResponse.status, 200);
      const demoContentPayload = await demoContentResponse.json();
      const demoApproveResponse = await approveDemoSeoContentRequest(
        demoRequest(`http://127.0.0.1/api/demo/seo-content/${demoContentPayload.request.id}/approve`, orgASlug, managerDemoSession.token, "POST"),
        { params: Promise.resolve({ requestId: demoContentPayload.request.id }) },
      );
      assert.equal(demoApproveResponse.status, 200);
      const demoDryRunResponse = await runDemoSeoContentDryRun(
        demoRequest(`http://127.0.0.1/api/demo/seo-content/${demoContentPayload.request.id}/run-dry-run`, orgASlug, managerDemoSession.token, "POST"),
        { params: Promise.resolve({ requestId: demoContentPayload.request.id }) },
      );
      assert.equal(demoDryRunResponse.status, 200);
      const demoDryRunPayload = await demoDryRunResponse.json();
      const demoAssetId = demoDryRunPayload.request.contentAssets[0].id;
      const demoReviewResponse = await reviewDemoSeoContentResult(
        jsonPost(`http://127.0.0.1/api/demo/seo-content/${demoContentPayload.request.id}/review`, {
          assetId: demoAssetId,
          approved: true,
        }, {
          authorization: `Bearer ${managerDemoSession.token}`,
          "x-demo-organization-slug": orgASlug,
        }),
        { params: Promise.resolve({ requestId: demoContentPayload.request.id }) },
      );
      assert.equal(demoReviewResponse.status, 200);
      const platformSeoReadinessResponse = await getDemoPlatformSeoReadiness(
        demoRequest("http://127.0.0.1/api/demo/platform/seo-readiness", orgASlug, platformDemoSession.token),
      );
      assert.equal(platformSeoReadinessResponse.status, 200);
      const platformSeoReadiness = await platformSeoReadinessResponse.json();
      assert.equal(platformSeoReadiness.providerReadiness.code, "DRY_RUN_READY");
      assert.equal((await getDemoSeoContentReadiness()).demoOrganizationsWithSeoOpportunities > 0, true);
      assert.equal(
        await prisma.businessEvent.count({
          where: {
            organizationId: orgAId,
            entityType: "ExternalCatalogImport",
            metadata: { path: ["noExternalMutation"], equals: true },
          },
        }) > 0,
        true,
      );

      const zeroCatalogConnection = await createExternalCatalogConnection({
        organizationId: zeroOrgId,
        provider: "MANUAL_IMPORT",
        externalUrl: "https://example.test/zero-menu",
      });
      await previewExternalCatalogImport({ organizationId: zeroOrgId, connectionId: zeroCatalogConnection.id });
      await approveExternalCatalogItems({ organizationId: zeroOrgId, connectionId: zeroCatalogConnection.id });
      await assert.rejects(
        executeApprovedExternalCatalogImport({ organizationId: zeroOrgId, connectionId: zeroCatalogConnection.id }),
        (error: unknown) => error instanceof ApiError && error.status === 409,
      );

      const legacyCatalogConnection = await createExternalCatalogConnection({
        organizationId: legacyOrgId,
        provider: "MANUAL_IMPORT",
        externalUrl: "https://example.test/legacy-menu",
      });
      await previewExternalCatalogImport({ organizationId: legacyOrgId, connectionId: legacyCatalogConnection.id });
      await approveExternalCatalogItems({ organizationId: legacyOrgId, connectionId: legacyCatalogConnection.id });
      const legacyImport = await executeApprovedExternalCatalogImport({
        organizationId: legacyOrgId,
        connectionId: legacyCatalogConnection.id,
      });
      assert.equal(legacyImport.imported.some((item) => item.entityType === "PRODUCT"), true);

      const appointmentCatalogConnection = await createExternalCatalogConnection({
        organizationId: appointmentOrgId,
        provider: "MANUAL_IMPORT",
        externalUrl: "https://example.test/appointment-menu",
      });
      await prisma.externalCatalogItem.create({
        data: {
          organizationId: appointmentOrgId,
          connectionId: appointmentCatalogConnection.id,
          externalId: "service-consultation",
          externalType: "SERVICE",
          rawName: "مشاوره نمایشی",
          normalizedName: "مشاوره نمایشی",
          status: "DISCOVERED",
          rawPayload: { externalId: "service-consultation", externalType: "SERVICE", rawName: "مشاوره نمایشی", price: 120000, duration: 45 },
        },
      });
      await approveExternalCatalogItems({ organizationId: appointmentOrgId, connectionId: appointmentCatalogConnection.id });
      const appointmentImport = await executeApprovedExternalCatalogImport({
        organizationId: appointmentOrgId,
        connectionId: appointmentCatalogConnection.id,
      });
      assert.equal(appointmentImport.imported.some((item) => item.entityType === "SERVICE"), true);

      const mixedCatalogConnection = await createExternalCatalogConnection({
        organizationId: mixedOrgId,
        provider: "MANUAL_IMPORT",
        externalUrl: "https://example.test/mixed-menu",
      });
      await previewExternalCatalogImport({ organizationId: mixedOrgId, connectionId: mixedCatalogConnection.id });
      await prisma.externalCatalogItem.create({
        data: {
          organizationId: mixedOrgId,
          connectionId: mixedCatalogConnection.id,
          externalId: "service-mixed-consultation",
          externalType: "SERVICE",
          rawName: "سرویس ترکیبی",
          normalizedName: "سرویس ترکیبی",
          status: "DISCOVERED",
          rawPayload: { externalId: "service-mixed-consultation", externalType: "SERVICE", rawName: "سرویس ترکیبی", price: 90000, duration: 30 },
        },
      });
      await approveExternalCatalogItems({ organizationId: mixedOrgId, connectionId: mixedCatalogConnection.id });
      const mixedImport = await executeApprovedExternalCatalogImport({
        organizationId: mixedOrgId,
        connectionId: mixedCatalogConnection.id,
      });
      assert.equal(mixedImport.imported.some((item) => item.entityType === "PRODUCT"), true);
      assert.equal(mixedImport.imported.some((item) => item.entityType === "SERVICE"), true);

      const staffApproveResponse = await approveDemoCatalogConnection(
        jsonPost(`http://127.0.0.1/api/demo/catalog/connections/${catalogConnection.id}/approve`, {}, {
          authorization: `Bearer ${staffDemoSession.token}`,
          "x-demo-organization-slug": orgASlug,
        }),
        { params: Promise.resolve({ connectionId: catalogConnection.id }) },
      );
      assert.equal(staffApproveResponse.status, 403);
      const customerImportResponse = await importDemoCatalogConnection(
        demoRequest(`http://127.0.0.1/api/demo/catalog/connections/${catalogConnection.id}/import`, orgASlug, activeCustomerDemoSession.token, "POST"),
        { params: Promise.resolve({ connectionId: catalogConnection.id }) },
      );
      assert.equal(customerImportResponse.status, 403);
    } finally {
      await prisma.demoProgress.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.demoScenarioStep.deleteMany({ where: { scenario: { organizationId: { in: orgIds } } } });
      await prisma.demoScenario.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.demoSessionToken.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.socialPost.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.socialConnection.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.contentDistribution.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.contentAsset.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.seoContentBrief.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.seoContentRequest.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.seoOpportunity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEntityMetadata.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEntityRelation.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEntity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.externalEntityMapping.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.externalImportRun.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.externalCatalogSyncJob.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.catalogSyncRun.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.externalCatalogItem.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.externalCatalogConnection.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.customerInteraction.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.businessEvent.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.orderStatusHistory.deleteMany({ where: { order: { organizationSlug: { in: [orgASlug, orgBSlug, zeroSlug, appointmentSlug, mixedSlug, legacySlug, normalSlug] } } } });
      await prisma.order.deleteMany({ where: { organizationSlug: { in: [orgASlug, orgBSlug, zeroSlug, appointmentSlug, mixedSlug, legacySlug, normalSlug] } } });
      await prisma.customerIdentity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.productVariant.deleteMany({ where: { product: { organizationId: { in: orgIds } } } });
      await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.productCategory.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.service.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.serviceCategory.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organizationSettings.deleteMany({ where: { organizationSlug: { in: [orgASlug, orgBSlug, zeroSlug, appointmentSlug, mixedSlug, legacySlug, normalSlug] } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.guestCustomer.deleteMany({ where: { id: guestCustomerId } });
      await prisma.user.deleteMany({ where: { id: { in: [customerUserId, driverUserId] } } });
    }
  });
});
