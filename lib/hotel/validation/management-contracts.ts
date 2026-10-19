import { z } from "zod";

const localizedContent = z
  .object({
    fa: z.string().max(4000).optional(),
    en: z.string().max(4000).optional(),
    ar: z.string().max(4000).optional(),
  })
  .strict();

const propertyFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable(),
  localizedContent: localizedContent.optional(),
  timezone: z.string().trim().min(1).max(100),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  minStayNights: z.number().int().safe().min(1),
  maxStayNights: z.number().int().safe().min(1),
  isActive: z.boolean(),
};

export const createPropertySchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: propertyFields.name,
    timezone: propertyFields.timezone.optional(),
  })
  .strict();

export const updatePropertySchema = z.object(propertyFields).partial().strict();

const beds = z.array(z.record(z.string(), z.unknown())).min(1).max(20);
const roomTypeFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000),
  localizedContent: localizedContent.optional(),
  maxAdults: z.number().int().safe().min(1),
  maxChildren: z.number().int().safe().min(0),
  maxOccupancy: z.number().int().safe().min(1),
  beds,
  isActive: z.boolean(),
};

export const createRoomTypeSchema = z
  .object({
    slug: z.string().trim().min(1).max(100),
    name: roomTypeFields.name,
    description: roomTypeFields.description.optional(),
    localizedContent: roomTypeFields.localizedContent,
    maxAdults: roomTypeFields.maxAdults,
    maxChildren: roomTypeFields.maxChildren.optional(),
    maxOccupancy: roomTypeFields.maxOccupancy,
    beds,
  })
  .strict();

export const updateRoomTypeSchema = z.object(roomTypeFields).partial().strict();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;

const id = z.string().trim().min(1).max(128);
const jsonText = z.string().max(4000);
const money = z.union([z.string().regex(/^\d+$/), z.number().int().safe().nonnegative()]).transform((value) => BigInt(value));
const date = z.coerce.date();

export const createPhysicalRoomSchema = z.object({
  roomTypeId: id,
  code: z.string().trim().min(1).max(64),
  floor: z.string().max(100).optional(),
  description: jsonText.optional(),
  isOutOfService: z.boolean().optional(),
}).strict();
export const updatePhysicalRoomSchema = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  roomTypeId: id.optional(),
  floor: z.string().max(100).nullable().optional(),
  description: jsonText.nullable().optional(),
  isOutOfService: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict();
export const createAmenitySchema = z.object({ key: z.string().trim().min(1).max(64), label: z.string().trim().min(1).max(200), description: jsonText.optional(), localizedContent: localizedContent.optional() }).strict();
export const updateAmenitySchema = z.object({ label: z.string().trim().min(1).max(200).optional(), description: jsonText.nullable().optional(), localizedContent: localizedContent.optional(), isActive: z.boolean().optional() }).strict();
export const roomTypeAmenitiesSchema = z.object({ amenityIds: z.array(id).max(100) }).strict();

const ratePlanShared = {
  code: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(200), description: jsonText.optional(), localizedContent: localizedContent.optional(),
  baseNightlyRate: money, minNights: z.number().int().safe().min(1).optional(), maxNights: z.number().int().safe().min(0).optional(), isRefundable: z.boolean().optional(), validFrom: date.optional(), validTo: date.optional(), cancellationPolicyId: id.nullable().optional(),
};
export const createRatePlanSchema = z.object({ roomTypeId: id, ...ratePlanShared, baseNightlyRate: money }).strict();
export const updateRatePlanSchema = z.object({ ...ratePlanShared, code: ratePlanShared.code.optional(), name: ratePlanShared.name.optional(), baseNightlyRate: money.optional() }).strict();
export const nightlyRateSchema = z.object({ from: date, to: date, nightlyRate: money.optional(), minNights: z.number().int().safe().min(1).optional(), maxNights: z.number().int().safe().min(0).optional() }).strict();
export const createCancellationPolicySchema = z.object({ key: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(200), description: jsonText.optional(), localizedContent: localizedContent.optional(), freeCancellationCutoffHours: z.number().int().safe().min(0), fullCancellationRetention: z.number().min(0).max(1).optional(), cancellationTiers: z.array(z.object({ cutoffHours: z.number().int().safe().min(0), retentionBasisPoints: z.number().int().safe().min(0).max(10000), penaltyBasis: z.enum(["RESERVATION_TOTAL", "FIRST_NIGHT"]) })).optional() }).strict();
export const updateCancellationPolicySchema = createCancellationPolicySchema.partial().extend({ isActive: z.boolean().optional() }).strict();
export const activationSchema = z.object({ isActive: z.boolean() }).strict();
export const inventoryAdjustmentSchema = z.object({
  roomTypeId: id,
  date,
  allotmentDelta: z.number().int().safe().optional(),
  outOfServiceDelta: z.number().int().safe().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict().refine((value) => (value.allotmentDelta ?? 0) !== 0 || (value.outOfServiceDelta ?? 0) !== 0, { message: "At least one inventory delta is required" });
