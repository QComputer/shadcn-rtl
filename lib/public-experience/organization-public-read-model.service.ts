import "server-only";

import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { getOrganizationReputationOverview } from "@/lib/customer-reputation/customer-reputation.service";
import { buildPublicOrganizationReadModel } from "@/lib/public-experience/organization-public-read-model";

export async function getPublicOrganizationReadModel(slug: string) {
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: {
      id: true,
      type: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
      name: true,
      slug: true,
      description: true,
      address: true,
      lat: true,
      lng: true,
      phone: true,
      email: true,
      logo: true,
      coverImage: true,
      locale: true,
      timezone: true,
      isOpen: true,
      settings: { select: { settings: true } },
      productCategories: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 50,
        select: { id: true, name: true, slug: true, description: true, image: true },
      },
      serviceCategories: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 50,
        select: { id: true, name: true, slug: true, description: true, image: true },
      },
      products: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 100,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          basePrice: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      services: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 100,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          price: true,
          duration: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      businessHours: {
        where: { userId: null },
        orderBy: { day: "asc" },
        select: { day: true, openTime: true, closeTime: true, isOpen: true },
      },
      businessEntities: {
        where: { status: { not: "ARCHIVED" } },
        take: 100,
        orderBy: { updatedAt: "desc" },
        select: {
          publicId: true,
          entityType: true,
          title: true,
          slug: true,
          status: true,
          metadataEntries: {
            select: { schemaType: true, seoTitle: true, seoDescription: true },
            take: 5,
          },
        },
      },
      seoOpportunities: {
        where: { status: "OPEN" },
        take: 100,
        select: { opportunityType: true, status: true },
      },
      contentAssets: {
        where: { status: { in: ["APPROVED", "PUBLISHED"] } },
        take: 20,
        orderBy: { updatedAt: "desc" },
        select: {
          publicId: true,
          title: true,
          contentType: true,
          schemaType: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
    },
  });

  if (!organization) throw new ApiError(404, "Organization not found");
  const reputationOverview = await getOrganizationReputationOverview({ organizationId: organization.id });

  return buildPublicOrganizationReadModel({
    ...organization,
    products: organization.products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      image: product.image,
      price: Number(product.basePrice),
      category: product.category,
    })),
    services: organization.services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      image: service.image,
      price: Number(service.price),
      duration: service.duration,
      category: service.category,
    })),
    businessEntities: organization.businessEntities.map((entity) => ({
      id: entity.publicId,
      type: entity.entityType,
      title: entity.title,
      slug: entity.slug,
      status: entity.status,
      schemaTypes: Array.from(new Set(entity.metadataEntries.map((entry) => entry.schemaType).filter((schemaType): schemaType is string => Boolean(schemaType)))),
      seoTitle: entity.metadataEntries.find((entry) => entry.seoTitle)?.seoTitle ?? null,
      seoDescription: entity.metadataEntries.find((entry) => entry.seoDescription)?.seoDescription ?? null,
    })),
    contentAssets: organization.contentAssets.map((asset) => ({
      id: asset.publicId,
      title: asset.title,
      contentType: asset.contentType,
      schemaType: asset.schemaType,
      seoTitle: asset.seoTitle,
      seoDescription: asset.seoDescription,
    })),
    reputation: {
      score: reputationOverview.reputationScore,
      averageRating: reputationOverview.factors.averageRating,
      reviewCount: reputationOverview.factors.reviewCount,
      verifiedReviewCount: reputationOverview.factors.verifiedReviewCount,
      verifiedReviewRatio: reputationOverview.factors.verifiedReviewRatio,
      responseRate: reputationOverview.factors.responseRate,
      recentActivity: reputationOverview.factors.recentActivity,
      selectedReviews: reputationOverview.publicReviews,
      schemaReadiness: {
        LocalBusiness: true,
        AggregateRating: reputationOverview.factors.reviewCount > 0,
        Review: reputationOverview.factors.reviewCount > 0,
        publicSchemaInjected: false,
      },
    },
  });
}
