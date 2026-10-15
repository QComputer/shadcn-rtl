import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";

const calls: Array<{ name: string; input: unknown }> = [];
let websiteEnabled = true;
const publishedWebsite = {
  mode: "PUBLISHED", locale: "en", propertySlug: "hotel-a", revisionNumber: 2,
  content: { title: "Hotel A", hero: { heading: "Welcome" }, introduction: { body: "Introduction" }, sections: [], contact: {} },
  propertyGallery: [], roomGalleries: [],
};
const publishedRooms = { mode: "PUBLISHED", locale: "en", propertySlug: "hotel-a", roomCategories: [] };

mock.module(pathToFileURL(resolve("lib/hotel/content/hotel-website-public.service.ts")).href, { namedExports: {
  getPublishedHotelWebsite: async (input: unknown) => { calls.push({ name: "website", input }); return publishedWebsite; },
  listPublishedHotelWebsiteRoomCategories: async (input: unknown) => { calls.push({ name: "rooms", input }); return publishedRooms; },
  getPublishedHotelWebsiteMedia: async (input: unknown) => { calls.push({ name: "media", input }); return { url: "https://hotel.public.blob.vercel-storage.com/image.jpg", filename: "image.jpg", mimeType: "image/jpeg" }; },
} });
mock.module(pathToFileURL(resolve("lib/hotel/services/public-website-gate.ts")).href, { namedExports: {
  isHotelWebsitePublicReadAvailable: () => websiteEnabled,
  HOTEL_WEBSITE_PUBLIC_GATE_MESSAGE: "Hotel website publication is not available",
} });

let websiteGET: typeof import("../../app/api/hotel/v1/website/properties/[propertySlug]/route").GET;
let roomsGET: typeof import("../../app/api/hotel/v1/website/properties/[propertySlug]/room-categories/route").GET;
let mediaGET: typeof import("../../app/api/hotel/v1/website/media/[associationId]/route").GET;
before(async () => {
  ({ GET: websiteGET } = await import("../../app/api/hotel/v1/website/properties/[propertySlug]/route"));
  ({ GET: roomsGET } = await import("../../app/api/hotel/v1/website/properties/[propertySlug]/room-categories/route"));
  ({ GET: mediaGET } = await import("../../app/api/hotel/v1/website/media/[associationId]/route"));
});

function request(path: string) {
  return new NextRequest(`https://hotel-a.example${path}`, { headers: { host: "hotel-a.example" } });
}

test("website and room routes pass trusted host and locale, validate response, and disable caching", { concurrency: false }, async () => {
  calls.length = 0;
  const website = await websiteGET(request("/api/hotel/v1/website/properties/hotel-a?locale=en"), { params: Promise.resolve({ propertySlug: "hotel-a" }) });
  assert.equal(website.status, 200);
  assert.equal(website.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await website.json(), publishedWebsite);
  const rooms = await roomsGET(request("/api/hotel/v1/website/properties/hotel-a/room-categories?locale=en"), { params: Promise.resolve({ propertySlug: "hotel-a" }) });
  assert.equal(rooms.status, 200);
  assert.equal(rooms.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await rooms.json(), publishedRooms);
  assert.deepEqual(calls, [
    { name: "website", input: { host: "hotel-a.example", propertySlug: "hotel-a", locale: "en", organizationSlug: null } },
    { name: "rooms", input: { host: "hotel-a.example", propertySlug: "hotel-a", locale: "en", organizationSlug: null } },
  ]);
});

test("platform organization slug is forwarded to the public Hotel resolver on platform-hosted reads", { concurrency: false }, async () => {
  calls.length = 0;
  const website = await websiteGET(request("/api/hotel/v1/website/properties/hotel-a?locale=fa&organizationSlug=damoon-hotel"), { params: Promise.resolve({ propertySlug: "hotel-a" }) });
  assert.equal(website.status, 200);
  assert.deepEqual(calls, [{ name: "website", input: { host: "hotel-a.example", propertySlug: "hotel-a", locale: "fa", organizationSlug: "damoon-hotel" } }]);
});

test("media route redirects only through its opaque association endpoint and sends safe no-store headers", { concurrency: false }, async () => {
  calls.length = 0;
  const response = await mediaGET(request("/api/hotel/v1/website/media/assoc-12345678"), { params: Promise.resolve({ associationId: "assoc-12345678" }) });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://hotel.public.blob.vercel-storage.com/image.jpg");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(calls, [{ name: "media", input: { host: "hotel-a.example", associationId: "assoc-12345678", organizationSlug: null } }]);
});

test("bad locale, slug, and media association fail without service access", { concurrency: false }, async () => {
  calls.length = 0;
  const badLocale = await websiteGET(request("/api/hotel/v1/website/properties/hotel-a?locale=de"), { params: Promise.resolve({ propertySlug: "hotel-a" }) });
  const badSlug = await roomsGET(request("/api/hotel/v1/website/properties/x/room-categories"), { params: Promise.resolve({ propertySlug: "x" }) });
  const badMedia = await mediaGET(request("/api/hotel/v1/website/media/no"), { params: Promise.resolve({ associationId: "no" }) });
  assert.equal(badLocale.status, 400);
  assert.equal(badSlug.status, 400);
  assert.equal(badMedia.status, 404);
  assert.deepEqual(calls, []);
});

test("all public website routes fail closed while the independent rollout gate is disabled", { concurrency: false }, async () => {
  calls.length = 0;
  websiteEnabled = false;
  const website = await websiteGET(request("/api/hotel/v1/website/properties/hotel-a"), { params: Promise.resolve({ propertySlug: "hotel-a" }) });
  const rooms = await roomsGET(request("/api/hotel/v1/website/properties/hotel-a/room-categories"), { params: Promise.resolve({ propertySlug: "hotel-a" }) });
  const media = await mediaGET(request("/api/hotel/v1/website/media/assoc-12345678"), { params: Promise.resolve({ associationId: "assoc-12345678" }) });
  for (const response of [website, rooms, media]) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.deepEqual(await response.json(), { error: "WEBSITE_DISABLED", message: "Hotel website publication is not available" });
  }
  assert.deepEqual(calls, [], "disabled route gate prevents database-backed service access");
  websiteEnabled = true;
});
