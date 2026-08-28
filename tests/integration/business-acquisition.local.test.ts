import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import prisma from "@/lib/db";
import { ApiError, requireRole } from "@/lib/api-guards";
import {
  completeActivationStep,
  generateActivationPlan,
  getActivationPlan,
  getOwnerOnboardingReadModel,
} from "@/lib/business-acquisition/activation-plan.service";
import {
  completeOwnerActivationTask,
  getOwnerActivationDashboard,
  updateOwnerBusinessProfile,
} from "@/lib/business-acquisition/owner-activation.service";
import {
  createOrganizationClaimRequest,
  createOrganizationInvitation,
  finalizeTeamOrganizationCreation,
  getBusinessAcquisitionOperatorOverview,
  getClaimRequestForOrganization,
  getInvitationForOrganization,
} from "@/lib/business-acquisition/business-acquisition.service";
import {
  completePilotChecklistItem,
  createOrRefreshPilotWorkspace,
  getRealPilotLaunchWorkspace,
  listPilotWorkspaces,
  recordPilotLaunchReview,
  registerPilotSourceAssessment,
  updatePilotWorkspace,
} from "@/lib/pilot-operations/pilot-workspace.service";
import {
  generateGrowthRecommendations,
  getGrowthPlan,
  getOwnerGrowthReadModel,
  upsertBusinessGrowthProfile,
} from "@/lib/growth-intelligence/growth-intelligence.service";
import { getPublicDemoShowcaseBySlug, listPublicDemoOrganizations } from "@/lib/demo-universe/demo-public.service";

