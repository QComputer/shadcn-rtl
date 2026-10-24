import { NextRequest, NextResponse } from "next/server";
import { getActivePrimaryOrganizationDomain } from "@/lib/domains/primary-domain.server";

export async function GET(request: NextRequest) {
  const secret = process.env.CUSTOM_DOMAIN_RESOLVER_SECRET || process.env.INTERNAL_API_SECRET || "";
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json({ error: "Custom-domain resolver secret is not configured" }, { status: 503 });
  }
  if (secret && request.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug || !/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) {
    return NextResponse.json({ error: "Invalid organization slug" }, { status: 400 });
  }
  const domain = await getActivePrimaryOrganizationDomain(slug);
  return domain
    ? NextResponse.json({ domain, slug }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "Primary domain not found" }, { status: 404 });
}
