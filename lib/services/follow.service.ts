import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-guards";
import { normalizePagination } from "@/lib/pagination";
import { supportedLocales } from "@/lib/i18n";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";

function revalidateOrganizationPublicPages(slug: string) {
  for (const locale of supportedLocales) {
    revalidatePath(buildOrganizationRootPath({ locale, organizationSlug: slug }));
    revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "appointment" }));
    revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "shop" }));
  }
}

export class FollowService {
  async requireActiveOrganization(organizationId: string) {
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true, type: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return organization;
  }

  async follow(customerId: string, organizationId: string) {
    const organization = await this.requireActiveOrganization(organizationId);

    const existing = await prisma.follow.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId: organization.id,
        },
      },
      include: {
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

    if (existing) {
      return { ...existing, alreadyFollowing: true };
    }

    const follow = await prisma.follow.create({
      data: {
        customerId,
        organizationId: organization.id,
      },
      include: {
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

    revalidateOrganizationPublicPages(follow.organization.slug);
    return { ...follow, alreadyFollowing: false };
  }

  async unfollow(customerId: string, organizationId: string) {
    const organization = await this.requireActiveOrganization(organizationId);
    const existing = await prisma.follow.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId: organization.id,
        },
      },
    });

    if (!existing) {
      return { success: true, removed: false };
    }

    await prisma.follow.delete({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId: organization.id,
        },
      },
    });

    revalidateOrganizationPublicPages(organization.slug);
    return { success: true, removed: true };
  }

  async isFollowing(customerId: string, organizationId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
      select: { id: true },
    });

    return !!follow;
  }

  async getFollowers(organizationId: string, params: {
    page?: number | string | null;
    pageSize?: number | string | null;
  }) {
    await this.requireActiveOrganization(organizationId);
    const pagination = normalizePagination(params, { defaultPageSize: 20, maxPageSize: 50 });

    const [data, total] = await Promise.all([
      prisma.follow.findMany({
        where: { organizationId },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
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
      prisma.follow.count({ where: { organizationId } }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async getFollowing(customerId: string, params: {
    page?: number | string | null;
    pageSize?: number | string | null;
  }) {
    const pagination = normalizePagination(params, { defaultPageSize: 20, maxPageSize: 50 });

    const [data, total] = await Promise.all([
      prisma.follow.findMany({
        where: { customerId, organization: { isActive: true, deletedAt: null } },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              coverImage: true,
              type: true,
            },
          },
        },
      }),
      prisma.follow.count({ where: { customerId, organization: { isActive: true, deletedAt: null } } }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async getFollowerCount(organizationId: string) {
    return prisma.follow.count({
      where: {
        organizationId,
        organization: { isActive: true, deletedAt: null },
      },
    });
  }
}

export const followService = new FollowService();
