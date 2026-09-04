import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicHandoffQuerySchema, PUBLIC_HANDOFF_VERSION } from "@/lib/public-handoff/contracts";

describe("Public Handoff API v1 contract", () => {
  it("enforces bounded explicit pagination and strict externalSource validation", () => {
    assert.equal(PUBLIC_HANDOFF_VERSION, "v1");
    assert.deepEqual(publicHandoffQuerySchema.parse({ externalSource: " CAFELEO_PUBLIC_CATALOG_V1 ", page: "1", limit: "50" }), {
      externalSource: "CAFELEO_PUBLIC_CATALOG_V1",
      page: 1,
      limit: 50,
    });
    assert.deepEqual(publicHandoffQuerySchema.parse({ externalSource: "X".repeat(160) }), { externalSource: "X".repeat(160), page: 1, limit: 20 });
    assert.throws(() => publicHandoffQuerySchema.parse({ externalSource: "" }), /too_small/);
    assert.throws(() => publicHandoffQuerySchema.parse({ externalSource: "X".repeat(161) }), /too_big/);
    assert.throws(() => publicHandoffQuerySchema.parse({ page: "0" }), /too_small/);
    assert.throws(() => publicHandoffQuerySchema.parse({ limit: "0" }), /too_small/);
    assert.throws(() => publicHandoffQuerySchema.parse({ limit: "51" }), /too_big/);
    assert.throws(() => publicHandoffQuerySchema.parse({ externalSource: [], page: 1 }), /expected string/);
    assert.throws(() => publicHandoffQuerySchema.parse({ externalSource: {}, page: 1 }), /expected string/);
    assert.throws(() => publicHandoffQuerySchema.parse({ externalSource: "ok", page: 1, limit: 20, extra: 1 }), /Unrecognized/);
  });
});
