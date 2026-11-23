import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { Prisma } from "@prisma/client";
import { hotelGuestBookingRequestSchema } from "@/lib/hotel/validation/hotel-contracts";

class TestApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Row = Prisma.HotelGuestBookingRequestUncheckedCreateInput & {
  status: string;
  managerMessage: string;
  createdAt: Date;
  updatedAt: Date;
};

const rows: Row[] = [];
const createdAt = new Date("2026-11-21T09:00:00.000Z");
let propertyEnabled = true;
let publicationEnabled = false;
let availabilityChecks = 0;
let createAttempts = 0;
const bookingRequests = {
  async findFirst({ where }: { where: Partial<Row> }) {
    return rows.find((row) => Object.entries(where).every(([key, value]) => row[key as keyof Row] === value)) ?? null;
  },
  async create({ data }: { data: Prisma.HotelGuestBookingRequestUncheckedCreateInput }) {
    createAttempts++;
    if (rows.some((row) => row.organizationId === data.organizationId && row.idempotencyHash === data.idempotencyHash)) {
      throw new Prisma.PrismaClientKnownRequestError("Duplicate idempotency key", { code: "P2002", clientVersion: "test" });
    }
    rows.push({ roomTypeSlug: null, ratePlanCode: null, availabilityHint: "UNKNOWN", ...data, status: "RECEIVED", managerMessage: "Reception note fixture", createdAt, updatedAt: createdAt });
  },
};

mock.module("@/lib/api-guards", { namedExports: { ApiError: TestApiError } });
mock.module("@/lib/db-runtime", { namedExports: { prisma: {
  hotelGuestBookingRequest: bookingRequests,
  async $transaction(action: (tx: unknown) => Promise<void>) {
    return action({
      hotelGuestBookingRequest: bookingRequests,
      async $queryRaw(query: Prisma.Sql) {
        assert.match(query.sql, /"isActive" AND "deletedAt" IS NULL AND "operationalMode" = 'REQUEST_ONLY'\s+FOR SHARE/);
        assert.match(query.sql, /"organizationId" = \? AND "slug" = \?/);
        if (!propertyEnabled) return [];
        if (query.values[0] === "org-damoon" && query.values[1] === "damoon-hotel") return [{ id: "property-damoon" }];
        if (query.values[0] === "org-other-hotel" && query.values[1] === "other-hotel") return [{ id: "property-other-hotel" }];
        return [];
      },
    });
  },
} } });
mock.module("@/lib/hotel/services/hotel-publication.service", { namedExports: {
  async resolveHotelTenantForHost(host: string | null) {
    if (host === "damoon.example") return { organizationId: "org-damoon" };
    if (host === "other-hotel.example") return { organizationId: "org-other-hotel" };
    return null;
  },
} });
mock.module("@/lib/hotel/services/public-publication-gate", { namedExports: {
  isApprovedHotelPublicationAvailable: () => publicationEnabled,
} });
mock.module("@/lib/hotel/services/public-availability.service", { namedExports: {
  async searchPublishedHotelAvailability() {
    availabilityChecks++;
    assert.equal(publicationEnabled, true);
    return { property: { id: "property-damoon" }, options: [{ roomType: { slug: "suite" }, ratePlan: { code: "standard" }, isAvailable: true }] };
  },
} });

let service: typeof import("@/lib/hotel/guest-booking-request.server");
const config = { AUTH_SECRET: process.env.AUTH_SECRET, HOTEL_GUEST_BOOKING_REQUEST_ENABLED: process.env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED };
before(async () => {
  process.env.AUTH_SECRET = "fixture-secret-for-synthetic-tracking-only";
  process.env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED = "1";
  service = await import("@/lib/hotel/guest-booking-request.server");
});

after(() => {
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const details = {
  kind: "coordination",
  preferredCategory: "studio-suite",
  property: "damoon-hotel",
  checkIn: "2026-12-15",
  checkOut: "2026-12-16",
  occupancy: { adults: 2, children: 1, childAges: [7] },
  contact: { fullName: "Synthetic Guest", phone: "09120000000", email: "guest@example.test" },
  specialRequests: "Synthetic note",
};

const input = hotelGuestBookingRequestSchema.parse(details);
const requestHeaders = (host = "damoon.example") => new Headers({ host });
const hasStatus = (status: number) => (error: unknown) => error instanceof TestApiError && error.status === status;

test("coordination requires an explicit kind and calendar dates and rejects room or rate fields", () => {
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, kind: undefined }).success, false);
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, preferredCategory: undefined }).success, true);
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, preferredCategory: "other-hotel-category" }).success, true);
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, preferredCategory: "../unsafe" }).success, false);
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, checkIn: "2026-02-30" }).success, false);
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, roomType: "suite", ratePlan: "standard" }).success, false);
  assert.equal(hotelGuestBookingRequestSchema.safeParse({ ...details, kind: undefined, roomType: "suite", ratePlan: "standard" }).success, true);
});

