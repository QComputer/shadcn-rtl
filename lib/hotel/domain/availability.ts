import {
  enumerateStayNights,
  validateOccupancyFitsRoom,
  validateStayWindow,
} from "@/lib/hotel/domain/stay-dates";
import { resolveNightlyRatesForWindow } from "@/lib/hotel/domain/rate";
import type {
  AvailabilityQuery,
  HotelProperty,
  InventoryNight,
  RatePlan,
  RoomType,
  RoomTypeAvailability,
  SeasonalRate,
  StayDate,
  UnavailableNight,
} from "@/lib/hotel/domain/types";

/**
 * Availability for hotel stays.
 *
 * A room type is sellable for a stay only if it is sellable on EVERY night of
 * `[checkIn, checkOut)`. A single unavailable night makes the whole stay
 * unsellable — a hotel cannot "half book" a night, and offering a partial
 * stay would misrepresent the product.
 *
 * Everything here is pure. Concurrency is deliberately NOT solved here; see
 * `planRoomNightAllocation` for the allocation rule and the architecture
 * document for the transactional boundary that must enforce it.
 */

function scopeMatchesRow(
  row: InventoryNight,
  roomTypeId: string,
  physicalRoomIds: readonly string[] | undefined,
): boolean {
  if (row.scope.kind === "ROOM_TYPE") return row.scope.roomTypeId === roomTypeId;
  if (!physicalRoomIds) return false;
  return physicalRoomIds.includes(row.scope.roomId);
}

function inventoryForNight(
  input: InventoryNightInput | undefined,
  date: StayDate,
): InventoryNight | undefined {
  if (!input) return undefined;
  // Aggregate room-type rows win when present; otherwise sum the physical rows
  // so callers may persist inventory at whichever granularity suits them.
  const roomTypeRow = input.nights.find(
    (row) => row.date === date && row.scope.kind === "ROOM_TYPE" && row.scope.roomTypeId === input.roomTypeId,
  );
  if (roomTypeRow) return roomTypeRow;

  const physicalRows = input.nights.filter(
    (row) => row.date === date && row.scope.kind === "PHYSICAL_ROOM" && scopeMatchesRow(row, input.roomTypeId, input.roomIds),
  );
  if (physicalRows.length === 0) return undefined;

  return {
    scope: { kind: "ROOM_TYPE", roomTypeId: input.roomTypeId },
    date,
    allotment: physicalRows.reduce((sum, row) => sum + row.allotment, 0),
    booked: physicalRows.reduce((sum, row) => sum + row.booked, 0),
    held: physicalRows.reduce((sum, row) => sum + row.held, 0),
    closedToArrival: physicalRows.some((row) => row.closedToArrival),
    closedToDeparture: physicalRows.some((row) => row.closedToDeparture),
  };
}

export function sellableUnitsForNight(night: InventoryNight | undefined): number {
  if (!night) return 0;
  if (night.closedToArrival && night.closedToDeparture) return 0;
  // Closed to arrival/departure blocks selling that night to a new stay, but
  // does not by itself invalidate rooms already occupied.
  if (night.closedToArrival || night.closedToDeparture) return 0;
  if (night.allotment === Infinity) return Infinity;
  return Math.max(0, night.allotment - night.booked - night.held);
}

export type InventoryNightInput = {
  readonly roomTypeId: string
  readonly nights: readonly InventoryNight[]
  /** Physical room ids for this room type, when inventory is stored per room. */
  readonly roomIds?: readonly string[]
};

export type RoomNightPlan = {
  readonly roomTypeId: string
  readonly nights: readonly StayDate[]
  readonly quantity: number
  readonly minAvailableUnits: number
};

export type AllocationPlan =
  | {
      readonly isAllocatable: true;
      readonly plans: readonly RoomNightPlan[];
      readonly blockingNights?: undefined;
    }
  | {
      readonly isAllocatable: false;
      readonly blockingNights: readonly UnavailableNight[];
      readonly plans?: undefined;
    };

/**
 * Plans how many units of each room type must be claimed per night.
 *
 * The claim quantity is identical across every night by construction: a guest
 * in room 204 must occupy room 204 on each night, so the planner works from
 * the MINIMUM availability across the stay, never the maximum.
 */
export function planRoomNightAllocation(input: {
  window: { checkIn: StayDate; checkOut: StayDate };
  requestedRoomTypeIds: readonly string[];
  inventoryByRoomType: readonly InventoryNightInput[];
}): AllocationPlan {
  const { window, requestedRoomTypeIds, inventoryByRoomType } = input;

  const windowCheck = validateStayWindow(window.checkIn, window.checkOut, { minNights: 0, maxNights: 0 });
  if (!windowCheck.isValid) {
    return {
      isAllocatable: false,
      blockingNights: [{ date: window.checkIn, reason: "NOT_SELLABLE", detail: windowCheck.reason }],
    };
  }

  const nights = enumerateStayNights(window.checkIn, window.checkOut);
  const plans: RoomNightPlan[] = [];
  const blockingNights: UnavailableNight[] = [];

  for (const roomTypeId of requestedRoomTypeIds) {
    const entry = inventoryByRoomType.find((candidate) => candidate.roomTypeId === roomTypeId);
    const perNight = nights.map((date) => sellableUnitsForNight(inventoryForNight(entry, date)));
    const minAvailableUnits = perNight.length > 0 ? Math.min(...perNight) : 0;

    if (minAvailableUnits < 1) {
      // Report every blocking night so guest and front desk see the same picture.
      nights.forEach((date, index) => {
        if ((perNight[index] ?? 0) < 1) {
          blockingNights.push({ date, reason: "SOLD_OUT", detail: roomTypeId });
        }
      });
      continue;
    }

    plans.push({ roomTypeId, nights, quantity: 1, minAvailableUnits });
  }

  if (blockingNights.length > 0) return { isAllocatable: false, blockingNights };
  return { isAllocatable: true, plans };
}

