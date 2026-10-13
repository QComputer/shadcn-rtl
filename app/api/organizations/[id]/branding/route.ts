import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess, requireSameOriginMutation } from "@/lib/api-guards";
import { organizationBrandingPatchSchema } from "@/lib/organization-branding-management";

async function authorize(organizationId: string) {
  const session = await requireAuthSession();
  await requireOrgAccess(session, organizationId, ["ADMIN"]);
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return { session, organization };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await authorize(id);
    const branding = await prisma.organizationBranding.findUnique({ where: { organizationId: id } });
    return NextResponse.json(branding ?? { organizationId: id }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return jsonError(error, "Unable to load organization branding");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id } = await params;
    const { session, organization } = await authorize(id);
    const data = organizationBrandingPatchSchema.parse(await request.json());
    const branding = await prisma.$transaction(async (tx) => {
      const previous = await tx.organizationBranding.findUnique({
        where: { organizationId: id },
        select: {
          organizationId: true,
          displayName: true,
          shortName: true,
          logoUrl: true,
          faviconUrl: true,
          appleTouchIconUrl: true,
          pwaIcon192Url: true,
          pwaIcon512Url: true,
          pwaMaskable192Url: true,
          pwaMaskable512Url: true,
          themeColor: true,
          backgroundColor: true,
        },
      });
      const updated = await tx.organizationBranding.upsert({
        where: { organizationId: id },
        create: { organizationId: id, ...data },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "OrganizationBranding",
          entityId: updated.id,
          description: "Updated organization PWA and browser branding",
          previousValue: previous ? JSON.parse(JSON.stringify(previous)) : undefined,
          newValue: JSON.parse(JSON.stringify(data)),
          userId: session.user.id,
          organizationId: id,
          organizationSlug: organization.slug,
          userAgent: request.headers.get("user-agent"),
        },
      });
      return updated;
    });
    return NextResponse.json(branding, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return jsonError(error, "Unable to update organization branding");
  }
}
