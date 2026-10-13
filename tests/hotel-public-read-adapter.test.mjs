import assert from "node:assert/strict";
import test from "node:test";
import {
  HotelPublicReadContractError,
  adaptApprovedRoomMedia,
  adaptPublishedEditorial,
  adaptPublishedProperty,
  adaptPublishedRoomCategories,
  adaptPublishedRoomPolicies,
  previewHotelRooms,
  toPublishedRoomCards,
} from "../lib/hotel-public-read-adapter.ts";

const property = {
  source: "PUBLISHED", locale: "fa",
  property: {
    slug: "damoon-hotel", name: "نام ثبت‌شده", description: null, localizedText: null,
    timezone: "Asia/Tehran", currency: "TOMAN", checkInTime: "14:00", checkOutTime: "11:00",
    minStayNights: 1, maxStayNights: 30,
  },
};
const room = {
  slug: "sample-room", name: "اتاق ثبت‌شده", description: null, localizedText: null,
  maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [{ kind: "double", count: 1 }], sizeSqm: null,
};
const categories = { source: "PUBLISHED", locale: "fa", property: { slug: "damoon-hotel" }, roomCategories: [room] };
const policy = {
  key: "flexible", name: "سیاست ثبت‌شده", description: null, localizedText: null,
  freeCancellationCutoffHours: 24, fullCancellationRetention: 0.5,
  cancellationTiers: [{ cutoffHours: 12, retentionBasisPoints: 2500, penaltyBasis: "FIRST_NIGHT" }],
};
const policies = {
  source: "PUBLISHED", locale: "fa", property: { slug: "damoon-hotel" }, roomCategory: { slug: "sample-room" }, cancellationPolicies: [policy],
};
const propertyContext = { slug: "damoon-hotel", locale: "fa" };
const roomContext = { propertySlug: "damoon-hotel", locale: "fa" };
const policyContext = { ...roomContext, roomTypeSlug: "sample-room" };

test("property adapter preserves only committed published fields", () => {
  const result = adaptPublishedProperty(property, propertyContext);
  assert.equal(result.source, "PUBLISHED");
  assert.equal(result.value.slug, "damoon-hotel");
  assert.equal(result.value.localizedText, null);
  assert.equal(result.value.currency, "TOMAN");
  assert.equal("images" in result.value, false);
  assert.equal("amenities" in result.value, false);
});

test("room categories preserve approved order and never invent gallery, prices or amenities", () => {
  const result = adaptPublishedRoomCategories({ ...categories, roomCategories: [room, { ...room, slug: "second-room", beds: undefined }] }, roomContext);
  assert.deepEqual(result.value.roomCategories.map((entry) => entry.slug), ["sample-room", "second-room"]);
  const cards = toPublishedRoomCards(result);
  assert.deepEqual(cards.map((card) => card.images), [[], []]);
  assert.deepEqual(cards.map((card) => card.id), ["sample-room", "second-room"]);
  assert.equal("facts" in cards[0], false);
  assert.equal("totalRate" in cards[0], false);
});

test("policy adapter keeps exact key, normalized fraction and validated tiers", () => {
  const result = adaptPublishedRoomPolicies(policies, policyContext);
  assert.equal(result.value.cancellationPolicies[0].key, "flexible");
  assert.equal(result.value.cancellationPolicies[0].fullCancellationRetention, 0.5);
  assert.deepEqual(result.value.cancellationPolicies[0].cancellationTiers, policy.cancellationTiers);
});

test("empty room and policy lists remain empty, with no invented fallback", () => {
  const rooms = adaptPublishedRoomCategories({ ...categories, roomCategories: [] }, roomContext);
  const emptyPolicies = adaptPublishedRoomPolicies({ ...policies, cancellationPolicies: [] }, policyContext);
  assert.deepEqual(toPublishedRoomCards(rooms), []);
  assert.deepEqual(emptyPolicies.value.cancellationPolicies, []);
});

test("requested locale is preserved and missing translations never borrow another locale", () => {
  const english = adaptPublishedProperty({ ...property, locale: "en", property: { ...property.property, localizedText: null } }, { slug: "damoon-hotel", locale: "en" });
  assert.equal(english.locale, "en");
  assert.equal(english.value.localizedText, null);
  assert.throws(() => adaptPublishedProperty(property, { slug: "damoon-hotel", locale: "en" }), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomCategories(categories, { propertySlug: "damoon-hotel", locale: "ar" }), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedProperty({ ...property, locale: "de" }, { slug: "damoon-hotel", locale: "de" }), HotelPublicReadContractError);
});

test("preview data remains distinctly PREVIEW and cannot masquerade as published", () => {
  const preview = previewHotelRooms([{ kind: "concept", id: "example", title: "مفهومی", images: [{ src: "/images/room-concept-1.webp", alt: "مفهومی" }] }]);
  assert.equal(preview.source, "PREVIEW");
  assert.throws(() => adaptPublishedRoomCategories({ ...categories, source: "PREVIEW" }, roomContext), HotelPublicReadContractError);
  assert.throws(() => previewHotelRooms([{ kind: "published", id: "x", title: "x", images: [] }]), HotelPublicReadContractError);
});

test("foreign property and room-policy context fail closed", () => {
  assert.throws(() => adaptPublishedProperty(property, { slug: "foreign", locale: "fa" }), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomCategories(categories, { propertySlug: "foreign", locale: "fa" }), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomPolicies(policies, { ...policyContext, roomTypeSlug: "foreign-room" }), HotelPublicReadContractError);
});

test("missing fields and uncontracted price/media payloads are rejected", () => {
  const missing = structuredClone(property);
  delete missing.property.timezone;
  assert.throws(() => adaptPublishedProperty(missing, propertyContext), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomCategories({ ...categories, roomCategories: [{ ...room, images: ["/unapproved.webp"] }] }, roomContext), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomCategories({ ...categories, roomCategories: [{ ...room, totalRate: "1000" }] }, roomContext), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomPolicies({ ...policies, cancellationPolicies: [{ ...policy, secret: "internal" }] }, policyContext), HotelPublicReadContractError);
});

test("malformed beds and penalty terms cannot become public display data", () => {
  assert.throws(() => adaptPublishedRoomCategories({ ...categories, roomCategories: [{ ...room, beds: [{ kind: "unknown", count: 1 }] }] }, roomContext), HotelPublicReadContractError);
  assert.throws(() => adaptPublishedRoomPolicies({ ...policies, cancellationPolicies: [{ ...policy, cancellationTiers: [{ cutoffHours: 12, retentionBasisPoints: 10001, penaltyBasis: "FIRST_NIGHT" }] }] }, policyContext), HotelPublicReadContractError);
});

test("editorial and approved media stay unsupported pending C1A/C1B contracts", () => {
  assert.deepEqual(adaptPublishedEditorial({ title: "unsupported" }), { status: "UNSUPPORTED", reason: "EDITORIAL_CONTRACT_MISSING" });
  assert.deepEqual(adaptApprovedRoomMedia({ src: "/unapproved.webp" }), { status: "UNSUPPORTED", reason: "APPROVED_MEDIA_CONTRACT_MISSING" });
});
