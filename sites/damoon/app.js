import { gallery, normalizePath, pageForPath, site } from "./content.js";
import { palettes, readPalette, applyPalette } from "./themes.js";
import { mountBooking } from "./booking.js";

const root = document.querySelector("#app");
if (!root) throw new Error("Damoon app mount #app was not found");

const safeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const routeHref = (href) => `${window.location.pathname.startsWith("/fa/") || window.location.pathname === "/fa" ? "/fa" : ""}${href === "/" ? "/" : href}`;
const link = (href, label, className = "") => `<a class="${className}" href="${routeHref(href)}">${safeText(label)}</a>`;

function readTheme() {
  try { return localStorage.getItem("damoon-theme") === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("damoon-theme", theme); } catch { /* Theme still works for this visit. */ }
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.setAttribute("aria-label", theme === "dark" ? "رفتن به تم روشن" : "رفتن به تم تیره");
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.innerHTML = theme === "dark" ? "<span aria-hidden=\"true\">☼</span>" : "<span aria-hidden=\"true\">◐</span>";
  }
}

function header(path) {
  const nav = site.nav.map(([href, label]) => {
    const active = href === path || (href === "/rooms" && path.startsWith("/rooms/"));
    return `<a class="site-nav__link${active ? " is-active" : ""}" href="${routeHref(href)}"${active ? ' aria-current="page"' : ""}>${safeText(label)}</a>`;
  }).join("");
  return `<a class="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="${routeHref("/")}" aria-label="${safeText(site.name)}، صفحهٔ اصلی">
          <span class="brand__mark" aria-hidden="true">د</span><span class="brand__text"><strong>${safeText(site.name)}</strong><small>هتل و اقامت · ${safeText(site.city)}</small></span>
        </a>
        <nav class="site-nav" aria-label="منوی اصلی">${nav}</nav>
        <div class="site-header__actions">
          <div class="theme-controls" id="theme-controls" role="group" aria-label="تنظیم ظاهر سایت">
            <div class="palette-switcher" role="group" aria-label="انتخاب رنگ‌بندی">
              ${palettes.map(p => `<button class="palette-choice" type="button" data-palette="${p.id}" aria-label="رنگ‌بندی ${safeText(p.label)}" aria-pressed="false"><span></span></button>`).join("")}
            </div>
            <button class="theme-toggle" type="button" data-theme-toggle aria-label="رفتن به تم تیره" aria-pressed="false"><span aria-hidden="true">◐</span></button>
          </div>
          ${link("/contact", "تماس با هتل", "button button--small button--outline")}
          <button class="menu-toggle" type="button" aria-label="بازکردن منو" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle><span></span><span></span></button>
        </div>
      </div>
      <nav id="mobile-menu" class="mobile-menu" aria-label="منوی موبایل" hidden>${nav}${link("/contact", "تماس با هتل", "mobile-menu__cta")}</nav>
    </header>`;
}

function footer() {
  const footerLinks = [["/rooms", "اتاق‌ها"], ["/restaurant", "رستوران"], ["/cafe", "کافی‌شاپ"], ["/facilities", "امکانات"], ["/gallery", "گالری"], ["/about", "دربارهٔ دامون"], ["/contact", "تماس"], ["/policies", "قوانین و حریم خصوصی"], ["/virtual-tour", "تور مجازی"]];
  return `<footer class="site-footer"><div class="site-footer__main"><div class="site-footer__brand"><span class="brand__mark" aria-hidden="true">د</span><div><strong>${safeText(site.name)}</strong><p>${safeText(site.city)}</p></div></div><p class="site-footer__note">اطلاعات تماس و جزئیات خدمات پس از تأیید رسمی در سایت درج می‌شوند.</p><nav class="footer-links" aria-label="پیوندهای پایانی">${footerLinks.map(([href, label]) => link(href, label)).join("")}</nav></div><div class="site-footer__bottom"><span>© ${new Date().getFullYear()} ${safeText(site.name)}</span><span>محتوای سایت در حال تکمیل است</span></div></footer>`;
}

function breadcrumb(path, title) {
  if (path === "/") return "";
  return `<nav class="breadcrumb" aria-label="مسیر صفحه"><a href="${routeHref("/")}">خانه</a><span aria-hidden="true">/</span><span aria-current="page">${safeText(title)}</span></nav>`;
}

