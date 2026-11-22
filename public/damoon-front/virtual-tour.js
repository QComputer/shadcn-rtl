export const DAMOON_VTOUR_TENANT = "damoon";
export const DAMOON_VTOUR_ALLOWED_ORIGINS = Object.freeze(["https://andarama.bazarbaaz.ir"]);
const DAMOON_VTOUR_ROOM_SLUGS = new Set([
  "vip-suite", "standard-room", "studio-suite",
  "vip", "single-room", "fourth-floor-suite",
  "single", "double", "suite", "suite-3-bed", "suite-4-5-bed",
]);

// Only tours whose URL and scene identity were verified in Andarama are public.
// VIP-02 remains unavailable; the dining-hall scene remains withheld until its
// exact hotel purpose is confirmed by the owner.
export const DAMOON_VTOUR_CATALOG = Object.freeze([
  {
    id: "vip-01",
    tenantId: "damoon",
    url: "https://andarama.bazarbaaz.ir/t/vip-01",
    title: { fa: "سوئیت VIP · تور ۱", en: "VIP Suite · Tour 01", ar: "جناح VIP · الجولة ٠١" },
    description: {
      fa: "نمای تعاملی شناسایی‌شده به‌عنوان سوئیت VIP؛ ظرفیت و امکانات واحد را از پذیرش بپرسید.",
      en: "Interactive panorama identified as a VIP suite. Ask reception to confirm unit capacity and amenities.",
      ar: "مشهد بانورامي تفاعلي تم تحديده كجناح VIP. اسألوا الاستقبال عن سعة الوحدة ومرافقها.",
    },
    roomSlugs: ["vip-suite", "vip"],
    approved: true,
  },
  {
    id: "vip-3",
    tenantId: "damoon",
    url: "https://andarama.bazarbaaz.ir/t/vip-3",
    title: { fa: "سوئیت VIP · تور ۳", en: "VIP Suite · Tour 03", ar: "جناح VIP · الجولة ٠٣" },
    description: {
      fa: "نمای تعاملی شناسایی‌شده به‌عنوان سوئیت VIP؛ ظرفیت و امکانات واحد را از پذیرش بپرسید.",
      en: "Interactive panorama identified as a VIP suite. Ask reception to confirm unit capacity and amenities.",
      ar: "مشهد بانورامي تفاعلي تم تحديده كجناح VIP. اسألوا الاستقبال عن سعة الوحدة ومرافقها.",
    },
    roomSlugs: ["vip-suite", "vip"],
    approved: true,
  },
  {
    id: "lobby",
    tenantId: "damoon",
    url: "https://andarama.bazarbaaz.ir/t/lobby",
    title: { fa: "لابی هتل", en: "Hotel Lobby", ar: "ردهة الفندق" },
    description: {
      fa: "نمای تعاملی لابی و فضای پذیرش هتل.",
      en: "Interactive panorama of the hotel lobby and reception area.",
      ar: "مشهد بانورامي تفاعلي لردهة الفندق ومنطقة الاستقبال.",
    },
    roomSlugs: [],
    approved: true,
  },
  {
    id: "303",
    tenantId: "damoon",
    url: "https://andarama.bazarbaaz.ir/t/303",
    title: { fa: "اتاق ۳۰۳", en: "Room 303", ar: "الغرفة ٣٠٣" },
    description: {
      fa: "تور واحد مشخص‌شده به‌عنوان اتاق ۳۰۳؛ جزئیات ظرفیت و امکانات را با پذیرش هماهنگ کنید.",
      en: "Tour for the unit identified as Room 303. Confirm capacity and amenities with reception.",
      ar: "جولة للوحدة المحددة بالغرفة ٣٠٣. أكّدوا السعة والمرافق مع الاستقبال.",
    },
    roomSlugs: [],
    approved: true,
  },
]);

