/**
 * Hotel persistence contracts (H2).
 *
 * These are interfaces only. No Prisma model is created in H2 — the concrete
 * PostgreSQL design lives in `docs/HOTEL-PERSISTENCE-DESIGN.md` and requires
 * separate migration authorization.
 *
 * Design rules:
 *  - Domain rules stay in `lib/hotel/domain/**` and never import these.
 *  - Every read and write is organization-scoped. `organizationId` is a
 *    required argument on every method rather than an ambient field, so a
 *    missing scope is a compile error rather than a data leak.
 *  - Money crosses this boundary as integer Toman only.
 *  - The only method that may mutate inventory is `tryClaimInventory`, and it
 *    must be atomic. An availability read followed by a write is forbidden:
 *    that pattern is the double-booking bug.
 */

import type {
  AvailabilityQuery,
  CancellationPolicySet,
  HotelProperty,
  HotelAmenityKey,
  PhysicalRoom,
  RatePlan,
  Reservation,
  ReservationCancellationPolicySnapshot,
  ReservationGuest,
  RoomType,
  SeasonalRate,
  StayDate,
  TomanAmount,
} from "@/lib/hotel/domain/types";

export type TenantScope = {
  readonly organizationId: string
};

/** A per-night inventory row, flattened for persistence. */
export type PersistedInventoryNight = {
  readonly propertyId: string
  readonly date: StayDate
  readonly roomTypeId: string
  /** Rooms sellable that night, before bookings and holds. */
  readonly allotment: number
  readonly booked: number
  readonly held: number
  readonly outOfService: number
  readonly closedToArrival: boolean
  readonly closedToDeparture: boolean
};

export type InventoryClaim = {
  readonly date: StayDate
  readonly roomTypeId: string
  /** Physical room assigned, when the property assigns rooms explicitly. */
  readonly roomId?: string
};

export type InventoryClaimResult =
  | {
      readonly isClaimed: true;
      readonly claims: readonly InventoryClaim[];
      readonly reason?: undefined;
      readonly failedDates?: undefined;
    }
  | {
      readonly isClaimed: false;
      readonly reason: "NO_INVENTORY" | "CONFLICT" | "OUT_OF_SERVICE" | "TENANT_MISMATCH";
      /** Nights that failed, so the caller can explain the failure. */
      readonly failedDates: readonly StayDate[];
      readonly claims?: undefined;
    };

export type HoldRecord = {
  readonly id: string
  readonly organizationId: string
  readonly propertyId: string
  readonly reference: string
  readonly roomTypeId: string
  readonly checkIn: StayDate
  readonly checkOut: StayDate
  readonly nights: readonly StayDate[]
  readonly quantity: number
  readonly expiresAt: Date
  readonly status: "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED"
  readonly createdAt: Date
};

export type ReservationRecord = {
  readonly id: string
  readonly organizationId: string
  readonly propertyId: string
  readonly reference: string
  /** Client retry key, scoped to the organization. */
  readonly idempotencyKey?: string
  readonly roomTypeId: string
  readonly ratePlanId: string
  readonly status: Reservation["status"]
  readonly checkIn: StayDate
  readonly checkOut: StayDate
  readonly nights: readonly StayDate[]
  readonly guests: readonly ReservationGuest[]
  readonly nightlyRates: readonly TomanAmount[]
  readonly totalAmount: TomanAmount
  readonly currency: string
  readonly cancellationPolicySnapshot: ReservationCancellationPolicySnapshot | null
  readonly paymentRequestPublicId?: string
  readonly holdId?: string
  readonly createdAt: Date
  readonly updatedAt: Date
};

export type PaymentSubjectRecord = {
  /** Opaque public id of the `PaymentRequest`. Never a raw provider id. */
  readonly paymentRequestPublicId: string
  readonly organizationId: string
  readonly purpose: "ORDER_PAYMENT" | "RESERVATION_DEPOSIT" | "RESERVATION_BALANCE" | "RESERVATION_REFUND"
  readonly amountToman: bigint
  readonly status: "CREATED" | "AWAITING_CUSTOMER" | "PENDING_VERIFICATION" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED"
  readonly reservationId?: string
  readonly paidAt?: Date
};

