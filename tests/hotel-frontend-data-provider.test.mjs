import assert from "node:assert/strict";
import test from "node:test";
import {
  createConceptPreviewProvider,
  createPendingAuthenticatedPreviewProvider,
  createPublishedSnapshotProvider,
} from "../lib/hotel-frontend-data-provider.ts";
import { HotelPublicReadContractError, toPublishedRoomCards } from "../lib/hotel-public-read-adapter.ts";
import { hotelFrontendStateText, hotelPublicReadErrorState, localizedTextState } from "../lib/hotel-frontend-state.ts";

const property = {
  source: "PUBLISHED", locale: "fa",
  property: { slug: "synthetic-hotel", name: "نام ثبت‌شده", description: null, localizedText: null,
    timezone: "Asia/Tehran", currency: "TOMAN", checkInTime: "14:00", checkOutTime: "11:00",
    minStayNights: 1, maxStayNights: 30 },
};
const room = { slug: "sample-room", name: "اتاق ثبت‌شده", description: null, localizedText: null,
  maxAdults: 2, maxChildren: 1, maxOccupancy: 3, sizeSqm: null };
const rooms = { source: "PUBLISHED", locale: "fa", property: { slug: "synthetic-hotel" }, roomCategories: [room] };
const policy = { source: "PUBLISHED", locale: "fa", property: { slug: "synthetic-hotel" }, roomCategory: { slug: "sample-room" },
  cancellationPolicies: [{ key: "flexible", name: "سیاست ثبت‌شده", description: null, localizedText: null,
    freeCancellationCutoffHours: 24, fullCancellationRetention: 0.5 }] };
const context = { propertySlug: "synthetic-hotel", locale: "fa" };
const published = (override = {}) => createPublishedSnapshotProvider({ trustedContext: context, propertyResponse: property,
  roomCategoriesResponse: rooms, policyResponsesByRoom: { "sample-room": policy }, ...override });

test("concept preview is explicit and cannot become a published catalog", () => {
  const provider = createConceptPreviewProvider("fa", [{ kind: "concept", id: "concept-1", title: "نمونه", images: [] }]);
  assert.equal(provider.provenance, "PREVIEW");
  assert.equal(provider.rooms().status, "READY");
  assert.equal(provider.rooms().value.source, "PREVIEW");
  assert.equal(provider.property().state, "PREVIEW_ONLY");
  assert.equal(provider.bookingPresentation(), "BOOKING_DISABLED");
  assert.throws(() => createConceptPreviewProvider("fa", [{ kind: "published", id: "x", title: "x", images: [] }]), HotelPublicReadContractError);
  assert.throws(() => published({ propertyResponse: { ...property, source: "PREVIEW" } }), HotelPublicReadContractError);
});

test("published snapshot maps exact R1 property, room and policy fields without fabrication", () => {
  const provider = published();
  assert.equal(provider.provenance, "PUBLISHED");
  assert.equal(provider.property().value.value.timezone, "Asia/Tehran");
  assert.equal(provider.property().value.value.localizedText, null);
  assert.equal(provider.rooms().value.value.roomCategories[0].maxOccupancy, 3);
  assert.equal(provider.policies("sample-room").value.value.cancellationPolicies[0].fullCancellationRetention, 0.5);
  const cards = toPublishedRoomCards(provider.rooms().value);
  assert.deepEqual(cards[0].images, []);
  assert.equal("facts" in cards[0], false);
  assert.equal("price" in cards[0], false);
  assert.equal("amenities" in cards[0], false);
});

test("wrong property, room and locale are rejected before presentation", () => {
  assert.throws(() => published({ trustedContext: { propertySlug: "foreign-hotel", locale: "fa" } }), HotelPublicReadContractError);
  assert.throws(() => published({ trustedContext: { propertySlug: "synthetic-hotel", locale: "ar" } }), HotelPublicReadContractError);
  assert.throws(() => published({ policyResponsesByRoom: { "sample-room": { ...policy, roomCategory: { slug: "foreign-room" } } } }), HotelPublicReadContractError);
  assert.throws(() => published({ policyResponsesByRoom: { "foreign-room": policy } }), HotelPublicReadContractError);
  assert.deepEqual(published().policies("foreign-room"), { status: "UNAVAILABLE", provenance: "PUBLISHED", state: "UNAVAILABLE_PROPERTY" });
});

