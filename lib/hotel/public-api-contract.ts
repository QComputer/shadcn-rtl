import { z } from "zod";

export const hotelPublicLocales = ["fa", "en", "ar"] as const;
export const hotelPublicLocaleSchema = z.enum(hotelPublicLocales);
export type HotelPublicLocale = z.infer<typeof hotelPublicLocaleSchema>;

const publicHotelPropertySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  localizedText: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  minStayNights: z.number().int(),
  maxStayNights: z.number().int(),
}).strict();

const publicHotelRoomCategorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  localizedText: z.string().nullable(),
  maxAdults: z.number().int(),
  maxChildren: z.number().int(),
  maxOccupancy: z.number().int(),
  beds: z.array(z.object({
    kind: z.enum(["single", "double", "queen", "king", "sofa", "bunk", "crib"]),
    count: z.number().int().positive(),
    widthCm: z.number().int().positive().optional(),
  }).strict()).optional(),
  sizeSqm: z.number().int().positive().nullable(),
}).strict();

const publicHotelCancellationPolicySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  localizedText: z.string().nullable(),
  freeCancellationCutoffHours: z.number().int().nonnegative(),
  fullCancellationRetention: z.number().min(0).max(1),
  cancellationTiers: z.array(z.object({
    cutoffHours: z.number().int().nonnegative(),
    retentionBasisPoints: z.number().int().min(0).max(10000),
    penaltyBasis: z.enum(["RESERVATION_TOTAL", "FIRST_NIGHT"]),
  }).strict()).optional(),
}).strict();

export const publicHotelPropertyResponseSchema = z.object({
  source: z.literal("PUBLISHED"),
  locale: hotelPublicLocaleSchema,
  property: publicHotelPropertySchema,
}).strict();

export const publicHotelRoomCategoriesResponseSchema = z.object({
  source: z.literal("PUBLISHED"),
  locale: hotelPublicLocaleSchema,
  property: z.object({ slug: z.string() }).strict(),
  roomCategories: z.array(publicHotelRoomCategorySchema),
}).strict();

export const publicHotelRoomPoliciesResponseSchema = z.object({
  source: z.literal("PUBLISHED"),
  locale: hotelPublicLocaleSchema,
  property: z.object({ slug: z.string() }).strict(),
  roomCategory: z.object({ slug: z.string() }).strict(),
  cancellationPolicies: z.array(publicHotelCancellationPolicySchema),
}).strict();

export const publicHotelReadErrorSchema = z.object({
  error: z.enum(["INVALID_REQUEST", "NOT_FOUND", "PUBLICATION_DISABLED", "UNAVAILABLE"]),
}).strict();

export type PublicHotelPropertyResponse = z.infer<typeof publicHotelPropertyResponseSchema>;
export type PublicHotelRoomCategoriesResponse = z.infer<typeof publicHotelRoomCategoriesResponseSchema>;
export type PublicHotelRoomPoliciesResponse = z.infer<typeof publicHotelRoomPoliciesResponseSchema>;
