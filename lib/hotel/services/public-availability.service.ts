import { searchAvailability } from "@/lib/hotel/domain/availability";
import type { PrismaClient } from "@prisma/client";
import { enumerateStayNights } from "@/lib/hotel/domain/stay-dates";
import type { AvailabilityQuery, RoomTypeAvailability } from "@/lib/hotel/domain/types";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import type { HotelAvailabilityRepository, HotelCatalogueRepository, TenantScope } from "@/lib/hotel/persistence/hotel-repositories";
import { isCurrentHotelPublicationApproved, resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import type { AvailabilitySearchInputDto } from "@/lib/hotel/validation/hotel-contracts";

export type PublicHotelReadRepositories = HotelCatalogueRepository & HotelAvailabilityRepository;
export type PublicHotelSearchInput = { readonly scope: TenantScope; readonly propertySlug: string; readonly query: AvailabilityQuery };
export type PublicHotelSearchResult = {
  readonly property: { id: string; slug: string; name: string; currency: string };
  readonly nights: readonly string[];
  readonly nightCount: number;
  readonly inventoryReserved: false;
  readonly options: readonly RoomTypeAvailability[];
  readonly rejected: ReadonlyArray<{ roomTypeId: string; reason: string }>;
};

/** Read-only search orchestration. It never claims inventory or creates booking records. */
export async function searchPublicHotelAvailability(input: PublicHotelSearchInput, repositories: PublicHotelReadRepositories = new PrismaHotelRepositories()): Promise<PublicHotelSearchResult | null> {
  const property = await repositories.findPropertyBySlug(input.scope, input.propertySlug);
  if (!property) return null;
  const roomTypes = await repositories.listRoomTypes(input.scope, property.id);
  const roomTypeIds = roomTypes.map((roomType) => roomType.id);
  const ratePlans = await repositories.listRatePlans(input.scope, property.id);
  const seasonalRates = await repositories.listSeasonalRates(input.scope, ratePlans.map((plan) => plan.id));
  const nights = enumerateStayNights(input.query.window.checkIn, input.query.window.checkOut);
  const persistedInventory = await repositories.getInventoryNights(input.scope, property.id, roomTypeIds, nights);
  const result = searchAvailability({
    query: input.query,
    property,
    roomTypes,
    ratePlans,
    seasonalRates,
    inventoryByRoomType: roomTypeIds.map((roomTypeId) => ({
      roomTypeId,
      nights: persistedInventory.filter((night) => night.roomTypeId === roomTypeId).map((night) => ({
        scope: { kind: "ROOM_TYPE" as const, roomTypeId },
        date: night.date,
        allotment: Math.max(0, night.allotment - night.outOfService),
        booked: night.booked,
        held: night.held,
        closedToArrival: night.closedToArrival,
        closedToDeparture: night.closedToDeparture,
      })),
    })),
  });
  return { property: { id: property.id, slug: property.slug, name: property.name, currency: property.currency }, nights: result.nights, nightCount: result.nightCount, inventoryReserved: false, options: result.options, rejected: result.rejected };
}

export function serializePublicAvailability(result: PublicHotelSearchResult) {
  return { ...result, options: result.options.map((option) => ({
    roomType: { id: option.roomType.id, slug: option.roomType.slug, name: option.roomType.name, capacity: option.roomType.capacity, amenities: option.roomType.amenities },
    ratePlan: { id: option.ratePlan.id, code: option.ratePlan.code, name: option.ratePlan.name, currency: option.ratePlan.currency, mealPlan: option.ratePlan.mealPlan },
    nights: option.nights, nightlyRates: option.nightlyRates.map(String), totalRate: String(option.totalRate), averageNightlyRate: String(option.averageNightlyRate), availableRoomCount: option.availableRoomCount, isAvailable: option.isAvailable, unavailableNights: option.unavailableNights,
  })) };
}

/** Host-bound publication-aware read. It filters every returned resource through the current revision approval. */
export async function searchPublishedHotelAvailability(host: string | null | undefined, input: AvailabilitySearchInputDto, repositories?: PublicHotelReadRepositories, db?: PrismaClient) {
  const client = db;
  const tenant = await resolveHotelTenantForHost(host, client);
  if (!tenant) return null;
  const readRepositories = repositories ?? (client ? new PrismaHotelRepositories(client) : new PrismaHotelRepositories());
  const property = await readRepositories.findPropertyBySlug({ organizationId: tenant.organizationId }, input.property);
  if (!property || !(await isCurrentHotelPublicationApproved({ organizationId: tenant.organizationId, propertyId: property.id, resourceType: "PROPERTY", resourceId: property.id, scope: "availability" }, client))) return null;
  const result = await searchPublicHotelAvailability({ scope: { organizationId: tenant.organizationId }, propertySlug: input.property, query: { propertyId: property.id, window: { checkIn: input.checkIn, checkOut: input.checkOut }, occupancy: input.occupancy, roomTypeIds: input.roomTypes, ratePlanId: input.ratePlan, requiredAmenities: input.amenities, maxNightlyRate: input.maxNightlyRate } }, readRepositories);
  if (!result) return null;
  const approvedOptions = [];
  for (const option of result.options) {
    const roomApproved = await isCurrentHotelPublicationApproved({ organizationId: tenant.organizationId, propertyId: property.id, resourceType: "ROOM_TYPE", resourceId: option.roomType.id, scope: "availability" }, client);
    const rateApproved = await isCurrentHotelPublicationApproved({ organizationId: tenant.organizationId, propertyId: property.id, resourceType: "RATE_PLAN", resourceId: option.ratePlan.id, scope: "availability" }, client);
    if (roomApproved && rateApproved) approvedOptions.push(option);
  }
  return { ...result, options: approvedOptions };
}
