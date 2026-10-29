const hospitalityPaths = ["/restaurant", "/cafe", "/facilities", "/about", "/contact", "/policies", "/virtual-tour", "/gallery"];

const labels = {
  fa: { home: "خانه", more: "اطلاعات بیشتر", concepts: "تصویر مفهومی", conceptNote: "تصویر مفهومی؛ عکس واقعی هتل نیست.", map: "مسیریابی روی نقشه", call: "تماس با پذیرش", address: "نشانی", phone: "تلفن پذیرش", tour: "آشنایی با فضای هتل", tourText: "نمایش آنلاین تور مجازی در حال آماده‌سازی است.", gallery: "دیدن تصاویر مفهومی", galleryIntro: "تصاویر این صفحه مفهومی‌اند و نمای واقعی هتل یا تور را نشان نمی‌دهند.", related: "بخش‌های دیگر هتل" },
  en: { home: "Home", more: "More information", concepts: "Concept image", conceptNote: "Concept image; not an actual hotel photograph.", map: "Directions", call: "Call reception", address: "Address", phone: "Reception phone", tour: "Explore the hotel", tourText: "Online display of the virtual tour is being prepared.", gallery: "View concept images", galleryIntro: "These are concept images; they do not show the actual hotel or virtual tour.", related: "Explore more" },
  ar: { home: "الرئيسية", more: "معلومات إضافية", concepts: "صورة تصورية", conceptNote: "صورة تصورية؛ وليست صورة حقيقية للفندق.", map: "الاتجاهات على الخريطة", call: "الاتصال بالاستقبال", address: "العنوان", phone: "هاتف الاستقبال", tour: "التعرّف على الفندق", tourText: "يجري إعداد العرض الإلكتروني للجولة الافتراضية.", gallery: "عرض الصور التصورية", galleryIntro: "هذه صور تصورية ولا تعرض الفندق الحقيقي أو الجولة الافتراضية.", related: "استكشف المزيد" },
};

const routeNames = {
  fa: { "/restaurant": "رستوران", "/cafe": "کافی‌شاپ", "/facilities": "امکانات", "/about": "دربارهٔ هتل", "/contact": "تماس", "/policies": "قوانین و حریم خصوصی", "/virtual-tour": "تور مجازی", "/gallery": "گالری", "/rooms": "اتاق‌ها و سوئیت‌ها" },
  en: { "/restaurant": "Restaurant", "/cafe": "Café", "/facilities": "Facilities", "/about": "About", "/contact": "Contact", "/policies": "Stay information and privacy", "/virtual-tour": "Virtual tour", "/gallery": "Gallery", "/rooms": "Rooms and suites" },
  ar: { "/restaurant": "المطعم", "/cafe": "المقهى", "/facilities": "المرافق", "/about": "عن الفندق", "/contact": "التواصل", "/policies": "الإقامة والخصوصية", "/virtual-tour": "الجولة الافتراضية", "/gallery": "المعرض", "/rooms": "الغرف والأجنحة" },
};

function esc(escapeHtml, value) { return escapeHtml(String(value ?? "")); }

function card(item, { escapeHtml, routeHref, t }) {
  const heading = esc(escapeHtml, item.heading);
  const media = item.image ? `<figure class="hospitality-card__media"><img src="${esc(escapeHtml, item.image)}" alt="${esc(escapeHtml, item.note || t.conceptNote)}" loading="lazy"><figcaption>${esc(escapeHtml, item.note || t.concepts)}</figcaption></figure>` : "";
  const link = item.link ? `<a class="hospitality-text-link" href="${esc(escapeHtml, routeHref(item.link))}">${esc(escapeHtml, item.label || t.more)} <span aria-hidden="true">↗</span></a>` : "";
  return `<article class="hospitality-card">${media}<div class="hospitality-card__copy">${item.badge ? `<span class="hospitality-badge">${esc(escapeHtml, item.badge)}</span>` : ""}<h2>${heading}</h2><p>${esc(escapeHtml, item.text)}</p>${link}</div></article>`;
}

function actions(path, page, site, { escapeHtml, routeHref, t, locale }) {
  if (path === "/contact") {
    const map = site.mapUrl ? `<a class="hospitality-button hospitality-button--quiet" href="${esc(escapeHtml, site.mapUrl)}" target="_blank" rel="noopener noreferrer">${esc(escapeHtml, t.map)} <span aria-hidden="true">↗</span></a>` : "";
    return `<div class="hospitality-actions"><a class="hospitality-button" href="tel:${esc(escapeHtml, site.phone)}">${esc(escapeHtml, t.call)} <bdi>${esc(escapeHtml, site.phoneDisplay || site.phone)}</bdi></a>${map}</div>`;
  }
  return (page.actions || []).map(([href, label], index) => `<a class="hospitality-button${index ? " hospitality-button--quiet" : ""}" href="${esc(escapeHtml, routeHref(href))}">${esc(escapeHtml, label)} <span aria-hidden="true">↗</span></a>`).join("");
}

