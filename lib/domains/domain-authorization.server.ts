import { ApiError } from "@/lib/api-guards";

export type DomainOwnershipPrismaLike = {
  organizationDomain: {
    findUnique: (args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }) => Promise<{
      id: string;
      organizationId: string;
      deletedAt: Date | null;
      domain: string;
    } | null>;
  };
  organizationMember: {
    findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
  };
  user: {
    findUnique: (args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }) => Promise<{ role?: string | null } | null>;
  };
};

export type OwnedOrganizationDomain = {
  id: string;
  organizationId: string;
  deletedAt: Date | null;
  domain: string;
};

export async function assertDomainOwnership(
  prisma: DomainOwnershipPrismaLike,
  sessionUserId: string,
  organizationDomainId: string,
): Promise<OwnedOrganizationDomain> {
  const domain = await prisma.organizationDomain.findUnique({
    where: { id: organizationDomainId },
    select: { id: true, organizationId: true, deletedAt: true, domain: true },
  });

  if (!domain || domain.deletedAt) {
    throw new ApiError(404, "Organization domain not found");
  }

  if (sessionUserId) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: sessionUserId,
        organizationId: domain.organizationId,
        isActive: true,
        organization: { isActive: true, deletedAt: null },
      },
      select: { id: true },
    });

    if (!membership) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { role: true },
      });

      if (user?.role !== "SUPER_ADMIN") {
        throw new ApiError(403, "Forbidden");
      }
    }
  }

  return domain;
}
