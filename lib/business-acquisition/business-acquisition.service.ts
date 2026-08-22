import crypto from "node:crypto";
import type {
  OrganizationAcquisitionSourceType,
  OrganizationClaimRequestStatus,
  OrganizationInvitationStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { generateActivationPlan } from "@/lib/business-acquisition/activation-plan.service";
import {
  createAcquisitionOnboardingDraft,
  reviewIndustryCapabilityRecommendations,
} from "@/lib/business-acquisition/industry-templates";
import { generateGrowthRecommendations, getGrowthPlan } from "@/lib/growth-intelligence/growth-intelligence.service";
import type {
  CreateOnboardingDraftInput,
  CreateOrganizationClaimRequestInput,
  CreateOrganizationInvitationInput,
  FinalizeTeamOrganizationInput,
  ReviewRecommendedCapabilitiesInput,
} from "@/lib/business-acquisition/validators";

type DbClient = Prisma.TransactionClient | typeof prisma;

const ACTIVE_SOURCE: OrganizationAcquisitionSourceType = "BAZARBAAZ_TEAM";
const INVITATION_TOKEN_BYTES = 32;

function buildCapabilityReview(input: ReviewRecommendedCapabilitiesInput) {
  return reviewIndustryCapabilityRecommendations(input);
}

function hashInvitationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function serializeInvitation(invitation: {
  id: string;
  publicId: string;
  organizationId: string;
  invitedRole: UserRole;
  expiresAt: Date;
  status: OrganizationInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: invitation.id,
    publicId: invitation.publicId,
    organizationId: invitation.organizationId,
    invitedRole: invitation.invitedRole,
    expiresAt: invitation.expiresAt.toISOString(),
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
  };
}

function serializeClaimRequest(claimRequest: {
  id: string;
  publicId: string;
  organizationId: string;
  status: OrganizationClaimRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: claimRequest.id,
    publicId: claimRequest.publicId,
    organizationId: claimRequest.organizationId,
    status: claimRequest.status,
    createdAt: claimRequest.createdAt.toISOString(),
    updatedAt: claimRequest.updatedAt.toISOString(),
  };
}

export function createOrganizationOnboardingDraft(input: CreateOnboardingDraftInput) {
  return createAcquisitionOnboardingDraft(input);
}

export function reviewRecommendedCapabilities(input: ReviewRecommendedCapabilitiesInput) {
  return buildCapabilityReview(input);
}

export async function finalizeTeamOrganizationCreation(input: FinalizeTeamOrganizationInput & {
  createdByUserId: string;
  db?: typeof prisma;
}) {
  if (input.sourceType !== ACTIVE_SOURCE) {
    throw new ApiError(400, "Only BAZARBAAZ_TEAM acquisition is active");
  }

  const db = input.db ?? prisma;
  const review = buildCapabilityReview({
    industryKey: input.industryKey,
    selectedCapabilities: input.selectedCapabilities,
  });

  if (review.selectedCapabilities.length === 0) {
    throw new ApiError(400, "At least one platform capability is required");
  }

  const finalized = await db.$transaction(async (tx) => {
    const existingSlug = await tx.organization.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existingSlug) throw new ApiError(409, "Slug already exists");

    const now = new Date();
    const organization = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        type: review.organizationType,
        description: input.description,
        address: input.address,
        phone: input.phone,
        email: input.email,
        locale: input.locale ?? "fa",
        timezone: input.timezone ?? "Asia/Tehran",
        capabilitiesInitializedAt: now,
        capabilities: {
          create: review.selectedCapabilities.map((key) => ({ key, status: "ACTIVE", enabledAt: now })),
        },
      },
      include: { capabilities: { orderBy: { key: "asc" } } },
    });

    await tx.organizationSettings.create({ data: { organizationSlug: organization.slug } });
    await tx.paymentSettings.create({ data: { organizationSlug: organization.slug } });

    const acquisition = await tx.organizationAcquisition.create({
      data: {
        organizationId: organization.id,
        sourceType: ACTIVE_SOURCE,
        industryKey: input.industryKey,
        createdByUserId: input.createdByUserId,
        metadata: {
          ...(input.metadata ?? {}),
          recommendedCapabilities: review.recommendedCapabilities,
          recommendedPlatformCapabilities: review.recommendedPlatformCapabilities,
          selectedCapabilities: review.selectedCapabilities,
          onboardingChecklist: review.onboardingChecklist,
          suggestedIntegrations: review.suggestedIntegrations,
        } satisfies Prisma.InputJsonObject,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "OrganizationAcquisition",
        entityId: acquisition.id,
        description: "BazarBaaz team finalized organization acquisition",
        userId: input.createdByUserId,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        newValue: {
          sourceType: ACTIVE_SOURCE,
          industryKey: input.industryKey,
          selectedCapabilities: review.selectedCapabilities,
        },
      },
    });

    return {
      organization,
      acquisition,
      recommendedCapabilities: review.recommendedCapabilities,
      selectedCapabilities: review.selectedCapabilities,
      onboardingChecklist: review.onboardingChecklist,
      suggestedIntegrations: review.suggestedIntegrations,
      nextHooks: {
        publicPageReady: true,
        demoExperienceReady: false,
        seoReadinessPrepared: review.selectedCapabilities.includes("CRM"),
        businessEntityGraphPrepared: true,
        integrationsPrepared: review.suggestedIntegrations.map((integration) => ({ integration, mode: "DEMO_ONLY" })),
      },
    };
  });

  const activationPlan = await generateActivationPlan({
    organizationId: finalized.organization.id,
    industryKey: input.industryKey,
    generatedByUserId: input.createdByUserId,
    db,
  });
  await generateGrowthRecommendations({
    organizationId: finalized.organization.id,
    actorUserId: input.createdByUserId,
    db,
  });
  const growthPlan = await getGrowthPlan({
    organizationId: finalized.organization.id,
    actorUserId: input.createdByUserId,
    db,
  });

  return {
    ...finalized,
    activationPlan,
    growthPlan,
  };
}

