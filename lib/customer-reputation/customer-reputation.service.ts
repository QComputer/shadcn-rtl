import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Prisma, ReviewSource, ReviewStatus } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import {
  createBusinessEntityRelation,
  ensureOrganizationBusinessEntity,
  upsertBusinessEntity,
} from "@/lib/business-entity/business-entity.service";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";

const COMPLETED_BUSINESS_EVENTS = new Set<string>(["ORDER_COMPLETED", "APPOINTMENT_COMPLETED", "SERVICE_COMPLETED"]);
const COMPLETED_INTERACTIONS = new Set<string>(["ORDER_COMPLETED", "APPOINTMENT_COMPLETED", "SERVICE_COMPLETED"]);

type ReviewContextInput = {
  contextType?: string | null;
  contextId?: string | null;
  productId?: string | null;
  serviceId?: string | null;
  appointmentId?: string | null;
  orderId?: string | null;
  staffUserId?: string | null;
};

function sanitizeJson(input: unknown): Prisma.InputJsonObject {
  return sanitizeIntegrationConfig(input) as Prisma.InputJsonObject;
}

function publicReviewCustomerLabel(index: number) {
  return `Verified customer ${index + 1}`;
}

function hashReviewRequestToken(token: string) {
  return createHash("sha256").update(`bazarbaaz-review-request:${token}`).digest("hex");
}

function generateReviewRequestToken() {
  return randomBytes(32).toString("base64url");
}

function publicReviewStatusFilter() {
  return { in: ["APPROVED", "PUBLISHED"] as ReviewStatus[] };
}

async function requireOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

async function requireCustomerIdentity(organizationId: string, customerIdentityId: string) {
  const customer = await prisma.customerIdentity.findFirst({
    where: { id: customerIdentityId, organizationId, status: "ACTIVE" },
    select: { id: true, organizationId: true, userId: true },
  });
  if (!customer) throw new ApiError(404, "Customer identity not found");
  return customer;
}

function extractReviewContext(payload: unknown, metadata: unknown): ReviewContextInput {
  const payloadObject = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const metadataObject = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  const merged = { ...payloadObject, ...metadataObject };
  return {
    contextType: typeof merged.contextType === "string" ? merged.contextType : typeof merged.entityType === "string" ? merged.entityType : null,
    contextId: typeof merged.contextId === "string" ? merged.contextId : typeof merged.entityId === "string" ? merged.entityId : null,
    productId: typeof merged.productId === "string" ? merged.productId : null,
    serviceId: typeof merged.serviceId === "string" ? merged.serviceId : null,
    appointmentId: typeof merged.appointmentId === "string" ? merged.appointmentId : null,
    orderId: typeof merged.orderId === "string" ? merged.orderId : null,
    staffUserId: typeof merged.staffUserId === "string" ? merged.staffUserId : null,
  };
}

function assertRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be an integer between 1 and 5");
  }
}

export function calculateReputationScore(input: {
  averageRating: number;
  reviewCount: number;
  verifiedReviewRatio: number;
  responseRate: number;
  recentActivityRatio: number;
}) {
  return Math.round(
    (input.averageRating / 5) * 45 +
    Math.min(input.reviewCount / 25, 1) * 20 +
    input.verifiedReviewRatio * 20 +
    input.responseRate * 10 +
    input.recentActivityRatio * 5,
  );
}

export function listReputationIntegrationReadinessMappings() {
  return [
    {
      target: "iAM",
      readinessKey: "IAM_TRUST_CONTENT_READY",
      purpose: "Use aggregate review signals for future trust content briefs.",
      externalProviderCalls: false,
    },
    {
      target: "EBC",
      readinessKey: "EBC_REVIEW_ENGAGEMENT_READY",
      purpose: "Use signed review request and response state for future engagement campaigns.",
      externalProviderCalls: false,
    },
    {
      target: "Customer Club",
      readinessKey: "CUSTOMER_CLUB_REPUTATION_INCENTIVES_READY",
      purpose: "Use verified review participation as future incentive input.",
      externalProviderCalls: false,
    },
    {
      target: "USSD",
      readinessKey: "USSD_REVIEW_REQUEST_READY",
      purpose: "Prepare no-send signed review request contracts for future USSD flows.",
      externalProviderCalls: false,
    },
  ];
}

