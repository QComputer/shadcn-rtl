import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { normalizePath, pageForPath, siteForLocale } from "../content.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const locales = {
  fa: {
    noRestaurant: "رستوران فعال یا تالار پذیرایی ندارد",
    noCafe: "فضای مستقل کافی‌شاپ",
    inRoom: "به مهمانان در اتاق",
    breakfastPending: "در دست آماده‌سازی",
    notOperational: "عملیاتی نیست",
    roomCount: "۲۰ اتاق",
    suiteCount: "۱۱ سوئیت",
  },
  en: {
    noRestaurant: "does not currently operate a restaurant or banquet hall",
    noCafe: "no standalone café or café seating area",
    inRoom: "served to hotel guests in their rooms",
    breakfastPending: "under preparation",
    notOperational: "not yet operational",
    roomCount: "20 rooms",
    suiteCount: "11 suites",
  },
  ar: {
    noRestaurant: "لا يوجد في فندق دامون مطعم أو قاعة مناسبات عاملة",
    noCafe: "لا توجد في فندق دامون مساحة مقهى مستقلة",
    inRoom: "لضيوف الفندق داخل غرفهم",
    breakfastPending: "قيد التجهيز",
    notOperational: "لم يبدأ تشغيلها بعد",
    roomCount: "٢٠ غرفة",
    suiteCount: "١١ جناحاً",
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
    const facilities = textOf(pageForPath("/facilities", locale));
    const policies = textOf(pageForPath("/policies", locale));
    const rooms = textOf(pageForPath("/rooms", locale));

    assert.ok(home.includes(expected.roomCount), `${locale} home exposes confirmed room total`);
    assert.ok(home.includes(expected.suiteCount), `${locale} home exposes confirmed suite total`);
    assert.ok(dining.includes(expected.noRestaurant), `${locale} legacy restaurant route corrects venue status`);
    assert.ok(refreshments.includes(expected.noCafe), `${locale} legacy cafe route corrects venue status`);
    assert.ok(refreshments.includes(expected.inRoom), `${locale} explains in-room refreshment service`);
    assert.ok(facilities.includes(expected.breakfastPending), `${locale} marks breakfast hall as under preparation`);
    assert.ok(facilities.includes(expected.notOperational), `${locale} says breakfast hall is not operational`);
    assert.ok(policies.includes("14:00") || policies.includes("۱۴:۰۰") || policies.includes("١٤:٠٠"), `${locale} policy states check-in at 14:00`);
    assert.ok(policies.includes("12:00") || policies.includes("۱۲:۰۰") || policies.includes("١٢:٠٠"), `${locale} policy states check-out at 12:00`);
    assert.ok(rooms.includes(expected.roomCount) && rooms.includes(expected.suiteCount), `${locale} accommodation page has confirmed aggregate totals`);
    assert.ok(!/one-bed|two-bed|three-bed|four- and five-bed|سرير واحد|سريرين|ثلاثة أسرّة|خمسة أسرّة/i.test(rooms), `${locale} room summary avoids unverified bed layouts`);

    const publicNav = siteForLocale(locale).nav.map(([, label]) => label).join(" ");
    assert.ok(!/restaurant|café|cafe|مطعم|مقهى|رستوران|کافی.?شاپ/i.test(publicNav), `${locale} primary navigation prioritizes the stay`);
    for (const path of ["/restaurant", "/cafe"]) assert.equal(normalizePath(`/${locale}${path}`), path, `${locale} keeps ${path} legacy route addressable`);
    assert.ok(pageForPath("/restaurant", locale));
    assert.ok(pageForPath("/cafe", locale));
  }

  const app = await readFile(resolve(root, "app.js"), "utf8");
  assert.doesNotMatch(app, /تالار و رستوران|Restaurant & Cafe|المطعم والمقهى/);
  assert.match(app, /· 14:00/);
  assert.match(app, /· 12:00/);
  const html = await readFile(resolve(root, "index.html"), "utf8");
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.doesNotMatch(html, /restaurant|café|cafe|رستوران|کافی.?شاپ/i);
  const publicRoot = resolve(root, "../../public/damoon-front");
  const publicTranslations = await readFile(resolve(publicRoot, "translations.js"), "utf8");
  const publicApp = await readFile(resolve(publicRoot, "app.js"), "utf8");
  assert.match(publicTranslations, /does not currently operate a restaurant or banquet hall/);
  assert.match(publicTranslations, /no standalone café or café seating area/);
  assert.match(publicTranslations, /قيد التجهيز/);
  assert.doesNotMatch(publicTranslations, /restaurant is ready|مطعم الفندق جاهز|مقهى فاخر/i);
  assert.doesNotMatch(publicApp, /تالار و رستوران|Restaurant & Cafe|المطعم والمقهى/);
  for (const route of ["restaurant", "cafe", "policies", "rooms"]) {
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
