import assert from "node:assert/strict";
import test from "node:test";
import {
  createPropertySchema,
  createRoomTypeSchema,
  updatePropertySchema,
  updateRoomTypeSchema,
} from "@/lib/hotel/validation/management-contracts";

test("hotel management property contracts accept only service-supported fields", () => {
  const property = createPropertySchema.parse({ slug: "main-hotel", name: "Main Hotel" });
  assert.deepEqual(property, { slug: "main-hotel", name: "Main Hotel" });
  assert.throws(() => createPropertySchema.parse({ slug: "Main Hotel", name: "x" }));
  assert.throws(() => updatePropertySchema.parse({ organizationId: "client-controlled" }));
});

test("room type contracts enforce occupancy and localized-content shape", () => {
  const roomType = createRoomTypeSchema.parse({
    slug: "standard",
    name: "Standard",
    maxAdults: 2,
    maxOccupancy: 3,
    beds: [{ kind: "queen", count: 1 }],
    localizedContent: { fa: "استاندارد" },
  });
  assert.equal(roomType.maxOccupancy, 3);
  assert.throws(() => createRoomTypeSchema.parse({ ...roomType, organizationId: "client-controlled" }));
  assert.throws(() => updateRoomTypeSchema.parse({ localizedContent: { de: "unsupported" } }));
});
