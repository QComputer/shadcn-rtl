import assert from "node:assert/strict";
import test from "node:test";
import { applyPublishedAccommodationCatalog } from "../accommodation.js";

function card(slug) {
  const fields = new Map(["[data-accommodation-title]", "[data-accommodation-description]", "[data-accommodation-count]"].map((selector) => [selector, { textContent: "bundle value" }]));
  return { dataset: { accommodationCategory: slug }, hidden: false, querySelector: (selector) => fields.get(selector), fields };
}

test("published Damoon catalog updates locale labels and counts on stable room cards", () => {
  const single = card("single");
  const double = card("double");
  const root = { querySelectorAll: () => [single, double] };
  assert.equal(applyPublishedAccommodationCatalog(root, { categories: [
    { slug: "single", title: "Single room", description: "Published description", count: 4 },
  ] }, "en"), true);
  assert.equal(single.fields.get("[data-accommodation-title]").textContent, "Single room");
  assert.equal(single.fields.get("[data-accommodation-description]").textContent, "Published description");
  assert.match(single.fields.get("[data-accommodation-count]").textContent, /4/);
  assert.equal(double.hidden, true, "unpublished/hidden category is not rendered from the public response");
});

test("published catalog rejects unsafe category identifiers and malformed values", () => {
  const single = card("single");
  const root = { querySelectorAll: () => [single] };
  applyPublishedAccommodationCatalog(root, { categories: [
    { slug: "<script>", title: "Injected", count: 9 },
    { slug: "single", title: "", count: -1 },
  ] });
  assert.equal(single.fields.get("[data-accommodation-title]").textContent, "bundle value");
});
