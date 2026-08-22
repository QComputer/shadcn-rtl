import "server-only";

import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { verifyDemoSession } from "@/lib/demo-universe/demo-session.service";
import type { DemoRole } from "@/lib/demo-universe/demo-organization";

export const DEMO_SESSION_COOKIE = "bazarbaaz_demo_session";

function readBearerToken(value: string | null) {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function resolveDemoSessionContext(input: {
  request: NextRequest | Request;
  allowedRoles?: UserRole[];
  allowedDemoRoles?: DemoRole[];
  organizationSlug?: string | null;
}) {
  const headers = input.request.headers;
  const requestWithCookies = input.request as NextRequest;
  const token =
    readBearerToken(headers.get("authorization")) ??
    headers.get("x-demo-session-token") ??
    requestWithCookies.cookies?.get(DEMO_SESSION_COOKIE)?.value;
  if (!token) throw new ApiError(401, "Demo session token is required");

  const organizationSlug = input.organizationSlug ?? headers.get("x-demo-organization-slug");
  if (!organizationSlug) throw new ApiError(400, "Demo organization slug is required");

  const organization = await prisma.organization.findFirst({
    where: { slug: organizationSlug, isActive: true, deletedAt: null },
    select: { id: true, slug: true, name: true, locale: true },
  });
  if (!organization) throw new ApiError(404, "Demo organization not found");

  const session = await verifyDemoSession({
    organizationId: organization.id,
    token,
    allowedRoles: input.allowedRoles,
    allowedDemoRoles: input.allowedDemoRoles,
  });

  return {
    token,
    session,
    organization,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    role: session.role,
    demoRole: session.demoRole ?? session.role,
  };
}
