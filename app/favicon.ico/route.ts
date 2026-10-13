import { NextRequest, NextResponse } from "next/server";
import { resolveAppBasePath } from "@/lib/app-base-path";
import { resolvePlatformFallbackBranding } from "@/lib/organization-branding";
import { safeTenantAssetUrl } from "@/lib/operational-app-manifest";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await resolveTenantPwaRequestContext(request.headers).catch(() => ({ kind: "unknown" as const }));
  const basePath = resolveAppBasePath();
  const configuredUrl = context.kind === "platform"
    ? resolvePlatformFallbackBranding().favicon
    : context.kind === "tenant"
      ? context.branding.favicon || context.branding.pwaIcons.icon192 || context.branding.logo
      : null;
  const destination = safeTenantAssetUrl(configuredUrl, basePath);

  if (!destination) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return NextResponse.redirect(new URL(destination, request.url), {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
