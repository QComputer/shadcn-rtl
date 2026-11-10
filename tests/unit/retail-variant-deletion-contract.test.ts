import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const revision = "a".repeat(64);
let retailProductUpdateSchema: typeof import("@/lib/retail/merchant-catalog.server").retailProductUpdateSchema;

mock.module(pathToFileURL(resolve("lib/db-runtime.ts")).href, { namedExports: { default: {}, prisma: {}, softDelete: async () => undefined } });
before(async () => {
  ({ retailProductUpdateSchema } = await import("@/lib/retail/merchant-catalog.server"));
});

describe("Retail variant deletion request contract", () => {
  it("requires a revision and rejects duplicate or malformed variant IDs", () => {
    assert.equal(retailProductUpdateSchema.safeParse({ deletedVariantIds: ["variant-legacy"] }).success, false);
    assert.equal(retailProductUpdateSchema.safeParse({ deletedVariantIds: ["variant-legacy", "variant-legacy"], expectedVariantRevision: revision }).success, false);
    for (const id of ["", "has space", "bad.id", "bad/id"]) {
      assert.equal(retailProductUpdateSchema.safeParse({ deletedVariantIds: [id], expectedVariantRevision: revision }).success, false, id);
    }
    assert.equal(retailProductUpdateSchema.safeParse({ deletedVariantIds: ["variant-legacy"], expectedVariantRevision: "stale" }).success, false);
  });

  it("rejects updating and deleting the same variant in one save", () => {
    const result = retailProductUpdateSchema.safeParse({
      deletedVariantIds: ["variant-legacy"],
      expectedVariantRevision: revision,
      variantUpdates: [{ id: "variant-legacy", manuallyUnavailable: true }],
    });
    assert.equal(result.success, false);
  });

  it("accepts legacy persisted IDs with a revision and keeps ordinary legacy updates valid", () => {
    const parsed = retailProductUpdateSchema.safeParse({
      deletedVariantIds: ["clxLegacyVariant_01"],
      expectedVariantRevision: revision,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.deepEqual(parsed.data.deletedVariantIds, ["clxLegacyVariant_01"]);
    assert.equal(retailProductUpdateSchema.safeParse({ name: "Legacy product", variantUpdates: [{ id: "clxLegacyVariant_01", price: 1250 }] }).success, true);
  });
});