export type HotelCatalogue = {
  readonly property: HotelProperty
  readonly roomTypes: readonly RoomType[]
  readonly physicalRooms: readonly PhysicalRoom[]
  readonly ratePlans: readonly RatePlan[]
  readonly seasonalRates: readonly SeasonalRate[]
  readonly cancellationPolicies: readonly CancellationPolicySet[]
  readonly amenities: readonly HotelAmenityKey[]
};

export interface HotelCatalogueRepository {
  findPropertyBySlug(scope: TenantScope, slug: string): Promise<HotelProperty | null>;
  listRoomTypes(scope: TenantScope, propertyId: string): Promise<readonly RoomType[]>;
  findRoomTypeBySlug(scope: TenantScope, propertyId: string, slug: string): Promise<RoomType | null>;
  listPhysicalRooms(scope: TenantScope, propertyId: string): Promise<readonly PhysicalRoom[]>;
  listRatePlans(scope: TenantScope, propertyId: string): Promise<readonly RatePlan[]>;
  listSeasonalRates(scope: TenantScope, ratePlanIds: readonly string[]): Promise<readonly SeasonalRate[]>;
  listCancellationPolicies(scope: TenantScope, propertyId: string): Promise<readonly CancellationPolicySet[]>;
  resolveRatePlanCancellationPolicy(scope: TenantScope, ratePlanId: string): Promise<ReservationCancellationPolicySnapshot | null>;
}

export interface HotelAvailabilityRepository {
  /**
   * Returns sellable units per night. Implementations MUST include committed
   * bookings, live holds and out-of-service rooms.
   */
  getInventoryNights(
    scope: TenantScope,
    propertyId: string,
    roomTypeIds: readonly string[],
    nights: readonly StayDate[],
  ): Promise<readonly PersistedInventoryNight[]>;
}

export interface HotelBookingRepository {
  findAnonymousHoldReplay?(input: { scope: TenantScope; idempotencyKey: string; requestFingerprint: string; propertySlug: string; roomTypeSlug: string; ratePlanCode: string }): Promise<{ isReplay: true; result: { holdId: string; reference: string; status: string; expiresAt: Date; currency: string; totalAmount: number; nightlyRates: readonly number[]; policySnapshot: unknown; inventoryReserved: true } } | { isConflict: true } | null>
  createAnonymousHoldAtomically?(input: {
    scope: TenantScope
    propertyId: string
    roomTypeId: string
    ratePlanId: string
    idempotencyKey: string
    requestFingerprint: string
    query: AvailabilityQuery
    holdId: string
    reference: string
    now: Date
  }): Promise<{ isHeld: true; holdId: string; reference: string; expiresAt: Date; totalAmount: number; currency: string; nightlyRates: readonly number[]; policySnapshot: ReservationCancellationPolicySnapshot | null; replay?: boolean } | { isHeld: false; reason: string; replay?: boolean }>
  /**
   * Atomically claims one unit of `roomTypeId` for EVERY supplied night, or
   * claims nothing at all.
   *
   * This must be a single serializable transaction using a conditional write
   * (`UPDATE ... WHERE allotment - booked - held - outOfService >= 1`) and must
   * assert the affected row count per night. A read-then-write implementation
   * is not an acceptable substitute.
   */
  claimInventoryForHold(input: {
    scope: TenantScope
    propertyId: string
    roomTypeId: string
    nights: readonly StayDate[]
    quantity: number
    holdId: string
    expiresAt: Date
    now: Date
  }): Promise<InventoryClaimResult>;

  /**
   * Authoritative H3-C1 boundary: inventory claim and hold persistence commit
   * together or neither is visible. Implementations that support PostgreSQL
   * MUST implement this method. Keeping it required prevents production
   * booking code from silently falling back to the legacy two-step sequence.
   */
  claimInventoryAndCreateHold(input: {
    scope: TenantScope
    propertyId: string
    roomTypeId: string
    nights: readonly StayDate[]
    quantity: number
    hold: Omit<HoldRecord, "id"> & { id: string }
    now: Date
  }): Promise<InventoryClaimResult & { readonly hold?: HoldRecord }>;