export async function createReviewRequestFromBusinessEvent(input: {
  organizationId: string;
  businessEventId: string;
  customerInteractionId?: string | null;
  metadata?: unknown;
  expiresAt?: Date | null;
}) {
  await requireOrganization(input.organizationId);
  const businessEvent = await prisma.businessEvent.findFirst({
    where: { id: input.businessEventId, organizationId: input.organizationId },
    select: {
      id: true,
      organizationId: true,
      customerIdentityId: true,
      type: true,
      entityType: true,
      entityId: true,
      payload: true,
      metadata: true,
    },
  });
  if (!businessEvent) throw new ApiError(404, "Business event not found");
  if (!businessEvent.customerIdentityId) throw new ApiError(400, "Review requests require a customer identity");
  if (!COMPLETED_BUSINESS_EVENTS.has(businessEvent.type)) {
    throw new ApiError(400, "Review requests require a completed customer transaction event");
  }
  if (input.customerInteractionId) {
    const interaction = await prisma.customerInteraction.findFirst({
      where: {
        id: input.customerInteractionId,
        organizationId: input.organizationId,
        customerIdentityId: businessEvent.customerIdentityId,
        businessEventId: businessEvent.id,
      },
      select: { id: true },
    });
    if (!interaction) throw new ApiError(404, "Customer interaction not found for review request");
  }
  const context = {
    ...extractReviewContext(businessEvent.payload, businessEvent.metadata),
    contextType: businessEvent.entityType ?? extractReviewContext(businessEvent.payload, businessEvent.metadata).contextType,
    contextId: businessEvent.entityId ?? extractReviewContext(businessEvent.payload, businessEvent.metadata).contextId,
  };
  return prisma.reviewRequest.upsert({
    where: {
      organizationId_businessEventId_customerIdentityId: {
        organizationId: input.organizationId,
        businessEventId: businessEvent.id,
        customerIdentityId: businessEvent.customerIdentityId,
      },
    },
    update: {
      status: "CREATED",
      customerInteractionId: input.customerInteractionId ?? null,
      expiresAt: input.expiresAt ?? undefined,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
    create: {
      organizationId: input.organizationId,
      customerIdentityId: businessEvent.customerIdentityId,
      businessEventId: businessEvent.id,
      customerInteractionId: input.customerInteractionId ?? null,
      source: "REVIEW_REQUEST",
      ...context,
      expiresAt: input.expiresAt ?? null,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function issueReviewRequestToken(input: {
  organizationId: string;
  reviewRequestId: string;
  expiresAt?: Date | null;
}) {
  const token = generateReviewRequestToken();
  const tokenHash = hashReviewRequestToken(token);
  const request = await prisma.reviewRequest.findFirst({
    where: { id: input.reviewRequestId, organizationId: input.organizationId, status: "CREATED" },
    select: { id: true, organizationId: true, customerIdentityId: true, publicId: true },
  });
  if (!request) throw new ApiError(404, "Review request not found");
  const updated = await prisma.reviewRequest.update({
    where: { id: request.id },
    data: {
      tokenHash,
      tokenIssuedAt: new Date(),
      expiresAt: input.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, publicId: true, organizationId: true, expiresAt: true },
  });

  return {
    reviewRequest: updated,
    token,
    signedPath: `/review/${token}`,
  };
}

export async function createReviewRequestLinkFromBusinessEvent(input: {
  organizationId: string;
  businessEventId: string;
  customerInteractionId?: string | null;
  expiresAt?: Date | null;
  metadata?: unknown;
}) {
  const reviewRequest = await createReviewRequestFromBusinessEvent(input);
  return issueReviewRequestToken({
    organizationId: input.organizationId,
    reviewRequestId: reviewRequest.id,
    expiresAt: input.expiresAt ?? null,
  });
}

async function verifyReviewRequest(input: {
  organizationId: string;
  customerIdentityId: string;
  reviewRequestId?: string | null;
  businessEventId?: string | null;
  customerInteractionId?: string | null;
}) {
  const request = input.reviewRequestId
    ? await prisma.reviewRequest.findFirst({
        where: {
          id: input.reviewRequestId,
          organizationId: input.organizationId,
          customerIdentityId: input.customerIdentityId,
          status: "CREATED",
        },
        include: { businessEvent: true, customerInteraction: true },
      })
    : null;
  const businessEventId = input.businessEventId ?? request?.businessEventId ?? null;
  if (!businessEventId) throw new ApiError(400, "Verified reviews require a completed business event");
  const businessEvent = request?.businessEvent ?? await prisma.businessEvent.findFirst({
    where: {
      id: businessEventId,
      organizationId: input.organizationId,
      customerIdentityId: input.customerIdentityId,
    },
  });
  if (!businessEvent || !COMPLETED_BUSINESS_EVENTS.has(businessEvent.type)) {
    throw new ApiError(400, "Verified reviews require a completed customer transaction");
  }
  if (input.customerInteractionId ?? request?.customerInteractionId) {
    const interactionId = input.customerInteractionId ?? request?.customerInteractionId;
    const interaction = request?.customerInteraction?.id === interactionId
      ? request.customerInteraction
      : await prisma.customerInteraction.findFirst({
          where: {
            id: interactionId,
            organizationId: input.organizationId,
            customerIdentityId: input.customerIdentityId,
            businessEventId: businessEvent.id,
          },
        });
    if (!interaction || !COMPLETED_INTERACTIONS.has(interaction.type)) {
      throw new ApiError(400, "Verified reviews require a completed customer interaction");
    }
  }
  return { request, businessEvent };
}

async function requireOpenReviewRequestByToken(token: string) {
  const tokenHash = hashReviewRequestToken(token);
  const request = await prisma.reviewRequest.findFirst({
    where: { tokenHash, status: "CREATED" },
    include: {
      organization: { select: { id: true, name: true, slug: true, locale: true } },
      businessEvent: { select: { id: true, type: true, entityType: true, entityId: true, payload: true, metadata: true } },
    },
  });
  if (!request) throw new ApiError(404, "Review request not found");
  if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
    await prisma.reviewRequest.update({ where: { id: request.id }, data: { status: "EXPIRED" } });
    throw new ApiError(410, "Review request expired");
  }
  return request;
}

export async function getPublicReviewRequestByToken(token: string) {
  const request = await requireOpenReviewRequestByToken(token);
  const context = extractReviewContext(request.businessEvent.payload, request.businessEvent.metadata);
  return {
    request: {
      id: request.publicId,
      status: request.status,
      expiresAt: request.expiresAt?.toISOString() ?? null,
      contextType: request.contextType ?? context.contextType,
      contextId: request.contextId ?? context.contextId,
      productId: request.productId ?? context.productId,
      serviceId: request.serviceId ?? context.serviceId,
      appointmentId: request.appointmentId ?? context.appointmentId,
      orderId: request.orderId ?? context.orderId,
      imageMetadataSupported: true,
    },
    organization: {
      name: request.organization.name,
      slug: request.organization.slug,
      locale: request.organization.locale,
    },
    safeMetadata: {
      customerIdentityExposed: false,
      externalProviderCalls: false,
    },
  };
}

export async function submitPublicReviewByToken(input: {
  token: string;
  rating: number;
  serviceQualityRating?: number | null;
  title?: string | null;
  text?: string | null;
  imageMetadata?: unknown;
}) {
  const request = await requireOpenReviewRequestByToken(input.token);
  if (input.serviceQualityRating != null) assertRating(input.serviceQualityRating);
  const review = await submitVerifiedReview({
    organizationId: request.organizationId,
    customerIdentityId: request.customerIdentityId,
    reviewRequestId: request.id,
    businessEventId: request.businessEventId,
    customerInteractionId: request.customerInteractionId,
    rating: input.rating,
    title: input.title,
    text: input.text,
    context: {
      contextType: request.contextType,
      contextId: request.contextId,
      productId: request.productId,
      serviceId: request.serviceId,
      appointmentId: request.appointmentId,
      orderId: request.orderId,
      staffUserId: request.staffUserId,
    },
    metadata: {
      source: "public-review-token",
      serviceQualityRating: input.serviceQualityRating ?? null,
      imageMetadata: input.imageMetadata ?? null,
    },
  });
  return {
    review: {
      id: review.publicId,
      rating: review.rating,
      status: review.status,
      verifiedInteraction: review.verifiedInteraction,
    },
    safeMetadata: { customerIdentityExposed: false },
  };
}

export async function submitVerifiedReview(input: {
  organizationId: string;
  customerIdentityId: string;
  rating: number;
  title?: string | null;
  text?: string | null;
  source?: ReviewSource;
  reviewRequestId?: string | null;
  businessEventId?: string | null;
  customerInteractionId?: string | null;
  businessEntityId?: string | null;
  context?: ReviewContextInput;
  metadata?: unknown;
}) {
  const organization = await requireOrganization(input.organizationId);
  await requireCustomerIdentity(input.organizationId, input.customerIdentityId);
  assertRating(input.rating);
  const { request, businessEvent } = await verifyReviewRequest(input);
  const eventContext = extractReviewContext(businessEvent.payload, businessEvent.metadata);
  const context = { ...eventContext, ...input.context };
  const rootEntity = await ensureOrganizationBusinessEntity({ organizationId: input.organizationId });
  const subjectEntityId = input.businessEntityId ?? rootEntity.id;
  const subjectEntity = await prisma.businessEntity.findFirst({
    where: { id: subjectEntityId, organizationId: input.organizationId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (!subjectEntity) throw new ApiError(404, "Business entity not found");

  const review = await prisma.review.create({
    data: {
      organizationId: input.organizationId,
      organizationSlug: organization.slug,
      customerIdentityId: input.customerIdentityId,
      userId: null,
      reviewRequestId: request?.id ?? null,
      businessEventId: businessEvent.id,
      customerInteractionId: input.customerInteractionId ?? request?.customerInteractionId ?? null,
      businessEntityId: subjectEntity.id,
      rating: input.rating,
      title: input.title?.trim() || null,
      comment: input.text?.trim() || null,
      text: input.text?.trim() || null,
      source: input.source ?? "REVIEW_REQUEST",
      status: "PUBLISHED",
      isVerifiedPurchase: true,
      verifiedInteraction: true,
      verifiedAt: new Date(),
      ...context,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
  if (request) {
    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  }
  const reviewEntity = await upsertBusinessEntity({
    organizationId: input.organizationId,
    entityType: "REVIEW",
    entityId: review.id,
    title: review.title || `Review ${review.rating}/5`,
    status: "ACTIVE",
    metadata: {
      rating: review.rating,
      verifiedInteraction: review.verifiedInteraction,
      source: review.source,
    },
  });
  await createBusinessEntityRelation({
    organizationId: input.organizationId,
    sourceEntityId: subjectEntity.id,
    targetEntityId: reviewEntity.id,
    relationType: "HAS_REVIEW",
    metadata: { rating: review.rating, verifiedInteraction: true },
  });
  return review;
}

export async function respondToReview(input: {
  organizationId: string;
  reviewPublicId: string;
  responseText: string;
  actorUserId: string;
}) {
  const review = await prisma.review.findFirst({
    where: {
      publicId: input.reviewPublicId,
      organizationId: input.organizationId,
      status: publicReviewStatusFilter(),
    },
    select: { id: true, publicId: true, responseText: true },
  });
  if (!review) throw new ApiError(404, "Review not found");
  const responseText = input.responseText.trim();
  if (!responseText) throw new ApiError(400, "Response text is required");
  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { responseText, respondedAt: new Date() },
    select: { publicId: true, responseText: true, respondedAt: true },
  });
  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "Review",
      entityId: review.id,
      description: "REVIEW_RESPONSE_UPDATED",
      previousValue: { responsePresent: Boolean(review.responseText) },
      newValue: { responsePresent: true },
      organizationId: input.organizationId,
      userId: input.actorUserId,
    },
  });
  return updated;
}

export async function getOrganizationReputationOverview(input: { organizationId: string }) {
  const organization = await requireOrganization(input.organizationId);
  const reviews = await prisma.review.findMany({
    where: { organizationId: input.organizationId, status: publicReviewStatusFilter() },
    select: {
      id: true,
      publicId: true,
      rating: true,
      title: true,
      text: true,
      verifiedInteraction: true,
      responseText: true,
      respondedAt: true,
      createdAt: true,
      source: true,
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const reviewCount = reviews.length;
  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);
  const verifiedCount = reviews.filter((review) => review.verifiedInteraction).length;
  const responseCount = reviews.filter((review) => Boolean(review.responseText || review.respondedAt)).length;
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const previousCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const recentCount = reviews.filter((review) => review.createdAt.getTime() >= recentCutoff).length;
  const recentReviews = reviews.filter((review) => review.createdAt.getTime() >= recentCutoff);
  const previousReviews = reviews.filter((review) => review.createdAt.getTime() < recentCutoff && review.createdAt.getTime() >= previousCutoff);
  const recentAverage = recentReviews.length ? recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length : 0;
  const previousAverage = previousReviews.length ? previousReviews.reduce((sum, review) => sum + review.rating, 0) / previousReviews.length : 0;
  const averageRating = reviewCount ? Number((ratingSum / reviewCount).toFixed(2)) : 0;
  const verifiedRatio = reviewCount ? verifiedCount / reviewCount : 0;
  const responseRate = reviewCount ? responseCount / reviewCount : 0;
  const recentActivityRatio = reviewCount ? Math.min(recentCount / Math.max(reviewCount, 5), 1) : 0;
  const score = calculateReputationScore({
    averageRating,
    reviewCount,
    verifiedReviewRatio: verifiedRatio,
    responseRate,
    recentActivityRatio,
  });

  return {
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    reputationScore: score,
    factors: {
      averageRating,
      reviewCount,
      verifiedReviewRatio: Number(verifiedRatio.toFixed(2)),
      responseRate: Number(responseRate.toFixed(2)),
      recentActivity: recentCount,
      verifiedReviewCount: verifiedCount,
    },
    trend: {
      direction: recentAverage === 0 || previousAverage === 0 ? "INSUFFICIENT_DATA" : recentAverage > previousAverage ? "UP" : recentAverage < previousAverage ? "DOWN" : "STABLE",
      recentAverage: Number(recentAverage.toFixed(2)),
      previousAverage: Number(previousAverage.toFixed(2)),
    },
    reviewTopics: {
      status: "FOUNDATION_READY",
      aiGenerated: false,
      topics: [],
    },
    publicReviews: reviews.slice(0, 10).map((review, index) => ({
      id: review.publicId,
      rating: review.rating,
      title: review.title,
      text: review.text,
      verifiedInteraction: review.verifiedInteraction,
      source: review.source,
      businessResponse: review.responseText ? { text: review.responseText, respondedAt: review.respondedAt?.toISOString() ?? null } : null,
      customerLabel: publicReviewCustomerLabel(index),
      createdAt: review.createdAt.toISOString(),
    })),
    safeMetadata: {
      customerPiiExposed: false,
      deterministicScoring: true,
    },
  };
}

export async function getOwnerReviewsSummary(input: { organizationId: string }) {
  const [overview, pendingResponses, openRequests] = await Promise.all([
    getOrganizationReputationOverview(input),
    prisma.review.count({
      where: { organizationId: input.organizationId, status: publicReviewStatusFilter(), responseText: null },
    }),
    prisma.reviewRequest.count({
      where: { organizationId: input.organizationId, status: "CREATED" },
    }),
  ]);
  return {
    ...overview,
    ownerActions: {
      pendingResponses,
      openReviewRequests: openRequests,
    },
  };
}

export async function getCustomerSubmittedReviews(input: {
  organizationId: string;
  customerIdentityId: string;
}) {
  await requireCustomerIdentity(input.organizationId, input.customerIdentityId);
  const reviews = await prisma.review.findMany({
    where: { organizationId: input.organizationId, customerIdentityId: input.customerIdentityId },
    select: {
      publicId: true,
      rating: true,
      title: true,
      text: true,
      status: true,
      verifiedInteraction: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    reviews: reviews.map((review) => ({
      id: review.publicId,
      rating: review.rating,
      title: review.title,
      text: review.text,
      status: review.status,
      verifiedInteraction: review.verifiedInteraction,
      createdAt: review.createdAt.toISOString(),
    })),
    safeMetadata: { customerPiiExposed: false },
  };
}

export async function getReviewSeoReadiness(input: { organizationId: string }) {
  const overview = await getOrganizationReputationOverview(input);
  return {
    organization: overview.organization,
    reputationSignals: overview.factors,
    schemaReadiness: {
      LocalBusiness: true,
      AggregateRating: overview.factors.reviewCount > 0,
      Review: overview.factors.reviewCount > 0,
      publicSchemaInjected: false,
    },
    seoSignals: {
      reviewCount: overview.factors.reviewCount,
      averageRating: overview.factors.averageRating,
      verifiedReviewRatio: overview.factors.verifiedReviewRatio,
      reputationScore: overview.reputationScore,
      reviewFreshness: overview.factors.recentActivity,
      reputationTrend: overview.trend.direction,
      reviewTopicsStatus: overview.reviewTopics.status,
    },
  };
}
