import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptPublishedHotelWebsite,
  PublishedHotelWebsiteContractError,
  publishedHotelWebsiteErrorState,
} from "../lib/hotel-website-public-adapter.ts";

const media = (associationId, altText, slot = "GALLERY", sortOrder = 0) => ({
  src: `/api/hotel/v1/website/media/${associationId}`, altText, slot, sortOrder,
});
const websiteResponse = {
  mode: "PUBLISHED", locale: "fa", propertySlug: "demo", revisionNumber: 5,
  content: {
    title: "عنوان منتشرشده",
    hero: { eyebrow: "معرفی", heading: "سرعنوان منتشرشده", subheading: "زیرعنوان" },
    introduction: { heading: "درباره", body: "متن منتشرشده" },
    sections: [{ key: "intro", order: 1, visible: true, kind: "TEXT", heading: "بخش", body: "متن" }],
    contact: { phone: "02100000000", email: "info@example.test" },
  },
  propertyGallery: [media("assoc0001", "نمای تأییدشده", "GALLERY"), media("assoc0002", "نمای اصلی", "HERO_DESKTOP"), media("assoc0003", "نمای موبایل", "HERO_MOBILE")],
  roomGalleries: [{ roomTypeSlug: "room", items: [media("assoc0004", "اتاق تأییدشده")] }],
};
const roomsResponse = {
  mode: "PUBLISHED", locale: "fa", propertySlug: "demo",
  roomCategories: [{ slug: "room", name: "اتاق منتشرشده", description: null, localizedText: "توضیح ثبت‌شده", maxAdults: 2, maxChildren: 1, maxOccupancy: 3, beds: [], sizeSqm: null, gallery: [] }],
};

test("accepted C1B2 adapter preserves association media src and maps only published fields", () => {
  const snapshot = adaptPublishedHotelWebsite(websiteResponse, roomsResponse, { propertySlug: "demo", locale: "fa" });
  assert.equal(snapshot.status, "PUBLISHED");
  if (snapshot.status !== "PUBLISHED") return;
  const value = snapshot.value;
  assert.equal(value.content.title, "عنوان منتشرشده");
  assert.equal(value.heroDesktop.src, "/api/hotel/v1/website/media/assoc0002");
  assert.equal(value.heroMobile.src, "/api/hotel/v1/website/media/assoc0003");
  assert.equal(value.propertyGallery[0].src, "/api/hotel/v1/website/media/assoc0001");
  assert.equal(value.roomCards[0].images[0].src, "/api/hotel/v1/website/media/assoc0004");
  assert.equal(value.roomCards[0].facts[0].value, "۳");
  assert.equal("price" in value.roomCards[0], false);
  assert.equal("availability" in value.roomCards[0], false);
});

test("unpublished response remains a distinct state and never falls back to preview", () => {
  const unpublished = { mode: "UNPUBLISHED", locale: "fa", propertySlug: "demo", content: null, propertyGallery: [], roomGalleries: [] };
  const rooms = { ...roomsResponse, mode: "UNPUBLISHED", roomCategories: [] };
  assert.deepEqual(adaptPublishedHotelWebsite(unpublished, rooms, { propertySlug: "demo", locale: "fa" }), { status: "UNPUBLISHED" });
});

test("property, room, locale and source mismatches are rejected", () => {
  assert.throws(() => adaptPublishedHotelWebsite(websiteResponse, roomsResponse, { propertySlug: "foreign", locale: "fa" }), PublishedHotelWebsiteContractError);
  assert.throws(() => adaptPublishedHotelWebsite(websiteResponse, { ...roomsResponse, propertySlug: "foreign" }, { propertySlug: "demo", locale: "fa" }), PublishedHotelWebsiteContractError);
  assert.throws(() => adaptPublishedHotelWebsite(websiteResponse, { ...roomsResponse, locale: "en" }, { propertySlug: "demo", locale: "fa" }), PublishedHotelWebsiteContractError);
  assert.throws(() => adaptPublishedHotelWebsite({ ...websiteResponse, mode: "PREVIEW" }, roomsResponse, { propertySlug: "demo", locale: "fa" }), PublishedHotelWebsiteContractError);
  assert.throws(() => adaptPublishedHotelWebsite({ ...websiteResponse, propertyGallery: [media("id", null, "GALLERY").src] }, roomsResponse, { propertySlug: "demo", locale: "fa" }), PublishedHotelWebsiteContractError);
});

test("missing translations remain null and empty galleries stay empty", () => {
  const website = { ...websiteResponse, locale: "en", content: { ...websiteResponse.content, title: null, hero: { heading: null }, introduction: { body: null } }, propertyGallery: [], roomGalleries: [] };
  const rooms = { ...roomsResponse, locale: "en", roomCategories: [{ ...roomsResponse.roomCategories[0], localizedText: null }] };
  const snapshot = adaptPublishedHotelWebsite(website, rooms, { propertySlug: "demo", locale: "en" });
  assert.equal(snapshot.status, "PUBLISHED");
  if (snapshot.status !== "PUBLISHED") return;
  assert.equal(snapshot.value.content.title, null);
  assert.equal(snapshot.value.heroDesktop, null);
  assert.deepEqual(snapshot.value.propertyGallery, []);
  assert.deepEqual(snapshot.value.roomCards[0].images, []);
  assert.equal(snapshot.value.roomCards[0].description, null);
});

test("C1B2 errors map to safe presentation states", () => {
  assert.equal(publishedHotelWebsiteErrorState(404, { error: "NOT_FOUND" }), "UNAVAILABLE_PROPERTY");
  assert.equal(publishedHotelWebsiteErrorState(503, { error: "WEBSITE_DISABLED", message: "internal gate detail" }), "PUBLICATION_DISABLED");
  assert.equal(publishedHotelWebsiteErrorState(500, { error: "UNAVAILABLE" }), "TEMPORARY_UNAVAILABLE");
  assert.equal(publishedHotelWebsiteErrorState(400, { error: "INVALID_REQUEST" }), "TEMPORARY_UNAVAILABLE");
});