export function renderHospitality({ path, page, locale, site, routeHref, escapeHtml }) {
  if (!hospitalityPaths.includes(path) || !page || !site) return "";
  const lang = ["fa", "en", "ar"].includes(locale) ? locale : "fa";
  const t = labels[lang];
  const title = esc(escapeHtml, page.title);
  const intro = esc(escapeHtml, page.intro || page.title);
  const lead = esc(escapeHtml, page.text || "");
  const crumbs = `<nav class="hospitality-breadcrumb" aria-label="${lang === "fa" ? "مسیر صفحه" : lang === "ar" ? "مسار الصفحة" : "Breadcrumb"}"><a href="${esc(escapeHtml, routeHref("/"))}">${t.home}</a><span aria-hidden="true">/</span><span aria-current="page">${title}</span></nav>`;
  const heroImage = page.image ? `<figure class="hospitality-hero__image"><img src="${esc(escapeHtml, page.image)}" alt="${esc(escapeHtml, page.imageNote || t.conceptNote)}" fetchpriority="high"><figcaption>${esc(escapeHtml, page.imageNote || t.concepts)}</figcaption></figure>` : "";
  const isGallery = path === "/gallery";
  const galleryIntro = isGallery ? `<p class="hospitality-gallery-intro">${esc(escapeHtml, page.text || t.galleryIntro)}</p>` : "";
  const cards = isGallery ? `<div class="hospitality-gallery-slot" data-hospitality-gallery-slot></div>` : (page.sections || []).length ? `<section class="hospitality-cards" aria-label="${esc(escapeHtml, t.more)}">${page.sections.map((item) => card(item, { escapeHtml, routeHref, t })).join("")}</section>` : "";
  const tourNote = path === "/virtual-tour" ? `<aside class="hospitality-note"><span class="hospitality-note__mark" aria-hidden="true">◌</span><div><h2>${esc(escapeHtml, t.tour)}</h2><p>${esc(escapeHtml, t.tourText)}</p><a class="hospitality-text-link" href="${esc(escapeHtml, routeHref("/rooms"))}">${esc(escapeHtml, routeNames[lang]["/rooms"])} <span aria-hidden="true">↗</span></a> <a class="hospitality-text-link" href="${esc(escapeHtml, routeHref("/gallery"))}">${esc(escapeHtml, t.gallery)} <span aria-hidden="true">↗</span></a></div></aside>` : "";
  const contactDetails = path === "/contact" ? `<section class="hospitality-contact-details"><div><span>${esc(escapeHtml, t.phone)}</span><a href="tel:${esc(escapeHtml, site.phone)}"><bdi>${esc(escapeHtml, site.phoneDisplay || site.phone)}</bdi></a></div><div><span>${esc(escapeHtml, t.address)}</span><p>${esc(escapeHtml, site.address)}</p></div></section>` : "";
  const relatedLinks = ["/restaurant", "/cafe", "/facilities", "/virtual-tour", "/gallery"].filter((href) => href !== path).map((href) => `<a href="${esc(escapeHtml, routeHref(href))}">${esc(escapeHtml, routeNames[lang][href])}<span aria-hidden="true">↗</span></a>`).join("");
  return `<article class="hospitality-page${isGallery ? " hospitality-page--gallery" : ""}" data-hospitality-page="${esc(escapeHtml, path)}"><header class="hospitality-hero">${crumbs}<div class="hospitality-hero__layout${heroImage ? " hospitality-hero__layout--image" : ""}"><div class="hospitality-hero__copy"><p class="hospitality-eyebrow">${esc(escapeHtml, site.eyebrow || site.city)}</p>${page.badge ? `<span class="hospitality-badge">${esc(escapeHtml, page.badge)}</span>` : ""}<h1>${intro}</h1>${isGallery ? galleryIntro : `<p class="hospitality-lead">${lead}</p>`}${!isGallery ? `<div class="hospitality-actions">${actions(path, page, site, { escapeHtml, routeHref, t, locale: lang })}</div>` : ""}</div>${heroImage}</div></header>${contactDetails}${tourNote}${cards}${path !== "/contact" && !isGallery ? `<footer class="hospitality-crosslinks"><span>${esc(escapeHtml, t.related)}</span><nav aria-label="${esc(escapeHtml, t.related)}">${relatedLinks}</nav></footer>` : ""}</article>`;
}
