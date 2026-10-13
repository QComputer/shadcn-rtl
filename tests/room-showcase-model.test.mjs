import test from "node:test";
import assert from "node:assert/strict";
import { toConceptCards, photoAt, photoIndexAfter } from "../lib/rooms/room-showcase-model.ts";

test("fixture adaptation preserves source labels and images without inventing details", () => {
  const fixtures = [{ id: "c1", label: "نمونهٔ اول", image: "/images/room-concept-1.webp" }];
  const result = toConceptCards(fixtures);
  assert.deepEqual(result, [{ kind: "concept", id: "c1", title: "نمونهٔ اول", images: [{
    src: "/images/room-concept-1.webp", alt: "تصویر مفهومی مربوط به نمونهٔ اول؛ عکس واقعی هتل نیست",
  }] }]);
  assert.equal("facts" in result[0], false);
  assert.equal("price" in result[0], false);
  assert.equal("capacity" in result[0], false);
});

test("empty concept fixture yields empty room collection", () => assert.deepEqual(toConceptCards([]), []));

test("adapter creates fresh collection and cannot mutate input fixtures", () => {
  const fixture = Object.freeze({ id: "a", label: "نمونه", image: "/images/a.webp" });
  const result = toConceptCards(Object.freeze([fixture]));
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "نمونه");
});

test("gallery moves forward and backward with wrap-around", () => {
  assert.equal(photoIndexAfter(0, 1, 3), 1);
  assert.equal(photoIndexAfter(2, 1, 3), 0);
  assert.equal(photoIndexAfter(0, -1, 3), 2);
  assert.equal(photoIndexAfter(1, -1, 3), 0);
});

test("gallery guards invalid counts", () => {
  assert.equal(photoIndexAfter(1, 1, 0), 0);
  assert.equal(photoIndexAfter(1, -1, -3), 0);
  assert.equal(photoIndexAfter(1, 1, NaN), 0);
});

test("photo selection returns null for missing images", () => {
  const photos = [{ src: "/images/a.webp", alt: "تصویر" }];
  assert.deepEqual(photoAt(photos, 0), photos[0]);
  assert.equal(photoAt(photos, 1), null);
  assert.equal(photoAt([], 0), null);
});
