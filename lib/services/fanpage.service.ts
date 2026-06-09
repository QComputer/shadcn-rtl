import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { normalizePagination } from "@/lib/pagination";
import { revalidatePath } from "next/cache";
import { supportedLocales } from "@/lib/i18n";

function revalidateFanpage(slug: string) {
  for (const locale of supportedLocales) {
    revalidatePath(`/${locale}/organizations/${slug}/fanpage`);
  }
}

export class FanpageService {
  async requirePublicOrganization(slug: string) {
    const organization = await prisma.organization.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        description: true,
        logo: true,
        coverImage: true,
      },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return organization;
  }

  async listPublic(slug: string, params: { page?: number | string | null; pageSize?: number | string | null } = {}) {
    const organization = await this.requirePublicOrganization(slug);
    const pagination = normalizePagination(params, { defaultPageSize: 10, maxPageSize: 30 });

    const where = {
      organizationId: organization.id,
      isPublished: true,
      deletedAt: null,
    };

    const [posts, total] = await Promise.all([
      prisma.fanpagePost.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          body: true,
          image: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              avatar: true,
              image: true,
            },
          },
        },
      }),
      prisma.fanpagePost.count({ where }),
    ]);

    return {
      organization,
      posts,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  async create(slug: string, authorId: string, data: { title?: string | null; body: string; image?: string | null }) {
    const organization = await this.requirePublicOrganization(slug);
    const post = await prisma.fanpagePost.create({
      data: {
        organizationId: organization.id,
        authorId,
        title: data.title?.trim() || null,
        body: data.body.trim(),
        image: data.image?.trim() || null,
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        body: true,
        image: true,
        createdAt: true,
      },
    });

    revalidateFanpage(organization.slug);
    return post;
  }
}

export const fanpageService = new FanpageService();