function fixtureId(label: string) {
  return `ba_${label}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function cleanup(prefix: string) {
  const organizations = await prisma.organization.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true, slug: true },
  });
  const organizationIds = organizations.map((organization) => organization.id);
  const slugs = organizations.map((organization) => organization.slug);

  await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.externalImportSource.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationIntegrationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.pilotWorkspace.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationActivationTask.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationActivationPlan.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.seoContentBrief.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.seoContentRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.growthRecommendation.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.keywordCluster.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.businessGrowthProfile.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.seoOpportunity.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.businessEntityMetadata.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.businessEntityRelation.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.businessEntity.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationClaimRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationInvitation.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationAcquisition.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.product.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.productCategory.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.service.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.serviceCategory.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.paymentSettings.deleteMany({ where: { organizationSlug: { in: slugs } } });
  await prisma.organizationSettings.deleteMany({ where: { organizationSlug: { in: slugs } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.user.deleteMany({ where: { name: { startsWith: prefix } } });
}

describe("business acquisition local foundation", () => {
  it("lets the BazarBaaz team create an organization and records acquisition source", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: {
          name: `${prefix}-operator`,
          password: "demo-password",
          role: "SUPER_ADMIN",
          isTeamMember: true,
        },
      });

      const result = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RESTAURANT",
        name: "Acquisition Restaurant",
        slug: `${prefix}-r`,
        selectedCapabilities: ["SHOP", "CRM", "LOYALTY"],
        metadata: { acquisitionNote: "local-test" },
      });

      assert.equal(result.organization.slug, `${prefix}-r`);
      assert.equal(result.organization.type, "SHOP");
      assert.deepEqual(result.selectedCapabilities, ["SHOP", "CRM", "LOYALTY"]);
      assert.equal(result.acquisition.sourceType, "BAZARBAAZ_TEAM");
      assert.equal(result.acquisition.industryKey, "RESTAURANT");
      assert.equal(result.activationPlan.industryKey, "RESTAURANT");
      assert.equal(result.activationPlan.status, "ACTIVE");
      assert.equal(Array.isArray(result.activationPlan.recommendedActions), true);
      assert.equal(result.activationPlan.recommendedActions.some((action) => action.category === "SEO"), true);
      assert.equal(result.activationPlan.growthOpportunities.businessEntityReadiness?.ready, true);
      assert.equal(result.growthPlan.readiness.externalProviderCalls, false);
      assert.equal(result.growthPlan.readiness.keywordPlanCount > 0, true);
      assert.equal(result.growthPlan.readiness.iamRecommendationCount > 0, true);
      assert.equal(result.growthPlan.readiness.contentOpportunityCount > 0, true);

      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: result.organization.id },
        include: {
          acquisition: true,
          activationPlan: true,
          capabilities: { orderBy: { key: "asc" } },
          settings: true,
          paymentSettings: true,
        },
      });

      assert.deepEqual(organization.capabilities.map((capability) => capability.key).sort(), ["CRM", "LOYALTY", "SHOP"]);
      assert.equal(organization.acquisition?.createdByUserId, operator.id);
      assert.equal(Boolean(organization.settings), true);
      assert.equal(Boolean(organization.paymentSettings), true);
      assert.equal(Boolean(organization.activationPlan), true);
      assert.equal(await prisma.seoOpportunity.count({ where: { organizationId: organization.id } }) > 0, true);
      assert.equal(await prisma.auditLog.count({ where: { entityType: "OrganizationAcquisition", organizationId: organization.id } }), 1);

      const overview = await getBusinessAcquisitionOperatorOverview({ take: 5 });
      const overviewEntry = overview.acquisitions.find((entry) => entry.organization.id === organization.id);
      assert.equal(Boolean(overviewEntry), true);
      assert.equal(overviewEntry?.organization.activationPlan?.status, "ACTIVE");
      assert.equal((overviewEntry?.organization.growthIntelligence?.keywordPlanCount ?? 0) > 0, true);
      assert.equal((overviewEntry?.organization.growthIntelligence?.recommendationCount ?? 0) > 0, true);
      assert.equal(JSON.stringify(overviewEntry).includes("tokenHash"), false);
      assert.equal(overview.counts.acquiredOrganizations >= 1, true);
    } finally {
      await cleanup(prefix);
    }
  });

  it("generates different activation plans per industry and supports completion", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const restaurant = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RESTAURANT",
        name: "Activation Restaurant",
        slug: `${prefix}-ar`,
        selectedCapabilities: ["SHOP", "CRM"],
      });
      const dental = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "DENTAL_CLINIC",
        name: "Activation Dental",
        slug: `${prefix}-ad`,
        selectedCapabilities: ["APPOINTMENT", "CRM"],
      });

      assert.notDeepEqual(
        restaurant.activationPlan.growthOpportunities.recommendedInotiServices,
        dental.activationPlan.growthOpportunities.recommendedInotiServices,
      );
      assert.equal(restaurant.activationPlan.recommendedActions.some((action) => action.title.includes("menu")), true);
      assert.equal(dental.activationPlan.recommendedActions.some((action) => action.title.includes("booking") || action.title.includes("iAM")), true);

      const actionKey = restaurant.activationPlan.recommendedActions[0].key;
      const completed = await completeActivationStep({
        organizationId: restaurant.organization.id,
        actionKey,
        completedByUserId: operator.id,
      });
      assert.equal(completed.completedActions.includes(actionKey), true);
      assert.equal((await getActivationPlan({ organizationId: restaurant.organization.id })).completedActions.includes(actionKey), true);
    } finally {
      await cleanup(prefix);
    }
  });

  it("keeps activation plans tenant-isolated and owner read models sanitized", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const primary = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "PHARMACY",
        name: "Activation Pharmacy",
        slug: `${prefix}-ap`,
        selectedCapabilities: ["SHOP", "CRM"],
        phone: "+989100000010",
      });
      const other = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "FASHION_BOUTIQUE",
        name: "Activation Boutique",
        slug: `${prefix}-af`,
        selectedCapabilities: ["SHOP", "CRM"],
      });

      const primaryPlan = await getActivationPlan({ organizationId: primary.organization.id });
      const otherPlan = await getActivationPlan({ organizationId: other.organization.id });
      assert.notEqual(primaryPlan.id, otherPlan.id);
      assert.equal(JSON.stringify(primaryPlan).includes(other.organization.id), false);
      assert.equal(JSON.stringify(primaryPlan).includes(other.organization.slug), false);
      assert.equal(primaryPlan.ownerOnboardingReadModel.enabledCapabilities.includes("SHOP"), true);

      const ownerReadModel = await getOwnerOnboardingReadModel({ organizationId: primary.organization.id });
      const serialized = JSON.stringify(ownerReadModel);
      assert.equal(serialized.includes("tokenHash"), false);
      assert.equal(serialized.includes("verificationMetadata"), false);
      assert.equal(serialized.includes("credentialProfileKey"), false);
      assert.equal(ownerReadModel.ownerOnboardingReadModel.businessProfileCompleteness.score > 0, true);
    } finally {
      await cleanup(prefix);
    }
  });

  it("generates activation plans for legacy organizations without initialized capabilities", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const organization = await prisma.organization.create({
        data: {
          name: "Legacy Activation Shop",
          slug: `${prefix}-lg`,
          type: "SHOP",
          description: "Legacy organization without capability rows.",
        },
      });

      const plan = await generateActivationPlan({ organizationId: organization.id, industryKey: "RETAIL_SHOP" });
      assert.equal(plan.organizationId, organization.id);
      assert.equal(plan.industryKey, "RETAIL_SHOP");
      assert.equal(plan.ownerOnboardingReadModel.enabledCapabilities.includes("SHOP"), true);
      assert.equal(await prisma.businessEntity.count({ where: { organizationId: organization.id, entityType: "ORGANIZATION" } }), 1);
    } finally {
      await cleanup(prefix);
    }
  });

  it("generates tenant-scoped growth intelligence plans without publishing or provider calls", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const restaurant = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RESTAURANT",
        name: "Growth Restaurant",
        slug: `${prefix}-growth-restaurant`,
        selectedCapabilities: ["SHOP", "CRM", "IAM"],
        address: "Tehran",
      });
      const dental = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "DENTAL_CLINIC",
        name: "Growth Dental",
        slug: `${prefix}-growth-dental`,
        selectedCapabilities: ["APPOINTMENT", "CRM", "IAM"],
        address: "Shiraz",
      });

      await upsertBusinessGrowthProfile({
        organizationId: restaurant.organization.id,
        actorUserId: operator.id,
        preferredKeywords: ["family pizza", "direct restaurant orders"],
        preferredLocations: ["Tehran"],
        targetAudience: ["nearby families"],
        primaryGoals: ["increase direct orders"],
      });
      await upsertBusinessGrowthProfile({
        organizationId: dental.organization.id,
        actorUserId: operator.id,
        preferredKeywords: ["dental implant booking", "teeth cleaning"],
        preferredLocations: ["Shiraz"],
        targetAudience: ["appointment customers"],
        primaryGoals: ["increase appointment bookings"],
      });
      await generateGrowthRecommendations({ organizationId: restaurant.organization.id, actorUserId: operator.id });
      await generateGrowthRecommendations({ organizationId: dental.organization.id, actorUserId: operator.id });

      const restaurantPlan = await getGrowthPlan({ organizationId: restaurant.organization.id });
      const dentalPlan = await getGrowthPlan({ organizationId: dental.organization.id });
      const restaurantBlueprint = restaurantPlan.recommendations.find((recommendation) => recommendation.type === "CONTENT_BLUEPRINT")?.contentBlueprint as Record<string, unknown> | undefined;
      const dentalBlueprint = dentalPlan.recommendations.find((recommendation) => recommendation.type === "CONTENT_BLUEPRINT")?.contentBlueprint as Record<string, unknown> | undefined;

      assert.equal(restaurantPlan.readiness.externalProviderCalls, false);
      assert.equal(restaurantPlan.readiness.keywordPlanCount > 0, true);
      assert.equal(restaurantPlan.readiness.iamRecommendationCount > 0, true);
      assert.equal(restaurantPlan.readiness.contentOpportunityCount > 0, true);
      assert.equal(restaurantPlan.recommendations.some((recommendation) => {
        const iam = recommendation.iamRecommendation as Record<string, unknown> | null;
        return recommendation.type === "IAM_RECOMMENDATION" && iam?.createsIamPage === false && iam?.externalProviderCalls === false;
      }), true);
      assert.equal(restaurantBlueprint?.publishesContent, false);
      assert.equal((restaurantBlueprint?.relatedSchema as string[]).includes("Restaurant"), true);
      assert.equal((restaurantBlueprint?.pageStructure as string[]).includes("FAQ"), true);
      assert.equal((restaurantBlueprint?.pageStructure as string[]).includes("reviews"), true);
      assert.equal((restaurantBlueprint?.pageStructure as string[]).includes("location"), true);
      assert.equal((dentalBlueprint?.relatedSchema as string[]).includes("Service"), true);
      assert.notDeepEqual(
        restaurantPlan.keywordClusters.map((cluster) => cluster.keyword).slice(0, 6),
        dentalPlan.keywordClusters.map((cluster) => cluster.keyword).slice(0, 6),
      );
      assert.equal(JSON.stringify(restaurantPlan).includes(dental.organization.id), false);
      assert.equal(JSON.stringify(restaurantPlan).includes("dental implant booking"), false);

      const ownerReadModel = await getOwnerGrowthReadModel({ organizationId: restaurant.organization.id });
      const serialized = JSON.stringify(ownerReadModel);
      assert.equal(serialized.includes("tokenHash"), false);
      assert.equal(serialized.includes("credentialProfileKey"), false);
      assert.equal(/password|apiKey|accessToken|secretValue|customerIdentityId/i.test(serialized), false);
      assert.equal(ownerReadModel.safety.externalProviderCalls, false);
      assert.equal(ownerReadModel.safety.publishesContent, false);
    } finally {
      await cleanup(prefix);
    }
  });

  it("keeps legacy organizations compatible with growth intelligence defaults", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const organization = await prisma.organization.create({
        data: {
          name: "Legacy Growth Shop",
          slug: `${prefix}-legacy-growth`,
          type: "SHOP",
          description: "Legacy organization without acquisition or capability rows.",
        },
      });

      const plan = await getGrowthPlan({ organizationId: organization.id, refresh: true });
      assert.equal(plan.organization.id, organization.id);
      assert.equal(plan.organization.capabilities.includes("SHOP"), true);
      assert.equal(plan.readiness.externalProviderCalls, false);
      assert.equal(plan.readiness.keywordPlanCount > 0, true);
      assert.equal(plan.recommendations.length > 0, true);
    } finally {
      await cleanup(prefix);
    }
  });

  it("stores invitation tokens as hashes and keeps invitation lookup organization-scoped", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const primary = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "PHARMACY",
        name: "Acquisition Pharmacy",
        slug: `${prefix}-p`,
        selectedCapabilities: ["SHOP", "CRM"],
      });
      const other = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "OTHER",
        name: "Other Acquisition",
        slug: `${prefix}-o`,
        selectedCapabilities: ["CRM"],
      });

      const created = await createOrganizationInvitation({
        organizationId: primary.organization.id,
        invitedRole: "ADMIN",
        createdByUserId: operator.id,
        ttlHours: 24,
        metadata: { channel: "operator" },
      });

      assert.equal(created.invitation.organizationId, primary.organization.id);
      assert.equal(created.invitation.invitedRole, "ADMIN");
      assert.equal(typeof created.oneTimeToken, "string");
      assert.equal(JSON.stringify(created.invitation).includes(created.oneTimeToken), false);

      const row = await prisma.organizationInvitation.findUniqueOrThrow({
        where: { publicId: created.invitation.publicId },
      });
      assert.notEqual(row.tokenHash, created.oneTimeToken);
      assert.equal(row.tokenHash.length, 64);

      assert.equal((await getInvitationForOrganization({
        organizationId: primary.organization.id,
        publicId: created.invitation.publicId,
      }))?.publicId, created.invitation.publicId);
      assert.equal(await getInvitationForOrganization({
        organizationId: other.organization.id,
        publicId: created.invitation.publicId,
      }), null);
    } finally {
      await cleanup(prefix);
    }
  });

  it("records claim requests without granting membership and keeps lookup organization-scoped", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const requester = await prisma.user.create({
        data: { name: `${prefix}-requester`, password: "demo-password", role: "CUSTOMER" },
      });
      const primary = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "DENTAL_CLINIC",
        name: "Acquisition Dental",
        slug: `${prefix}-d`,
        selectedCapabilities: ["APPOINTMENT", "CRM"],
      });
      const other = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "OTHER",
        name: "Other Claim Org",
        slug: `${prefix}-c`,
        selectedCapabilities: ["CRM"],
      });

      const claim = await createOrganizationClaimRequest({
        organizationId: primary.organization.id,
        requesterUserId: requester.id,
        requesterEmail: "claimant@example.test",
        verificationMetadata: { submittedDocument: "placeholder" },
      });

      assert.equal(claim.status, "REQUESTED");
      assert.equal(await prisma.organizationMember.count({
        where: { organizationId: primary.organization.id, userId: requester.id },
      }), 0);
      assert.equal((await getClaimRequestForOrganization({
        organizationId: primary.organization.id,
        publicId: claim.publicId,
      }))?.publicId, claim.publicId);
      assert.equal(await getClaimRequestForOrganization({
        organizationId: other.organization.id,
        publicId: claim.publicId,
      }), null);
    } finally {
      await cleanup(prefix);
    }
  });

  it("serves an owner activation dashboard only to current admin or manager members", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const admin = await prisma.user.create({
        data: { name: `${prefix}-admin`, password: "demo-password", role: "ADMIN" },
      });
      const manager = await prisma.user.create({
        data: { name: `${prefix}-manager`, password: "demo-password", role: "MANAGER" },
      });
      const staff = await prisma.user.create({
        data: { name: `${prefix}-staff`, password: "demo-password", role: "STAFF" },
      });
      const primary = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RESTAURANT",
        name: "Owner Portal Restaurant",
        slug: `${prefix}-owner-a`,
        selectedCapabilities: ["SHOP", "CRM"],
      });
      const other = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "DENTAL_CLINIC",
        name: "Owner Portal Dental",
        slug: `${prefix}-owner-b`,
        selectedCapabilities: ["APPOINTMENT", "CRM"],
      });

      await prisma.organizationMember.createMany({
        data: [
          { organizationId: primary.organization.id, organizationSlug: primary.organization.slug, userId: admin.id, role: "ADMIN" },
          { organizationId: primary.organization.id, organizationSlug: primary.organization.slug, userId: manager.id, role: "MANAGER" },
          { organizationId: primary.organization.id, organizationSlug: primary.organization.slug, userId: staff.id, role: "STAFF" },
          { organizationId: other.organization.id, organizationSlug: other.organization.slug, userId: manager.id, role: "MANAGER" },
        ],
      });

      const adminDashboard = await getOwnerActivationDashboard({
        session: { user: { id: admin.id, role: "ADMIN", organizationId: primary.organization.id } },
        locale: "fa",
      });
      assert.equal(adminDashboard.organization.id, primary.organization.id);
      assert.equal(adminDashboard.membership.ownerEquivalent, true);
      assert.equal(adminDashboard.activation.nextActions.length > 0, true);
      assert.equal(adminDashboard.guidedSetup.tasks.some((task) => task.taskKey === "menu-readiness"), true);
      assert.equal(adminDashboard.guidedSetup.nextRecommendedTasks.every((task) => Boolean(task.targetRoute)), true);
      assert.equal(adminDashboard.readinessScore.dimensions.length, 4);
      assert.equal(adminDashboard.organization.publicPaths.shell, `/fa/${primary.organization.slug}`);

      const managerDashboard = await getOwnerActivationDashboard({
        session: { user: { id: manager.id, role: "MANAGER", organizationId: primary.organization.id } },
        organizationId: primary.organization.id,
        locale: "en",
      });
      assert.equal(managerDashboard.organization.publicPaths.shop, `/en/${primary.organization.slug}/shop`);
      assert.equal(managerDashboard.guidedSetup.tasks.some((task) => task.category === "INTEGRATIONS"), true);
      assert.equal(managerDashboard.inotiReadiness.length > 0, true);
      assert.equal(JSON.stringify(managerDashboard).includes(other.organization.id), false);
      assert.equal(JSON.stringify(managerDashboard).includes("tokenHash"), false);
      assert.equal(JSON.stringify(managerDashboard).includes("verificationMetadata"), false);
      assert.equal(JSON.stringify(managerDashboard).includes("credentialProfileKey"), false);
      assert.equal(JSON.stringify(managerDashboard).includes("paymentSettings"), false);

      await assert.rejects(
        getOwnerActivationDashboard({
          session: { user: { id: staff.id, role: "STAFF", organizationId: primary.organization.id } },
        }),
        (error: unknown) => error instanceof ApiError && error.status === 403,
      );
      await assert.rejects(
        getOwnerActivationDashboard({
          session: { user: { id: admin.id, role: "ADMIN", organizationId: primary.organization.id } },
          organizationId: other.organization.id,
        }),
        (error: unknown) => error instanceof ApiError && error.status === 403,
      );
    } finally {
      await cleanup(prefix);
    }
  });

  it("lets owner-equivalent members update public profile fields and refresh completeness", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const admin = await prisma.user.create({
        data: { name: `${prefix}-owner`, password: "demo-password", role: "ADMIN" },
      });
      const created = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "PHARMACY",
        name: "Owner Profile Pharmacy",
        slug: `${prefix}-profile`,
        selectedCapabilities: ["SHOP", "CRM"],
      });
      await prisma.organizationMember.create({
        data: { organizationId: created.organization.id, organizationSlug: created.organization.slug, userId: admin.id, role: "ADMIN" },
      });

      const before = await getOwnerActivationDashboard({
        session: { user: { id: admin.id, role: "ADMIN", organizationId: created.organization.id } },
      });
      const after = await updateOwnerBusinessProfile({
        session: { user: { id: admin.id, role: "ADMIN", organizationId: created.organization.id } },
        organizationId: created.organization.id,
        data: {
          description: "Local pharmacy profile for activation testing.",
          address: "Activation Street",
          phone: "+989100001111",
          email: "owner-profile@example.test",
        },
      });

      assert.equal(after.organization.description, "Local pharmacy profile for activation testing.");
      assert.equal(after.organization.email, "owner-profile@example.test");
      assert.equal(after.profileCompletion.score > before.profileCompletion.score, true);
      assert.equal(after.readinessScore.percent >= before.readinessScore.percent, true);
      assert.equal(after.profileCompletion.missingItems.includes("description"), false);
      assert.equal(after.inotiReadiness.every((entry) => entry.externalActivation === false), true);
      assert.equal(await prisma.auditLog.count({
        where: {
          organizationId: created.organization.id,
          entityType: "OrganizationActivation",
          description: "BUSINESS_PROFILE_COMPLETED",
        },
      }), 1);
    } finally {
      await cleanup(prefix);
    }
  });

  it("completes guided activation tasks and updates progress without leaking tenants", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const owner = await prisma.user.create({
        data: { name: `${prefix}-owner`, password: "demo-password", role: "MANAGER" },
      });
      const customer = await prisma.user.create({
        data: { name: `${prefix}-customer`, password: "demo-password", role: "CUSTOMER" },
      });
      const created = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "DENTAL_CLINIC",
        name: "Guided Dental",
        slug: `${prefix}-guided`,
        selectedCapabilities: ["APPOINTMENT", "CRM"],
      });
      await prisma.organizationMember.create({
        data: { organizationId: created.organization.id, organizationSlug: created.organization.slug, userId: owner.id, role: "MANAGER" },
      });

      const before = await getOwnerActivationDashboard({
        session: { user: { id: owner.id, role: "MANAGER", organizationId: created.organization.id } },
        locale: "fa",
      });
      const task = before.guidedSetup.nextRecommendedTasks.find((entry) => entry.taskKey === "service-readiness") ?? before.guidedSetup.nextRecommendedTasks[0];
      assert.equal(Boolean(task), true);
      assert.equal(before.guidedSetup.tasks.some((entry) => entry.taskKey === "doctors-staff"), true);
      assert.equal(before.guidedSetup.tasks.some((entry) => entry.taskKey === "appointment-settings"), true);
      assert.equal(before.readinessScore.percent >= 0 && before.readinessScore.percent <= 100, true);

      const after = await completeOwnerActivationTask({
        session: { user: { id: owner.id, role: "MANAGER", organizationId: created.organization.id } },
        organizationId: created.organization.id,
        taskKey: task.taskKey,
      });
      assert.equal(after.guidedSetup.progress.completed, before.guidedSetup.progress.completed + 1);
      assert.equal(after.guidedSetup.tasks.find((entry) => entry.taskKey === task.taskKey)?.status, "COMPLETED");
      assert.equal(await prisma.auditLog.count({
        where: {
          organizationId: created.organization.id,
          entityType: "OrganizationActivationTask",
          description: "ACTIVATION_TASK_COMPLETED",
        },
      }), 1);

      await assert.rejects(
        getOwnerActivationDashboard({
          session: { user: { id: customer.id, role: "CUSTOMER", organizationId: created.organization.id } },
        }),
        (error: unknown) => error instanceof ApiError && error.status === 403,
      );
    } finally {
      await cleanup(prefix);
    }
  });

  it("manages pilot operations workspace checklist, status, readiness, and safe read models", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, email: `${prefix}-operator@example.test`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const restaurant = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RESTAURANT",
        name: "Pilot Restaurant",
        slug: `${prefix}-restaurant`,
        selectedCapabilities: ["SHOP", "CRM", "USSD"],
      });
      const retail = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RETAIL_SHOP",
        name: "Pilot Shoes",
        slug: `${prefix}-retail`,
        selectedCapabilities: ["SHOP", "CRM", "ICV", "EBC"],
      });
      const appointment = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "DENTAL_CLINIC",
        name: "Pilot Appointment",
        slug: `${prefix}-appointment`,
        selectedCapabilities: ["APPOINTMENT", "CRM", "IAM"],
      });

      const restaurantPilot = await createOrRefreshPilotWorkspace({
        organizationId: restaurant.organization.id,
        actorUserId: operator.id,
        assignedOperatorId: operator.id,
        status: "CONFIGURATION",
        notes: "SNAPPFOOD mock only; no external call.",
        seoGrowthPlanner: {
          businessGoals: ["Direct orders"],
          targetAudience: ["Local customers"],
          preferredKeywords: ["pizza", "Italian restaurant"],
          cityLocation: "Tehran",
        },
      });
      const retailPilot = await createOrRefreshPilotWorkspace({ organizationId: retail.organization.id, actorUserId: operator.id });
      const appointmentPilot = await createOrRefreshPilotWorkspace({ organizationId: appointment.organization.id, actorUserId: operator.id });

      assert.equal(restaurantPilot.status, "CONFIGURATION");
      assert.equal(restaurantPilot.setupFlow.externalProvider, "SNAPPFOOD");
      assert.equal(restaurantPilot.setupFlow.steps.every((step) => step.externalProviderCalls === false), true);
      assert.equal(restaurantPilot.readinessSummary.seo.keywordPlanCount > 0, true);
      assert.equal(restaurantPilot.readinessSummary.seo.iamRecommendationCount > 0, true);
      assert.equal(restaurantPilot.readinessSummary.seo.contentOpportunityCount > 0, true);
      assert.equal(restaurantPilot.readinessSummary.seo.seoStrategyStatus === "READY" || restaurantPilot.readinessSummary.seo.seoStrategyStatus === "NOT_READY", true);
      assert.equal(retailPilot.checklist.some((item) => item.key === "catalog-images"), true);
      assert.equal(appointmentPilot.checklist.some((item) => item.key === "catalog-services"), true);
      assert.equal(appointmentPilot.checklist.some((item) => item.key === "catalog-staff"), true);

      const firstMissing = restaurantPilot.checklist.find((item) => !item.completed);
      assert.ok(firstMissing);
      const afterChecklist = await completePilotChecklistItem({
        organizationId: restaurant.organization.id,
        itemKey: firstMissing.key,
        completed: true,
        actorUserId: operator.id,
      });
      assert.equal(afterChecklist.checklist.find((item) => item.key === firstMissing.key)?.completed, true);
      assert.equal(await prisma.organizationActivationTask.count({
        where: { organizationId: restaurant.organization.id, taskKey: `pilot-${firstMissing.key}`, status: "COMPLETED" },
      }), 1);

      const updated = await updatePilotWorkspace({
        organizationId: restaurant.organization.id,
        actorUserId: operator.id,
        status: "READY_FOR_LAUNCH",
        notes: "Final internal review pending.",
      });
      assert.equal(updated.status, "READY_FOR_LAUNCH");
      assert.equal(updated.readinessSummary.integrations.dryRunOnly, true);
      assert.equal(updated.readinessSummary.seo.keywordPlanCount > 0, true);
      assert.equal(updated.growthPlanner.futureHooks.includes("Google Trends"), true);

      const overview = await listPilotWorkspaces();
      const scoped = overview.pilots.filter((pilot) => pilot.organization.slug.startsWith(prefix));
      assert.equal(scoped.length, 3);
      const serialized = JSON.stringify(scoped);
      assert.equal(/password|apiKey|accessToken|secretValue|0912|customerIdentityId/i.test(serialized), false);
      assert.equal(scoped.some((pilot) => pilot.organizationId === restaurant.organization.id), true);
      assert.equal(scoped.some((pilot) => pilot.organizationId === retail.organization.id), true);
      assert.equal(scoped.some((pilot) => pilot.organizationId === appointment.organization.id), true);
      assert.equal(await prisma.auditLog.count({
        where: { organizationId: restaurant.organization.id, entityType: "PilotWorkspace" },
      }) >= 3, true);
    } finally {
      await cleanup(prefix);
    }
  });

  it("builds real pilot launch readiness without fake data or external provider side effects", async () => {
    const prefix = `ba${randomUUID().replace(/-/g, "").slice(0, 7)}`;
    await cleanup(prefix);
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    try {
      const operator = await prisma.user.create({
        data: { name: `${prefix}-operator`, email: `${prefix}-operator@example.test`, password: "demo-password", role: "SUPER_ADMIN", isTeamMember: true },
      });
      const created = await finalizeTeamOrganizationCreation({
        createdByUserId: operator.id,
        sourceType: "BAZARBAAZ_TEAM",
        industryKey: "RESTAURANT",
        name: "Restaurant Italiano 13",
        slug: `${prefix}-italiano-13`,
        selectedCapabilities: ["SHOP", "CRM", "USSD"],
      });
      await createOrRefreshPilotWorkspace({
        organizationId: created.organization.id,
        actorUserId: operator.id,
        assignedOperatorId: operator.id,
        status: "CONFIGURATION",
        notes: "Real pilot intake only; no SnappFood calls.",
      });

      const source = await registerPilotSourceAssessment({
        organizationId: created.organization.id,
        actorUserId: operator.id,
        sourceKind: "SNAPPFOOD",
        displayName: "SnappFood source candidate",
        intendedPurpose: "Future menu intake after legal/provider approval.",
        assessmentStatus: "REQUIRES_EXTERNAL_APPROVAL",
        dataExpected: ["menu categories", "menu items"],
        manualImportRequired: true,
        adapterSupport: "LOCAL_PREVIEW_FIXTURE",
        externalVerificationRequired: true,
        provenance: "EXTERNAL_CATALOG",
      });
      assert.equal(source.externalProviderCalls, false);
      assert.equal(fetchCalls, 0);

      await prisma.organizationIntegration.create({
        data: {
          organizationId: created.organization.id,
          provider: "INOTI_USSD",
          type: "USSD",
          status: "ACTIVE",
          codeName: `${prefix}-ussd`,
          displayName: "USSD",
          externalAccountId: "internal-account-reference",
          credentialProfileKey: "cred-profile-real-pilot-test",
          configuration: { localReadinessOnly: true },
          healthStatus: "UNKNOWN",
        },
      });

      const launch = await getRealPilotLaunchWorkspace({ organizationId: created.organization.id });
      assert.equal(launch.launch.stage, "PROFILE_SETUP");
      assert.equal(launch.profileReadiness.state, "MISSING");
      assert.equal(launch.catalogReadiness.state, "MISSING");
      assert.equal(launch.sourceAssessments.some((entry) => entry.sourceKind === "SNAPPFOOD" && entry.persisted), true);
      assert.equal(launch.integrationReadiness.services.find((service) => service.key === "USSD")?.connectionState, "CONNECTION_PENDING");
      assert.equal(launch.safety.externalProviderCalls, false);
      assert.equal(launch.safety.exposesCredentials, false);
      assert.equal(/cred-profile-real-pilot-test|internal-account-reference|customerIdentityId|tokenHash/i.test(JSON.stringify(launch)), false);
      assert.equal(launch.blockers.some((blocker) => blocker.key === "catalog-required"), true);
      assert.equal(launch.recommendations.some((recommendation) => recommendation.key === "trust-reviews"), true);

      const reviewed = await recordPilotLaunchReview({
        organizationId: created.organization.id,
        actorUserId: operator.id,
        notes: "Configuration review recorded locally.",
      });
      assert.equal(reviewed.launch.approval.completed, true);
      assert.equal(reviewed.blockers.some((blocker) => blocker.key === "launch-review"), false);
      assert.equal(await prisma.auditLog.count({
        where: { organizationId: created.organization.id, description: "Pilot launch review completed" },
      }), 1);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(prefix);
    }
  });

  it("keeps real pilot slugs out of Demo Universe discovery even if demo settings drift", async () => {
    const prefix = "italiano-13";
    await cleanup(prefix);
    try {
      const organization = await prisma.organization.create({
        data: {
          name: "Restaurant Italiano 13",
          slug: "italiano-13",
          type: "SHOP",
          locale: "fa",
          capabilitiesInitializedAt: new Date(),
        },
      });
      await prisma.organizationSettings.create({
        data: {
          organizationSlug: organization.slug,
          settings: { demo: { enabled: true, roles: ["CUSTOMER", "MANAGER"] } },
        },
      });
      await prisma.organizationCapability.create({
        data: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
      });

      const demos = await listPublicDemoOrganizations();
      assert.equal(demos.some((demo) => demo.slug === "italiano-13"), false);
      assert.equal(await getPublicDemoShowcaseBySlug("italiano-13"), null);
    } finally {
      await cleanup(prefix);
    }
  });

  it("blocks non-platform users from the operator role boundary and inactive sources from finalization", async () => {
    assert.throws(
      () => requireRole({ user: { id: "user_admin", role: "ADMIN" } }, ["SUPER_ADMIN"]),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );

    await assert.rejects(
      finalizeTeamOrganizationCreation({
        createdByUserId: fixtureId("operator"),
        sourceType: "BUSINESS_SELF_SIGNUP",
        industryKey: "OTHER",
        name: "Future Self Signup",
        slug: "future-self",
        selectedCapabilities: ["CRM"],
      }),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });
});
