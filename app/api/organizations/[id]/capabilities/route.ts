import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant-context";
import { organizationCapabilityKeys, replaceOrganizationCapabilitiesSchema } from "@/lib/validators/tenant-platform";
import {
  activePublicBusinessCapabilities,
  getConfiguredDefaultPublicCapability,
  writeDefaultPublicCapabilitySetting,
} from "@/lib/organization-public-home";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF", "DRIVER"]);

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        capabilitiesInitializedAt: true,
        capabilities: { orderBy: { key: "asc" } },
      },
    });
    if (!organization) throw new ApiError(404, "Organization not found");
    return NextResponse.json(organization);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);

    const parsed = replaceOrganizationCapabilitiesSchema.safeParse({
      ...(await request.json()),
      organizationId: id,
    });
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    const requested = new Set(parsed.data.capabilities);
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.organizationCapability.findMany({ where: { organizationId: id } });
      for (const key of organizationCapabilityKeys) {
        const active = requested.has(key);
        await tx.organizationCapability.upsert({
          where: { organizationId_key: { organizationId: id, key } },
          create: {
            organizationId: id,
            key,
            status: active ? "ACTIVE" : "INACTIVE",
            enabledAt: active ? new Date() : null,
            disabledAt: active ? null : new Date(),
          },
          update: {
            status: active ? "ACTIVE" : "INACTIVE",
            enabledAt: active ? new Date() : undefined,
            disabledAt: active ? null : new Date(),
          },
        });
      }

      const organization = await tx.organization.update({
        where: { id },
        data: {
          capabilitiesInitializedAt: new Date(),
          ...(parsed.data.capabilities.find((key) => key === "SHOP" || key === "APPOINTMENT")
            ? { type: parsed.data.capabilities.find((key) => key === "SHOP" || key === "APPOINTMENT") }
            : {}),
        },
        select: { id: true, slug: true },
      });
      const activePublicCapabilities = activePublicBusinessCapabilities(
        organizationCapabilityKeys.map((key) => ({
          key,
          status: requested.has(key) ? "ACTIVE" : "INACTIVE",
        })),
      );
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationSlug: organization.slug },
        select: { id: true, settings: true },
      });
      const configuredDefault = getConfiguredDefaultPublicCapability(settings?.settings);
      if (settings && configuredDefault && !activePublicCapabilities.includes(configuredDefault)) {
        await tx.organizationSettings.update({
          where: { id: settings.id },
          data: {
            settings: writeDefaultPublicCapabilitySetting(settings.settings, null) as any,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "OrganizationCapabilities",
          entityId: id,
          description: "Explicit organization capabilities replaced",
          previousValue: previous.map(({ key, status }) => ({ key, status })),
          newValue: parsed.data.capabilities,
          userId: session.user.id,
          organizationId: organization.id,
          organizationSlug: organization.slug,
        },
      });
      return tx.organization.findUnique({
        where: { id },
        select: { id: true, type: true, capabilitiesInitializedAt: true, capabilities: { orderBy: { key: "asc" } } },
      });
    });

    const organizationSlug = await prisma.organization.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (organizationSlug?.slug) {
      revalidatePath("/");
      revalidatePath("/shop");
      for (const routeLocale of ["fa", "en", "ar"]) {
        revalidatePath(buildOrganizationRootPath({ locale: routeLocale, organizationSlug: organizationSlug.slug }));
        revalidatePath(buildOrganizationPublicPath({ locale: routeLocale, organizationSlug: organizationSlug.slug, surface: "shop" }));
        revalidatePath(buildOrganizationPublicPath({ locale: routeLocale, organizationSlug: organizationSlug.slug, surface: "appointment" }));
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
