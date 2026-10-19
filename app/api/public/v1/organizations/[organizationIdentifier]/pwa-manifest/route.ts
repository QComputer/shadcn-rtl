import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { resolveAppBasePath } from "@/lib/app-base-path";
import { resolveTenantPwaBranding } from "@/lib/organization-branding";
import { buildOperationalAppManifest } from "@/lib/operational-app-manifest";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";
import { resolveTenantRetailStartPath, resolveTenantShopStartPath } from "@/lib/tenant-retail-pwa";

export const dynamic = "force-dynamic";

type Params = { organizationIdentifier: string };
type Locale = "fa" | "en" | "ar";

function validLocale(value: string | null, fallback: string | null): Locale {
  const candidate = value ?? fallback;
  return candidate === "en" || candidate === "ar" ? candidate : "fa";
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { organizationIdentifier } = await params;
  const url = new URL(request.url);
  const requestedEntry = url.searchParams.get("entry");
  if (requestedEntry !== null && requestedEntry !== "shop" && requestedEntry !== "retail") return unavailable();
  const entry = requestedEntry ?? "retail";
  const requestedLocale = url.searchParams.get("locale");
  if (requestedLocale !== null && requestedLocale !== "fa" && requestedLocale !== "en" && requestedLocale !== "ar") return unavailable();
  const requestHeaders = await headers();
  const context = await resolveTenantPwaRequestContext(requestHeaders).catch(() => ({ kind: "unknown" as const }));

  const organization = await prisma.organization.findFirst({
    where: {
      slug: organizationIdentifier,
      isActive: true,
      deletedAt: null,
      isPlatformOwner: false,
      capabilities: { some: { key: "SHOP", status: "ACTIVE" } },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      logo: true,
      locale: true,
      branding: {
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
          retailPresentationTheme: true,
        },
      },
    },
  });

  if (!organization || context.kind === "unknown" || (context.kind === "tenant" && context.organizationId !== organization.id)) {
    return unavailable();
  }

  const locale = validLocale(requestedLocale, organization.locale);
  const branding = resolveTenantPwaBranding({
    organizationId: organization.id,
    name: organization.name,
    logo: organization.logo,
    branding: organization.branding,
  });
  const hasActiveShopCapability = true;
  let tenantStartPath: string | null;

  if (context.kind === "tenant" && context.organizationId === organization.id) {
    tenantStartPath = resolveTenantShopStartPath({ locale, hasActiveShopCapability });
  } else if (entry === "shop") {
    tenantStartPath = resolveTenantShopStartPath({ locale, hasActiveShopCapability })
      ? `/${locale}/${encodeURIComponent(organization.slug)}/shop`
      : null;
  } else {
    tenantStartPath = resolveTenantRetailStartPath({
      locale,
      slug: organization.slug,
      hasActiveShopCapability,
      branding,
    });
  }

  if (!tenantStartPath) return unavailable();

  const manifest = buildOperationalAppManifest({
    basePath: resolveAppBasePath(),
    tenantBranding: branding,
    tenantStartPath,
    locale,
  });
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Host",
    },
  });
}

function unavailable() {
  return NextResponse.json({ error: "Store manifest is unavailable." }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Host" },
  });
}