function hero(page, path) {
  const src = page.image || (path.startsWith("/rooms/") ? "/assets/room-concept-1.webp" : "/assets/gallery-concept-1.webp");
  const note = page.imageNote || (path === "/" ? site.imageNote : "تصویر مفهومی برای نمایش چیدمان سایت؛ عکس واقعی هتل نیست.");
  const isHome = path === "/";
  const actions = (page.actions || []).map(([href, label], index) => link(href, label, `button ${index ? "button--outline" : "button--primary"}`)).join("");
  return `<section class="page-hero${path === "/" ? " page-hero--home" : ""}" aria-labelledby="page-title">
    <div class="page-hero__copy">${breadcrumb(path, page.title)}<p class="eyebrow">${safeText(isHome ? "اقامتی آرام در شهرکرد" : site.eyebrow)}</p>${page.badge ? `<p class="status-badge">${safeText(page.badge)}</p>` : ""}<h1 id="page-title">${safeText(isHome ? site.name : page.intro || page.title)}</h1>${isHome ? `<p class="home-subtitle">اقامت و مهمان‌نوازی در شهرکرد</p>` : ""}<p class="page-hero__lead">${safeText(isHome ? "برای اقامت و دورهمی خود، فضاهای هتل را ببینید و برای هماهنگی با ما در تماس باشید." : page.text || "")}</p><div class="page-hero__actions">${actions || link("/contact", "هماهنگی با هتل", "button button--primary")}</div></div>
    <figure class="page-hero__visual"><img src="${safeText(src)}" alt="${safeText(note)}" fetchpriority="high"><figcaption>${safeText(note)}</figcaption></figure>
  </section>`;
}

function cards(sections) {
  if (!sections?.length) return "";
  return `<section class="content-section" aria-label="اطلاعات بیشتر"><div class="section-heading"><p class="eyebrow">هتل دامون</p><h2>جزئیات بیشتر</h2></div><div class="info-grid">${sections.map((item) => `<article class="info-card">${item.image ? `<a class="info-card__image" href="${routeHref(item.link || "/gallery")}" aria-label="${safeText(item.heading)}"><img src="${safeText(item.image)}" alt="${safeText(item.note || "تصویر مفهومی؛ عکس واقعی نیست.")}" loading="lazy"><span class="image-caption">${safeText(item.note || "تصویر مفهومی؛ عکس واقعی نیست.")}</span></a>` : ""}<div class="info-card__body">${item.badge ? `<span class="status-badge">${safeText(item.badge)}</span>` : ""}<h3>${safeText(item.heading)}</h3><p>${safeText(item.text)}</p>${item.link ? link(item.link, item.label || "اطلاعات بیشتر", "text-link") : ""}</div></article>`).join("")}</div></section>`;
}