test("coordination persists once without publication or availability, with private scoped tracking", async () => {
  const { submitHotelGuestBookingRequest, readHotelGuestBookingRequestStatus } = service;
  const key = "coordination-key-0001";
  const priorCreateAttempts = createAttempts;
  const results = await Promise.all([
    submitHotelGuestBookingRequest(input, requestHeaders(), key),
    submitHotelGuestBookingRequest(input, requestHeaders(), key),
  ]);
  assert.equal(results[0].reference, results[1].reference);
  assert.match(results[0].reference, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(results.map(({ replay }) => replay).sort(), [false, true]);
  assert.equal(createAttempts - priorCreateAttempts, 2, "both requests raced to create and the unique constraint recovered one replay");
  assert.equal(results[0].availabilityHint, undefined);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organizationId, "org-damoon");
  assert.equal(rows[0].propertyId, "property-damoon");
  assert.equal(rows[0].roomTypeSlug, null);
  assert.equal(rows[0].ratePlanCode, null);
  assert.equal(rows[0].preferredCategory, "studio-suite");
  assert.equal(rows[0].availabilityHint, "UNKNOWN");
  assert.notEqual(rows[0].trackingReferenceHash, results[0].reference);
  assert.deepEqual(await readHotelGuestBookingRequestStatus(results[0].reference, "damoon.example"), {
    status: "RECEIVED",
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  });
  await assert.rejects(readHotelGuestBookingRequestStatus(results[0].reference, "other-hotel.example"), hasStatus(404));
  await assert.rejects(submitHotelGuestBookingRequest({ ...input, specialRequests: "Different note" }, requestHeaders(), key), hasStatus(409));
  const changedCategory = hotelGuestBookingRequestSchema.parse({ ...details, preferredCategory: "standard-room" });
  await assert.rejects(submitHotelGuestBookingRequest(changedCategory, requestHeaders(), key), hasStatus(409));
  assert.equal(availabilityChecks, 0);
});

test("the same idempotency key is isolated by tenant for create and tracking", async () => {
  const { submitHotelGuestBookingRequest, readHotelGuestBookingRequestStatus } = service;
  const key = "shared-tenant-key-0001";
  const before = rows.length;
  const damoon = await submitHotelGuestBookingRequest(input, requestHeaders("damoon.example"), key);
  const otherInput = hotelGuestBookingRequestSchema.parse({ ...details, property: "other-hotel" });
  const otherTenant = await submitHotelGuestBookingRequest(otherInput, requestHeaders("other-hotel.example"), key);

  assert.notEqual(damoon.reference, otherTenant.reference);
  assert.equal(rows.length, before + 2);
  assert.equal(rows.at(-2)?.organizationId, "org-damoon");
  assert.equal(rows.at(-1)?.organizationId, "org-other-hotel");
  assert.deepEqual(await readHotelGuestBookingRequestStatus(damoon.reference, "damoon.example"), {
    status: "RECEIVED",
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  });
  await assert.rejects(readHotelGuestBookingRequestStatus(damoon.reference, "other-hotel.example"), hasStatus(404));
  await assert.rejects(readHotelGuestBookingRequestStatus(otherTenant.reference, "damoon.example"), hasStatus(404));
});

test("coordination fails closed for disabled requests, missing child ages and unverified or mismatched hosts", async () => {
  const { submitHotelGuestBookingRequest } = service;
  const key = "coordination-key-0002";
  const count = rows.length;
  await assert.rejects(submitHotelGuestBookingRequest(input, requestHeaders("unknown.example"), key), hasStatus(404));
  await assert.rejects(submitHotelGuestBookingRequest(input, requestHeaders("other-hotel.example"), key), hasStatus(404));
  await assert.rejects(submitHotelGuestBookingRequest({ ...input, occupancy: { ...input.occupancy, childAges: undefined } }, requestHeaders(), key), hasStatus(400));
  propertyEnabled = false;
  try {
    await assert.rejects(submitHotelGuestBookingRequest(input, requestHeaders(), key), hasStatus(404));
  } finally {
    propertyEnabled = true;
  }
  process.env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED = "0";
  try {
    await assert.rejects(submitHotelGuestBookingRequest(input, requestHeaders(), key), hasStatus(503));
  } finally {
    process.env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED = "1";
  }
  assert.equal(rows.length, count);
  assert.equal(availabilityChecks, 0);
});

test("existing priced requests still require publication and retain the rate-backed tracking response", async () => {
  const { submitHotelGuestBookingRequest, readHotelGuestBookingRequestStatus } = service;
  const priced = hotelGuestBookingRequestSchema.parse({ ...details, kind: undefined, roomType: "suite", ratePlan: "standard" });
  const key = "legacy-priced-key-0001";
  await assert.rejects(submitHotelGuestBookingRequest(priced, requestHeaders(), key), hasStatus(503));
  publicationEnabled = true;
  try {
    const result = await submitHotelGuestBookingRequest(priced, requestHeaders(), key);
    assert.equal(result.availabilityHint, "AVAILABLE");
    const row = rows.at(-1);
    assert.equal(row?.roomTypeSlug, "suite");
    assert.equal(row?.ratePlanCode, "standard");
    assert.deepEqual(await readHotelGuestBookingRequestStatus(result.reference, "damoon.example"), {
      status: "RECEIVED",
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      availabilityHint: "AVAILABLE",
      managerMessage: "Reception note fixture",
    });
    assert.equal(availabilityChecks, 1);
  } finally {
    publicationEnabled = false;
  }
});
