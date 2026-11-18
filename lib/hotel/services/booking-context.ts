import "server-only";
import type { PrismaClient, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";

export type HotelBookingActor = { userId: string; role: string; organizationId?: string | null; customerContextVerified?: boolean };
export const HOTEL_BOOKING_BASE_PROPERTY_SELECT = {
  id: true,
  organizationId: true,
  organizationSlug: true,
  slug: true,
  name: true,
  description: true,
  localizedContent: true,
  timezone: true,
  currency: true,
  checkInTime: true,
  checkOutTime: true,
  minStayNights: true,
  maxStayNights: true,
  addressLine1: true,
  city: true,
  latitude: true,
  longitude: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;
export type HotelBookingBaseProperty = {
  id: string;
  organizationId: string;
  organizationSlug: string;
  slug: string;
  name: string;
  description: string | null;
  localizedContent: unknown;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  minStayNights: number;
  maxStayNights: number;
  addressLine1: string | null;
  city: string | null;
  latitude: unknown;
  longitude: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Runtime gates belong to each caller; persisted tenant authority is shared. */
export async function authorizeHotelBookingActor(
  db: PrismaClient,
  actor: HotelBookingActor,
  organizationId: string,
  propertyId: string,
): Promise<HotelBookingBaseProperty> {
  const deny = (message = "Forbidden"): never => {
    throw new ApiError(403, message);
  };
  const user = await db.user.findFirst({
    where: { id: actor.userId, role: actor.role as UserRole, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const property = await db.hotelProperty.findFirst({
    where: {
      id: propertyId,
      organizationId,
      isActive: true,
      deletedAt: null,
      organization: {
        isActive: true,
        deletedAt: null,
        vertical: "HOTEL",
        capabilities: { some: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null } } },
      },
    },
    select: HOTEL_BOOKING_BASE_PROPERTY_SELECT,
  });
  if (!user || !property || !["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "CUSTOMER"].includes(actor.role)) deny();
  if (actor.role !== "SUPER_ADMIN" && actor.organizationId !== organizationId) deny();
  if (actor.role === "CUSTOMER") {
    if (!actor.customerContextVerified || !await db.customerClubMembership.findFirst({ where: { organizationId, customerId: actor.userId, status: "ACTIVE" } })) {
      deny("Customer context required");
    }
  } else if (actor.role !== "SUPER_ADMIN" && !await db.organizationMember.findFirst({ where: { organizationId, userId: actor.userId, isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF"] } } })) {
    deny();
  }
  return property as HotelBookingBaseProperty;
}
