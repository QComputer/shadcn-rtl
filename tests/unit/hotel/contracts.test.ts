import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderHotelSections,
  REQUIRED_HOTEL_PAGE_SECTION_KINDS,
  validateHotelPage,
  type HotelPage,
} from "../../../lib/hotel/ui/hotel-page-contract";
import {
  DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE,
  DAMOON_PROPERTY_SLUG,
  isPublishablePlaceholder,
} from "../../../lib/hotel/dev/damoon-development-example";
import {
  availabilitySearchSchema,
  bookingRequestSchema,
  reservationLookupSchema,
} from "../../../lib/hotel/validation/hotel-contracts";
import { MAX_HOTEL_STAY_NIGHTS } from "../../../lib/hotel/domain/policy";

describe("hotel page contract", () => {
  it("orders sections deterministically", () => {
    const ordered = orderHotelSections([
      { id: "b", kind: "FAQ", visible: true, order: 20, heading: "q", items: [] },
      { id: "a", kind: "HERO", visible: true, order: 10, heading: "h" },
    ]);
    assert.deepEqual(ordered.map((section) => section.id), ["a", "b"]);
  });

  it("requires the core hotel sections", () => {
    assert.deepEqual(
      [...REQUIRED_HOTEL_PAGE_SECTION_KINDS].sort(),
      ["BOOKING_SEARCH", "HERO", "POLICIES", "ROOM_SHOWCASE"],
    );
  });

  it("flags a page that is missing a required hotel section", () => {
    const page: HotelPage = {
      ...DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE,
      sections: DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE.sections.filter(
        (section) => section.kind !== "ROOM_SHOWCASE",
      ),
    };
    const result = validateHotelPage(page);
    assert.equal(result.isValid, false);
    if (result.isValid) return;
    assert.ok(result.issues.includes("MISSING_REQUIRED_SECTION:ROOM_SHOWCASE"));
  });

  it("rejects a published page without SEO metadata", () => {
    const page: HotelPage = {
      ...DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE,
      status: "PUBLISHED",
      seo: { title: "  ", description: "", structuredDataEnabled: false },
    };
    const result = validateHotelPage(page);
    assert.equal(result.isValid, false);
    if (result.isValid) return;
    assert.ok(result.issues.includes("PUBLISHED_PAGE_REQUIRES_SEO_TITLE"));
    assert.ok(result.issues.includes("PUBLISHED_PAGE_REQUIRES_SEO_DESCRIPTION"));
  });

  it("flags duplicate section ids", () => {
    const page: HotelPage = {
      ...DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE,
      sections: [
        { id: "dup", kind: "HERO", visible: true, order: 10, heading: "a" },
        { id: "dup", kind: "FAQ", visible: true, order: 20, heading: "b", items: [] },
        { id: "s", kind: "BOOKING_SEARCH", visible: true, order: 30, defaultGuests: 2, showAvailabilityCalendar: true, ratePlanFamilies: [] },
        { id: "r", kind: "ROOM_SHOWCASE", visible: true, order: 40, heading: "r", roomTypeRefs: [], layout: "GRID" },
        { id: "p", kind: "POLICIES", visible: true, order: 50, cancellationPolicyKeys: [] },
      ],
    };
    const result = validateHotelPage(page);
    assert.equal(result.isValid, false);
    if (result.isValid) return;
    assert.ok(result.issues.includes("DUPLICATE_SECTION_ID:dup"));
  });

  it("accepts the development placeholder page as a draft", () => {
    const result = validateHotelPage(DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE);
    assert.equal(result.isValid, true);
  });

  it("keeps the Damoon placeholder non-publishable", () => {
    assert.equal(DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE.status, "DRAFT");
    assert.equal(isPublishablePlaceholder(DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE), false);
  });

  it("invents no hotel facts in the placeholder content", () => {
    // Room categories, prices, amenities and policies must all stay empty
    // until Damoon supplies verified data.
    const rooms = DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE.sections.find((section) => section.kind === "ROOM_SHOWCASE");
    assert.ok(rooms && rooms.kind === "ROOM_SHOWCASE" && rooms.roomTypeRefs.length === 0);

    const policies = DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE.sections.find((section) => section.kind === "POLICIES");
    assert.ok(policies && policies.kind === "POLICIES" && policies.cancellationPolicyKeys.length === 0);

    const search = DAMOON_DEVELOPMENT_PLACEHOLDER_PAGE.sections.find((section) => section.kind === "BOOKING_SEARCH");
    assert.ok(search && search.kind === "BOOKING_SEARCH" && search.ratePlanFamilies.length === 0);

    assert.equal(DAMOON_PROPERTY_SLUG, "damoon-hotel");
  });
});

