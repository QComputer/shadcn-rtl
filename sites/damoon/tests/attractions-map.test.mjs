import assert from "node:assert/strict";
import test from "node:test";
import { normalizePath, pageForPath } from "../content.js";
import { damoonAttractionsData } from "../damoon-attractions-data.js";
import { getDamoonAttraction, renderDamoonAttractionDetailPage } from "../damoon-attractions-detail-view.js";
import { renderDamoonAttractionsPage } from "../damoon-attractions-view.js";
import { renderHospitality } from "../hospitality.js";
import { siteForLocale } from "../content.js";
import { attractionMapUrl, getDamoonMapPoints, hotelMapUrl, renderDamoonMap } from "../damoon-leaflet-maps.js";

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
    assert.doesNotMatch(html, /waze/i, "Waze must not appear in Damoon public routes");
    assert.match(html, /data-da-map data-map-kind="attractions"/);
    assert.doesNotMatch(html, /<iframe\b|export\/embed\.html/i);
    assert.doesNotMatch(stripTags(html), /32\.32657|50\.85848/);
    assert.doesNotMatch(html, /&origin=|waze/i, "no route assumes a verified hotel origin or links Waze");
    assert.equal((html.match(/class="da-map-shell"/g) || []).length, 1);
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
      assert.match(html, /data-map-kind="attraction"/);
      assert.match(html, new RegExp(`data-map-id="${slug}"`));
      assert.equal((html.match(/class="da-map-shell"/g) || []).length, 1);
      assert.doesNotMatch(html, /waze/i);
      for (const anchor of externalAnchors(html)) assert.match(anchor, /rel="noopener noreferrer"/);
    }
  }
  assert.equal(renderDamoonAttractionDetailPage("en", "unknown-slug"), null);
  assert.equal(pageForPath("/attractions/unknown-slug", "en"), null);
  assert.equal(pageForPath("/attractions/museum-archaeology/extra", "fa"), null);
});

test("Leaflet points use only canonical coordinates, pending hotel status, destination OSM URLs and neutral directions labels", () => {
  const points = getDamoonMapPoints("attractions");
  assert.equal(points.length, 9);
  assert.equal(points[0].lat, damoonAttractionsData.hotel.geo.lat);
  assert.equal(points[0].lng, damoonAttractionsData.hotel.geo.lng);
  assert.deepEqual(points.slice(1).map(({ id, lat, lng }) => ({ id, lat, lng })), damoonAttractionsData.attractions.map(item => ({ id: item.id, lat: item.geo.lat, lng: item.geo.lng })));
  assert.equal(getDamoonMapPoints("attraction", "unknown").length, 0);
  const hotelUrl = new URL(hotelMapUrl());
  assert.equal(hotelUrl.hostname, "www.openstreetmap.org");
  assert.equal(Number(hotelUrl.searchParams.get("mlat")), damoonAttractionsData.hotel.geo.lat);
  assert.equal(Number(hotelUrl.searchParams.get("mlon")), damoonAttractionsData.hotel.geo.lng);
  for (const attraction of damoonAttractionsData.attractions) {
    const url = new URL(attractionMapUrl(attraction));
    assert.equal(Number(url.searchParams.get("mlat")), attraction.geo.lat);
    assert.equal(Number(url.searchParams.get("mlon")), attraction.geo.lng);
  }
  for (const locale of locales) {
    const html = renderDamoonMap({ kind: "hotel", locale });
    assert.ok(html.includes(damoonAttractionsData.labels[locale].pinPending));
    assert.match(html, /tile\.openstreetmap\.org|OpenStreetMap contributors/);
    assert.match(html, /openstreetmap\.org\//);
    assert.doesNotMatch(html, /waze/i);
  }
  assert.equal(damoonAttractionsData.hotel.geo.status, "PUBLIC_MAP_POINT_NOT_OWNER_APPROVED");
  assert.ok(locales.every(locale => ["Directions", "مسیریابی", "الاتجاهات"].includes(damoonAttractionsData.labels[locale].directions)));
});

test("localized contact pages expose the hotel map and its pending public-point notice", () => {
  for (const locale of locales) {
    const html = renderHospitality({ path: "/contact", page: { title: "Contact", sections: [] }, locale, site: siteForLocale(locale), routeHref: value => value, escapeHtml: value => String(value) });
    assert.match(html, /data-map-kind="hotel"/);
    assert.ok(html.includes(damoonAttractionsData.labels[locale].pinPending));
    assert.match(html, /openstreetmap\.org/);
    assert.doesNotMatch(html, /waze\.com/i);
  }
});
