import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import test from "node:test";
import sourceTranslations from "../sites/damoon/translations.js";
import { readFile as readSource } from "node:fs/promises";

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
  for (const name of ["app.js", "booking.js", "booking-flow.js", "content.js", "translations.js", "damoon-attractions-data.js", "damoon-attractions-view.js", "damoon-attractions-detail-view.js", "damoon-leaflet-maps.js", "damoon-attractions.css", "vendor/leaflet/LICENSE", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-icon-2x.png", "vendor/leaflet/images/marker-shadow.png", "vendor/leaflet/images/layers.png", "vendor/leaflet/images/layers-2x.png"]) assert.ok(manifest.files[name], name);
  for (const locale of ["", "fa/", "en/", "ar/"]) {
    assert.ok(manifest.files[`${locale}attractions/index.html`], `${locale || "fa-default/"}attractions list route`);
    for (const slug of ["museum-archaeology", "grand-mosque", "atabakan-mosque", "do-khatun-shrine", "mellat-park", "chaleshtar-castle", "gerdab-ben", "zaman-khan-bridge"]) {
      assert.ok(manifest.files[`${locale}attractions/${slug}/index.html`], `${locale}${slug} route`);
    }
  }
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = resolve(root, name);
    assert.ok(file.startsWith(root + sep), "manifest entry stays in the public bundle");
    const bytes = await readFile(file);
    const normalized = name === "vendor/leaflet/LICENSE" ? Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n")) : bytes;
    assert.equal(createHash("sha256").update(normalized).digest("hex"), expected, name);
  }
  for (const [name] of Object.entries(manifest.files).filter(([name]) => /\.(?:html|js|css|json|txt)$/.test(name))) {
    const contents = await readFile(resolve(root, name), "utf8");
    assert.doesNotMatch(contents, /waze\.com|Waze/i, `${name} contains no public Waze reference`);
  }
});

test("Damoon maps use a path-scoped CSP with only the exact OSM tile image host", async () => {
  const config = await readSource(resolve("next.config.ts"), "utf8");
  const scoped = config.match(/source:\s*"\/damoon-front\/:path\*"[\s\S]{0,300}?Content-Security-Policy[^\n]+/);
  assert.ok(scoped, "the CSP is scoped to generated Damoon public assets");
  assert.match(scoped[0], /img-src 'self' data: https:\/\/tile\.openstreetmap\.org/);
  assert.doesNotMatch(scoped[0], /img-src[^;]*\*/);
  assert.doesNotMatch(scoped[0], /unsafe-inline|unsafe-eval|connect-src[^;]*tile\.openstreetmap/);
});

test("Damoon public route CSP allows OSM tiles in img-src only", async () => {
  const proxy = await readSource(resolve("proxy.ts"), "utf8");
  const policy = proxy.match(/const damoonContentSecurityPolicy = \[([\s\S]*?)\]\.join\("; "\)/)?.[1];
  assert.ok(policy, "Damoon public CSP must be explicit");
  assert.match(policy, /img-src 'self' data: https:\/\/tile\.openstreetmap\.org/);
  assert.doesNotMatch(policy, /(?:script-src|style-src|connect-src|frame-src)[^\n]*tile\.openstreetmap\.org/);
  assert.match(proxy, /function withDamoonPublicHeaders\([\s\S]*?set\("Content-Security-Policy", damoonContentSecurityPolicy\)/);
});
