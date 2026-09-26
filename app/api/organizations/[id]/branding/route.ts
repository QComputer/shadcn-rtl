import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import { organizationBrandingPatchSchema } from "@/lib/organization-branding-management";
import { writeAuditLog } from "@/lib/audit-log";

async function authorize(session: Awaited<ReturnType<typeof requireAuthSession>>, organizationId: string) {
  await requireOrgAccess(session, organizationId, ["ADMIN"]);
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, slug: true, isActive: true } });
  if (!organization?.isActive) throw new Error("Organization not found");
  return organization;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await authorize(session, id);
    const branding = await prisma.organizationBranding.findUnique({ where: { organizationId: id } });
    return NextResponse.json(branding ?? { organizationId: id });
  } catch (error) {
    return jsonError(error, "Unable to load organization branding");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organization = await authorize(session, id);
    const data = organizationBrandingPatchSchema.parse(await request.json());
    const branding = await prisma.organizationBranding.upsert({
      where: { organizationId: id },
      create: { organizationId: id, ...data },
      update: data,
    });
    await writeAuditLog({ action: "UPDATE", entityType: "OrganizationBranding", entityId: branding.id, description: "Updated organization branding", userId: session.user.id, organizationId: id, organizationSlug: organization.slug, newValue: data });
    revalidatePath("/");
    revalidatePath("/shop");
    return NextResponse.json(branding);
  } catch (error) {
    return jsonError(error, "Unable to update organization branding");
  }
}