test("missing translations remain missing in fa, en and ar", () => {
  assert.equal(localizedTextState(published().property().value.value.localizedText), "MISSING_TRANSLATION");
  for (const locale of ["fa", "en", "ar"]) {
    const message = hotelFrontendStateText("MISSING_TRANSLATION", locale);
    assert.ok(message.title.length > 0 && message.detail.length > 0);
    assert.doesNotMatch(message.detail, /synthetic-hotel|sample-room/);
  }
});

test("empty published rooms and policies remain empty states", () => {
  const empty = published({ roomCategoriesResponse: { ...rooms, roomCategories: [] }, policyResponsesByRoom: {} });
  assert.deepEqual(empty.rooms(), { status: "EMPTY", provenance: "PUBLISHED", state: "NO_PUBLISHED_ROOMS" });
  const noPolicy = published({ policyResponsesByRoom: {} });
  assert.deepEqual(noPolicy.policies("sample-room"), { status: "EMPTY", provenance: "PUBLISHED", state: "NO_APPROVED_CONTENT" });
  assert.deepEqual(createConceptPreviewProvider("fa", []).rooms().value.roomCards, []);
});

test("C1A storage and future C1B routes do not imply public editorial or media", () => {
  const provider = published();
  assert.deepEqual(provider.editorial(), { status: "UNSUPPORTED", provenance: "PUBLISHED", pending: "PUBLIC_EDITORIAL_READ", state: "CONTENT_CONTRACT_PENDING" });
  assert.equal(provider.propertyGallery().status, "UNSUPPORTED");
  assert.equal(provider.roomGallery("sample-room").pending, "APPROVED_ROOM_MEDIA_READ");
  assert.equal(provider.roomGallery("foreign-room").status, "UNAVAILABLE");
  assert.equal(provider.bookingPresentation(), "BOOKING_DISABLED");
  const cms = createPendingAuthenticatedPreviewProvider("ar");
  assert.equal(cms.provenance, "AUTHENTICATED_PREVIEW");
  assert.equal(cms.editorial().pending, "AUTHENTICATED_CMS_PREVIEW");
  assert.equal(cms.rooms().status, "UNAVAILABLE");
});

test("all localized guest-facing states are safe and explicit", () => {
  const codes = ["LOADING", "NO_APPROVED_CONTENT", "NO_PUBLISHED_ROOMS", "CONTENT_CONTRACT_PENDING",
    "MISSING_TRANSLATION", "UNAVAILABLE_PROPERTY", "PUBLICATION_DISABLED", "TEMPORARY_UNAVAILABLE", "PREVIEW_ONLY", "BOOKING_DISABLED"];
  for (const locale of ["fa", "en", "ar"]) for (const code of codes) {
    const text = hotelFrontendStateText(code, locale);
    assert.ok(text.title && text.detail, `${locale} ${code}`);
    assert.doesNotMatch(`${text.title} ${text.detail}`, /database|Prisma|stack trace|tenant id/i);
  }
});

test("R1 errors map to non-sensitive UI states without leaking raw details", () => {
  assert.equal(hotelPublicReadErrorState(404, { error: "NOT_FOUND" }), "UNAVAILABLE_PROPERTY");
  assert.equal(hotelPublicReadErrorState(503, { error: "PUBLICATION_DISABLED" }), "PUBLICATION_DISABLED");
  assert.equal(hotelPublicReadErrorState(500, { error: "UNAVAILABLE", details: "internal stack" }), "TEMPORARY_UNAVAILABLE");
  assert.equal(hotelPublicReadErrorState(400, { error: "INVALID_REQUEST" }), "TEMPORARY_UNAVAILABLE");
});

test("snapshot providers perform no network calls", () => {
  const prior = globalThis.fetch;
  let count = 0;
  globalThis.fetch = () => { count += 1; throw new Error("Network forbidden in F2C preparation"); };
  try {
    published().property();
    published().rooms();
    createConceptPreviewProvider("fa", []).rooms();
    createPendingAuthenticatedPreviewProvider("fa").editorial();
    assert.equal(count, 0);
  } finally { globalThis.fetch = prior; }
});
