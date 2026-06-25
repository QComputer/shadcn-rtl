import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-guards";
import { normalizePagination } from "@/lib/pagination";
import type { UserRole } from "@/lib/types";

export type CreateReviewData = {
  organizationSlug?: string | null;
  organizationId?: string | null;
  rating: number;
  comment?: string | null;
};

export type UpdateReviewData = {
  rating?: number;
  comment?: string | null;
};

function cleanComment(comment?: string | null) {
  const value = typeof comment === "string" ? comment.trim() : "";
  return value.length > 0 ? value.slice(0, 2000) : null;
}

export class ReviewService {
  async resolveActiveOrganization(data: { organizationSlug?: string | null; organizationId?: string | null }) {
    if (!data.organizationSlug && !data.organizationId) {
      throw new ApiError(400, "organizationSlug or organizationId is required");
    }

    const organization = await prisma.organization.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        ...(data.organizationId ? { id: data.organizationId } : {}),
        ...(data.organizationSlug ? { slug: data.organizationSlug } : {}),
      },
      select: { id: true, slug: true, name: true, type: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return organization;
  }

  async create(userId: string, data: CreateReviewData) {
    const organization = await this.resolveActiveOrganization(data);
    const rating = Number(data.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, "Rating must be an integer between 1 and 5");
    }

    const existingReview = await prisma.review.findUnique({
      where: {
        userId_organizationSlug: {
          userId,
          organizationSlug: organization.slug,
        },
      },
      select: { id: true },
    });

    if (existingReview) {
      throw new ApiError(409, "You have already reviewed this organization");
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment: cleanComment(data.comment),
        userId,
        organizationSlug: organization.slug,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

revalidatePath(`/fa/appointment/${organization.slug}`);
     revalidatePath(`/fa/shop/${organization.slug}`);
    return review;
  }

  async getById(id: string) {
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    if (!review) throw new ApiError(404, "Review not found");
    return review;
  }

  async list(params: {
    page?: number | string | null;
    pageSize?: number | string | null;
    organizationSlug?: string | null;
    organizationId?: string | null;
    minRating?: number | string | null;
    maxRating?: number | string | null;
  }) {
    const pagination = normalizePagination(params, { defaultPageSize: 20, maxPageSize: 50 });
    const where: Record<string, unknown> = {};

    if (params.organizationSlug || params.organizationId) {
      const organization = await this.resolveActiveOrganization({
        organizationSlug: params.organizationSlug,
        organizationId: params.organizationId,
      });
      where.organizationSlug = organization.slug;
    }

    const minRating = params.minRating == null || params.minRating === "" ? undefined : Number(params.minRating);
    const maxRating = params.maxRating == null || params.maxRating === "" ? undefined : Number(params.maxRating);

    if (Number.isFinite(minRating) || Number.isFinite(maxRating)) {
      where.rating = {
        ...(Number.isFinite(minRating) ? { gte: minRating } : {}),
        ...(Number.isFinite(maxRating) ? { lte: maxRating } : {}),
      };
    }

    const [data, total, average] = await Promise.all([
      prisma.review.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
      averageRating: average._avg.rating ?? 0,
    };
  }

  async update(id: string, userId: string, data: UpdateReviewData) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationSlug: true },
    });

    if (!review) throw new ApiError(404, "Review not found");
    if (review.userId !== userId) throw new ApiError(403, "Forbidden");

    const updateData: UpdateReviewData = {};
    if (data.rating !== undefined) {
      const rating = Number(data.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be an integer between 1 and 5");
      }
      updateData.rating = rating;
    }

    if (data.comment !== undefined) {
      updateData.comment = cleanComment(data.comment);
    }

    const updated = await prisma.review.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

revalidatePath(`/fa/appointment/${review.organizationSlug}`);
     revalidatePath(`/fa/shop/${review.organizationSlug}`);
     return updated;
   }

   async delete(id: string, userId: string, userRole: UserRole) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationSlug: true },
    });

    if (!review) throw new ApiError(404, "Review not found");
    if (review.userId !== userId && userRole !== "SUPER_ADMIN") {
      throw new ApiError(403, "Forbidden");
    }

await prisma.review.delete({ where: { id } });
     revalidatePath(`/fa/appointment/${review.organizationSlug}`);
     revalidatePath(`/fa/shop/${review.organizationSlug}`);
   }

  async getUserReview(userId: string, organizationSlug: string) {
    return prisma.review.findUnique({
      where: {
        userId_organizationSlug: {
          userId,
          organizationSlug,
        },
      },
    });
  }
}

export const reviewService = new ReviewService();