export const DAMOON_VTOUR_COPY = Object.freeze({
  fa: {
    galleryTitle: "تورهای تعاملی تأییدشده",
    galleryIntro: "تورهای تعاملی ارائه‌شده از سوی هتل دامون. تصاویر داخل تور، عکاسی تأییدشدهٔ هتل محسوب نمی‌شوند.",
    openEmbed: "نمایش تور در همین صفحه",
    openDirect: "بازکردن مستقیم تور ↗",
    fullscreen: "تمام‌صفحه",
    close: "بستن نمایشگر",
    loading: "در حال بارگذاری تور… اگر نمایشگر باز نشد، تور را مستقیم باز کنید.",
    loaded: "اگر تصویر نمایش داده نمی‌شود یا بارگذاری ادامه دارد، تور را مستقیم باز کنید.",
    failed: "نمایش درون‌صفحه‌ای در دسترس نیست؛ تور را مستقیم باز کنید.",
    slow: "بارگذاری طول کشیده است. اتصال را بررسی کنید یا تور را مستقیم باز کنید.",
    fullscreenFailed: "تمام‌صفحه در این مرورگر در دسترس نیست؛ از کنترل‌های خود تور استفاده کنید.",
    lobbyLink: "مشاهدهٔ تور لابی",
    roomLink: "دیدن گروه سوئیت‌های VIP",
  },
  en: {
    galleryTitle: "Verified interactive tours",
    galleryIntro: "Owner-provided Damoon tours. Tour imagery is not represented as approved hotel photography.",
    openEmbed: "View tour here",
    openDirect: "Open tour directly ↗",
    fullscreen: "Full screen",
    close: "Close viewer",
    loading: "Loading tour… If the viewer does not open, use the direct link.",
    loaded: "If the panorama is blank or still loading, open the tour directly.",
    failed: "The embedded viewer is unavailable. Open the tour directly.",
    slow: "This is taking longer than expected. Check your connection or open the tour directly.",
    fullscreenFailed: "Fullscreen is unavailable in this browser. Use the tour's own controls.",
    lobbyLink: "View the lobby tour",
    roomLink: "See VIP suite categories",
  },
  ar: {
    galleryTitle: "جولات تفاعلية موثقة",
    galleryIntro: "جولات مقدمة من فندق دامون. ولا تُعرض صور الجولة على أنها صور فوتوغرافية معتمدة للفندق.",
    openEmbed: "عرض الجولة هنا",
    openDirect: "فتح الجولة مباشرةً ↗",
    fullscreen: "ملء الشاشة",
    close: "إغلاق العارض",
    loading: "جارٍ تحميل الجولة… إذا لم يفتح العارض، استخدموا الرابط المباشر.",
    loaded: "إذا كانت البانوراما فارغة أو ما زالت تحمّل، افتحوا الجولة مباشرةً.",
    failed: "العارض المضمّن غير متاح. افتحوا الجولة مباشرةً.",
    slow: "يستغرق التحميل وقتاً أطول من المتوقع. تحققوا من الاتصال أو افتحوا الجولة مباشرةً.",
    fullscreenFailed: "ملء الشاشة غير متاح في هذا المتصفح. استخدموا أدوات الجولة نفسها.",
    lobbyLink: "استعراض جولة الردهة",
    roomLink: "استعراض فئات أجنحة VIP",
  },
});

export function allowedVirtualTourUrl(value, allowedOrigins = DAMOON_VTOUR_ALLOWED_ORIGINS) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !allowedOrigins.includes(url.origin)) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function publishedDamoonTours(catalog = DAMOON_VTOUR_CATALOG, allowedOrigins = DAMOON_VTOUR_ALLOWED_ORIGINS) {
  if (!Array.isArray(catalog)) return [];
  return catalog.flatMap((tour) => {
    if (!tour || tour.tenantId !== DAMOON_VTOUR_TENANT || tour.approved !== true || typeof tour.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(tour.id)) return [];
    const url = allowedVirtualTourUrl(tour.url, allowedOrigins);
    if (!url) return [];
    const roomSlugs = Array.isArray(tour.roomSlugs) ? tour.roomSlugs.filter((slug) => DAMOON_VTOUR_ROOM_SLUGS.has(slug)) : [];
    const publishedTour = { id: tour.id, url, roomSlugs };
    if (tour.title && typeof tour.title === "object") publishedTour.title = tour.title;
    if (tour.description && typeof tour.description === "object") publishedTour.description = tour.description;
    if (tour.representation === "CONCEPTUAL_PREVIEW") publishedTour.representation = tour.representation;
    return [publishedTour];
  });
}

export function tourViewerMarkup(tour, title, allowedOrigins = DAMOON_VTOUR_ALLOWED_ORIGINS, locale = "en") {
  const url = allowedVirtualTourUrl(tour?.url, allowedOrigins);
  if (!url) return "";
  const escaped = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const copy = DAMOON_VTOUR_COPY[locale] || DAMOON_VTOUR_COPY.en;
  const representation = tour?.representation === "CONCEPTUAL_PREVIEW" ? "conceptual" : "verified";
  return `<div class="vtour-viewer" data-tour-representation="${representation}"><iframe src="${escaped(url)}" title="${escaped(title)}" loading="lazy" allow="fullscreen; xr-spatial-tracking" allowfullscreen referrerpolicy="no-referrer"></iframe><div class="vtour-viewer__actions"><button type="button" class="vtour-viewer__fullscreen" data-vtour-fullscreen>${escaped(copy.fullscreen)}</button><a class="vtour-viewer__direct" href="${escaped(url)}" target="_blank" rel="noopener noreferrer">${escaped(copy.openDirect)}</a></div><p class="vtour-viewer__status" data-vtour-status role="status" aria-live="polite">${escaped(copy.loading)}</p></div>`;
}
