import assert from "node:assert/strict";
import test from "node:test";
import { normalizePath, pageForPath } from "../content.js";
import { damoonAttractionsData } from "../damoon-attractions-data.js";
import { getDamoonAttraction, renderDamoonAttractionDetailPage } from "../damoon-attractions-detail-view.js";
import { renderDamoonAttractionsPage } from "../damoon-attractions-view.js";

const locales = ["fa", "en", "ar"];
const expectedSlugs = ["museum-archaeology", "grand-mosque", "atabakan-mosque", "do-khatun-shrine", "mellat-park", "chaleshtar-castle", "gerdab-ben", "zaman-khan-bridge"];
const stripTags = html => html.replace(/<[^>]*>/g, " ").replaceAll("&amp;", "&").replace(/\s+/g, " ");
const externalAnchors = html => [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(match => match[0]);

test("canonical attractions data keeps approximate coordinates and straight-line distances distinct from road routes", () => {
  assert.equal(damoonAttractionsData.attractions.length, 8);
  assert.deepEqual(damoonAttractionsData.attractions.map(item => item.id), expectedSlugs);
  assert.equal(damoonAttractionsData.hotel.geo.status, "PUBLIC_MAP_POINT_NOT_OWNER_APPROVED");
  for (const item of damoonAttractionsData.attractions) {
    assert.equal(item.distanceFromHotel.roadKm, null, `${item.id} has no unverified road distance`);
    assert.equal(item.distanceFromHotel.roadKmStatus, "NOT_VERIFIED");
    assert.ok(Number.isFinite(item.distanceFromHotel.straightLineKm));
    assert.deepEqual(Object.keys(item.content).sort(), locales.toSorted());
    assert.deepEqual(Object.keys(item.detail).sort(), locales.toSorted());
  }
  const bridge = getDamoonAttraction("zaman-khan-bridge");
  assert.equal(bridge.visitStatus.status, "OPEN_FOR_VISIT");
  assert.match(bridge.visitorAdvisory.en, /accessible to visitors/i);
});

test("list renders eight localized cards, map fallbacks and explicit pending-pin/straight-line wording", () => {
  for (const locale of locales) {
    const html = renderDamoonAttractionsPage(locale);
    assert.equal((html.match(/class="da-card"/g) || []).length, 8, `${locale} has eight attraction cards`);
    assert.ok(html.includes(`lang="${locale}"`));
    assert.match(html, /straight-line|فاصله مستقیم|المسافة المباشرة|مسافة مباشرة/i);
    assert.ok(html.includes(damoonAttractionsData.labels[locale].pinPending));
    assert.match(html, /openstreetmap\.org\/\?mlat=/);
    assert.match(html, /waze\.com\/live-map\/directions/);
    assert.doesNotMatch(html, /<iframe\b|data-da-load-map|export\/embed\.html/i);
    assert.doesNotMatch(stripTags(html), /32\.32657|50\.85848/);
    assert.doesNotMatch(html, /&origin=/, "directions do not imply the provisional hotel pin is a verified start point");
    for (const slug of expectedSlugs) assert.match(html, new RegExp(`/${locale}/attractions/${slug}(?:["?])`));
    for (const anchor of externalAnchors(html)) assert.match(anchor, /rel="noopener noreferrer"/);
    assert.equal((html.match(/class="da-details"/g) || []).length, 8, `${locale} exposes sources for all eight locations`);
  }
});

test("all 24 detail routes render localized source-backed copy; unknown slugs stay not found", () => {
  for (const locale of locales) {
    assert.ok(pageForPath("/attractions", locale));
    assert.equal(normalizePath(`/${locale}/attractions`), "/attractions");
    for (const slug of expectedSlugs) {
      const html = renderDamoonAttractionDetailPage(locale, slug);
      assert.ok(html, `${locale}/${slug} detail exists`);
      assert.ok(html.includes(`lang="${locale}"`));
      assert.ok(stripTags(html).includes(damoonAttractionsData.attractions.find(item => item.id === slug).content[locale].name));
      assert.match(html, /straight-line|فاصله مستقیم|المسافة المباشرة|مسافة مباشرة/i);
      assert.match(html, /road distance|مسافت جاده‌ای|مسافة الطريق/i);
      assert.doesNotMatch(html, /<iframe\b|&origin=/i);
      for (const anchor of externalAnchors(html)) assert.match(anchor, /rel="noopener noreferrer"/);
    }
  }
  assert.equal(renderDamoonAttractionDetailPage("en", "unknown-slug"), null);
  assert.equal(pageForPath("/attractions/unknown-slug", "en"), null);
  assert.equal(pageForPath("/attractions/museum-archaeology/extra", "fa"), null);
});
