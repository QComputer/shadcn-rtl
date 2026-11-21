import { z } from "zod";
import { HotelManagementValidationError } from "./hotel-management.service";

const guestCount = z.number().int().min(1).max(100);
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

const createSchema = z.strictObject({
  temporaryCode: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(100),
  floor: nullableText(80),
  layout: nullableText(500),
  description: nullableText(4000),
  estimatedMinGuests: guestCount.nullable().optional(),
  estimatedMaxGuests: guestCount.nullable().optional(),
  maxAdults: guestCount.nullable().optional(),
  maxChildren: z.number().int().min(0).max(100).nullable().optional(),
  maxOccupancy: guestCount.nullable().optional(),
  beds: z.array(z.strictObject({
    type: z.string().trim().min(1).max(80),
    count: guestCount,
  })).min(1).max(20).nullable().optional(),
});

const archiveSchema = z.strictObject({
  version: z.number().int().min(1).max(2147483646),
});

const promoteSchema = z.strictObject({
  expectedVersion: z.number().int().min(1).max(2147483646),
  roomTypeId: z.string().trim().min(1).max(100),
  physicalRoomCode: z.string().trim().min(1).max(64),
  confirmPhysicalRoomCode: z.literal(true),
});

const updateSchema = createSchema.partial()
  .extend(archiveSchema.shape)
  .refine(({ version: _version, ...patch }) => Object.keys(patch).length > 0);

function managementSchema<T>(schema: z.ZodType<T>) {
  return {
    parse(input: unknown) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) throw new HotelManagementValidationError("Invalid draft accommodation input");
      return parsed.data;
    },
  };
}

export const createDraftAccommodationSchema = managementSchema(createSchema);
export const updateDraftAccommodationSchema = managementSchema(updateSchema);
export const archiveDraftAccommodationSchema = managementSchema(archiveSchema);
export const promoteDraftAccommodationSchema = managementSchema(promoteSchema);

export type DraftAccommodationInput = z.infer<typeof createSchema>;
export type DraftAccommodationPatch = z.infer<typeof updateSchema>;
export type DraftAccommodationPromotionInput = z.infer<typeof promoteSchema>;

export function assertDraftAccommodationOccupancy(
  input: Pick<DraftAccommodationInput, "estimatedMinGuests" | "estimatedMaxGuests" | "maxAdults" | "maxChildren" | "maxOccupancy">,
) {
  const { estimatedMinGuests, estimatedMaxGuests, maxAdults, maxChildren, maxOccupancy } = input;
  if (estimatedMinGuests == null ? estimatedMaxGuests != null : estimatedMaxGuests == null || estimatedMinGuests > estimatedMaxGuests) {
    throw new HotelManagementValidationError("Estimated occupancy requires both bounds in ascending order");
  }
  if (maxOccupancy != null && (maxOccupancy < (maxAdults ?? 0) || maxOccupancy < (maxChildren ?? 0))) {
    throw new HotelManagementValidationError("Verified occupancy is below the verified adult or child limit");
  }
}
