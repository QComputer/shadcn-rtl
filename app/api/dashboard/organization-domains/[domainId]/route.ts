import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import { customDomainLocales } from "@/lib/custom-domain-routing";
import { revalidatePath } from "next/cache";

const updateDomainStatusSchema = z.object({
  status: z.enum(["DISABLED"]),
});

function getClientMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}

function parseError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
  }
  return jsonError(error, "Failed to update domain status");
}

function revalidateOrganizationPublicPaths(organization: { slug: string; type: string }) {
  const section = organization.type === "APPOINTMENT" ? "appointment" : "shop";
  revalidatePath(`/${section}/${organization.slug}`);

  for (const locale of customDomainLocales) {
    revalidatePath(`/${locale}/${section}/${organization.slug}`);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { domainId } = await params;
    const body = updateDomainStatusSchema.parse(await request.json());

    const existing = await prisma.organizationDomain.findUnique({
      where: { id: domainId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!existing) {
      throw new ApiError(404, "Domain not found");
    }

    await requireOrgAccess(session, existing.organizationId, ["ADMIN", "MANAGER"]);

    const updated = await prisma.organizationDomain.update({
      where: { id: domainId },
      data: {
        status: body.status,
        isPrimary: false,
        disabledAt: new Date(),
        lastCheckedAt: new Date(),
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, type: true, isActive: true },
        },
      },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationDomain",
      entityId: updated.id,
      description: `Domain status set to ${body.status} for ${updated.normalizedDomain}.`,
      newValue: { status: body.status, isPrimary: updated.isPrimary },
      userId: session.user.id,
      organizationId: updated.organizationId,
      ...getClientMeta(request),
    });

    try {
      revalidateOrganizationPublicPaths(updated.organization);
    } catch {
      // Cache revalidation must not break domain updates.
    }

    return NextResponse.json({ domain: updated });
  } catch (error) {
    return parseError(error);
  }
}
