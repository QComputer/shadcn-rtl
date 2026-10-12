/**
 * Hotel vertical — core domain types (H1 foundation).
 *
 * These are pure, persistence-agnostic contracts. They deliberately do NOT
 * map to Prisma models yet: no hotel migration is authorised in H1. When the
 * schema lands, these types are the reference the models must satisfy.
 *
 * Two decisions worth stating up front, because they differ from the existing
 * `Appointment` model and drive everything else:
 *
 *  1. A stay is expressed as an inclusive-exclusive list of *property-local
 *     calendar dates* ("nights"), not as two instants. A hotel night is a
 *     business unit that rolls over at a configured local time; deriving an
 *     `endTime` from a start (as `appointment.service.ts` does) cannot express
 *     a multi-night stay.
 *  2. Money is an integer count of Toman. No floating point, no `Decimal`
 *     arithmetic in domain code — conversion to/from Prisma `Decimal` is the
 *     persistence layer's job.
 */

/** ISO `YYYY-MM-DD` calendar date in the property's local timezone. */
export type StayDate = string

/** Integer Toman. Never a float. */
export type TomanAmount = number

export type IsoDateTime = string

/** Half-open UTC interval `[start, end)` used for check-in/check-out instants. */
export type StayWindow = {
  readonly checkIn: StayDate
  readonly checkOut: StayDate
}

export type HotelAmenityKey =
  | "wifi"
  | "breakfast_included"
  | "breakfast_optional"
  | "air_conditioning"
  | "heating"
  | "private_bathroom"
  | "bathtub"
  | "shower"
  | "kettle"
  | "minibar"
  | "safe_box"
  | "airport_shuttle"
  | "parking"
  | "pool"
  | "gym"
  | "spa"
  | "restaurant"
  | "bar"
  | "room_service"
  | "laundry"
  | "iron"
  | "tv"
  | "work_desk"
  | "elevator"
  | "wheelchair_accessible"
  | "connecting_rooms"
  | "family_room"
  | "sea_view"
  | "city_view"
  | "garden_view"

/**
 * A bed configuration. `count` is the number of physical beds of that shape,
 * not the number of guests that may sleep in them.
 */
export type BedConfiguration = {
  readonly kind: "single" | "double" | "queen" | "king" | "sofa" | "bunk" | "crib"
  readonly count: number
  readonly widthCm?: number
}

/** Maximum guests a bed configuration can legally hold. */
export const BED_CAPACITY: Readonly<Record<BedConfiguration["kind"], number>> = {
  single: 1,
  double: 2,
  queen: 2,
  king: 2,
  sofa: 2,
  bunk: 2,
  crib: 1,
}

export type Occupancy = {
  readonly adults: number
  readonly children: number
  /** Child ages are required whenever occupancy affects pricing or capacity. */
  readonly childAges?: readonly number[]
}

export type RoomCapacity = {
  readonly maxAdults: number
  /** Children may share the adult quota unless a floor is configured. */
  readonly maxChildren: number
  /** Absolute ceiling regardless of bed count. */
  readonly maxOccupancy: number
}

export type RoomFeature = {
  readonly key: HotelAmenityKey
  readonly label: string
  readonly description?: string
}

export type RoomType = {
  readonly id: string
  readonly propertyId: string
  readonly slug: string
  readonly name: string
  readonly description?: string
  readonly capacity: RoomCapacity
  readonly beds: readonly BedConfiguration[]
  readonly amenities: readonly RoomFeature[]
  readonly sizeSqm?: number
  readonly maxOccupancy: number
  readonly isActive: boolean
}

export type PhysicalRoom = {
  readonly id: string
  readonly propertyId: string
  readonly roomTypeId: string
  /** Human-facing identifier shown at the desk. Never used as a join key. */
  readonly code: string
  readonly floor?: string
  readonly isActive: boolean
}

export type HotelProperty = {
  readonly id: string
  readonly organizationId: string
  readonly slug: string
  readonly name: string
  /** IANA zone that defines the property's calendar and check-in day boundary. */
  readonly timezone: string
  readonly currency: string
  readonly checkInTime: string
  readonly checkOutTime: string
  readonly minStayNights: number
  readonly maxStayNights: number
  readonly policies: CancellationPolicySet
}

export type CancellationPolicySet = {
  readonly key: string
  readonly name: string
  /** Hours before check-in at which free cancellation stops being possible. */
  readonly freeCancellationCutoffHours: number
  /** Fraction of the reservation total retained when cancelling in full. */
  readonly fullCancellationRetention: number
  readonly description: string
  readonly cancellationTiers?: readonly CancellationTier[]
}

export type CancellationTier = {
  readonly cutoffHours: number
  readonly retentionBasisPoints: number
  readonly penaltyBasis: "RESERVATION_TOTAL" | "FIRST_NIGHT"
}

/**
 * A cancellation policy frozen onto a reservation at the moment of booking.
 *
 * A cancellation must be quoted against the terms the guest actually agreed
 * to. Re-reading the live policy by key would silently change a penalty
 * because the hotel edited its terms after the booking, which is unfair and
 * unauditable. H3 persists this snapshot; H1/H2 pass it in memory.
 */
export type ReservationCancellationPolicySnapshot = CancellationPolicySet & {
  readonly organizationId: string
  /** Monotonic version of the policy row this snapshot was taken from. */
  readonly policyVersion: number
  readonly capturedAt: IsoDateTime
}

