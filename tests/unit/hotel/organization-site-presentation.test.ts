import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptAuthenticatedHotelWebsitePreview,
  adaptHotelOrganizationPublicRead,
  adaptSyntheticHotelPreview,
  hotelOrganizationRobots,
} from "@/lib/hotel/organization-site-presentation";

const expected = { organizationId: "org-damoon-test", organizationSlug: "damoon-hotel", propertySlug: "damoon-test-property", locale: "fa" as const, contentProvenance: "SYNTHETIC" as const };

function publicPayload() {
  return [
    {
      mode: "PUBLISHED", locale: "fa", propertySlug: expected.propertySlug, revisionNumber: 2,
      content: { title: "دادهٔ ساختگی آزمون", hero: { heading: "نمایش مصنوعی آزمون" }, introduction: { body: "این متن فقط برای آزمون رابط است." }, sections: [], contact: {} },
      propertyGallery: [{ src: "/api/hotel/v1/website/media/opaque-media-id-1", altText: "تصویر ساختگی", sortOrder: 0, slot: "HERO_DESKTOP" }], roomGalleries: [],
    },
    { mode: "PUBLISHED", locale: "fa", propertySlug: expected.propertySlug, roomCategories: [] },
  ];
}

function previewPayload() {
  return {
    mode: "PREVIEW", locale: "fa", revisionId: "revision-123", revisionNumber: 3, status: "DRAFT", pageKey: "HOME",
    content: {
      title: { fa: "عنوان پیش‌نویس مصنوعی" },
      hero: { heading: { fa: "پیش‌نمایش خصوصی مصنوعی" } },
      introduction: { body: { fa: "محتوای ساختگی فقط برای مرور." } },
      sections: [{ key: "private-note", order: 1, visible: false, kind: "TEXT", heading: {}, body: { fa: "نباید نمایش داده شود." } }],
      contact: {},
    },
    media: [{ imageId: "synthetic-image", src: "/uploads/synthetic-preview.webp", scope: "PROPERTY", roomTypeId: null, slot: "HERO_DESKTOP", sortOrder: 0, altText: { fa: "تصویر مفهومی ساختگی" } }],
  };
}

test("organization public adapter consumes only matching F5 published scope and preserves media URLs", () => {
  const [website, rooms] = publicPayload();
  const presentation = adaptHotelOrganizationPublicRead(website, rooms, expected);
  assert.equal(presentation.status, "PUBLISHED");
  if (presentation.status !== "PUBLISHED") return;
  assert.equal(presentation.source, "PUBLIC_API");
  assert.equal(presentation.website.heroDesktop?.src, "/api/hotel/v1/website/media/opaque-media-id-1");
  assert.deepEqual(presentation.website.roomCards, []);
  assert.throws(() => adaptHotelOrganizationPublicRead(website, rooms, { ...expected, propertySlug: "other-property" }));
});

test("organization route can represent unpublished and unavailable without falling back to preview", () => {
  const [website, rooms] = publicPayload();
  const unpublished = adaptHotelOrganizationPublicRead({ mode: "UNPUBLISHED", locale: "fa", propertySlug: expected.propertySlug, content: null, propertyGallery: [], roomGalleries: [] }, { mode: "UNPUBLISHED", locale: "fa", propertySlug: expected.propertySlug, roomCategories: [] }, expected);
  assert.equal(unpublished.status, "UNPUBLISHED");
  assert.equal(hotelOrganizationRobots({ status: unpublished.status }).index, false);
  assert.throws(() => adaptHotelOrganizationPublicRead({ ...website as object, propertySlug: "foreign" }, rooms, expected));
});

test("private CMS preview is localized, labeled as review-only data, and excludes invisible sections", () => {
  const presentation = adaptAuthenticatedHotelWebsitePreview(previewPayload(), expected);
  assert.equal(presentation.status, "PREVIEW");
  if (presentation.status !== "PREVIEW") return;
  assert.equal(presentation.source, "AUTHENTICATED_CMS_PREVIEW");
  assert.equal(presentation.revisionStatus, "DRAFT");
  assert.equal(presentation.website.content.title, "عنوان پیش‌نویس مصنوعی");
  assert.deepEqual(presentation.website.content.sections, []);
  assert.equal(presentation.website.heroDesktop?.src, "/uploads/synthetic-preview.webp");
  assert.deepEqual(hotelOrganizationRobots({ status: presentation.status, source: presentation.source, approvedForIndexing: true, websiteCapabilityActive: true, organizationActive: true }), { index: false, follow: false });
});

test("synthetic preview stays noindex even when the source shape resembles published data", () => {
  const [website, rooms] = publicPayload();
  const presentation = adaptSyntheticHotelPreview(website, rooms, expected);
  assert.equal(presentation.status, "PREVIEW");
  if (presentation.status !== "PREVIEW") return;
  assert.equal(presentation.source, "SYNTHETIC_PREVIEW");
  assert.deepEqual(hotelOrganizationRobots({ status: presentation.status, source: presentation.source, approvedForIndexing: true, websiteCapabilityActive: true, organizationActive: true }), { index: false, follow: false });
  assert.deepEqual(hotelOrganizationRobots({ status: "PUBLISHED", source: "PUBLIC_API", contentProvenance: "OWNER_APPROVED", approvedForIndexing: true, websiteCapabilityActive: true, organizationActive: true }), { index: true, follow: true });
  assert.deepEqual(hotelOrganizationRobots({ status: "PUBLISHED", source: "PUBLIC_API", approvedForIndexing: true }), { index: false, follow: false });
});

test("preview rejects wrong locale, malformed payload, and missing trusted organization scope", () => {
  assert.throws(() => adaptAuthenticatedHotelWebsitePreview({ ...previewPayload(), locale: "en" }, expected));
  assert.throws(() => adaptAuthenticatedHotelWebsitePreview(previewPayload(), { ...expected, organizationId: "" }));
  assert.throws(() => adaptAuthenticatedHotelWebsitePreview({ ...previewPayload(), pageKey: "OTHER" }, expected));
  assert.throws(() => adaptAuthenticatedHotelWebsitePreview({ ...previewPayload(), media: [{ ...previewPayload().media[0], src: "https://untrusted.example/secret.jpg" }] }, expected));
});
