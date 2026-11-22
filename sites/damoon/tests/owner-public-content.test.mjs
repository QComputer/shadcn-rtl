import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { normalizePath, pageForPath, siteForLocale } from "../content.js";
import { renderHospitality } from "../hospitality.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const locales = {
  fa: {
    noRestaurant: "رستوران فعال یا تالار پذیرایی ندارد",
    noCafe: "فضای مستقل کافی‌شاپ",
    inRoom: "به مهمانان در اتاق",
    breakfastReady: "آمادهٔ استفاده",
    complimentaryBreakfast: "برای مهمانان هتل رایگان",
    unitCount: "۳۱ واحد اقامتی",
    parkingLimited: "ظرفیت محدود",
    receptionStart: "۰۶:۰۰",
    receptionEnd: "۰۱:۰۰",
    faxOnly: "فکس (فقط دریافت فکس)",
  },
  en: {
    noRestaurant: "does not currently operate a restaurant or banquet hall",
    noCafe: "no standalone café or café seating area",
    inRoom: "served to hotel guests in their rooms",
    breakfastReady: "ready for use",
    complimentaryBreakfast: "complimentary for hotel guests",
    unitCount: "31 accommodation units",
    parkingLimited: "limited parking",
    receptionStart: "06:00",
    receptionEnd: "01:00",
    faxOnly: "Fax only",
  },
  ar: {
    noRestaurant: "لا يوجد في فندق دامون مطعم أو قاعة مناسبات عاملة",
    noCafe: "لا توجد في فندق دامون مساحة مقهى مستقلة",
    inRoom: "لضيوف الفندق داخل غرفهم",
    breakfastReady: "جاهزة للاستخدام",
    complimentaryBreakfast: "مجاني لنزلاء الفندق",
    unitCount: "٣١ وحدة إقامة",
    parkingLimited: "مواقف سيارات محدودة",
    receptionStart: "06:00",
    receptionEnd: "01:00",
    faxOnly: "فاكس فقط",
  },
};

function textOf(page) {
  return [page?.title, page?.intro, page?.text, ...(page?.sections || []).flatMap(({ heading, text }) => [heading, text])]
    .filter(Boolean).join(" ");
}

function asciiDigits(value) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10);
}

