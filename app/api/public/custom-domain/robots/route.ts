import { NextResponse } from "next/server";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headerList = new Headers(request.headers);
  const tenantDomain = normalizeDomainHost(
    headerList.get("x-bazar-tenant-domain") || headerList.get("host") || "",
  );
  const baseUrl = headerList.get("x-bazar-tenant-public-base-url") || `https://${tenantDomain}`;

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /dashboard/",
    "Disallow: /checkout",
    "Disallow: /checkout/",
    "Disallow: /order/",
    "Disallow: /fa/checkout",
    "Disallow: /en/checkout",
    "Disallow: /ar/checkout",
    "Disallow: /fa/order/",
    "Disallow: /en/order/",
    "Disallow: /ar/order/",
    `Sitemap: ${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
    `Host: ${baseUrl.replace(/\/$/, "")}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
