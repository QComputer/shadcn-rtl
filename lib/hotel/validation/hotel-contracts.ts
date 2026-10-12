import { z } from "zod";
import { MAX_HOTEL_STAY_NIGHTS } from "@/lib/hotel/domain/policy";

/**
 * Shared hotel validation contracts.
 *
 * These are the single validation boundary for anything entering the hotel
 * vertical from the network. They are pure schemas — no DB, no auth — so they
 * can be reused by the public search route, the dashboard, and future
 * background jobs identically.
 *
 * Dates are validated as `YYYY-MM-DD` strings rather than `z.date()` because a
 * hotel stay is a property-local calendar concept. Parsing to an instant and
 * back is lossy for zones east of UTC and silently shifts stays by a day.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const stayDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, "Expected an ISO calendar date (YYYY-MM-DD)");

export const propertySlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case slug");

export const roomTypeSlugSchema = propertySlugSchema;

const integerToman = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const hotelAmenityKeySchema = z.enum([
  "wifi",
  "breakfast_included",
  "breakfast_optional",
  "air_conditioning",
  "heating",
  "private_bathroom",
  "bathtub",
  "shower",
  "kettle",
  "minibar",
  "safe_box",
  "airport_shuttle",
  "parking",
  "pool",
  "gym",
  "spa",
  "restaurant",
  "bar",
  "room_service",
  "laundry",
  "iron",
  "tv",
  "work_desk",
  "elevator",
  "wheelchair_accessible",
  "connecting_rooms",
  "family_room",
  "sea_view",
  "city_view",
  "garden_view",
]);

export const occupancySchema = z
  .object({
    adults: z.number().int().min(1).max(12),
    children: z.number().int().min(0).max(12).default(0),
    childAges: z.array(z.number().int().min(0).max(17)).max(12).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.childAges && value.childAges.length !== value.children) {
      ctx.addIssue({
        code: "custom",
        path: ["childAges"],
        message: "childAges must contain one entry per child",
      });
    }
  });

/** Public availability search. Read-only; safe for anonymous callers. */
export const availabilitySearchSchema = z
  .object({
    property: propertySlugSchema,
    checkIn: stayDateSchema,
    checkOut: stayDateSchema,
    occupancy: occupancySchema,
    roomTypes: z.array(roomTypeSlugSchema).max(50).optional(),
    ratePlan: z.string().max(64).optional(),
    amenities: z.array(hotelAmenityKeySchema).max(20).optional(),
    maxNightlyRate: integerToman.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.checkOut <= value.checkIn) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "checkOut must be after checkIn",
      });
      return;
    }
    const nights =
      (Date.parse(`${value.checkOut}T00:00:00Z`) - Date.parse(`${value.checkIn}T00:00:00Z`)) / 86_400_000;
    if (nights > MAX_HOTEL_STAY_NIGHTS) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: `Stay cannot exceed ${MAX_HOTEL_STAY_NIGHTS} nights`,
      });
    }
  });

export type AvailabilitySearchInputDto = z.infer<typeof availabilitySearchSchema>;

export const guestSchema = z.object({
  fullName: z.string().min(2).max(120),
  isPrimary: z.boolean().default(false),
  isChild: z.boolean().default(false),
  age: z.number().int().min(0).max(120).optional(),
});

/**
 * Booking submission contract.
 *
 * Amounts are supplied by the server only. A client-submitted total would be
 * a price-tampering vector, so the DTO deliberately has no total field.
 */
export const bookingRequestSchema = z
  .object({
    property: propertySlugSchema,
    roomType: roomTypeSlugSchema,
    ratePlan: z.string().min(1).max(64),
    checkIn: stayDateSchema,
    checkOut: stayDateSchema,
    occupancy: occupancySchema,
    guests: z.array(guestSchema).min(1).max(12),
    contact: z.object({
      fullName: z.string().min(2).max(120),
      phone: z.string().min(8).max(24),
      email: z.string().email().max(200).optional(),
    }),
    /** Idempotency key so a retried submit cannot create two reservations. */
    idempotencyKey: z.string().min(8).max(128),
    specialRequests: z.string().max(2000).optional(),
    acceptedCancellationPolicyKey: z.string().min(1).max(64),
  })
  .superRefine((value, ctx) => {
    if (value.checkOut <= value.checkIn) {
      ctx.addIssue({ code: "custom", path: ["checkOut"], message: "checkOut must be after checkIn" });
    }
    if (!value.guests.some((guest) => guest.isPrimary)) {
      ctx.addIssue({ code: "custom", path: ["guests"], message: "At least one primary guest is required" });
    }
    const expectedGuests = value.occupancy.adults + value.occupancy.children;
    if (value.guests.length > expectedGuests) {
      ctx.addIssue({
        code: "custom",
        path: ["guests"],
        message: "Guest list cannot exceed the declared occupancy",
      });
    }
  });

export type BookingRequestDto = z.infer<typeof bookingRequestSchema>;

/** Anonymous hold creation reuses the booking request contract but never accepts price authority. */
export const anonymousHoldRequestSchema = bookingRequestSchema;
export type AnonymousHoldRequestDto = z.infer<typeof anonymousHoldRequestSchema>;

export const reservationLookupSchema = z.object({
  reference: z.string().min(4).max(32).regex(/^[A-Z0-9-]+$/, "Expected an uppercase reservation reference"),
  contactPhone: z.string().min(8).max(24),
});

export type ReservationLookupDto = z.infer<typeof reservationLookupSchema>;
