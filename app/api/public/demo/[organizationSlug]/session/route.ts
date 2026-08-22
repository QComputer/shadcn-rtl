import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { createDemoSession } from "@/lib/demo-universe/demo-session.service";
import { DEMO_ROLE_CAPABILITIES, getDemoOrganization } from "@/lib/demo-universe/demo-organization";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-universe/demo-session-context";

const bodySchema = z.object({
  role: z.enum(["PLATFORM_ADMIN", "ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF", "DRIVER"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationSlug: string }> },
) {
  try {
    const { organizationSlug } = await params;
    const organization = await prisma.organization.findFirst({
      where: { slug: organizationSlug, isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true, locale: true },
    });
    if (!organization) throw new ApiError(404, "Demo organization not found");
    const { demo } = await getDemoOrganization(organization.id);
    if (!demo.enabled) throw new ApiError(404, "Demo organization not found");
    const body = bodySchema.parse(await request.json());
    const { token, session } = await createDemoSession({
      organizationId: organization.id,
      role: body.role,
    });
    const response = NextResponse.json({
      token,
      expiresAt: session.expiresAt,
      organization,
      role: body.role,
      internalRole: session.role,
      availableDemoCapabilities: DEMO_ROLE_CAPABILITIES[body.role],
    });
    response.cookies.set(DEMO_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
