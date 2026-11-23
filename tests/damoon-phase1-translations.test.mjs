import assert from "node:assert/strict";
import test from "node:test";
import { accommodationCategories, normalizePath, pages, rooms, pageForPath, roomForLocale } from "../sites/damoon/content.js";
import translations from "../sites/damoon/translations.js";

const locales = ["en", "ar"];
const englishOnly = /[\u0600-\u06ff]/u;

test("English and Arabic cover every main Damoon page and room section", () => {
  for (const locale of locales) {
    const copy = translations[locale];
    assert.ok(copy, `missing ${locale} translation`);
    assert.deepEqual(Object.keys(copy.pages).sort(), Object.keys(pages).sort(), `${locale} page coverage`);
    assert.deepEqual(Object.keys(copy.rooms).sort(), rooms.map(({ slug }) => slug).sort(), `${locale} room coverage`);
    assert.ok(copy.site.nav.length >= 4, `${locale} accommodation-focused navigation coverage`);
    assert.ok(copy.site.nav.some(([, label]) => /room|accommodation|غرف|إقامة/iu.test(label)), `${locale} navigation includes accommodation`);
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

test("Damoon catalog uses the owner-selected five-category baseline and preserves legacy routes", () => {
  const categories = [
    { slug: "single", count: 3, titles: { fa: "اتاق یک‌نفره", en: "Single room", ar: "غرفة مفردة" } },
    { slug: "double", count: 17, titles: { fa: "اتاق دونفره", en: "Double room", ar: "غرفة مزدوجة" } },
    { slug: "suite-3-person", count: 6, titles: { fa: "سوئیت سه‌نفره", en: "Three-person suite", ar: "جناح لثلاثة أشخاص" } },
    { slug: "suite-4-person", count: 3, titles: { fa: "سوئیت چهارنفره", en: "Four-person suite", ar: "جناح لأربعة أشخاص" } },
    { slug: "suite-5-person", count: 2, titles: { fa: "سوئیت پنج‌نفره", en: "Five-person suite", ar: "جناح لخمسة أشخاص" } },
  ];
  assert.deepEqual(accommodationCategories.map(({ slug, count }) => ({ slug, count })), categories.map(({ slug, count }) => ({ slug, count })));
  assert.equal(categories.slice(0, 2).reduce((sum, item) => sum + item.count, 0), 20);
  assert.equal(categories.slice(2).reduce((sum, item) => sum + item.count, 0), 11);
  assert.equal(categories.reduce((sum, item) => sum + item.count, 0), 31);
  for (const locale of ["fa", ...locales]) {
    const sections = pageForPath("/rooms", locale).sections;
    assert.deepEqual(sections.map(({ link }) => link), categories.map(({ slug }) => `/rooms/${slug}`));
    for (const [index, { slug, count, titles }] of categories.entries()) {
      assert.equal(roomForLocale(slug, locale).title, titles[locale]);
      assert.equal(sections[index].count, count);
      assert.match(sections[index].text, locale === "fa" ? /درخواست/ : locale === "en" ? /coordination requests/ : /طلبات التنسيق/);
      assert.doesNotMatch(sections[index].text, /bed layout|عدد الأسرة|چیدمان تخت/i);
      assert.equal(normalizePath(`/${locale}/rooms/${slug}`), `/rooms/${slug}`);
    }
  }
  for (const [alias, target] of Object.entries({ vip: "vip-suite", "single-room": "standard-room", "fourth-floor-suite": "studio-suite", "suite-3-bed": "suite", "suite-4-5-bed": "suite" })) {
    assert.equal(normalizePath(`/fa/rooms/${alias}`), `/rooms/${target}`);
    assert.ok(pageForPath(`/rooms/${target}`, "fa"), `legacy route ${target} remains renderable`);
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
    assert.match(copy.pages["/cafe"].text, locale === "en" ? /no separate cafe|refreshments.*rooms/i : /لا توجد.*مقهى|المرطبات.*الغرف/);
    assert.match(copy.pages["/restaurant"].text, locale === "en" ? /does not currently operate a restaurant|under preparation/i : /لا يوجد.*مطعم|قيد التجهيز/);
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
