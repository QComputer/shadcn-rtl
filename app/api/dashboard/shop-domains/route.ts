import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import {
  createShopDomainSchema,
  deleteShopDomainSchema,
  displayDomainInput,
  requireSuperAdmin,
  updateShopDomainSchema,
  validateShopDomainInput,
} from "@/lib/shop-domain-admin";

function parseError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
  }

  return jsonError(error, "Failed to manage shop domains");
}

async function assertShopOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      type: "SHOP",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      type: true,
    },
  });

  if (!organization) {
    throw new ApiError(404, "Shop organization not found");
  }

  return organization;
}

async function assertDomainAvailable(normalizedDomain: string, currentDomainId?: string) {
  const existing = await prisma.organizationDomain.findUnique({
    where: { normalizedDomain },
    select: { id: true },
  });

  if (existing && existing.id !== currentDomainId) {
    throw new ApiError(409, "Custom domain already exists");
  }
}

export async function GET() {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);

    const [shops, domains] = await Promise.all([
      prisma.organization.findMany({
        where: {
          type: "SHOP",
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          locale: true,
          domains: {
            select: {
              id: true,
              normalizedDomain: true,
              isPrimary: true,
              status: true,
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
      prisma.organizationDomain.findMany({
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    return NextResponse.json({ shops, domains });
  } catch (error) {
    return jsonError(error, "Failed to load shop domains");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);

    const body = createShopDomainSchema.parse(await request.json());
    const normalizedDomain = validateShopDomainInput(body.domain);
    await assertShopOrganization(body.organizationId);
    await assertDomainAvailable(normalizedDomain);

    const domain = await prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.organizationDomain.updateMany({
          where: { organizationId: body.organizationId },
          data: { isPrimary: false },
        });
      }

      return tx.organizationDomain.create({
        data: {
          organizationId: body.organizationId,
          domain: displayDomainInput(body.domain),
          normalizedDomain,
          status: body.status,
          isPrimary: body.isPrimary,
          verifiedAt: body.status === "ACTIVE" ? new Date() : null,
          lastCheckedAt: body.status === "ACTIVE" ? new Date() : null,
          failureReason: body.failureReason || null,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              isActive: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ domain }, { status: 201 });
  } catch (error) {
    return parseError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);

    const body = updateShopDomainSchema.parse(await request.json());
    const existing = await prisma.organizationDomain.findUnique({
      where: { id: body.id },
      select: {
        id: true,
        organizationId: true,
        normalizedDomain: true,
        status: true,
        isPrimary: true,
      },
    });

    if (!existing) {
      throw new ApiError(404, "Custom domain not found");
    }

    const targetOrganizationId = body.organizationId || existing.organizationId;
    await assertShopOrganization(targetOrganizationId);

    const normalizedDomain = body.domain ? validateShopDomainInput(body.domain) : existing.normalizedDomain;
    if (body.domain) {
      await assertDomainAvailable(normalizedDomain, existing.id);
    }

    const nextStatus = body.status || existing.status;

    const domain = await prisma.$transaction(async (tx) => {
      const shouldRemainPrimary = body.isPrimary ?? existing.isPrimary;
      if (shouldRemainPrimary) {
        await tx.organizationDomain.updateMany({
          where: { organizationId: targetOrganizationId, NOT: { id: existing.id } },
          data: { isPrimary: false },
        });
      }

      return tx.organizationDomain.update({
        where: { id: existing.id },
        data: {
          organizationId: targetOrganizationId,
          ...(body.domain
            ? {
                domain: displayDomainInput(body.domain),
                normalizedDomain,
              }
            : {}),
          ...(body.status
            ? {
                status: body.status,
                verifiedAt: body.status === "ACTIVE" ? new Date() : null,
                lastCheckedAt: new Date(),
              }
            : {}),
          ...(typeof body.isPrimary === "boolean" ? { isPrimary: body.isPrimary } : {}),
          ...(body.failureReason !== undefined ? { failureReason: body.failureReason || null } : {}),
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              isActive: true,
            },
          },
        },
      });
    });

    if (nextStatus !== "FAILED" && body.failureReason === undefined && domain.failureReason) {
      await prisma.organizationDomain.update({
        where: { id: domain.id },
        data: { failureReason: null },
      });
    }

    return NextResponse.json({ domain });
  } catch (error) {
    return parseError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);

    const body = deleteShopDomainSchema.parse(await request.json());
    const existing = await prisma.organizationDomain.findUnique({
      where: { id: body.id },
      select: { id: true },
    });

    if (!existing) {
      throw new ApiError(404, "Custom domain not found");
    }

    await prisma.organizationDomain.delete({ where: { id: body.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return parseError(error);
  }
}