function homeContent(page) {
  const shortcuts = [
    ["/rooms", "اتاق‌ها و سوئیت‌ها", "فضاهای اقامت"],
    ["/restaurant", "رستوران", "برای وعده‌های دل‌پذیر"],
    ["/virtual-tour", "تور مجازی", "گشت‌وگذار در فضاها"],
  ];
  const rooms = [
    { title: "اقامت یک‌نفره", image: "/assets/room-concept-1.webp", href: "/rooms/single" },
    { title: "اقامت دونفره", image: "/assets/room-concept-2.webp", href: "/rooms/double" },
    { title: "سوئیت‌های اقامتی", image: "/assets/room-concept-3.webp", href: "/rooms" },
  ];
  const services = [
    { title: "اتاق‌ها و سوئیت‌ها", href: "/rooms", image: "/assets/room-concept-1.webp" },
    { title: "رستوران هتل", href: "/restaurant", image: "/assets/gallery-concept-2.webp" },
    { title: "کافی‌شاپ", href: "/cafe", image: "/assets/gallery-concept-3.webp" },
    { title: "تور مجازی", href: "/virtual-tour", image: "/assets/lobby-concept.webp" },
  ];
  return `<nav class="home-shortcuts" aria-label="دسترسی سریع">${shortcuts.map(([href, title, note]) => `<a class="home-shortcut" href="${routeHref(href)}"><span><small>${safeText(note)}</small><strong>${safeText(title)}</strong></span><span class="home-shortcut__arrow" aria-hidden="true">←</span></a>`).join("")}</nav>
    <section class="home-intro" aria-labelledby="home-intro-title"><figure class="home-intro__visual"><img src="/assets/lobby-concept.webp" alt="تصویر مفهومی از فضای لابی؛ عکس واقعی هتل نیست." loading="lazy"><figcaption>تصویر مفهومی؛ عکس واقعی هتل نیست.</figcaption></figure><div class="home-intro__copy"><p class="eyebrow">هتل دامون · شهرکرد</p><h2 id="home-intro-title">برای اقامتی آرام و لحظه‌هایی خوش</h2><p>هتل دامون در شهرکرد میزبان برنامه‌های اقامت و دورهمی شماست. فضاهای هتل را ببینید و برای هماهنگی، با ما در تماس باشید.</p><a class="text-link" href="${routeHref("/about")}">بیشتر دربارهٔ هتل</a></div></section>
    <section class="home-rooms" aria-labelledby="home-rooms-title"><div class="section-heading"><p class="eyebrow">فضاهای اقامت</p><h2 id="home-rooms-title">جایی برای آسودن</h2><p>گروه‌های اقامتی هتل دامون را ببینید و برای انتخاب متناسب با برنامه‌تان هماهنگ کنید.</p></div><div class="home-room-grid">${rooms.map((room) => `<a class="home-room-tile" href="${routeHref(room.href)}"><img src="${room.image}" alt="تصویر مفهومی؛ عکس واقعی اتاق نیست." loading="lazy"><span class="home-room-tile__caption">تصویر مفهومی</span><strong>${safeText(room.title)}</strong><span class="home-room-tile__link">مشاهدهٔ فضاها ←</span></a>`).join("")}</div></section>
    <section class="home-services" aria-labelledby="home-services-title"><div class="section-heading"><p class="eyebrow">برای اقامت شما</p><h2 id="home-services-title">فضاهای هتل</h2></div><div class="home-service-grid">${services.map((service) => `<a class="home-service" href="${routeHref(service.href)}"><img src="${service.image}" alt="" loading="lazy"><span>${safeText(service.title)}</span><span class="home-service__arrow" aria-hidden="true">←</span></a>`).join("")}</div></section>
    <section class="contact-strip"><div><p class="eyebrow">برای برنامه‌ریزی اقامت</p><h2>برای هماهنگی با هتل در تماس باشید</h2></div>${link("/contact", "راه‌های تماس", "button button--primary")}</section>`;
}

function galleryGrid() {
  return `<section class="content-section"><div class="section-heading"><p class="eyebrow">تصاویر مرجع</p><h2>گالری مفهومی</h2><p>این تصاویر برای نمایش ترکیب‌بندی هستند؛ هیچ‌کدام عکس واقعی هتل دامون نیستند.</p></div><div class="gallery-grid">${gallery.map((image, index) => `<button class="gallery-tile" type="button" data-gallery-index="${index}" aria-label="بزرگ‌نمایی تصویر مفهومی ${index + 1}"><img src="${safeText(image.src)}" alt="${safeText(image.alt)}" loading="lazy"><span>تصویر مفهومی</span></button>`).join("")}</div></section>`;
}

function render() {
  const path = normalizePath(window.location.pathname);
  const page = pageForPath(path);
  document.documentElement.lang = "fa";
  document.documentElement.dir = "rtl";
  document.title = page ? `${page.title} | ${site.name}` : `صفحه پیدا نشد | ${site.name}`;
  let description = document.querySelector('meta[name="description"]');
  if (!description) {
    description = document.createElement("meta");
    description.name = "description";
    document.head.append(description);
  }
  description.content = page?.text || "صفحه موردنظر در سایت هتل دامون پیدا نشد.";
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = "noindex, nofollow";
  const hasBookingSlot = path === "/" || path === "/rooms" || path.startsWith("/rooms/");
  root.innerHTML = `${header(page?.path || path)}<main id="main" class="site-main">${page ? `${hero(page, path)}${hasBookingSlot ? '<div data-booking-slot></div>' : ""}${path === "/" ? homeContent(page) : path === "/gallery" ? galleryGrid() : cards(page.sections)}` : `<section class="not-found"><p class="eyebrow">۴۰۴</p><h1>این صفحه پیدا نشد</h1><p>ممکن است نشانی صفحه تغییر کرده باشد.</p>${link("/", "بازگشت به خانه", "button button--primary")}</section>`}</main>${footer()}<div id="gallery-dialog-root"></div>`;
  wireInteractions();
}

