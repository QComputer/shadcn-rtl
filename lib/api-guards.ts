import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export type SessionWithUser = {
  user: {
    id: string;
    role: UserRole;
    name?: string | null;
    email?: string | null;
    locale?: string | null;
    isTeamMember?: boolean | null;
    theme?: string | null;
    organizationId?: string | null;
  };
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown, fallback = "Internal server error") {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message || fallback : fallback },
    { status: 500 },
  );
}

export async function requireAuthSession(): Promise<SessionWithUser> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.role) {
    throw new ApiError(401, "Unauthorized");
  }

  return {
    user: {
      id: user.id,
      role: user.role as UserRole,
      name: user.name ?? null,
      email: user.email ?? null,
      locale: user.locale ?? null,
      isTeamMember: user.isTeamMember ?? null,
      theme: user.theme ?? null,
      organizationId: user.organizationId ?? null,
    },
  };
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

export function getMembershipRole(membership: { role?: UserRole | null; user?: { role?: UserRole | null } } | null | undefined): UserRole | undefined {
  return (membership?.role || membership?.user?.role || undefined) as UserRole | undefined;
}

export async function getActiveMembership(
  userId: string,
  organizationId?: string | null,
) {
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

  const membership = await getActiveMembership(userId, organizationId);
  const membershipRole = getMembershipRole(membership);
  if (!membership || !membership.organization?.isActive || !membershipRole) {
    throw new ApiError(403, "Forbidden");
  }

  if (!allowedRoles.includes(membershipRole)) {
    throw new ApiError(403, "Forbidden");
  }

  return membership;
}

export async function requireCurrentOrgAdminOrManager(
  session: SessionWithUser,
) {
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (role === "SUPER_ADMIN") {
    return null;
  }

  const membership = await getActiveMembership(
    userId,
    session.user.organizationId ?? undefined,
  );
  const membershipRole = getMembershipRole(membership);
  if (!membership || !membership.organization?.isActive || !membershipRole) {
    throw new ApiError(403, "Forbidden");
  }

  if (membershipRole !== "ADMIN" && membershipRole !== "MANAGER") {
    throw new ApiError(403, "Forbidden");
  }

  return membership;
}