test("Damoon public content uses owner-confirmed hospitality facts in fa/en/ar", async () => {
  for (const [locale, expected] of Object.entries(locales)) {
    const home = textOf(pageForPath("/", locale));
    const dining = textOf(pageForPath("/restaurant", locale));
    const refreshments = textOf(pageForPath("/cafe", locale));
    const facilityPage = pageForPath("/facilities", locale);
    const facilities = textOf(facilityPage);
    const policies = textOf(pageForPath("/policies", locale));
    const rooms = textOf(pageForPath("/rooms", locale));
    const site = siteForLocale(locale);
    const contact = pageForPath("/contact", locale);

    assert.ok(home.includes(expected.unitCount), `${locale} home exposes confirmed total units`);
    assert.ok(dining.includes(expected.noRestaurant), `${locale} legacy restaurant route corrects venue status`);
    assert.ok(refreshments.includes(expected.noCafe), `${locale} legacy cafe route corrects venue status`);
    assert.ok(refreshments.includes(expected.inRoom), `${locale} explains in-room refreshment service`);
    assert.ok(facilities.includes(expected.breakfastReady), `${locale} marks breakfast hall as ready for use`);
    assert.ok(facilities.includes(expected.complimentaryBreakfast), `${locale} limits complimentary breakfast to hotel guests`);
    assert.doesNotMatch(facilities, /under preparation|not yet operational|قيد التجهيز|لم يبدأ تشغيلها بعد|در دست آماده‌سازی|عملیاتی نیست/i, `${locale} removes superseded breakfast status`);
    assert.ok(policies.includes("14:00") || policies.includes("۱۴:۰۰") || policies.includes("١٤:٠٠"), `${locale} policy states check-in at 14:00`);
    assert.ok(policies.includes("12:00") || policies.includes("۱۲:۰۰") || policies.includes("١٢:٠٠"), `${locale} policy states check-out at 12:00`);
    assert.ok(rooms.includes(expected.unitCount), `${locale} accommodation page has confirmed aggregate totals`);
    assert.ok(!/one-bed|two-bed|three-bed|four- and five-bed|سرير واحد|سريرين|ثلاثة أسرّة|خمسة أسرّة/i.test(rooms), `${locale} room summary avoids unverified bed layouts`);
    assert.ok(facilities.toLowerCase().includes(expected.parkingLimited.toLowerCase()), `${locale} states parking is limited`);
    const receptionCopy = facilityPage.sections[0].text;
    assert.ok(receptionCopy.includes(expected.receptionStart) && receptionCopy.includes(expected.receptionEnd), `${locale} states reception hours 06:00–01:00`);
    assert.doesNotMatch(receptionCopy, /24\s*[-/]?\s*hours?|24\/7|٢٤\s*ساعة|۲۴\s*ساعت|شبانه.?روزی/i, `${locale} does not advertise 24-hour reception`);
    assert.match(receptionCopy, /14:00|۱۴:۰۰|١٤:٠٠/);
    assert.match(receptionCopy, /12:00|۱۲:۰۰|١٢:٠٠/);

    assert.deepEqual(site.phoneLines.map(({ number }) => number), [
      "+983832261984", "+983832261985", "+983832261987", "+983832261988",
    ], `${locale} lists only the four callable hotel lines`);
    assert.equal(site.phoneLines.some(({ number }) => number === site.fax?.number), false, `${locale} does not classify the fax as callable`);
    assert.equal(site.fax?.number, "+983832261986", `${locale} stores fax separately`);
    assert.ok(site.receptionHours, `${locale} has a separate reception-hours value`);

    const contactHtml = renderHospitality({
      path: "/contact", page: contact, locale, site,
      routeHref: (path) => `/${locale}${path === "/" ? "/" : path}`,
      escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    });
    for (const number of ["+983832261984", "+983832261985", "+983832261987", "+983832261988"]) {
      assert.ok(contactHtml.includes(`href="tel:${number}"`), `${locale} contact page exposes callable line ${number}`);
    }
    assert.ok(contactHtml.includes(expected.faxOnly), `${locale} labels the fax as fax-only`);
    assert.ok(contactHtml.includes("+98 38 3226 1986"), `${locale} displays the fax number`);
    assert.ok(!contactHtml.includes('href="tel:+983832261986"'), `${locale} does not make the fax callable`);

    const publicNav = siteForLocale(locale).nav.map(([, label]) => label).join(" ");
    assert.ok(!/restaurant|café|cafe|مطعم|مقهى|رستوران|کافی.?شاپ/i.test(publicNav), `${locale} primary navigation prioritizes the stay`);
    for (const path of ["/restaurant", "/cafe"]) assert.equal(normalizePath(`/${locale}${path}`), path, `${locale} keeps ${path} legacy route addressable`);
    assert.ok(pageForPath("/restaurant", locale));
    assert.ok(pageForPath("/cafe", locale));
  }

  for (const locale of Object.keys(locales)) {
    const site = siteForLocale(locale);
    const copy = JSON.stringify({ site, pages: ["/", "/rooms", "/restaurant", "/cafe", "/facilities", "/gallery", "/about", "/contact", "/policies", "/virtual-tour"].map((path) => pageForPath(path, locale)) });
    assert.doesNotMatch(copy, /taxi|taxi service|airport transfer|خدمات تاکسی|تاکسی هتل|سيارة أجرة|سيارات الأجرة/i, `${locale} public content does not advertise a hotel taxi service`);
    assert.doesNotMatch(copy, /wi\s*[- ]?fi|wireless|hotel internet|free internet|وای.?فای|واي.?فاي|إنترنت الفندق|انترنت الفندق/i, `${locale} public content does not advertise hotel-provided Internet or Wi-Fi`);
  }

  const app = await readFile(resolve(root, "app.js"), "utf8");
  assert.doesNotMatch(app, /تالار و رستوران|Restaurant & Cafe|المطعم والمقهى/);
  assert.match(app, /· 14:00/);
  assert.match(app, /· 12:00/);
  assert.match(app, /<source type="image\/webp" srcset="\/assets\/hero-reference-v2-640\.webp 640w, \/assets\/hero-reference-v2-1280\.webp 1280w, \/assets\/hero-reference-v2-1920\.webp 1920w"/);
  assert.match(app, /sizes="\(max-width: 760px\) 100vw, \(max-width: 1400px\) 64vw, 896px"/);
  assert.match(app, /width="2243" height="701" alt="\$\{safeText\(note\)\}" fetchpriority="high" decoding="async"/);
  const heroOriginal = await stat(resolve(root, "assets/hero-reference-v2.png"));
  for (const width of [640, 1280, 1920]) {
    const asset = `assets/hero-reference-v2-${width}.webp`;
    const heroVariant = await stat(resolve(root, asset));
    assert.ok(heroVariant.size > 0 && heroVariant.size < heroOriginal.size / 10, `${width}px source hero is a compact WebP derivative`);
  }
  const html = await readFile(resolve(root, "index.html"), "utf8");
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.doesNotMatch(html, /restaurant|café|cafe|رستوران|کافی.?شاپ/i);
  const publicRoot = resolve(root, "../../public/damoon-front");
  const publicContent = await readFile(resolve(publicRoot, "content.js"), "utf8");
  const publicTranslations = await readFile(resolve(publicRoot, "translations.js"), "utf8");
  const publicApp = await readFile(resolve(publicRoot, "app.js"), "utf8");
  const publicBooking = await readFile(resolve(publicRoot, "booking.js"), "utf8");
  const publicBookingActivation = await readFile(resolve(publicRoot, "booking-activation.js"), "utf8");
  const publicHospitality = await readFile(resolve(publicRoot, "hospitality.js"), "utf8");
  const publicManifest = JSON.parse(await readFile(resolve(publicRoot, "release-manifest.json"), "utf8"));
  assert.match(publicBooking, /booking-activation\.js/);
  assert.match(publicBookingActivation, /enabled: false/);
  assert.ok(publicManifest.files["booking-activation.js"], "release manifest includes the disabled public booking activation gate");
  assert.match(publicApp, /Request stay coordination/);
  assert.match(publicApp, /<source type="image\/webp" srcset="\/damoon-front\/assets\/hero-reference-v2-640\.webp 640w, \/damoon-front\/assets\/hero-reference-v2-1280\.webp 1280w, \/damoon-front\/assets\/hero-reference-v2-1920\.webp 1920w"/);
  for (const width of [640, 1280, 1920]) assert.ok(publicManifest.files[`assets/hero-reference-v2-${width}.webp`], `release manifest includes ${width}px responsive hero asset`);
  for (const asset of ["content.js", "translations.js", "hospitality.js", "hospitality.css"]) {
    const bytes = await readFile(resolve(publicRoot, asset));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), publicManifest.files[asset], `release manifest matches generated ${asset}`);
  }
  const generatedCopy = `${publicContent}\n${publicTranslations}\n${publicApp}\n${publicHospitality}`;
  for (const number of ["+983832261984", "+983832261985", "+983832261987", "+983832261988", "+983832261986"]) {
    assert.ok(generatedCopy.includes(number), `generated public assets include owner-provided number ${number}`);
  }
  assert.match(publicContent, /پارکینگ هتل با ظرفیت محدود/);
  assert.match(publicTranslations, /The hotel has limited parking/);
  assert.match(publicTranslations, /مواقف سيارات محدودة/);
  assert.match(publicHospitality, /فاكس فقط|Fax only/);
  assert.doesNotMatch(await readFile(resolve(publicRoot, "index.html"), "utf8"), /application\/ld\+json/i, "static metadata does not publish unreviewed hotel amenity claims");
  assert.doesNotMatch(generatedCopy, /taxi service|airport transfer|خدمات تاکسی|تاکسی هتل|سيارة أجرة|سيارات الأجرة/i);
  assert.doesNotMatch(generatedCopy, /wi\s*[- ]?fi|wireless|hotel internet|free internet|وای.?فای|واي.?فاي|إنترنت الفندق|انترنت الفندق/i);
  assert.doesNotMatch(generatedCopy, /24\s*[-/]?\s*hours?|24\/7|٢٤\s*ساعة|۲۴\s*ساعت|شبانه.?روزی/i);
  assert.match(publicTranslations, /does not currently operate a restaurant or banquet hall/);
  assert.match(publicTranslations, /no standalone café or café seating area/);
  assert.match(publicTranslations, /جاهزة للاستخدام/);
  assert.doesNotMatch(publicTranslations, /restaurant is ready|مطعم الفندق جاهز|مقهى فاخر/i);
  assert.doesNotMatch(publicApp, /تالار و رستوران|Restaurant & Cafe|المطعم والمقهى/);
  for (const route of ["restaurant", "cafe", "policies", "rooms", "hotel-reservations/start"]) {
    for (const locale of ["fa", "en", "ar"]) {
      const alias = locale === "fa" ? locale : locale;
      const path = resolve(publicRoot, alias, route, "index.html");
      assert.ok((await readFile(path, "utf8")).includes('name="robots"'), `${locale}/${route} generated public entry exists`);
    }
  }
});

test("stay times normalize to the approved 14:00 and noon check-out", () => {
  assert.match(asciiDigits("۱۴:۰۰"), /14:00/);
  assert.match(asciiDigits("١٢:٠٠"), /12:00/);
});