function wireInteractions() {
  setTheme(readTheme());
  let paletteStorage;
  try { paletteStorage = window.localStorage; } catch { /* Private browsing can disable persistence. */ }
  applyPalette(readPalette(paletteStorage), document, paletteStorage);
  document.querySelectorAll('button[data-palette]').forEach(button => button.addEventListener('click', () => applyPalette(button.dataset.palette, document, paletteStorage)));
  const bookingSlot = document.querySelector('[data-booking-slot]');
  if (bookingSlot) mountBooking(bookingSlot, { routeHref });
  if (normalizePath(window.location.pathname) === '/contact') {
    const contact = document.createElement('section');
    contact.className = 'contact-actions content-section';
    contact.innerHTML = `<h2>پذیرش هتل دامون</h2><p>${safeText(site.address)}</p><div class="page-hero__actions"><a class="button button--primary" href="tel:${site.phone}">تماس با پذیرش <bdi>${site.phoneDisplay}</bdi></a><a class="button button--outline" href="${site.mapUrl}" target="_blank" rel="noopener noreferrer">مسیریابی روی نقشه</a></div>`;
    document.querySelector('main').append(contact);
  }
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileMenu = document.querySelector("#mobile-menu");
  const closeMenu = () => { if (!menuButton || !mobileMenu) return; menuButton.setAttribute("aria-expanded", "false"); menuButton.setAttribute("aria-label", "بازکردن منو"); mobileMenu.hidden = true; };
  menuButton?.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "بستن منو" : "بازکردن منو");
    mobileMenu.hidden = !open;
    if (open) mobileMenu.querySelector("a")?.focus();
  });
  mobileMenu?.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuButton.focus();
    }
  });
  document.querySelectorAll("[data-gallery-index]").forEach((button) => button.addEventListener("click", () => openGallery(Number(button.dataset.galleryIndex))));
}

function openGallery(startIndex) {
  let index = ((startIndex % gallery.length) + gallery.length) % gallery.length;
  const dialogRoot = document.querySelector("#gallery-dialog-root");
  const opener = document.activeElement;
  const draw = () => {
    const item = gallery[index];
    dialogRoot.innerHTML = `<div class="gallery-dialog-backdrop" data-dialog-backdrop><section class="gallery-dialog" role="dialog" aria-modal="true" aria-label="نمایش تصویر مفهومی" tabindex="-1"><button class="gallery-dialog__close" type="button" data-dialog-close aria-label="بستن نمایش تصویر">×</button><button class="gallery-dialog__prev" type="button" data-dialog-prev aria-label="تصویر قبلی">‹</button><figure><img src="${safeText(item.src)}" alt="${safeText(item.alt)}"><figcaption>${safeText(item.alt)} · تصویر مفهومی</figcaption></figure><button class="gallery-dialog__next" type="button" data-dialog-next aria-label="تصویر بعدی">›</button><p class="gallery-dialog__count">${index + 1} از ${gallery.length}</p></section></div>`;
    const dialog = dialogRoot.querySelector("[role=dialog]");
    dialog.querySelector("[data-dialog-close]").addEventListener("click", close);
    dialog.querySelector("[data-dialog-next]").addEventListener("click", () => { index = (index + 1) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); });
    dialog.querySelector("[data-dialog-prev]").addEventListener("click", () => { index = (index - 1 + gallery.length) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); });
    dialogRoot.querySelector("[data-dialog-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "ArrowRight") { index = (index - 1 + gallery.length) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); }
      if (event.key === "ArrowLeft") { index = (index + 1) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); }
      if (event.key === "Tab") {
        const focusable = [...dialog.querySelectorAll("button")];
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    });
    dialog.querySelector("[data-dialog-close]").focus();
  };
  const close = () => { dialogRoot.innerHTML = ""; opener?.focus?.(); };
  draw();
}

render();
