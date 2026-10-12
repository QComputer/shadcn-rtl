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
