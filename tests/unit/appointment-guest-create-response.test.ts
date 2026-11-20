import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

let session: { user: { id: string; role: string } } | null = null;
const guestAppointment = {
  id: "internal-appointment-id",
  bookingReference: "GF1-REFERENCE",
  date: new Date("2030-01-01T00:00:00Z"),
  startTime: new Date("2030-01-01T08:00:00Z"),
  endTime: new Date("2030-01-01T08:30:00Z"),
  status: "PENDING",
  notes: "private note",
  trackingTokenHash: "private-hash",
  trackingTokenExpiresAt: new Date("2030-04-01T00:00:00Z"),
  customerId: null,
  guestCustomerId: "internal-guest-id",
  service: {
    id: "internal-service-id",
    name: "Synthetic service",
    duration: 30,
    price: "250000",
    organization: { id: "internal-org-id", name: "Synthetic tenant", slug: "synthetic-tenant", phone: "private-phone" },
    category: { id: "internal-category-id", name: "Synthetic category" },
  },
  guestCustomer: { id: "internal-guest-id", phone: "private-phone" },
  customer: null,
};

mock.module("@/lib/auth", { namedExports: { auth: async () => session } });
mock.module("@/lib/db", { namedExports: { prisma: {
  guestCustomer: { upsert: async () => ({ id: "internal-guest-id" }) },
} } });
mock.module("@/lib/services/appointment.service", { namedExports: { appointmentService: {
  create: async () => ({ appointment: { id: "existing-customer-contract", status: "PENDING" } }),
  createForGuest: async () => ({ appointment: guestAppointment, trackingToken: "one-time-guest-token" }),
} } });

let route: typeof import("../../app/api/appointments/route");
before(async () => {
  route = await import("../../app/api/appointments/route");
});

const makeRequest = () => new NextRequest("https://tenant.example/api/appointments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    serviceId: "clh1234567890123456789012",
    date: "2030-01-01T00:00:00.000Z",
    startTime: "2030-01-01T08:00:00.000Z",
    customerName: "Synthetic Guest",
    customerPhone: "09123456789",
  }),
});

test("guest creation returns one tracking credential and a sanitized appointment DTO", async () => {
  session = null;
  const response = await route.POST(makeRequest());
  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.trackingToken, "one-time-guest-token");
  assert.deepEqual(json.appointment, {
    bookingReference: "GF1-REFERENCE",
    date: "2030-01-01T00:00:00.000Z",
    startTime: "2030-01-01T08:00:00.000Z",
    endTime: "2030-01-01T08:30:00.000Z",
    status: "PENDING",
    service: {
      name: "Synthetic service",
      duration: 30,
      price: 250000,
      organization: { name: "Synthetic tenant", slug: "synthetic-tenant" },
    },
  });
  assert.doesNotMatch(JSON.stringify(json), /private-hash|private note|private-phone|internal-appointment-id|internal-guest-id|internal-org-id/);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(response.headers.get("set-cookie")?.includes("guest_session_id_local"));
});

test("authenticated CUSTOMER creation preserves its original response contract", async () => {
  session = { user: { id: "customer-id", role: "CUSTOMER" } };
  const response = await route.POST(makeRequest());
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "existing-customer-contract", status: "PENDING" });
  session = null;
});
