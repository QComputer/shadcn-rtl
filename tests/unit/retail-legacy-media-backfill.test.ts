import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLegacyProductMediaBackfillSql } from "../../scripts/retail/backfill-legacy-product-media.mjs";

const identity = { organizationId: "org-retail-1", expectedDatabase: "retail_preview" };

describe("legacy product media backfill SQL", () => {
  it("requires a tenant and expected database identity", () => {
    assert.throws(() => buildLegacyProductMediaBackfillSql({ expectedDatabase: "retail_preview" }), /organizationId is required/);
    assert.throws(() => buildLegacyProductMediaBackfillSql({ organizationId: "org-retail-1" }), /expectedDatabase is required/);
  });

  it("quotes the tenant literal and limits candidates to unambiguous owned public images", () => {
    const sql = buildLegacyProductMediaBackfillSql({ ...identity, organizationId: "store' OR TRUE --" });
    assert.match(sql, /p\."organizationId" = 'store'' OR TRUE --'/);
    assert.match(sql, /i\."organizationId" = p\."organizationId"/);
    assert.match(sql, /i\."access" = 'PUBLIC'/);
    assert.match(sql, /p\."deletedAt" IS NULL/);
    assert.match(sql, /NOT EXISTS \([\s\S]*relation\."B" = p\."id"/);
    assert.match(sql, /HAVING count\(\*\) = 1/);
    assert.match(sql, /FROM candidates[\s\S]*ORDER BY/);
    assert.doesNotMatch(sql, /INSERT INTO/);
  });

  it("previews by default and inserts only candidates when apply is explicit", () => {
    const preview = buildLegacyProductMediaBackfillSql(identity);
    const apply = buildLegacyProductMediaBackfillSql({ ...identity, apply: true });
    assert.match(preview, /SELECT "productId", "imageId", "slug"/);
    assert.doesNotMatch(preview, /INSERT INTO/);
    assert.match(apply, /INSERT INTO "_ImageToProduct" \("A", "B"\)/);
    assert.match(apply, /ON CONFLICT DO NOTHING/);
    assert.match(apply, /RETURNING "A" AS "imageId", "B" AS "productId"/);
    assert.match(apply, /candidates\."slug"/);
  });

  it("rejects non-boolean apply modes", () => {
    assert.throws(() => buildLegacyProductMediaBackfillSql({ ...identity, apply: "true" as unknown as boolean }), /apply must be a boolean/);
  });
});
