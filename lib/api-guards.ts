import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export type SessionWithUser = Awaited<ReturnType<typeof auth>>;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown, fallback = "Internal server error") {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message || fallback : fallback },
    { status: 500 },
  );
}

export async function requireAuthSession() {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    throw new ApiError(401, "Unauthorized");
  }

  return session;
}

export function requireRole(session: SessionWithUser, roles: UserRole[]) {
  const role = session?.user?.role as UserRole | undefined;

  if (!role || !roles.includes(role)) {
    throw new ApiError(403, "Forbidden");
  }
}

export function isPrivilegedOrgRole(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

export async function getActiveMembership(userId: string, organizationId?: string | null) {
  return prisma.organizationMember.findFirst({
    where: {
      userId,
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      organization: {
        select: {
          id: true,
          slug: true,
          type: true,
          name: true,
          isActive: true,
        },
      },
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });
}

export async function requireOrgAccess(
  session: SessionWithUser,
  organizationId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER"],
) {
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (role === "SUPER_ADMIN") {
    return null;
  }

  if (!allowedRoles.includes(role)) {
    throw new ApiError(403, "Forbidden");
  }

  const membership = await getActiveMembership(userId, organizationId);
  if (!membership || !membership.organization?.isActive) {
    throw new ApiError(403, "Forbidden");
  }

  return membership;
}

export async function requireCurrentOrgAdminOrManager(session: SessionWithUser) {
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (role === "SUPER_ADMIN") {
    return null;
  }

  if (role !== "ADMIN" && role !== "MANAGER") {
    throw new ApiError(403, "Forbidden");
  }

  const membership = await getActiveMembership(userId, session.user.organizationId ?? undefined);
  if (!membership || !membership.organization?.isActive) {
    throw new ApiError(403, "Forbidden");
  }

  return membership;
}

export async function resolveManageableOrganizationId(session: SessionWithUser, requestedId: string) {
  const role = session?.user?.role as UserRole | undefined;

  if (role === "SUPER_ADMIN") {
    return requestedId;
  }

  const membership = await requireCurrentOrgAdminOrManager(session);
  if (!membership) {
    throw new ApiError(403, "Forbidden");
  }

  return membership.organizationId;
}

export function safeUploadFilename(originalName: string, fallbackExtension = "bin") {
  const name = originalName || `upload.${fallbackExtension}`;
  const extension = name.includes(".") ? name.split(".").pop() || fallbackExtension : fallbackExtension;
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || fallbackExtension;
  return `${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}
