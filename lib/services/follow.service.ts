import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export class FollowService {
  async follow(customerId: string, organizationId: string) {
    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
    });

    if (existing) {
      throw new Error("Already following this organization");
    }

    const follow = await prisma.follow.create({
      data: {
        customerId,
        organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    revalidatePath(`/organization/${follow.organization.slug}`);
    return follow;
  }

  async unfollow(customerId: string, organizationId: string) {
    const existing = await prisma.follow.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
    });

    if (!existing) {
      throw new Error("Not following this organization");
    }

    await prisma.follow.delete({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
    });

    revalidatePath(`/organization`);
  }

  async isFollowing(customerId: string, organizationId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
    });

    return !!follow;
  }

  async getFollowers(organizationId: string, params: {
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20 } = params;

    const [data, total] = await Promise.all([
      prisma.follow.findMany({
        where: { organizationId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
            },
          },
        },
      }),
      prisma.follow.count({ where: { organizationId } }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getFollowing(customerId: string, params: {
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20 } = params;

    const [data, total] = await Promise.all([
      prisma.follow.findMany({
        where: { customerId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              coverImage: true,
            },
          },
        },
      }),
      prisma.follow.count({ where: { customerId } }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getFollowerCount(organizationId: string) {
    return prisma.follow.count({ where: { organizationId } });
  }
}

export const followService = new FollowService();