  createHold(input: Omit<HoldRecord, "id"> & { id: string }): Promise<HoldRecord>;
  findHold(scope: TenantScope, holdId: string): Promise<HoldRecord | null>;
  findHoldByReference(scope: TenantScope, reference: string): Promise<HoldRecord | null>;
  /**
   * Lists ACTIVE holds whose expiry is at or before `now`. Required by the
   * sweeper so inventory can never be locked up by an abandoned checkout.
   * Must be scoped and paginated.
   */
  listExpiredActiveHolds(
    scope: TenantScope,
    input: { propertyId?: string; now: Date; limit: number },
  ): Promise<readonly HoldRecord[]>;
  releaseHold(scope: TenantScope, holdId: string, now: Date): Promise<HoldReleaseResult>;

  createReservation(record: ReservationRecord): Promise<ReservationRecord>;
  findReservationByReference(scope: TenantScope, reference: string): Promise<ReservationRecord | null>;
  findReservation(scope: TenantScope, reservationId: string): Promise<ReservationRecord | null>;

  /**
   * Compare-and-set on status. Returns `CONFLICT` when another writer already
   * moved the row, which is what makes transitions idempotent under retry.
   */
  updateReservationStatus(input: {
    scope: TenantScope
    reservationId: string
    expectedStatus: readonly Reservation["status"][]
    nextStatus: Reservation["status"]
    now: Date
    patch?: Partial<Pick<ReservationRecord, "paymentRequestPublicId" | "cancellationPolicySnapshot">>;
  }): Promise<ReservationUpdateResult>;
}

export type HoldReleaseResult =
  | { readonly isReleased: true; readonly reason?: undefined }
  | { readonly isReleased: false; readonly reason: "NOT_FOUND" | "TENANT_MISMATCH" | "ALREADY_CONSUMED" };

export type ReservationUpdateResult =
  | {
      readonly isUpdated: true;
      readonly reservation: ReservationRecord;
      readonly reason?: undefined;
    }
  | {
      readonly isUpdated: false;
      readonly reason: "NOT_FOUND" | "TENANT_MISMATCH" | "STATUS_CONFLICT";
      readonly reservation?: undefined;
    };

export interface HotelPaymentSubjectRepository {
  findByPublicId(scope: TenantScope, publicId: string): Promise<PaymentSubjectRecord | null>;
  listForReservation(scope: TenantScope, reservationId: string): Promise<readonly PaymentSubjectRecord[]>;
  /**
   * Attaches a verified payment to a reservation and performs the status
   * transition in ONE atomic step, returning the post-state.
   *
   * A reservation must never be confirmed by a caller acting on a payment
   * status it read separately: settlement and state change must not be
   * separable.
   */
  applyVerifiedPayment(input: {
    scope: TenantScope
    reservationId: string
    paymentRequestPublicId: string
    paidAt: Date
    amountToman: bigint
    now: Date
  }): Promise<PaymentApplicationResult>;
}

export type PaymentApplicationResult =
  | {
      readonly isApplied: true;
      readonly reservation: ReservationRecord;
      readonly isIdempotentReplay: boolean;
      readonly reason?: undefined;
    }
  | {
      readonly isApplied: false;
      readonly reason: "NOT_FOUND" | "TENANT_MISMATCH" | "STATUS_CONFLICT" | "AMOUNT_MISMATCH";
      readonly reservation?: undefined;
      readonly isIdempotentReplay?: undefined;
    };

/** Reads needed by the availability service, grouped for convenience. */
export interface HotelReadRepositories {
  readonly catalogue: HotelCatalogueRepository
  readonly availability: HotelAvailabilityRepository
}

export interface HotelWriteRepositories {
  readonly booking: HotelBookingRepository
  readonly payment: HotelPaymentSubjectRepository
}

export type HotelRepositories = HotelReadRepositories & HotelWriteRepositories;

/** Input for a hold attempt, already validated by the H1 validation layer. */
export type CreateHoldCommand = {
  readonly scope: TenantScope
  readonly property: HotelProperty
  readonly roomType: RoomType
  readonly ratePlan: RatePlan
  readonly query: AvailabilityQuery
  readonly holdId: string
  readonly reference: string
  readonly now: Date
  readonly holdMinutes: number
};
