import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertHotelWebsiteTransition,
  assertHotelWebsiteIdempotencyActor,
  assertIndependentHotelWebsiteReviewer,
  HotelWebsiteManagementConflictError,
  hotelWebsiteRequestFingerprint,
} from "@/lib/hotel/content/hotel-website-management.service";
import { HotelWebsiteContentAuthorizationError } from "@/lib/hotel/content/hotel-website-content.service";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";

test("editorial transitions are guarded and only a distinct reviewer can decide a revision", () => {
  assert.doesNotThrow(() => assertHotelWebsiteTransition("IN_REVIEW", "IN_REVIEW"));
  assert.throws(() => assertHotelWebsiteTransition("DRAFT", "IN_REVIEW"), HotelWebsiteManagementConflictError);
  assert.doesNotThrow(() => assertIndependentHotelWebsiteReviewer("creator-1", "admin-2"));
  assert.throws(() => assertIndependentHotelWebsiteReviewer("creator-1", "creator-1"), HotelWebsiteContentAuthorizationError);
  assert.doesNotThrow(() => assertHotelWebsiteIdempotencyActor("actor-1", "actor-1"));
  assert.throws(() => assertHotelWebsiteIdempotencyActor("actor-1", "actor-2"), HotelWebsiteManagementConflictError);
});

test("idempotency request fingerprints ignore object key order but detect payload changes", () => {
  assert.equal(hotelWebsiteRequestFingerprint({ revisionId: "r1", note: "ok" }), hotelWebsiteRequestFingerprint({ note: "ok", revisionId: "r1" }));
  assert.notEqual(hotelWebsiteRequestFingerprint({ revisionId: "r1" }), hotelWebsiteRequestFingerprint({ revisionId: "r2" }));
});

test("website studio media picker is scoped to the authorized organization and public assets", async () => {
  let imageQuery: unknown;
  const tx = {
    user: { findFirst: async () => ({ id: "admin-1", role: "ADMIN" }) },
    organization: { findFirst: async () => ({ id: "org-a" }) },
    hotelProperty: { findFirst: async () => ({ id: "property-a" }) },
    organizationMember: { findFirst: async () => ({ role: "ADMIN" }) },
    image: { findMany: async ({ where }: { where: unknown }) => {
      imageQuery = where;
      return [
        { id: "img-a", organizationId: "org-a", url: "/uploads/a.jpg", filename: "a.jpg", mimeType: "image/jpeg", createdAt: new Date("2026-10-18T00:00:00Z") },
        { id: "img-private-host", organizationId: "org-a", url: "https://not-approved.example/a.jpg", filename: "a.jpg", mimeType: "image/jpeg", createdAt: new Date("2026-10-18T00:00:00Z") },
      ];
    } },
  };
  const db = { ...tx, $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as never;
  const service = new HotelWebsiteManagementService(db);
  const result = await service.listAvailableMedia({ userId: "admin-1", role: "ADMIN", organizationId: "org-a" }, { organizationId: "org-a", propertyId: "property-a" });
  assert.deepEqual(imageQuery, { organizationId: "org-a", access: "PUBLIC" });
  assert.deepEqual(result.map((image) => image.imageId), ["img-a"]);
});
