import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createReviewSchema } from "@/lib/validators";
import type { CreateReviewInput } from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";

export class ReviewService {
  async create(userId: string, data: CreateReviewInput) {
    // Check if user already reviewed this organization
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: data.organizationId,
        },
      },
    });

    if (existingReview) {
      throw new Error("You have already reviewed this organization");
    }

    const review = await prisma.review.create({
      data: {
        rating: data.rating,
        comment: data.comment,
        userId,
        organizationId: data.organizationId,
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
          },
        },
      },
    });

    revalidatePath(`/organization/${review.organization.slug}`);
    return review;
  }

  async getById(id: string) {
    return prisma.review.findUnique({
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
          },
        },
      },
    });
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    organizationId?: string;
    minRating?: number;
    maxRating?: number;
  }) {
    const { 
      page = 1, 
      pageSize = 20, 
      organizationId,
      minRating,
      maxRating,
    } = params;

    const where: Record<string, unknown> = {};

    if (organizationId) where.organizationId = organizationId;
    if (minRating) where.rating = { ...where.rating as object, gte: minRating };
    if (maxRating) where.rating = { ...where.rating as object, lte: maxRating };

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
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
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Calculate average rating
    const avgRating = await prisma.review.aggregate({
      where: { organizationId },
      _avg: { rating: true },
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      averageRating: avgRating._avg.rating ?? 0,
    };
  }

  async update(id: string, userId: string, data: { rating?: number; comment?: string }) {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new Error("Review not found");
    }

    if (review.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const updated = await prisma.review.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    revalidatePath(`/organization`);
    return updated;
  }

  async delete(id: string, userId: string, userRole: UserRole) {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new Error("Review not found");
    }

    // Allow delete if user owns review or has review:manage permission
    if (review.userId !== userId && !hasPermission(userRole, "review:manage")) {
      throw new Error("Unauthorized");
    }

    await prisma.review.delete({
      where: { id },
    });

    revalidatePath(`/organization`);
  }

  async getUserReview(userId: string, organizationId: string) {
    return prisma.review.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });
  }
}

export const reviewService = new ReviewService();