export type AvailabilitySearchInput = {
  readonly query: AvailabilityQuery
  readonly property: HotelProperty
  readonly roomTypes: readonly RoomType[]
  readonly ratePlans: readonly RatePlan[]
  readonly seasonalRates: readonly SeasonalRate[]
  readonly inventoryByRoomType: readonly InventoryNightInput[];
};

export type AvailabilitySearchResult = {
  readonly nights: readonly StayDate[]
  readonly nightCount: number
  readonly options: readonly RoomTypeAvailability[]
  readonly rejected: ReadonlyArray<{ roomTypeId: string; reason: string }>;
};

/**
 * Deterministic availability search.
 *
 * Ordering is stable: available before unavailable, then cheapest total, then
 * room-type name. The same input always yields the same order, which is what
 * makes the results testable and cacheable.
 */
export function searchAvailability(input: AvailabilitySearchInput): AvailabilitySearchResult {
  const { query, property, roomTypes, ratePlans, seasonalRates, inventoryByRoomType } = input;
  const nights = enumerateStayNights(query.window.checkIn, query.window.checkOut);
  const options: RoomTypeAvailability[] = [];
  const rejected: Array<{ roomTypeId: string; reason: string }> = [];

  const requested = query.roomTypeIds
    ? roomTypes.filter((roomType) => query.roomTypeIds?.includes(roomType.id))
    : roomTypes;

  for (const roomType of requested) {
    if (!roomType.isActive) {
      rejected.push({ roomTypeId: roomType.id, reason: "ROOM_TYPE_INACTIVE" });
      continue;
    }

    const occupancyCheck = validateOccupancyFitsRoom(query.occupancy, roomType.capacity, roomType.beds);
    if (!occupancyCheck.isValid) {
      rejected.push({ roomTypeId: roomType.id, reason: occupancyCheck.reason });
      continue;
    }

    if (query.requiredAmenities && query.requiredAmenities.length > 0) {
      const available = new Set(roomType.amenities.map((amenity) => amenity.key));
      const missing = query.requiredAmenities.filter((key) => !available.has(key));
      if (missing.length > 0) {
        rejected.push({ roomTypeId: roomType.id, reason: `MISSING_AMENITIES:${missing.join(",")}` });
        continue;
      }
    }

    const inventory = inventoryByRoomType.find((entry) => entry.roomTypeId === roomType.id);
    const nightlyUnits = nights.map((date) => sellableUnitsForNight(inventoryForNight(inventory, date)));
    const availableRoomCount = nightlyUnits.length > 0 ? Math.min(...nightlyUnits) : 0;
    const unavailableNights: UnavailableNight[] = nights
      .filter((_, index) => (nightlyUnits[index] ?? 0) < 1)
      .map((date) => ({ date, reason: "SOLD_OUT" as const }));

    const plans = ratePlans.filter(
      (plan) => plan.roomTypeId === roomType.id && (query.ratePlanId ? plan.id === query.ratePlanId : true),
    );
    if (plans.length === 0) {
      rejected.push({ roomTypeId: roomType.id, reason: "NO_RATE_PLAN" });
      continue;
    }

    let selected: RoomTypeAvailability | undefined;

    for (const plan of plans) {
      const resolution = resolveNightlyRatesForWindow({
        property,
        ratePlan: plan,
        seasonalRates,
        checkIn: query.window.checkIn,
        checkOut: query.window.checkOut,
      });
      if (!resolution.isResolved) continue;

      const averageNightlyRate = nights.length > 0 ? Math.round(resolution.total / nights.length) : resolution.total;
      if (query.maxNightlyRate !== undefined && averageNightlyRate > query.maxNightlyRate) continue;

      const candidate: RoomTypeAvailability = {
        roomType,
        ratePlan: plan,
        nights,
        nightlyRates: resolution.nights.map((night) => night.amount),
        totalRate: resolution.total,
        averageNightlyRate,
        availableRoomCount,
        isAvailable: unavailableNights.length === 0,
        unavailableNights,
      };

      if (!selected || candidate.totalRate < selected.totalRate) {
        selected = candidate;
      }
    }

    if (!selected) {
      rejected.push({ roomTypeId: roomType.id, reason: "NO_APPLICABLE_RATE_PLAN" });
      continue;
    }
    options.push(selected);
  }

  options.sort((left, right) => {
    if (left.isAvailable !== right.isAvailable) return left.isAvailable ? -1 : 1;
    if (left.totalRate !== right.totalRate) return left.totalRate - right.totalRate;
    return left.roomType.name.localeCompare(right.roomType.name);
  });

  return { nights, nightCount: nights.length, options, rejected };
}