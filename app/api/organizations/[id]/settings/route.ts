import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { updateOrganizationSettingsSchema, updatePreparationDefaultsSchema } from "@/lib/validators";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import {
  activePublicBusinessCapabilities,
  assertDefaultPublicCapabilityAllowed,
  isPublicBusinessCapability,
  writeDefaultPublicCapabilitySetting,
  type PublicBusinessCapabilityRecord,
} from "@/lib/organization-public-home";
import type { BusinessCapability } from "@/lib/business-capability-registry";

async function getOrganizationSlug(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  if (!org?.slug) {
    throw new ApiError(404, "Organization not found");
  }

  return org.slug;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const organizationSlug = await getOrganizationSlug(organizationId);

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationSlug },
      include: {
        organization: {
          include: { businessHours: true, paymentSettings: true, capabilities: true },
        },
      },
    });

    if (settings) {
      return NextResponse.json(settings);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { businessHours: true, paymentSettings: true, capabilities: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return NextResponse.json({
      id: null,
      organizationSlug,
      currency: "IRR",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      minimumOrderAmount: null,
      maximumOrderAmount: null,
      deliveryRadius: null,
      deliveryFee: null,
      enablePickup: true,
      enableDelivery: true,
      emailNotifications: true,
      smsNotifications: false,
      settings: null,
      organization,
    });
  } catch (error) {
    console.error("Error getting settings:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const organizationSlug = await getOrganizationSlug(organizationId);

    const body = await request.json();
    const data = updateOrganizationSettingsSchema.parse(body) as any;

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationSlug },
      update: data,
      create: { organizationSlug, ...data },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      description: "Updated organization settings",
      userId: session.user.id,
      organizationId,
      organizationSlug,
      newValue: data,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const organizationSlug = await getOrganizationSlug(organizationId);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const hasDefaultPublicCapability = Object.prototype.hasOwnProperty.call(body, "defaultPublicCapability");
    const hasPreparationMinutes = Object.prototype.hasOwnProperty.call(body, "defaultPreparationMinutes");
    let defaultPublicCapabilityForAudit: string | null | undefined;

    if (hasPreparationMinutes) {
      Object.assign(data, updatePreparationDefaultsSchema.parse(body));
    }

    if (hasDefaultPublicCapability) {
      const rawSelected = body.defaultPublicCapability;
      if (rawSelected !== null && !isPublicBusinessCapability(rawSelected)) {
        throw new ApiError(400, "Default public capability is not a public business capability");
      }
      const selected = rawSelected as BusinessCapability | null;

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          capabilities: { select: { key: true, status: true } },
          settings: { select: { settings: true } },
        },
      });
      if (!organization) throw new ApiError(404, "Organization not found");

      const activeCapabilities = activePublicBusinessCapabilities(
        organization.capabilities as PublicBusinessCapabilityRecord[],
      );
      assertDefaultPublicCapabilityAllowed({
        selected,
        activePublicCapabilities: activeCapabilities,
      });

      data.settings = writeDefaultPublicCapabilitySetting(
        organization.settings?.settings,
        selected,
      );
      defaultPublicCapabilityForAudit = selected;
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "No settings changes were provided");
    }

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationSlug },
      update: data,
      create: { organizationSlug, ...data },
    });
    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationPreparationSettings",
      entityId: settings.id,
      description: hasDefaultPublicCapability
        ? "Updated default public capability"
        : "Updated default order preparation time",
      userId: session.user.id,
      organizationId,
      organizationSlug,
      newValue: hasDefaultPublicCapability
        ? { defaultPublicCapability: defaultPublicCapabilityForAudit ?? null }
        : data,
    });
    revalidatePath("/");
    revalidatePath("/shop");
    for (const routeLocale of ["fa", "en", "ar"]) {
      revalidatePath(`/${routeLocale}/organization/${organizationSlug}`);
      revalidatePath(`/${routeLocale}/shop/${organizationSlug}`);
    }
    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error, "Error updating organization settings");
  }
}
