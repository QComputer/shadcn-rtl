import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import test from "node:test";
import sourceTranslations from "../sites/damoon/translations.js";

test("shared-public English and Arabic retain every translated UI key from the reviewed source", async () => {
  const source = await readFile(resolve("public/damoon-front/translations.js"), "utf8");
  const { default: publicTranslations } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  for (const locale of ["en", "ar"]) {
    for (const key of Object.keys(sourceTranslations[locale].ui)) {
      assert.ok(publicTranslations[locale].ui[key], `${locale}.${key} must not silently fall back to Persian`);
    }
    for (const key of ["adults", "children", "childAge", "childAgeRequired", "bookingSubmit", "datePlanningOnly"]) {
      assert.equal(publicTranslations[locale].ui[key], sourceTranslations[locale].ui[key], `${locale}.${key} coordination contract`);
    }
  }
});

test("reviewed Damoon shared bundle matches its manifest and retains concept-image status", async () => {
  const root = resolve("public/damoon-front");
  const manifest = JSON.parse(await readFile(resolve(root, "release-manifest.json"), "utf8"));
  assert.equal(manifest.site, "damoon");
  assert.equal(manifest.contentMode, "DEVELOPMENT_WITH_CONCEPT_IMAGES", "missing approved photos must not be presented as real photography");
  for (const name of ["app.js", "booking.js", "booking-flow.js", "content.js", "translations.js"]) assert.ok(manifest.files[name], name);
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = resolve(root, name);
    assert.ok(file.startsWith(root + sep), "manifest entry stays in the public bundle");
    assert.equal(createHash("sha256").update(await readFile(file)).digest("hex"), expected, name);
  }
});