export async function resolveManageableOrganizationId(
  session: SessionWithUser,
  requestedId: string,
) {
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

export function safeUploadFilename(
  originalName: string,
  fallbackExtension = "bin",
) {
  const name = originalName || `upload.${fallbackExtension}`;
  const extension = name.includes(".")
    ? name.split(".").pop() || fallbackExtension
    : fallbackExtension;
  const safeExtension =
    extension
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12) || fallbackExtension;
  return `${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

export function statusForApiError(error: unknown) {
  if (error instanceof ApiError) return error.status;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("not found")) return 404;
    if (message.includes("unauthorized")) return 401;
    if (message.includes("forbidden")) return 403;
    if (
      message.includes("insufficient") ||
      message.includes("cannot") ||
      message.includes("invalid")
    )
      return 400;
  }
  return 500;
}

export async function requireOrgManageAccessById(
  session: SessionWithUser,
  organizationId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER"],
) {
  await requireOrgAccess(session, organizationId, allowedRoles);
}

export async function requireOrgManageAccessBySlug(
  session: SessionWithUser,
  organizationSlug: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER"],
) {
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true, isActive: true },
  });

  if (!organization || !organization.isActive) {
    throw new ApiError(404, "Organization not found");
  }

  await requireOrgAccess(session, organization.id, allowedRoles);
  return organization;
}

export async function requireCurrentOrganizationId(
  session: SessionWithUser,
  requestedOrganizationId?: string | null,
) {
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) throw new ApiError(401, "Unauthorized");

  if (role === "SUPER_ADMIN") {
    if (!requestedOrganizationId)
      throw new ApiError(400, "Organization ID is required");
    return requestedOrganizationId;
  }

  const membership = await requireCurrentOrgAdminOrManager(session);
  if (!membership) throw new ApiError(403, "Forbidden");

  if (
    requestedOrganizationId &&
    requestedOrganizationId !== membership.organizationId
  ) {
    throw new ApiError(403, "Forbidden");
  }

  return membership.organizationId;
}


export async function resolveOptionalUploadOrganizationId(
  session: SessionWithUser,
  requestedOrganizationId?: string | null,
  requestedOrganizationSlug?: string | null,
) {
  if (session.user.role === "SUPER_ADMIN") {
    if (requestedOrganizationId) {
      const organization = await prisma.organization.findFirst({
        where: { id: requestedOrganizationId, deletedAt: null },
        select: { id: true },
      });
      if (!organization) throw new ApiError(404, "Organization not found");
      return organization.id;
    }

    if (requestedOrganizationSlug) {
      const organization = await prisma.organization.findFirst({
        where: { slug: requestedOrganizationSlug, deletedAt: null },
        select: { id: true },
      });
      if (!organization) throw new ApiError(404, "Organization not found");
      return organization.id;
    }

    return null;
  }

  if (requestedOrganizationSlug) {
    const organization = await prisma.organization.findFirst({
      where: { slug: requestedOrganizationSlug, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!organization) throw new ApiError(404, "Organization not found");
    await requireOrgAccess(session, organization.id, ["ADMIN", "MANAGER", "STAFF"]);
    return organization.id;
  }

  const organizationId = await requireCurrentOrganizationId(
    session,
    requestedOrganizationId || session.user.organizationId || undefined,
  );
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF"]);
  return organizationId;
}

export async function requireImageManageAccess(
  session: SessionWithUser,
  imageId: string,
) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      filename: true,
      url: true,
      uploadedByUserId: true,
      organizationId: true,
    },
  });

  if (!image) throw new ApiError(404, "Image not found");

  if (session.user.role === "SUPER_ADMIN") {
    return image;
  }

  if (image.organizationId) {
    await requireOrgAccess(session, image.organizationId, ["ADMIN", "MANAGER"]);
    return image;
  }

  if (image.uploadedByUserId && image.uploadedByUserId === session.user.id) {
    requireRole(session, ["ADMIN", "MANAGER", "STAFF"]);
    return image;
  }

  throw new ApiError(403, "Forbidden");
}

export async function requireProductAccess(
  session: SessionWithUser,
  productId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER"],
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, organizationId: true },
  });

  if (!product) throw new ApiError(404, "Product not found");
  await requireOrgAccess(session, product.organizationId, allowedRoles);
  return product;
}

export async function requireProductCategoryAccess(
  session: SessionWithUser,
  categoryId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER"],
) {
  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, organizationId: true },
  });

  if (!category) throw new ApiError(404, "Product category not found");
  await requireOrgAccess(session, category.organizationId, allowedRoles);
  return category;
}

export async function requireServiceAccess(
  session: SessionWithUser,
  serviceId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER", "STAFF"],
) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true, organizationId: true, serviceProviderId: true },
  });

  if (!service) throw new ApiError(404, "Service not found");
  if (
    session?.user?.role === "STAFF" &&
    service.serviceProviderId !== session.user.id
  ) {
    throw new ApiError(403, "Forbidden");
  }
  await requireOrgAccess(session, service.organizationId, allowedRoles);
  return service;
}

export async function requireServiceCategoryAccess(
  session: SessionWithUser,
  categoryId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER", "STAFF"],
) {
  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, organizationId: true },
  });

  if (!category) throw new ApiError(404, "Service category not found");
  await requireOrgAccess(session, category.organizationId, allowedRoles);
  return category;
}

export async function requireOrderAccess(
  session: SessionWithUser,
  orderId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER", "STAFF", "DRIVER"],
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: {
      id: true,
      organizationSlug: true,
      customerId: true,
      driverId: true,
    },
  });

  if (!order) throw new ApiError(404, "Order not found");

  if (session?.user?.role === "CUSTOMER") {
    if (order.customerId !== session.user.id)
      throw new ApiError(403, "Forbidden");
    return order;
  }

  if (
    session?.user?.role === "DRIVER" &&
    order.driverId &&
    order.driverId !== session.user.id
  ) {
    throw new ApiError(403, "Forbidden");
  }

  await requireOrgManageAccessBySlug(
    session,
    order.organizationSlug,
    allowedRoles,
  );
  return order;
}

export async function requireAppointmentAccess(
  session: SessionWithUser,
  appointmentId: string,
  allowedRoles: UserRole[] = ["ADMIN", "MANAGER", "STAFF"],
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, deletedAt: null },
    select: {
      id: true,
      customerId: true,
      service: { select: { organizationId: true, serviceProviderId: true } },
    },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");

  if (session?.user?.role === "CUSTOMER") {
    if (appointment.customerId !== session.user.id)
      throw new ApiError(403, "Forbidden");
    return appointment;
  }

  if (
    session?.user?.role === "STAFF" &&
    appointment.service.serviceProviderId !== session.user.id
  ) {
    throw new ApiError(403, "Forbidden");
  }

  await requireOrgAccess(
    session,
    appointment.service.organizationId,
    allowedRoles,
  );
  return appointment;
}
