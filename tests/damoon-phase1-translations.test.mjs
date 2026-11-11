import assert from "node:assert/strict";
import test from "node:test";
import { pages, rooms, pageForPath } from "../sites/damoon/content.js";
import translations from "../sites/damoon/translations.js";

const locales = ["en", "ar"];
const englishOnly = /[\u0600-\u06ff]/u;

test("English and Arabic cover every main Damoon page and room section", () => {
  for (const locale of locales) {
    const copy = translations[locale];
    assert.ok(copy, `missing ${locale} translation`);
    assert.deepEqual(Object.keys(copy.pages).sort(), Object.keys(pages).sort(), `${locale} page coverage`);
    assert.deepEqual(Object.keys(copy.rooms).sort(), rooms.map(({ slug }) => slug).sort(), `${locale} room coverage`);
    assert.equal(copy.site.nav.length, 5, `${locale} navigation coverage`);
    assert.equal(copy.gallery.length, 6, `${locale} gallery coverage`);

    for (const [path, source] of Object.entries(pages)) {
      const translated = pageForPath(path, locale);
      assert.ok(translated?.title && translated.intro && translated.text, `${locale} ${path} has translated page copy`);
      assert.equal(translated.sections?.length ?? 0, source.sections?.length ?? 0, `${locale} ${path} section parity`);
      for (const [index, section] of (translated.sections ?? []).entries()) {
        assert.ok(section.heading && section.text, `${locale} ${path} section ${index} has heading and text`);
      }
    }
  }
});

test("English pages, room details, navigation, and controls use English copy", () => {
  const en = translations.en;
  const strings = [en.site.name, en.site.eyebrow, ...en.site.nav.map(([, label]) => label), ...en.gallery.map(({ alt }) => alt)];
  for (const room of Object.values(en.rooms)) strings.push(room.title, room.description);
  for (const page of Object.values(en.pages)) {
    strings.push(page.title, page.intro, page.text, ...(page.actions ?? []).map(([, label]) => label));
    for (const section of page.sections ?? []) strings.push(section.heading, section.text, section.label, section.note, section.badge);
  }
  for (const room of Object.keys(en.rooms)) {
    const page = pageForPath(`/rooms/${room}`, "en");
    strings.push(page.title, page.text, ...(page.sections ?? []).flatMap(({ heading, text, label }) => [heading, text, label]));
  }
  strings.push(en.ui.datePlanningOnly, en.ui.bookingSubmit, en.ui.contactForStay);
  for (const value of strings.filter(Boolean)) assert.doesNotMatch(value, englishOnly, `English copy contains non-English script: ${value}`);
});

test("localized hospitality and stay-planning copy preserves current status without promising a booking", () => {
  for (const locale of locales) {
    const copy = translations[locale];
    assert.match(copy.pages["/cafe"].text, locale === "en" ? /in progress/i : /يجري استكمال/);
    assert.match(copy.pages["/restaurant"].intro, locale === "en" ? /ready/i : /جاهز/);
    assert.match(copy.pages["/policies"].sections[1].text, locale === "en" ? /do not reserve or hold/i : /لا يحجز غرفة ولا يحتفظ بها/);
    assert.match(copy.ui.datePlanningOnly, locale === "en" ? /planning and coordination only/i : /للتخطيط والتنسيق فقط/);
    assert.match(copy.ui.datePlanningOnly, locale === "en" ? /confirm room, rate, and availability/i : /أكّدوا الغرفة والسعر والتوفر/);
    assert.match(copy.ui.bookingSubmit, locale === "en" ? /stay coordination/i : /تنسيق الإقامة/);
  }
});

test("about and privacy copy includes the approved intent and phase-one data boundaries", () => {
  assert.match(translations.en.pages["/about"].sections[0].text, /warm, friendly, and calm hospitality.*at home/u);
  assert.match(translations.ar.pages["/about"].sections[0].text, /ضيافة دافئة وودودة وهادئة.*بيته الثاني/u);
  for (const locale of locales) {
    const privacy = translations[locale].pages["/policies"].sections.at(-1).text;
    assert.match(privacy, locale === "en" ? /children’s ages/u : /أعمار الأطفال/u);
    assert.match(privacy, locale === "en" ? /page address and current browser session/u : /عنوان الصفحة وجلسة المتصفح الحالية/u);
    assert.match(privacy, locale === "en" ? /does not submit personal contact details or payments/u : /لا يرسل الموقع بيانات الاتصال الشخصية أو المدفوعات/u);
  }
});
