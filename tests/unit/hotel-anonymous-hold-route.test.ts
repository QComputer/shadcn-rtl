import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

test("anonymous hold route fails closed unless separately operationally enabled", async () => {
  delete process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED;
  const { POST } = await import("../../app/api/hotel/v1/holds/route");
  const response = await POST(new NextRequest("https://hotel.example/api/hotel/v1/holds", { method: "POST", body: "{}" }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /stack|Prisma|SELECT|DATABASE_URL/i);
});