export type RatePlan = {
  readonly id: string
  readonly propertyId: string
  readonly roomTypeId: string
  readonly code: string
  readonly name: string
  readonly description?: string
  /** Base nightly price used when no date-specific rate matches. */
  readonly baseNightlyRate: TomanAmount
  readonly currency: string
  readonly mealPlan: "none" | "breakfast_included" | "half_board" | "full_board"
  readonly minNights: number
  readonly maxNights: number
  readonly isRefundable: boolean
  readonly isActive: boolean
  /** Restricts when the plan may be sold, in property-local dates. */
  readonly validFrom?: StayDate
  readonly validTo?: StayDate
  readonly cancellationPolicy?: CancellationPolicySet
}

/** A date-specific override. Highest precedence when it matches the night. */
export type SeasonalRate = {
  readonly id: string
  readonly ratePlanId: string
  readonly from: StayDate
  readonly to: StayDate
  readonly nightlyRate?: TomanAmount
  readonly minNights?: number
  readonly maxNights?: number
}

export type InventoryScope =
  | { readonly kind: "ROOM_TYPE"; readonly roomTypeId: string }
  | { readonly kind: "PHYSICAL_ROOM"; readonly roomId: string }

/**
 * Per-night inventory for a sellable scope. This row is the unit of
 * contention: two reservations may never claim the same `roomTypeId` +
 * `date` beyond the allotment.
 */
export type InventoryNight = {
  readonly scope: InventoryScope
  readonly date: StayDate
  /** Rooms sellable on this night. `Infinity` when closed-to-arrival is off. */
  readonly allotment: number
  /** Rooms already committed to confirmed reservations. */
  readonly booked: number
  /** Rooms temporarily held by in-flight bookings, with a live expiry. */
  readonly held: number
  readonly closedToArrival?: boolean
  readonly closedToDeparture?: boolean
}

export type AvailabilityQuery = {
  readonly propertyId: string
  readonly window: StayWindow
  readonly occupancy: Occupancy
  readonly ratePlanId?: string
  /** Restricts the search; omit to consider every active room type. */
  readonly roomTypeIds?: readonly string[]
  readonly requiredAmenities?: readonly HotelAmenityKey[]
  readonly maxNightlyRate?: TomanAmount
}

export type RoomTypeAvailability = {
  readonly roomType: RoomType
  readonly ratePlan: RatePlan
  readonly nights: readonly StayDate[]
  readonly nightlyRates: readonly TomanAmount[]
  readonly totalRate: TomanAmount
  readonly averageNightlyRate: TomanAmount
  readonly availableRoomCount: number
  readonly isAvailable: boolean
  /** Nights that failed, for explainable diagnostics. Empty when available. */
  readonly unavailableNights: readonly UnavailableNight[]
}

export type UnavailableNight = {
  readonly date: StayDate
  readonly reason:
    | "SOLD_OUT"
    | "NOT_SELLABLE"
    | "MIN_STAY_NOT_MET"
    | "MAX_STAY_EXCEEDED"
    | "RATE_PLAN_OUT_OF_VALIDITY"
  readonly detail?: string
}

export type ReservationGuest = {
  readonly fullName: string
  readonly isPrimary: boolean
  readonly isChild?: boolean
  readonly age?: number
}

export type ReservationStatus =
  | "HELD"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW"
  | "EXPIRED"
  | "REFUNDED"

/**
 * A committed claim on inventory. `expiresAt` is authoritative for holds; a
 * server-side sweep, not the browser, decides when a hold is released.
 */
export type ReservationHold = {
  readonly id: string
  readonly propertyId: string
  readonly window: StayWindow
  readonly scope: InventoryScope
  readonly quantity: number
  readonly expiresAt: IsoDateTime
}

export type Reservation = {
  readonly id: string
  readonly organizationId: string
  readonly propertyId: string
  readonly roomTypeId: string
  readonly ratePlanId: string
  readonly reference: string
  readonly status: ReservationStatus
  readonly window: StayWindow
  readonly nights: readonly StayDate[]
  readonly guests: readonly ReservationGuest[]
  readonly occupancy: Occupancy
  readonly nightlyRates: readonly TomanAmount[]
  readonly totalAmount: TomanAmount
  readonly currency: string
  readonly cancellationPolicyKey: string
  /**
   * Frozen policy terms. Authoritative for any cancellation quote. Absent only
   * for pre-migration data; callers must fail closed when it is missing.
   */
  readonly cancellationPolicySnapshot?: ReservationCancellationPolicySnapshot
  readonly paymentRequestPublicId?: string
  readonly holdExpiresAt?: IsoDateTime
  readonly createdAt: IsoDateTime
  readonly cancelledAt?: IsoDateTime
}

/** Reasons a stay was requested — used for explainable ranking, never to deny. */
export type StayPreference = {
  readonly amenities?: readonly HotelAmenityKey[]
  readonly budgetPerNight?: TomanAmount
  readonly viewPreference?: "sea" | "city" | "garden" | "any"
  /** Ground floor / near-elevator. Explicitly requested, never inferred. */
  readonly locationNote?: string
  readonly accessibilityNeeds?: readonly HotelAmenityKey[]
}
