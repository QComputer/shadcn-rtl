import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { updateOrganizationSettingsSchema, updatePreparationDefaultsSchema } from "@/lib/validators";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation, resolveManageableOrganizationId } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import {
  activePublicBusinessCapabilities,
  assertDefaultPublicCapabilityAllowed,
  assertPublicHomeModeAllowed,
  isPublicBusinessCapability,
  type PublicHomeMode,
  type PublicBusinessCapabilityRecord,
} from "@/lib/organization-public-home";
import type { BusinessCapability } from "@/lib/business-capability-registry";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";

const RETAIL_HERO_PUBLICATION_KEY = "retailHeroPublication";

function omitRetailHeroPublication(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const rest = { ...value as Record<string, unknown> };
  delete rest[RETAIL_HERO_PUBLICATION_KEY];
  return rest;
}

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

    const requestedSettings = Object.prototype.hasOwnProperty.call(data, "settings")
      ? omitRetailHeroPublication(data.settings)
      : undefined;
    const scalarData = { ...data };
    delete scalarData.settings;
    const settings = await prisma.$transaction(async (tx) => {
      await tx.organizationSettings.upsert({
        where: { organizationSlug },
        update: scalarData,
        create: { organizationSlug, ...scalarData },
      });

      if (requestedSettings !== undefined) {
        const incoming = requestedSettings && typeof requestedSettings === "object" && !Array.isArray(requestedSettings)
          ? requestedSettings
          : {};
        await tx.$executeRaw`UPDATE "OrganizationSettings"
          SET settings =
            (${JSON.stringify(incoming)}::jsonb - ${RETAIL_HERO_PUBLICATION_KEY})
            || (CASE WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)) = 'object'
                      AND COALESCE(settings, '{}'::jsonb) ? ${RETAIL_HERO_PUBLICATION_KEY}
              THEN jsonb_build_object(${RETAIL_HERO_PUBLICATION_KEY}, COALESCE(settings, '{}'::jsonb)->${RETAIL_HERO_PUBLICATION_KEY})
              ELSE '{}'::jsonb END),
            "updatedAt" = NOW()
          WHERE "organizationSlug" = ${organizationSlug}`;
      }

      return tx.organizationSettings.findUniqueOrThrow({ where: { organizationSlug } });
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      description: "Updated organization settings",
      userId: session.user.id,
      organizationId,
      organizationSlug,
      newValue: { ...data, ...(requestedSettings !== undefined ? { settings: requestedSettings } : {}) },
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
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const organizationSlug = await getOrganizationSlug(organizationId);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const hasDefaultPublicCapability = Object.prototype.hasOwnProperty.call(body, "defaultPublicCapability");
    const hasPublicHomeMode = Object.prototype.hasOwnProperty.call(body, "publicHomeMode");
    const hasPreparationMinutes = Object.prototype.hasOwnProperty.call(body, "defaultPreparationMinutes");
    let defaultPublicCapabilityForAudit: string | null | undefined;

    if (hasPreparationMinutes) {
      Object.assign(data, updatePreparationDefaultsSchema.parse(body));
    }

    if (hasPublicHomeMode) {
      const mode = body.publicHomeMode;
      if (!["AUTO", "SHOP", "APPOINTMENT", "BRAND", "VISITOR_CHOICE"].includes(mode)) {
        throw new ApiError(400, "Invalid homepage mode");
      }
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          capabilities: { select: { key: true, status: true } },
          settings: { select: { brandLandingProvider: true } },
        },
      });
      if (!organization) throw new ApiError(404, "Organization not found");
      try {
        assertPublicHomeModeAllowed({
          mode: mode as PublicHomeMode,
          activePublicCapabilities: activePublicBusinessCapabilities(
            organization.capabilities as PublicBusinessCapabilityRecord[],
          ),
          brandLandingProvider: organization.settings?.brandLandingProvider ?? null,
        });
      } catch {
        throw new ApiError(400, "Homepage mode is not available for this organization");
      }
      data.publicHomeMode = mode;
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

      defaultPublicCapabilityForAudit = selected;
    }

    if (Object.keys(data).length === 0 && !hasDefaultPublicCapability) {
      throw new ApiError(400, "No settings changes were provided");
    }

    const scalarData = { ...data };
    delete scalarData.settings;
    const settings = await prisma.$transaction(async (tx) => {
      await tx.organizationSettings.upsert({
        where: { organizationSlug },
        update: scalarData,
        create: { organizationSlug, ...scalarData },
      });
      if (hasDefaultPublicCapability) {
        if (defaultPublicCapabilityForAudit) {
          await tx.$executeRaw`UPDATE "OrganizationSettings"
            SET settings = (CASE WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)) = 'object' THEN COALESCE(settings, '{}'::jsonb) ELSE '{}'::jsonb END)
              || jsonb_build_object('defaultPublicCapability', ${defaultPublicCapabilityForAudit}::text), "updatedAt" = NOW()
            WHERE "organizationSlug" = ${organizationSlug}`;
        } else {
          await tx.$executeRaw`UPDATE "OrganizationSettings"
            SET settings = NULLIF(
              CASE WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)) = 'object'
                THEN COALESCE(settings, '{}'::jsonb) - 'defaultPublicCapability'
                ELSE '{}'::jsonb END,
              '{}'::jsonb
            ), "updatedAt" = NOW()
            WHERE "organizationSlug" = ${organizationSlug}`;
        }
      }
      return tx.organizationSettings.findUniqueOrThrow({ where: { organizationSlug } });
    });
    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationPreparationSettings",
      entityId: settings.id,
      description: hasPublicHomeMode
        ? "Updated business homepage mode"
        : hasDefaultPublicCapability
        ? "Updated default public capability"
        : "Updated default order preparation time",
      userId: session.user.id,
      organizationId,
      organizationSlug,
      newValue: hasPublicHomeMode
        ? { publicHomeMode: data.publicHomeMode }
        : hasDefaultPublicCapability
        ? { defaultPublicCapability: defaultPublicCapabilityForAudit ?? null }
        : data,
    });
    revalidatePath("/");
    revalidatePath("/shop");
    for (const routeLocale of ["fa", "en", "ar"]) {
      revalidatePath(buildOrganizationRootPath({ locale: routeLocale, organizationSlug }));
      revalidatePath(buildOrganizationPublicPath({ locale: routeLocale, organizationSlug, surface: "shop" }));
      revalidatePath(buildOrganizationPublicPath({ locale: routeLocale, organizationSlug, surface: "appointment" }));
    }
    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error, "Error updating organization settings");
  }
}
