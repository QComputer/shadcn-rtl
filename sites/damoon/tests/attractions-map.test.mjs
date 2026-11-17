import assert from "node:assert/strict";
import test from "node:test";
import { localeForPath, normalizePath, pageForPath, siteForLocale } from "../content.js";
import { renderHospitality } from "../hospitality.js";

const routeHref = (path, locale) => `${locale === "fa" ? "" : `/${locale}`}${path === "/" ? "/" : path}`;
const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

test("attractions page and localized aliases expose only verified approximate road distances", () => {
  for (const locale of ["fa", "en", "ar"]) {
    const path = locale === "fa" ? "/attractions" : `/${locale}/attractions`;
    assert.equal(localeForPath(path), locale);
    assert.equal(normalizePath(path), "/attractions");
    const page = pageForPath("/attractions", locale);
    assert.ok(page, `${locale} route resolves in the content model`);
    assert.equal(page.sections.length, 2);
    for (const item of page.sections) {
      assert.ok(Number.isFinite(item.roadDistanceKm) && item.roadDistanceKm > 0, `${locale} ${item.heading} road distance`);
      assert.match(item.directionsUrl, /^https:\/\/www\.google\.com\/maps\/dir\//);
    }
    const html = renderHospitality({ path: "/attractions", page, locale, site: siteForLocale(locale), routeHref: target => routeHref(target, locale), escapeHtml });
    assert.equal((html.match(/data-road-distance-km="/g) || []).length, 4, `${locale} distances are rendered and exposed as data fields`);
    assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 2, `${locale} map links are safe external links`);
    assert.match(html, /1\.2|9\.3|١٫٢|٩٫٣|۱٫۲|۹٫۳/);
  }
});

test("contact location section uses the verified hotel directions pin without embedding a third-party map", () => {
  for (const locale of ["fa", "en", "ar"]) {
    const page = pageForPath("/contact", locale);
    const site = siteForLocale(locale);
    const html = renderHospitality({ path: "/contact", page, locale, site, routeHref: target => routeHref(target, locale), escapeHtml });
    assert.match(html, /hospitality-contact-location/);
    assert.ok(html.includes(`href="${site.mapUrl}"`), `${locale} directions use the verified Waze hotel pin`);
    assert.doesNotMatch(html, /<iframe\b/i);
  }
});
