import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipInitialCatalogFetch } from "../../lib/public-catalog/discovery-initial-fetch";

const base = {
  currentRequestKey: "tenant-a\0q=shoes",
  initialRequestKey: "tenant-a\0q=shoes",
  hasNavigated: false,
  saved: false,
  retryKey: 0,
  favoriteRefreshKey: 0,
  canReuseInitialProducts: true,
};

describe("Retail discovery initial server result reuse", () => {
  it("skips only the exact initial server query, including repeated StrictMode effects", () => {
    assert.equal(shouldSkipInitialCatalogFetch(base), true);
    assert.equal(shouldSkipInitialCatalogFetch(base), true);
  });

  it("fetches after URL navigation, including back navigation to the initial query", () => {
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, currentRequestKey: "tenant-a\0q=boots" }), false);
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, hasNavigated: true }), false);
  });

  it("never reuses user-specific favorites, retry results, or a prior tenant request", () => {
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, saved: true }), false);
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, canReuseInitialProducts: false }), false);
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, retryKey: 1 }), false);
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, favoriteRefreshKey: 1 }), false);
    assert.equal(shouldSkipInitialCatalogFetch({ ...base, currentRequestKey: "tenant-b\0q=shoes" }), false);
  });
});
