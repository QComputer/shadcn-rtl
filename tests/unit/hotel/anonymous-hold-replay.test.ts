import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";

const malformedHoldIds: readonly [string, unknown][] = [
  ["missing", undefined],
  ["null", null],
  ["empty", ""],
  ["whitespace", "   "],
  ["wrong type", { id: "otherwise-valid" }],
  ["malformed UUID", "not-a-hold-uuid"],
];

for (const [label, holdId] of malformedHoldIds) {
  test(`anonymous hold replay rejects ${label} persisted holdId before querying a hold`, async () => {
    let holdLookupCount = 0;
    const client = {
      $queryRaw: async () => [{ requestFingerprint: "fingerprint", status: "COMPLETED", resultJson: { holdId } }],
      hotelBookingHold: {
        findFirst: async () => {
          holdLookupCount += 1;
          return { status: "ACTIVE", expiresAt: new Date(Date.now() + 60_000) };
        },
      },
    };
    const repositories = new PrismaHotelRepositories(client as never);

    const result = await repositories.findAnonymousHoldReplay({
      scope: { organizationId: "org-test" },
      idempotencyKey: "test-key-123",
      requestFingerprint: "fingerprint",
      propertySlug: "hotel",
      roomTypeSlug: "standard",
      ratePlanCode: "flex",
    });

    assert.equal(result, null);
    assert.equal(holdLookupCount, 0);
  });
}
