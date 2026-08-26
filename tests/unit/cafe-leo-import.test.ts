import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCafeLeoImageUrl, buildCafeLeoDefaultVariantSku, buildCafeLeoProductSku } from "../../prisma/seed-data/cafe-leo-menu";

describe("Cafe Leo importer helpers", () => {
  it("uses stable deterministic source identities", () => {
    assert.equal(buildCafeLeoProductSku("hot-coffee-1"), "CAFELEO-hot-coffee-1");
    assert.equal(buildCafeLeoDefaultVariantSku("hot-coffee-1"), "CAFELEO-hot-coffee-1-DEFAULT");
  });

  it("allows only Cafe Leo source images", () => {
    assert.equal(
      assertCafeLeoImageUrl("/media/images/products/cafeleo-cup-120-520x.webp"),
      "https://iran.cafeleo.vip/media/images/products/cafeleo-cup-120-520x.webp",
    );
    assert.throws(() => assertCafeLeoImageUrl("http://iran.cafeleo.vip/image.webp"), /must use https/);
    assert.throws(() => assertCafeLeoImageUrl("https://example.com/image.webp"), /host is not allowed/);
    assert.throws(() => assertCafeLeoImageUrl("https://user:pass@iran.cafeleo.vip/image.webp"), /must not contain credentials/);
  });
});
