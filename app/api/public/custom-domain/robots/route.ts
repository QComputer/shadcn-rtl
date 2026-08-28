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
    "Disallow: /shop/checkout",
    "Disallow: /shop/order/",
    "Disallow: /appointment/booking",
    "Disallow: /appointment/my-appointments",
    "Disallow: /fa/shop/checkout",
    "Disallow: /en/shop/checkout",
    "Disallow: /ar/shop/checkout",
    "Disallow: /fa/shop/order/",
    "Disallow: /en/shop/order/",
    "Disallow: /ar/shop/order/",
    "Disallow: /fa/appointment/booking",
    "Disallow: /en/appointment/booking",
    "Disallow: /ar/appointment/booking",
    "Disallow: /fa/appointment/my-appointments",
    "Disallow: /en/appointment/my-appointments",
    "Disallow: /ar/appointment/my-appointments",
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
