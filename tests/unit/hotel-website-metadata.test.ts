import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHotelWebsiteMetadata } from "../../lib/hotel/website-metadata";

const seoContext = {
  isCustomDomain: true,
  organizationRootNavigation: "hard" as const,
  baseUrl: "https://hotel.example",
  path: "/fa",
  alternatePath: (locale: "fa" | "en" | "ar") => `/${locale}`,
};

describe("published Hotel website metadata", () => {
  it("uses only localized published revision fields and tenant-domain alternates", () => {
    const metadata = buildHotelWebsiteMetadata({
      locale: "fa",
      seoContext,
      state: {
        mode: "PUBLISHED",
        locale: "fa",
        propertySlug: "central",
        revisionNumber: 3,
        content: {
          title: "هتل نمونه",
          hero: { heading: "اقامت آرام", subheading: "در مرکز شهر" },
          introduction: { heading: null, body: "توضیح تأییدشده" },
          sections: [],
          contact: {},
        },
        propertyGallery: [],
        roomGalleries: [],
      },
    });

    assert.equal(metadata.title, "هتل نمونه");
    assert.equal(metadata.description, "توضیح تأییدشده");
    assert.deepEqual(metadata.alternates?.canonical, "https://hotel.example/fa");
    assert.deepEqual(metadata.alternates?.languages, {
      "fa-IR": "https://hotel.example/fa",
      "en-US": "https://hotel.example/en",
      "ar-SA": "https://hotel.example/ar",
      "x-default": "https://hotel.example/fa",
    });
    assert.deepEqual(metadata.openGraph && "images" in metadata.openGraph ? metadata.openGraph.images : undefined, []);
  });

  it("does not fabricate descriptions or expose indexable metadata without publication", () => {
    const unpublished = buildHotelWebsiteMetadata({
      locale: "fa",
      state: { mode: "UNPUBLISHED", locale: "fa", propertySlug: "central", content: null, propertyGallery: [], roomGalleries: [] },
    });
    assert.equal(unpublished.description, "");
    assert.equal(unpublished.robots && typeof unpublished.robots === "object" ? unpublished.robots.index : undefined, false);
    assert.equal(unpublished.alternates?.canonical, null);

    const unavailable = buildHotelWebsiteMetadata({ locale: "fa", state: null });
    assert.equal(unavailable.description, "");
    assert.equal(unavailable.robots && typeof unavailable.robots === "object" ? unavailable.robots.index : undefined, false);
    assert.equal(unavailable.alternates?.canonical, null);
  });
});
