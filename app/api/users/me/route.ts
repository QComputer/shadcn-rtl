import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { AccountSecurityError, changeAccountPassword } from "@/lib/security/password.server";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit-log";

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).nullable().optional(),
  lastName: z.string().trim().min(1).max(100).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  locale: z.enum(["fa", "en", "ar"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

function publicUserSelect() {
  return {
    id: true,
    name: true,
    role: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    avatar: true,
    isActive: true,
    isTeamMember: true,
    locale: true,
    theme: true,
    createdAt: true,
    updatedAt: true,
    following: {
      select: {
        id: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            isOpen: true,
          },
        },
      },
    },
    memberOf: {
      where: { isActive: true },
      orderBy: { joinedAt: "desc" as const },
      select: {
        id: true,
        role: true,
        isActive: true,
        organizationId: true,
        organizationSlug: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            isOpen: true,
          },
        },
      },
    },
  };
}

function normalizeProfilePayload(data: z.infer<typeof updateProfileSchema>) {
  return {
    ...(data.firstName !== undefined && { firstName: data.firstName?.trim() || null }),
    ...(data.lastName !== undefined && { lastName: data.lastName?.trim() || null }),
    ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
    ...(data.locale !== undefined && { locale: data.locale }),
    ...(data.theme !== undefined && { theme: data.theme }),
  };
}

export async function GET() {
  try {
    const session = await requireAuthSession();

    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null, isActive: true },
      select: publicUserSelect(),
    });

    if (!user) throw new ApiError(404, "User not found");

    return NextResponse.json({
      ...user,
      memberships: user.memberOf,
      memberOf: user.memberOf[0] ?? null,
    });
  } catch (error) {
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const data = updateProfileSchema.parse(body);
    const previous = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        locale: true,
        theme: true,
      },
    });

    if (!previous) throw new ApiError(404, "User not found");

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: normalizeProfilePayload(data),
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        locale: true,
        theme: true,
      },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "UserProfile",
      entityId: session.user.id,
      description: "User updated their own profile settings",
      previousValue: previous,
      newValue: user,
      userId: session.user.id,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  let actorId: string | undefined;
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    actorId = session.user.id;
    const clientIp = getClientIp(request.headers);
    const rateLimit = checkRateLimit({
      key: `password-change:${session.user.id}:${clientIp}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many password change attempts" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const data = changePasswordSchema.parse(body);

    await changeAccountPassword(session.user.id, data.currentPassword, data.newPassword);
    return NextResponse.json({ success: true, signInRequired: true, message: "رمز عبور تغییر کرد و تمام نشست‌های قبلی پایان یافتند. دوباره وارد شوید." });
  } catch (error) {
    if (error instanceof AccountSecurityError) {
      if (actorId) await writeAuditLog({ action: "UPDATE", entityType: "AccountSecurityRejected", entityId: actorId,
        userId: actorId, description: "Password change rejected; credential values omitted" });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    return jsonError(error, "Internal server error");
  }
}
