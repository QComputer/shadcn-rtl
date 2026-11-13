import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const required = ["DATABASE_URL", "DIRECT_URL", "DAMOON_STANDALONE_URL", "DAMOON_PUBLIC_HOST"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);
if (process.env.NODE_ENV !== "test" || process.env.DAMOON_E2E_ENABLED !== "1") throw new Error("This check is restricted to the disposable Damoon E2E job");
if (process.env.DATABASE_URL !== process.env.DIRECT_URL) throw new Error("Database URLs must match exactly");
if (!/^damoon_[a-f0-9]{16}$/i.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error("Expected uniquely named disposable database");
if (process.env.HOTEL_GUEST_BOOKING_REQUEST_ENABLED !== "0") throw new Error("Guest request gate must be disabled for this verification");

const organizationId = process.env.DAMOON_ORGANIZATION_ID;
const idempotencyKey = `disabled-gate-${randomUUID()}`;
const beforeClient = new PrismaClient();
const beforeCount = await beforeClient.hotelGuestBookingRequest.count({ where: { organizationId } });
await beforeClient.$disconnect();

const host = process.env.DAMOON_PUBLIC_HOST;
const response = await fetch(new URL("/api/hotel/v1/requests", process.env.DAMOON_STANDALONE_URL), {
  method: "POST",
  headers: { Host: host, Origin: process.env.DAMOON_STANDALONE_URL, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
  body: JSON.stringify({
    property: process.env.DAMOON_PROPERTY_SLUG,
    roomType: process.env.DAMOON_ROOM_TYPE_SLUG,
    ratePlan: process.env.DAMOON_RATE_PLAN_CODE,
    checkIn: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
    occupancy: { adults: 2, children: 0 },
    contact: { fullName: "Disabled Gate Fixture", phone: "+989120000000", email: `disabled-${randomUUID()}@example.test` },
  }),
});
assert.equal(response.status, 503, `disabled request gate must return 503; got ${response.status}`);

const afterClient = new PrismaClient();
const afterCount = await afterClient.hotelGuestBookingRequest.count({ where: { organizationId } });
const idempotencyHash = createHash("sha256").update(`${organizationId}\0${idempotencyKey}`).digest("hex");
const leaked = await afterClient.hotelGuestBookingRequest.count({ where: { organizationId, idempotencyHash } });
await afterClient.$disconnect();
assert.equal(afterCount, beforeCount, "disabled gate must not persist a guest request");
assert.equal(leaked, 0, "disabled gate must not persist the rejected idempotency key");
console.log("Disabled guest request gate returned 503 and persisted no request.");