export async function createOrganizationInvitation(input: CreateOrganizationInvitationInput & {
  createdByUserId: string;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const organization = await db.organization.findFirst({
    where: { id: input.organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");

  const token = crypto.randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(Date.now() + (input.ttlHours ?? 72) * 60 * 60 * 1000);

  const invitation = await db.organizationInvitation.create({
    data: {
      organizationId: input.organizationId,
      invitedRole: input.invitedRole,
      tokenHash: hashInvitationToken(token),
      expiresAt,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata ? { ...input.metadata } satisfies Prisma.InputJsonObject : undefined,
    },
  });

  return {
    invitation: serializeInvitation(invitation),
    oneTimeToken: token,
  };
}

export async function getInvitationForOrganization(input: {
  organizationId: string;
  publicId: string;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const invitation = await db.organizationInvitation.findFirst({
    where: { organizationId: input.organizationId, publicId: input.publicId },
  });
  return invitation ? serializeInvitation(invitation) : null;
}

export async function createOrganizationClaimRequest(input: CreateOrganizationClaimRequestInput & {
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const organization = await db.organization.findFirst({
    where: { id: input.organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");

  const claimRequest = await db.organizationClaimRequest.create({
    data: {
      organizationId: input.organizationId,
      requesterUserId: input.requesterUserId,
      requesterEmail: input.requesterEmail,
      requesterPhone: input.requesterPhone,
      verificationMetadata: {
        ...(input.verificationMetadata ?? {}),
        grantsMembership: false,
      } satisfies Prisma.InputJsonObject,
    },
  });

  return serializeClaimRequest(claimRequest);
}

export async function getClaimRequestForOrganization(input: {
  organizationId: string;
  publicId: string;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const claimRequest = await db.organizationClaimRequest.findFirst({
    where: { organizationId: input.organizationId, publicId: input.publicId },
  });
  return claimRequest ? serializeClaimRequest(claimRequest) : null;
}

export async function getBusinessAcquisitionOperatorOverview(input: {
  take?: number;
  db?: DbClient;
} = {}) {
  const db = input.db ?? prisma;
  const take = input.take ?? 12;
  const [acquisitions, invitations, claimRequests, counts] = await Promise.all([
    db.organizationAcquisition.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            isActive: true,
            createdAt: true,
            capabilities: { where: { status: "ACTIVE" }, select: { key: true }, orderBy: { key: "asc" } },
            activationPlan: {
              select: {
                id: true,
                status: true,
                recommendedActions: true,
                completedActions: true,
                growthOpportunities: true,
                ownerOnboardingReadModel: true,
                updatedAt: true,
              },
            },
            businessGrowthProfile: { select: { status: true, updatedAt: true } },
            _count: { select: { keywordClusters: true, growthRecommendations: true } },
          },
        },
        createdByUser: { select: { id: true, name: true, role: true } },
      },
    }),
    db.organizationInvitation.findMany({
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicId: true,
        organizationId: true,
        invitedRole: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    db.organizationClaimRequest.findMany({
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicId: true,
        organizationId: true,
        status: true,
        requesterEmail: true,
        requesterPhone: true,
        createdAt: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    Promise.all([
      db.organizationAcquisition.count(),
      db.organizationInvitation.count({ where: { status: { in: ["CREATED", "SENT"] } } }),
      db.organizationClaimRequest.count({ where: { status: "REQUESTED" } }),
      db.organization.count({ where: { isActive: true, deletedAt: null } }),
    ]),
  ]);

  return {
    counts: {
      acquiredOrganizations: counts[0],
      pendingInvitations: counts[1],
      pendingClaims: counts[2],
      activeOrganizations: counts[3],
    },
    acquisitions: acquisitions.map((entry) => ({
      id: entry.id,
      organizationId: entry.organizationId,
      sourceType: entry.sourceType,
      industryKey: entry.industryKey,
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdByUser ? {
        id: entry.createdByUser.id,
        name: entry.createdByUser.name,
        role: entry.createdByUser.role,
      } : null,
      organization: {
        id: entry.organization.id,
        name: entry.organization.name,
        slug: entry.organization.slug,
        type: entry.organization.type,
        isActive: entry.organization.isActive,
        createdAt: entry.organization.createdAt.toISOString(),
        capabilities: entry.organization.capabilities.map((capability) => capability.key),
        activationPlan: entry.organization.activationPlan ? {
          id: entry.organization.activationPlan.id,
          status: entry.organization.activationPlan.status,
          recommendedActions: entry.organization.activationPlan.recommendedActions,
          completedActions: entry.organization.activationPlan.completedActions,
          growthOpportunities: entry.organization.activationPlan.growthOpportunities,
          ownerOnboardingReadModel: entry.organization.activationPlan.ownerOnboardingReadModel,
          updatedAt: entry.organization.activationPlan.updatedAt.toISOString(),
        } : null,
        growthIntelligence: entry.organization.businessGrowthProfile ? {
          status: entry.organization.businessGrowthProfile.status,
          keywordPlanCount: entry.organization._count.keywordClusters,
          recommendationCount: entry.organization._count.growthRecommendations,
          updatedAt: entry.organization.businessGrowthProfile.updatedAt.toISOString(),
          externalProviderCalls: false,
        } : null,
      },
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      publicId: invitation.publicId,
      organizationId: invitation.organizationId,
      invitedRole: invitation.invitedRole,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      organization: invitation.organization,
    })),
    claimRequests: claimRequests.map((claim) => ({
      id: claim.id,
      publicId: claim.publicId,
      organizationId: claim.organizationId,
      status: claim.status,
      requesterEmail: claim.requesterEmail,
      requesterPhone: claim.requesterPhone,
      createdAt: claim.createdAt.toISOString(),
      organization: claim.organization,
    })),
  };
}