describe("hotel validation contracts", () => {
  const validSearch = {
    property: "damoon-hotel",
    checkIn: "2026-03-21",
    checkOut: "2026-03-24",
    occupancy: { adults: 2, children: 0 },
  };

  it("accepts a well-formed availability search", () => {
    const result = availabilitySearchSchema.safeParse(validSearch);
    assert.equal(result.success, true);
  });

  it("rejects a non-ISO calendar date", () => {
    const result = availabilitySearchSchema.safeParse({ ...validSearch, checkIn: "21-03-2026" });
    assert.equal(result.success, false);
  });

  it("rejects a checkout that is not after checkin", () => {
    const result = availabilitySearchSchema.safeParse({ ...validSearch, checkOut: "2026-03-21" });
    assert.equal(result.success, false);
  });

  it("rejects an absurdly long stay", () => {
    const result = availabilitySearchSchema.safeParse({
      ...validSearch,
      checkOut: "2027-03-21",
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.ok(JSON.stringify(result.error.issues).includes(String(MAX_HOTEL_STAY_NIGHTS)));
  });

  it("rejects an uppercase slug", () => {
    const result = availabilitySearchSchema.safeParse({ ...validSearch, property: "Damoon-Hotel" });
    assert.equal(result.success, false);
  });

  it("rejects a zero-adult occupancy", () => {
    const result = availabilitySearchSchema.safeParse({
      ...validSearch,
      occupancy: { adults: 0, children: 2 },
    });
    assert.equal(result.success, false);
  });

  it("rejects a mismatched child age list", () => {
    const result = availabilitySearchSchema.safeParse({
      ...validSearch,
      occupancy: { adults: 2, children: 2, childAges: [5] },
    });
    assert.equal(result.success, false);
  });

  it("requires a primary guest and an idempotency key on booking", () => {
    const base = {
      property: "damoon-hotel",
      roomType: "standard-suite",
      ratePlan: "FLEX",
      checkIn: "2026-03-21",
      checkOut: "2026-03-24",
      occupancy: { adults: 2, children: 0 },
      contact: { fullName: "Ali Rezaei", phone: "09120000000" },
      idempotencyKey: "idem-0123456789",
      acceptedCancellationPolicyKey: "flexible",
    };

    assert.equal(bookingRequestSchema.safeParse({ ...base, guests: [{ fullName: "Ali Rezaei", isPrimary: true }] }).success, true);
    assert.equal(
      bookingRequestSchema.safeParse({ ...base, guests: [{ fullName: "Ali Rezaei", isPrimary: false }] }).success,
      false,
    );
    assert.equal(bookingRequestSchema.safeParse({ ...base, idempotencyKey: "short" }).success, false);
  });

  it("refuses a guest list larger than the declared occupancy", () => {
    const result = bookingRequestSchema.safeParse({
      property: "damoon-hotel",
      roomType: "standard-suite",
      ratePlan: "FLEX",
      checkIn: "2026-03-21",
      checkOut: "2026-03-24",
      occupancy: { adults: 1, children: 0 },
      guests: [
        { fullName: "Ali Rezaei", isPrimary: true },
        { fullName: "Sara Rezaei", isPrimary: false },
      ],
      contact: { fullName: "Ali Rezaei", phone: "09120000000" },
      idempotencyKey: "idem-0123456789",
      acceptedCancellationPolicyKey: "flexible",
    });
    assert.equal(result.success, false);
  });

  it("has no client-supplied amount field on the booking contract", () => {
    const shape = Object.keys(bookingRequestSchema.shape).join(",");
    assert.equal(shape.includes("total"), false);
    assert.equal(shape.includes("amount"), false);
    assert.equal(shape.includes("price"), false);
  });

  it("requires a reference and phone to look up a reservation", () => {
    assert.equal(reservationLookupSchema.safeParse({ reference: "DMN-2026-0001", contactPhone: "09120000000" }).success, true);
    assert.equal(reservationLookupSchema.safeParse({ reference: "dmn-2026-0001", contactPhone: "09120000000" }).success, false);
    assert.equal(reservationLookupSchema.safeParse({ reference: "DMN-2026-0001" }).success, false);
  });
});