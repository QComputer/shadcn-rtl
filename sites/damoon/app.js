import { galleryForLocale, localeForPath, normalizePath, pageForPath, siteForLocale, roomForLocale } from "./content.js";
import { renderAccommodation, wireAccommodation } from "./accommodation.js";
import { renderHospitality } from "./hospitality.js";
import { renderDamoonAttractionsPage, mountDamoonAttractionsPage } from "./damoon-attractions-view.js";
import { renderDamoonAttractionDetailPage } from "./damoon-attractions-detail-view.js";
import { renderDamoonMap, mountDamoonMaps, hotelMapUrl } from "./damoon-leaflet-maps.js";
import { validateStayRange, todayLocalISO, jalaliAccessibleDay } from "./calendar.js";
import translations from "./translations.js";
import { palettes, readPalette, applyPalette } from "./themes.js";
import { mountBooking, readStaySelection } from "./booking.js";
import { parseChildAges, withStaySelection, guestPortalHref } from "./booking-flow.js";
import { allowedVirtualTourUrl } from "./virtual-tour.js";

const root = document.querySelector("#app");
if (!root) throw new Error("Damoon app mount #app was not found");

const safeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let locale = "fa";
let site;
let gallery;
let ui;
const faUI = {
  skipToMain: "╪▒┘ü╪¬┘å ╪¿┘ç ┘à╪¡╪¬┘ê╪º█î ╪º╪╡┘ä█î", mainMenu: "┘à┘å┘ê█î ╪º╪╡┘ä█î", mobileMenu: "┘à┘å┘ê█î ┘à┘ê╪¿╪º█î┘ä", appearanceSettings: "╪¬┘å╪╕█î┘à ╪╕╪º┘ç╪▒ ╪│╪º█î╪¬", choosePalette: "╪º┘å╪¬╪«╪º╪¿ ╪▒┘å┌»ΓÇî╪¿┘å╪»█î", contactHotel: "╪¬┘à╪º╪│ ╪¿╪º ┘ç╪¬┘ä", openMenu: "╪¿╪º╪▓┌⌐╪▒╪»┘å ┘à┘å┘ê", closeMenu: "╪¿╪│╪¬┘å ┘à┘å┘ê", footerLinks: "┘╛█î┘ê┘å╪»┘ç╪º█î ┘╛╪º█î╪º┘å█î", breadcrumb: "┘à╪│█î╪▒ ╪╡┘ü╪¡┘ç", detailsMore: "╪¼╪▓╪ª█î╪º╪¬ ╪¿█î╪┤╪¬╪▒", generalHotel: "┘ç╪¬┘ä ╪»╪º┘à┘ê┘å", additionalInformation: "╪º╪╖┘ä╪º╪╣╪º╪¬ ╪¿█î╪┤╪¬╪▒", coordinateWithHotel: "┘ç┘à╪º┘ç┘å┌»█î ╪¿╪º ┘ç╪¬┘ä", pageNotFound: "╪º█î┘å ╪╡┘ü╪¡┘ç ┘╛█î╪»╪º ┘å╪┤╪»", pageNotFoundText: "┘à┘à┌⌐┘å ╪º╪│╪¬ ┘å╪┤╪º┘å█î ╪╡┘ü╪¡┘ç ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘ç ╪¿╪º╪┤╪».", backHome: "╪¿╪º╪▓┌»╪┤╪¬ ╪¿┘ç ╪«╪º┘å┘ç", reception: "┘╛╪░█î╪▒╪┤", callReception: "╪¬┘à╪º╪│ ╪¿╪º ┘╛╪░█î╪▒╪┤", directions: "┘à╪│█î╪▒█î╪º╪¿█î ╪▒┘ê█î ┘å┘é╪┤┘ç", checkIn: "┘ê╪▒┘ê╪»", checkOut: "╪«╪▒┘ê╪¼", guests: "┘à┘ç┘à╪º┘å╪º┘å", room: "╪º╪¬╪º┘é", rooms: "╪º╪¬╪º┘éΓÇî┘ç╪º", restaurant: "╪º╪╖┘ä╪º╪╣╪º╪¬ ┘╛╪░█î╪▒╪º█î█î", cafe: "┘╛╪░█î╪▒╪º█î█î ╪»╪▒ ╪º╪¬╪º┘é", facilities: "╪«╪»┘à╪º╪¬ ┘à┘ç┘à╪º┘å╪º┘å", gallery: "┌»╪º┘ä╪▒█î", aboutDamoon: "╪»╪▒╪¿╪º╪▒┘ç┘ö ╪»╪º┘à┘ê┘å", contact: "╪¬┘à╪º╪│", policies: "┘é┘ê╪º┘å█î┘å ┘ê ╪¡╪▒█î┘à ╪«╪╡┘ê╪╡█î", virtualTour: "╪¬┘ê╪▒ ┘à╪¼╪º╪▓█î", conceptImage: "╪¬╪╡┘ê█î╪▒ ┘à┘ü┘ç┘ê┘à█î", conceptGallery: "┌»╪º┘ä╪▒█î ┘à┘ü┘ç┘ê┘à█î", referenceImages: "╪¬╪╡╪º┘ê█î╪▒ ┘à╪▒╪¼╪╣", zoomConceptImage: "╪¿╪▓╪▒┌»ΓÇî┘å┘à╪º█î█î ╪¬╪╡┘ê█î╪▒ ┘à┘ü┘ç┘ê┘à█î", closeImageViewer: "╪¿╪│╪¬┘å ┘å┘à╪º█î╪┤ ╪¬╪╡┘ê█î╪▒", previousImage: "╪¬╪╡┘ê█î╪▒ ┘é╪¿┘ä█î", nextImage: "╪¬╪╡┘ê█î╪▒ ╪¿╪╣╪»█î", imageNotActual: "╪¬╪╡┘ê█î╪▒ ┘à┘ü┘ç┘ê┘à█î╪¢ ╪╣┌⌐╪│ ┘ê╪º┘é╪╣█î ┘ç╪¬┘ä ┘å█î╪│╪¬.", imageCount: "{current} ╪º╪▓ {total}", colorPalette: "╪▒┘å┌»ΓÇî╪¿┘å╪»█î", switchToDark: "╪▒┘ü╪¬┘å ╪¿┘ç ╪¬┘à ╪¬█î╪▒┘ç", switchToLight: "╪▒┘ü╪¬┘å ╪¿┘ç ╪¬┘à ╪▒┘ê╪┤┘å", footerReception: "┘╛╪░█î╪▒╪┤", noscript: "╪¿╪▒╪º█î ┘å┘à╪º█î╪┤ ╪º█î┘å ┘å╪│╪«┘ç┘ö ╪»╪▒ ╪¡╪º┘ä ╪¬┌⌐┘à█î┘ä╪î ╪¼╪º┘ê╪º╪º╪│┌⌐╪▒█î┘╛╪¬ ┘à╪▒┘ê╪▒┌»╪▒ ╪▒╪º ┘ü╪╣╪º┘ä ┌⌐┘å█î╪».", homeSubtitle: "╪º┘é╪º┘à╪¬ ╪»╪▒ ╪»╪º┘à┘ê┘å", homeLead: "┘ç╪¬┘ä ╪»╪º┘à┘ê┘å ╪»╪▒ ╪┤┘ç╪▒┌⌐╪▒╪» █│█▒ ┘ê╪º╪¡╪» ╪º┘é╪º┘à╪¬█î ╪»╪º╪▒╪»: █▓█░ ╪º╪¬╪º┘é ┘ê █▒█▒ ╪│┘ê╪ª█î╪¬. ╪¿╪▒╪º█î ╪¿╪▒┘å╪º┘à┘çΓÇî╪▒█î╪▓█î ╪º┘é╪º┘à╪¬ ╪¿╪º ┘╛╪░█î╪▒╪┤ ┘ç┘à╪º┘ç┘å┌» ┌⌐┘å█î╪».", homeShortcuts: "╪»╪│╪¬╪▒╪│█î ╪│╪▒█î╪╣", roomSpaces: "┘ü╪╢╪º┘ç╪º█î ╪º┘é╪º┘à╪¬", restaurantShort: "╪º╪╖┘ä╪º╪╣╪º╪¬ ┘╛╪░█î╪▒╪º█î█î", tourShort: "┌»╪┤╪¬ΓÇî┘ê┌»╪░╪º╪▒ ╪»╪▒ ┘ü╪╢╪º┘ç╪º", calmStay: "╪¿╪▒╪º█î ╪º┘é╪º┘à╪¬█î ╪ó╪▒╪º┘à ┘ê ┘ä╪¡╪╕┘çΓÇî┘ç╪º█î█î ╪«┘ê╪┤", homeIntro: "┘ç╪¬┘ä ╪»╪º┘à┘ê┘å ╪»╪▒ ╪┤┘ç╪▒┌⌐╪▒╪» ┘à█î╪▓╪¿╪º┘å ┘à┘ç┘à╪º┘å╪º┘å ┘ê ╪¿╪▒┘å╪º┘à┘çΓÇî┘ç╪º█î ╪º┘é╪º┘à╪¬ ╪┤┘à╪º╪│╪¬. ╪¿╪▒╪º█î ┘ç┘à╪º┘ç┘å┌»█î ╪¿╪º ┘╛╪░█î╪▒╪┤ ╪»╪▒ ╪¬┘à╪º╪│ ╪¿╪º╪┤█î╪».", aboutMore: "╪¿█î╪┤╪¬╪▒ ╪»╪▒╪¿╪º╪▒┘ç┘ö ┘ç╪¬┘ä", accommodationSpaces: "┘ü╪╢╪º┘ç╪º█î ╪º┘é╪º┘à╪¬", aPlaceToRest: "╪¼╪º█î█î ╪¿╪▒╪º█î ╪ó╪│┘ê╪»┘å", browseRooms: "┌»╪▒┘ê┘çΓÇî┘ç╪º█î ╪º┘é╪º┘à╪¬█î ┘ç╪¬┘ä ╪»╪º┘à┘ê┘å ╪▒╪º ╪¿╪¿█î┘å█î╪» ┘ê ╪¿╪▒╪º█î ╪º┘å╪¬╪«╪º╪¿ ┘à╪¬┘å╪º╪│╪¿ ╪¿╪º ╪¿╪▒┘å╪º┘à┘çΓÇî╪¬╪º┘å ┘ç┘à╪º┘ç┘å┌» ┌⌐┘å█î╪».", conceptCaption: "╪¬╪╡┘ê█î╪▒ ┘à┘ü┘ç┘ê┘à█î", viewSpaces: "┘à╪┤╪º┘ç╪»┘ç┘ö ┘ü╪╢╪º┘ç╪º", forYourStay: "╪¿╪▒╪º█î ╪º┘é╪º┘à╪¬ ╪┤┘à╪º", hotelSpaces: "┘ü╪╢╪º┘ç╪º█î ┘ç╪¬┘ä", planYourStay: "╪¿╪▒╪º█î ╪¿╪▒┘å╪º┘à┘çΓÇî╪▒█î╪▓█î ╪º┘é╪º┘à╪¬", contactCoordination: "╪¿╪▒╪º█î ┘ç┘à╪º┘ç┘å┌»█î ╪¿╪º ┘ç╪¬┘ä ╪»╪▒ ╪¬┘à╪º╪│ ╪¿╪º╪┤█î╪»", homeEyebrow: "╪º┘é╪º┘à╪¬█î ╪ó╪▒╪º┘à ╪»╪▒ ╪┤┘ç╪▒┌⌐╪▒╪»", guestComfort: "╪ó╪│╪º█î╪┤ ┘à┘ç┘à╪º┘å╪º┘å", unitCount: "█│█▒ ┘ê╪º╪¡╪» ╪º┘é╪º┘à╪¬█î", unitBreakdown: "█▓█░ ╪º╪¬╪º┘é ┬╖ █▒█▒ ╪│┘ê╪ª█î╪¬", checkInLabel: "┘ê╪▒┘ê╪»", checkOutLabel: "╪«╪▒┘ê╪¼", notFound: "╪º█î┘å ╪╡┘ü╪¡┘ç ┘╛█î╪»╪º ┘å╪┤╪»", notFoundText: "┘à┘à┌⌐┘å ╪º╪│╪¬ ┘å╪┤╪º┘å█î ╪╡┘ü╪¡┘ç ╪¬╪║█î█î╪▒ ┌⌐╪▒╪»┘ç ╪¿╪º╪┤╪».", paletteNames: { hermes: "┌⌐╪▒┘à ┘ê ┘å╪º╪▒┘å╪¼█î", forest: "╪│╪¿╪▓ ╪▒┘ê╪┤┘å ┘ê ╪╖╪¿█î╪╣█î", wood: "┘é┘ç┘ê┘çΓÇî╪º█î ┌å┘ê╪¿█î" },
};

function prefixFor(localeCode = locale) {
  if (localeCode !== "fa") return `/${localeCode}`;
  return /^\/fa(?:\/|$)/.test(window.location.pathname) ? "/fa" : "";
}
const routeHref = (href) => `${prefixFor()}${href === "/" ? "/" : href}`;
function stayHref(href) {
  const target = withStaySelection(new URL(routeHref(href), window.location.origin), readStaySelection());
  const room = normalizePath(window.location.pathname).match(/^\/rooms\/(single|double|suite)$/)?.[1];
  if (room && normalizePath(target.pathname) === '/contact' && !target.searchParams.has('room')) target.searchParams.set('room', room);
  return target.pathname + target.search + target.hash;
}
const link = (href, label, className = "") => `<a class="${className}" href="${routeHref(href)}">${safeText(label)}</a>`;
function languageHref(code) {
  const path = normalizePath(window.location.pathname);
  const prefix = code === "fa" ? "" : `/${code}`;
  const url = withStaySelection(new URL(`${prefix}${path === "/" ? "/" : path}${window.location.search}${window.location.hash}`, window.location.origin), readStaySelection());
  return url.pathname + url.search + url.hash;
}

function readTheme() {
  try { return localStorage.getItem("damoon-theme") === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("damoon-theme", theme); } catch { /* Theme still works for this visit. */ }
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.setAttribute("aria-label", theme === "dark" ? ui.switchToLight : ui.switchToDark);
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.innerHTML = theme === "dark" ? "<span aria-hidden=\"true\">Γÿ╝</span>" : "<span aria-hidden=\"true\">ΓùÉ</span>";
  }
}

function languageSwitcher(path) {
  const choices = [["fa", "┘ü╪º╪▒╪│█î"], ["en", "English"], ["ar", "╪º┘ä╪╣╪▒╪¿┘è╪⌐"]];
  const current = choices.find(([code]) => code === locale) || choices[0];
  return `<details class="language-switcher"><summary aria-label="${safeText(locale === "en" ? "Language" : locale === "ar" ? "╪º┘ä┘ä╪║╪⌐" : "╪▓╪¿╪º┘å ╪│╪º█î╪¬")}"><span>${current[0].toUpperCase()}</span><span aria-hidden="true">Γîä</span></summary><div class="language-switcher__options">${choices.map(([code, label]) => `<a href="${safeText(languageHref(code))}" lang="${code}" hreflang="${code}"${locale === code ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</div></details>`;
}

function header(path) {
  const attractionsLabel = locale === "fa" ? "╪»█î╪»┘å█îΓÇî┘ç╪º█î ┘å╪▓╪»█î┌⌐" : locale === "ar" ? "┘à╪╣╪º┘ä┘à ┘é╪▒┘è╪¿╪⌐" : "Nearby attractions";
  const homeNavigation = [
    ["/", locale === "fa" ? "╪╡┘ü╪¡┘ç ╪º╪╡┘ä█î" : locale === "ar" ? "╪º┘ä╪▒╪ª┘è╪│┘è╪⌐" : "Home"],
    ["/rooms", locale === "fa" ? "╪º┘é╪º┘à╪¬" : locale === "ar" ? "╪º┘ä╪Ñ┘é╪º┘à╪⌐" : "Stay"],
    ["/attractions", attractionsLabel],
    ["/policies", ui.policies],
    ["/gallery", ui.gallery], ["/facilities", ui.facilities], ["/about", ui.aboutDamoon], ["/contact", ui.contact],
  ];
  const navItems = normalizePath(window.location.pathname) === "/" ? homeNavigation : site.nav;
  const nav = navItems.map(([href, label]) => {
    const active = href === path || (href === "/rooms" && path.startsWith("/rooms/")) || (href === "/attractions" && path.startsWith("/attractions/"));
    return `<a class="site-nav__link${active ? " is-active" : ""}" href="${routeHref(href)}"${active ? ' aria-current="page"' : ""}>${safeText(label)}</a>`;
  }).join("");
  const brandLabel = locale === "fa" ? `${site.name}╪î ╪╡┘ü╪¡┘ç┘ö ╪º╪╡┘ä█î` : `${site.name}, home`;
  const paletteNames = ui.paletteNames || faUI.paletteNames;
  return `<a class="skip-link" href="#main">${safeText(ui.skipToMain)}</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="${routeHref("/")}" aria-label="${safeText(brandLabel)}">
          <span class="brand__mark" aria-hidden="true">${locale === "fa" ? "╪»" : "D"}</span><span class="brand__text"><strong>${safeText(site.name)}</strong><small>${locale === "fa" ? "┘ç╪¬┘ä ┘ê ╪º┘é╪º┘à╪¬" : locale === "ar" ? "┘ü┘å╪»┘é ┘ê╪Ñ┘é╪º┘à╪⌐" : "Hotel and accommodation"} ┬╖ ${safeText(site.city)}</small></span>
        </a>
        <nav class="site-nav" aria-label="${safeText(ui.mainMenu)}">${nav}</nav>
        <div class="site-header__actions">
          ${languageSwitcher(path)}
          <div class="theme-controls" id="theme-controls" role="group" aria-label="${safeText(ui.appearanceSettings)}">
            <div class="palette-switcher" role="group" aria-label="${safeText(ui.choosePalette)}">
              ${palettes.map(p => `<button class="palette-choice" type="button" data-palette="${p.id}" aria-label="${safeText(`${ui.colorPalette}: ${paletteNames[p.id] || p.label}`)}" aria-pressed="false"><span></span></button>`).join("")}
            </div>
            <button class="theme-toggle" type="button" data-theme-toggle aria-label="${safeText(ui.switchToDark)}" aria-pressed="false"><span aria-hidden="true">ΓùÉ</span></button>
          </div>
          ${link("/contact", ui.contactHotel, "button button--small button--outline")}
          <button class="menu-toggle" type="button" aria-label="${safeText(ui.openMenu)}" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle><span></span><span></span></button>
        </div>
      </div>
      <nav id="mobile-menu" class="mobile-menu" aria-label="${safeText(ui.mobileMenu)}" hidden>${nav}${link("/contact", ui.contactHotel, "mobile-menu__cta")}</nav>
    </header>`;
}

function footer() {
  const attractionsLabel = locale === "fa" ? "╪»█î╪»┘å█îΓÇî┘ç╪º█î ┘å╪▓╪»█î┌⌐" : locale === "ar" ? "┘à╪╣╪º┘ä┘à ┘é╪▒┘è╪¿╪⌐" : "Nearby attractions";
  const footerLinks = [["/rooms", ui.rooms], ["/attractions", attractionsLabel], ["/facilities", ui.facilities], ["/gallery", ui.gallery], ["/about", ui.aboutDamoon], ["/contact", ui.contact], ["/policies", ui.policies], ["/virtual-tour", ui.virtualTour]];
  const alwaysOpen = locale === "fa" ? "┘ç┘à╪º┘ç┘å┌»█î ╪¿╪º ┘╛╪░█î╪▒╪┤" : locale === "ar" ? "╪º┘ä╪¬┘å╪│┘è┘é ┘à╪╣ ╪º┘ä╪º╪│╪¬┘é╪¿╪º┘ä" : "Coordinate with reception";
  return `<footer class="site-footer"><div class="site-footer__main"><div class="site-footer__brand"><span class="brand__mark" aria-hidden="true">${locale === "fa" ? "╪»" : "D"}</span><div><strong>${safeText(site.name)}</strong><p>${safeText(site.city)}</p></div></div><p class="site-footer__note">${safeText(site.address)} ┬╖ ${alwaysOpen}</p><nav class="footer-links" aria-label="${safeText(ui.footerLinks)}">${footerLinks.map(([href, label]) => link(href, label)).join("")}</nav></div><div class="site-footer__bottom"><span>┬⌐ ${new Date().getFullYear()} ${safeText(site.name)}</span><a href="tel:${site.phone}">${safeText(ui.reception)}: <bdi>${safeText(site.phoneDisplay)}</bdi></a></div></footer>`;
}

function breadcrumb(path, title) {
  if (path === "/") return "";
  return `<nav class="breadcrumb" aria-label="${safeText(ui.breadcrumb)}"><a href="${routeHref("/")}">${safeText(ui.rooms === "Rooms" ? "Home" : locale === "ar" ? "╪º┘ä╪▒╪ª┘è╪│┘è╪⌐" : locale === "en" ? "Home" : "╪«╪º┘å┘ç")}</a><span aria-hidden="true">/</span><span aria-current="page">${safeText(title)}</span></nav>`;
}

function hero(page, path) {
  const isHome = path === "/";
  const src = isHome ? "/assets/hero-reference-v2.png" : page.image || (path.startsWith("/rooms/") ? "/assets/room-concept-1.webp" : "/assets/gallery-concept-1.webp");
  const note = page.imageNote || (path === "/" ? site.imageNote : ui.imageNotActual);
  const actions = (page.actions || []).map(([href, label], index) => link(href, label, `button ${index ? "button--outline" : "button--primary"}`)).join("");
  const homeEyebrow = locale === "fa" ? "╪º┘é╪º┘à╪¬█î ╪ó╪▒╪º┘à<br class=\"home-eyebrow-break\">╪»╪▒ ┘é┘ä╪¿ ╪┤┘ç╪▒┌⌐╪▒╪»" : safeText(ui.homeEyebrow);
  const homeSubtitle = safeText(ui.homeSubtitle);
  const homeLead = safeText(ui.homeLead);
  return `<section class="page-hero${isHome ? " page-hero--home" : ""}" aria-labelledby="page-title">
    <div class="page-hero__copy">${breadcrumb(path, page.title)}<p class="eyebrow">${isHome ? homeEyebrow : safeText(site.eyebrow)}</p>${page.badge ? `<p class="status-badge">${safeText(page.badge)}</p>` : ""}<h1 id="page-title">${safeText(isHome ? site.name : page.intro || page.title)}</h1>${isHome ? `<p class="home-subtitle">${homeSubtitle}</p>` : ""}<p class="page-hero__lead">${isHome ? homeLead : safeText(page.text || "")}</p><div class="page-hero__actions">${isHome ? link("/rooms", locale === "fa" ? "╪¿╪▒┘å╪º┘à┘çΓÇî╪▒█î╪▓█î ╪º┘é╪º┘à╪¬" : locale === "ar" ? "╪«╪╖╪╖ ┘ä╪Ñ┘é╪º┘à╪¬┘â" : "Plan your stay", "button button--primary") : actions || link("/contact", ui.coordinateWithHotel, "button button--primary")}</div></div>
    <figure class="page-hero__visual"><img src="${safeText(src)}" alt="${safeText(note)}" fetchpriority="high"><figcaption>${safeText(note)}</figcaption></figure>
  </section>`;
}

function cards(sections = []) {
  if (!sections.length) return "";
  return `<section class="content-section" aria-label="${safeText(ui.additionalInformation)}"><div class="section-heading"><p class="eyebrow">${safeText(ui.generalHotel)}</p><h2>${safeText(ui.detailsMore)}</h2></div><div class="info-grid">${sections.map((item) => `<article class="info-card">${item.image ? `<a class="info-card__image" href="${routeHref(item.link || "/gallery")}" aria-label="${safeText(item.heading)}"><img src="${safeText(item.image)}" alt="${safeText(item.note || ui.imageNotActual)}" loading="lazy"><span class="image-caption">${safeText(item.note || ui.imageNotActual)}</span></a>` : ""}<div class="info-card__body">${item.badge ? `<span class="status-badge">${safeText(item.badge)}</span>` : ""}<h3>${safeText(item.heading)}</h3><p>${safeText(item.text)}</p>${item.link ? link(item.link, item.label || ui.additionalInformation, "text-link") : ""}</div></article>`).join("")}</div></section>`;
}

function homeContent() {
  const roomTiles = [
    { title: locale === "fa" ? "╪º╪¬╪º┘é █î┌⌐ΓÇî┘å┘ü╪▒┘ç" : locale === "ar" ? "╪║╪▒┘ü╪⌐ ┘à┘ü╪▒╪»╪⌐" : "Single room", image: "/assets/room-concept-1.webp", href: "/rooms/single" },
    { title: locale === "fa" ? "╪º╪¬╪º┘é ╪»┘ê┘å┘ü╪▒┘ç" : locale === "ar" ? "╪║╪▒┘ü╪⌐ ┘à╪▓╪»┘ê╪¼╪⌐" : "Double room", image: "/assets/room-concept-2.webp", href: "/rooms/double" },
    { title: locale === "fa" ? "╪│┘ê╪ª█î╪¬ΓÇî┘ç╪º█î ╪º┘é╪º┘à╪¬█î" : locale === "ar" ? "╪ú╪¼┘å╪¡╪⌐ ╪º┘ä╪Ñ┘é╪º┘à╪⌐" : "Accommodation suites", image: "/assets/room-concept-3.webp", href: "/rooms" },
  ];
  const slides = gallery.slice(0, 4);
  return `<section class="home-intro" aria-label="${safeText(ui.homeIntro)}"><div class="home-intro__copy"><p class="eyebrow">${safeText(locale === "fa" ? "╪»╪▒╪¿╪º╪▒┘ç ┘ç╪¬┘ä ╪»╪º┘à┘ê┘å" : ui.aboutMore)}</p><h2 id="home-intro-title">${safeText(locale === "fa" ? "╪¼╪º█î█î ┘à╪¬╪╣╪º╪»┘ä ╪¿╪▒╪º█î ╪│┘ü╪▒ ┘ê ╪ó╪▒╪º┘à╪┤" : ui.calmStay)}</h2><p>${safeText(ui.homeIntro)}</p><a class="text-link" href="${routeHref("/about")}">${safeText(ui.aboutMore)} ΓåÉ</a></div><div class="home-lobby" aria-label="${safeText(ui.gallery)}"><img data-home-slide src="/assets/lobby-concept.webp" alt="${safeText(ui.imageNotActual)}" loading="lazy"><button type="button" data-home-prev aria-label="${safeText(ui.previousImage)}">ΓÇ╣</button><button type="button" data-home-next aria-label="${safeText(ui.nextImage)}">ΓÇ║</button><div class="home-lobby__dots">${slides.map((_, i) => `<button type="button" data-home-dot="${i}" aria-label="${safeText(ui.gallery)} ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("")}</div></div><div class="home-side"><div class="home-room-list"><h2>${safeText(locale === "fa" ? "╪º╪¬╪º┘éΓÇî┘ç╪º ┘ê ╪│┘ê╪ª█î╪¬ΓÇî┘ç╪º" : ui.rooms)}</h2><div class="home-room-list__grid">${roomTiles.map((room, index) => `<a href="${routeHref(room.href)}" data-room-sprite="${index}"><img src="${room.image}" alt="${safeText(ui.imageNotActual)}" loading="lazy"><strong>${safeText(room.title)}<small>${safeText(ui.viewSpaces)}</small></strong></a>`).join("")}</div></div><div class="home-gallery-list"><h2>${safeText(locale === "fa" ? "╪¬╪╡╪º┘ê█î╪▒ ┘ç╪¬┘ä" : ui.gallery)}</h2><div>${slides.map((image, i) => `<a href="${routeHref("/gallery")}" data-gallery-sprite="${i}"><img src="${safeText(image.src)}" alt="${safeText(image.alt)}" loading="lazy"></a>`).join("")}</div></div></div></section>
    <div class="home-features"><span><svg viewBox="0 0 32 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 38C11 30 2 20 2 14a14 14 0 1 1 28 0c0 6-9 16-14 24Z"/><circle cx="16" cy="14" r="5"/></svg><strong>${safeText(ui.guestComfort)}</strong><small>${safeText(site.city)}</small></span><span><svg viewBox="0 0 40 36" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 29h34M6 25a14 14 0 0 1 28 0H6Zm14-17V4m-5 0h10M2 33h36"/></svg><strong>${safeText(ui.unitCount)}</strong><small>${safeText(ui.unitBreakdown)}</small></span><span><svg viewBox="0 0 32 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 38V2h22v36M1 38h30M12 38V28h8v10M10 8h3m6 0h3M10 14h3m6 0h3M10 20h3m6 0h3"/></svg><strong>${safeText(ui.checkInLabel)} · 14:00</strong><small>${safeText(ui.checkOutLabel)} · 12:00</small></span></div>`;
}

function galleryGrid() {
  return `<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(ui.referenceImages)}</p><h2>${safeText(ui.conceptGallery)}</h2><p>${safeText(locale === "fa" ? "╪º█î┘å ╪¬╪╡╪º┘ê█î╪▒ ╪¿╪▒╪º█î ┘å┘à╪º█î╪┤ ╪¬╪▒┌⌐█î╪¿ΓÇî╪¿┘å╪»█î ┘ç╪│╪¬┘å╪»╪¢ ┘ç█î┌åΓÇî┌⌐╪»╪º┘à ╪╣┌⌐╪│ ┘ê╪º┘é╪╣█î ┘ç╪¬┘ä ╪»╪º┘à┘ê┘å ┘å█î╪│╪¬┘å╪»." : locale === "ar" ? "┘ç╪░┘ç ╪º┘ä╪¬╪╡╪º┘à┘è┘à ┘ä╪¬┘ê╪╢┘è╪¡ ╪º┘ä╪¬┘â┘ê┘è┘å╪¢ ┘ê┘ä╪º ╪¬┘à╪½┘ä ╪╡┘ê╪▒╪º┘ï ╪¡┘é┘è┘é┘è╪⌐ ┘ä┘ü┘å╪»┘é ╪»╪º┘à┘ê┘å." : "These images illustrate layout and are not actual photographs of Damoon Hotel.")}</p></div><div class="gallery-grid">${gallery.map((image, index) => `<button class="gallery-tile" type="button" data-gallery-index="${index}" aria-label="${safeText(`${ui.zoomConceptImage} ${index + 1}`)}"><img src="${safeText(image.src)}" alt="${safeText(image.alt)}" loading="lazy"><span>${safeText(ui.conceptImage)}</span></button>`).join("")}</div></section>`;
}

function virtualTourUrl() {
  try {
    const fromQuery = new URLSearchParams(location.search).get("tour");
    const allowedQuery = allowedVirtualTourUrl(fromQuery);
    if (allowedQuery) return allowedQuery;
    const stored = localStorage.getItem("damoon-vtour-url");
    const allowedStored = allowedVirtualTourUrl(stored);
    if (allowedStored) return allowedStored;
  } catch { /* ignore */ }
  return allowedVirtualTourUrl(window.DAMOON_VTOUR_URL);
}
function virtualTourSection() {
  const url = virtualTourUrl();
  if (url) {
    return `<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(ui.virtualTour)}</p><h2>${safeText(ui.virtualTour)}</h2></div><div style="position:relative;padding-top:56.25%;background:#000;border-radius:12px;overflow:hidden"><iframe src="${safeText(url)}" title="${safeText(ui.virtualTour)}" loading="lazy" allow="fullscreen; xr-spatial-tracking" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div><p><a class="text-link" href="${safeText(url)}" target="_blank" rel="noopener noreferrer">${safeText(locale === "fa" ? "┘à╪┤╪º┘ç╪»┘ç┘ö ┘à╪│╪¬┘é█î┘à ╪¬┘ê╪▒" : locale === "ar" ? "╪╣╪▒╪╢ Tour ┘à╪¿╪º╪┤╪▒╪⌐" : "Open tour directly")} Γåù</a></p></section>`;
  }
  return `<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(ui.virtualTour)}</p><h2>${safeText(ui.virtualTour)}</h2></div><p>${safeText(locale === "fa" ? "┘å┘à╪º█î╪┤ ╪ó┘å┘ä╪º█î┘å ╪¬┘ê╪▒ ┘à╪¼╪º╪▓█î ╪»╪▒ ╪¡╪º┘ä ╪ó┘à╪º╪»┘çΓÇî╪│╪º╪▓█î ╪º╪│╪¬. ╪¿╪▒╪º█î ┘ç┘à╪º┘ç┘å┌»█î ╪¿╪º ┘╛╪░█î╪▒╪┤ ╪¬┘à╪º╪│ ╪¿┌»█î╪▒█î╪»." : locale === "ar" ? "╪╣╪▒╪╢ Tour ╪º┘ä╪º┘ü╪¬╪▒╪º╪╢┘è ┘é┘è╪» ╪º┘ä╪Ñ╪╣╪»╪º╪»." : "Online virtual tour display is being prepared.")}</p><div class="page-hero__actions">${link("/contact", ui.contactHotel, "button button--primary")}</div></section>`;
}
function render() {
  locale = localeForPath(window.location.pathname);
  if (!translations[locale] && locale !== "fa") locale = "fa";
  site = siteForLocale(locale);
  gallery = galleryForLocale(locale);
  ui = translations[locale]?.ui || faUI;
  const path = normalizePath(window.location.pathname);
  const page = pageForPath(path, locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = translations[locale]?.direction || "rtl";
  const noScript = document.querySelector("noscript");
  if (noScript) noScript.textContent = ui.noscript || faUI.noscript;
  document.title = page ? `${page.title} | ${site.name}` : `${ui.pageNotFound} | ${site.name}`;
  let description = document.querySelector('meta[name="description"]');
  if (!description) { description = document.createElement("meta"); description.name = "description"; document.head.append(description); }
  description.content = page?.text || ui.pageNotFoundText;
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.append(robots); }
  robots.content = "noindex, nofollow";
  const isAccommodation = path === '/rooms' || path.startsWith('/rooms/');
  let body;
  if (!page) body = `<section class="not-found"><p class="eyebrow">404</p><h1>${safeText(ui.pageNotFound)}</h1><p>${safeText(ui.pageNotFoundText)}</p>${link("/", ui.backHome, "button button--primary")}</section>`;
  else if (isAccommodation) body = renderAccommodation({ path, page, locale, site, routeHref, stayHref, escapeHtml: safeText });
  else if (path === '/') body = `<div class="home-top">${hero(page, path)}<div data-booking-slot></div></div>${homeContent()}`;
  else if (path === "/attractions") body = renderDamoonAttractionsPage(locale);
  else if (path.startsWith("/attractions/")) body = renderDamoonAttractionDetailPage(locale, path.slice("/attractions/".length));
  else if (path === "/virtual-tour") body = `${hero(page, path)}${virtualTourSection()}`; else body = renderHospitality({ path, page, locale, site, routeHref, escapeHtml: safeText }) || `${hero(page, path)}${cards(page.sections)}`;
  root.innerHTML = `${header(page?.path || path)}<main id="main" class="site-main${path === "/" ? " home-main" : ""}">${body}</main>${footer()}<div id="gallery-dialog-root"></div>`;
  const gallerySlot = root.querySelector('[data-hospitality-gallery-slot]');
  if (gallerySlot) gallerySlot.innerHTML = galleryGrid();
  wireInteractions();
}

function wireInteractions() {
  wireAccommodation(root);
  if (root.querySelector("[data-da-filter]")) mountDamoonAttractionsPage(root);
  const stayLinks = [...root.querySelectorAll('a[href]')].filter(a => a.origin === window.location.origin && !a.closest('.language-switcher') && !a.getAttribute('href').startsWith('#'));
  const syncStayLinks = () => {
    stayLinks.forEach(a => {
      if (!a.dataset.stayPath) a.dataset.stayPath = normalizePath(a.pathname) + a.search + a.hash;
      a.href = stayHref(a.dataset.stayPath);
    });
    root.querySelectorAll('.language-switcher a[hreflang]').forEach(a => { a.href = languageHref(a.hreflang); });
  };
  document.addEventListener('damoon:stay-change', syncStayLinks);
  syncStayLinks();
  const languageControl = document.querySelector('.language-switcher');
  document.addEventListener('click', (event) => {
    if (languageControl?.open && !languageControl.contains(event.target)) languageControl.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && languageControl?.open) {
      languageControl.open = false;
      languageControl.querySelector('summary')?.focus();
    }
  });
  setTheme(readTheme());
  let paletteStorage;
  try { paletteStorage = window.localStorage; } catch { /* Private browsing can disable persistence. */ }
  applyPalette(readPalette(paletteStorage), document, paletteStorage);
  document.querySelectorAll("button[data-palette]").forEach(button => button.addEventListener("click", () => applyPalette(button.dataset.palette, document, paletteStorage)));
  const bookingSlot = document.querySelector("[data-booking-slot]");
  if (bookingSlot) mountBooking(bookingSlot, { routeHref, locale, coordinationOnly: false, requestOnly: true, reservationEntry: true });
  const homeSlides = gallery.slice(1, 5);
  const homeImage = document.querySelector("[data-home-slide]");
  if (homeImage && homeSlides.length) {
    let slide = 0;
    const showSlide = () => {
      const item = homeSlides[slide];
      document.querySelector(".home-lobby")?.classList.toggle("is-live", slide !== 0);
      homeImage.src = item.src;
      homeImage.alt = item.alt;
      document.querySelectorAll("[data-home-dot]").forEach((dot, index) => dot.toggleAttribute("aria-current", index === slide));
    };
    document.querySelector("[data-home-prev]")?.addEventListener("click", () => { slide = (slide - 1 + homeSlides.length) % homeSlides.length; showSlide(); });
    document.querySelector("[data-home-next]")?.addEventListener("click", () => { slide = (slide + 1) % homeSlides.length; showSlide(); });
    document.querySelectorAll("[data-home-dot]").forEach(dot => dot.addEventListener("click", () => { slide = Number(dot.dataset.homeDot); showSlide(); }));
  }
  if (normalizePath(window.location.pathname) === "/contact" && !root.querySelector(".hospitality-contact-details")) {
    const contact = document.createElement("section");
    contact.className = "contact-actions content-section";
    contact.innerHTML = `<h2>${safeText(`${ui.reception} ${site.name}`)}</h2><p>${safeText(site.address)}</p><div class="page-hero__actions"><a class="button button--primary" href="tel:${site.phone}">${safeText(ui.callReception)} <bdi>${safeText(site.phoneDisplay)}</bdi></a><a class="button button--outline" href="${hotelMapUrl()}" target="_blank" rel="noopener noreferrer">${safeText(locale === "fa" ? "┘å┘à╪º█î╪┤ ┘à┘ê┘é╪╣█î╪¬ ╪¬┘é╪▒█î╪¿█î" : locale === "ar" ? "╪╣╪▒╪╢ ╪º┘ä┘à┘ê┘é╪╣ ╪º┘ä╪¬┘é╪▒┘è╪¿┘è" : "View approximate location")}</a></div>${renderDamoonMap({ kind: "hotel", locale })}`;
    document.querySelector("main").append(contact);
  }
  mountDamoonMaps(root);
  if (normalizePath(window.location.pathname) === '/contact') {
    const contactNotice = document.createElement('p');
    contactNotice.className = 'hospitality-note';
    contactNotice.dataset.contactApproval = 'pending';
    contactNotice.textContent = locale === 'fa'
      ? '╪┤┘à╪º╪▒┘ç ┘ê ┘å╪┤╪º┘å█î ╪º╪▓ ┘à┘å╪º╪¿╪╣ ╪╣┘à┘ê┘à█î ┌»╪▒╪»╪ó┘ê╪▒█î ╪┤╪»┘çΓÇî╪º┘å╪» ┘ê ╪¬╪ú█î█î╪» ┘å┘ç╪º█î█î ┘à╪»█î╪▒█î╪¬ ┘ç╪¬┘ä ╪»╪▒ ╪º┘å╪¬╪╕╪º╪▒ ╪º╪│╪¬. ┘ç┘å┌»╪º┘à ╪¬┘à╪º╪│╪î ╪╡╪¡╪¬ ┘à┘é╪╡╪» ╪▒╪º ╪¿╪▒╪▒╪│█î ┌⌐┘å█î╪».'
      : locale === 'ar'
        ? '╪¼┘Å┘à╪╣╪¬ ╪¿┘è╪º┘å╪º╪¬ ╪º┘ä┘ç╪º╪¬┘ü ┘ê╪º┘ä╪╣┘å┘ê╪º┘å ┘à┘å ┘à╪╡╪º╪»╪▒ ╪╣╪º┘à╪⌐╪î ┘ê┘ä╪º ┘è╪▓╪º┘ä ╪¬╪ú┘â┘è╪» ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä┘ü┘å╪»┘é ┘é┘è╪» ╪º┘ä╪º┘å╪¬╪╕╪º╪▒. ╪¬╪¡┘é┘æ┘é ┘à┘å ╪º┘ä╪¼┘ç╪⌐ ╪╣┘å╪» ╪º┘ä╪º╪¬╪╡╪º┘ä.'
        : 'The phone and address come from public sources and await hotel management confirmation. Verify the destination when calling.';
    root.querySelector('.hospitality-contact-details')?.append(contactNotice);
    const { range, guests, children, childAges } = readStaySelection();
    const selectedRoom = roomForLocale(new URLSearchParams(location.search).get('room'), locale);
    if (selectedRoom || validateStayRange(range, todayLocalISO()) === 'OK') {
      const summary = document.createElement('section');
      summary.className = 'hospitality-stay-context';
      const heading = locale === 'fa' ? '╪¿╪▒┘å╪º┘à┘ç┘ö ╪º┘é╪º┘à╪¬ ╪┤┘à╪º' : locale === 'ar' ? '╪«╪╖╪⌐ ╪Ñ┘é╪º┘à╪¬┘â' : 'Your stay plans';
      const hint = locale === 'fa' ? '╪º█î┘å ╪º╪╖┘ä╪º╪╣╪º╪¬ ╪▒╪º ┘ç┘å┌»╪º┘à ╪¬┘à╪º╪│ ╪¿╪º ┘╛╪░█î╪▒╪┤ ┘à╪╖╪▒╪¡ ┌⌐┘å█î╪»╪¢ ╪º┘å╪¬╪«╪º╪¿ ╪┤┘à╪º ╪▒╪▓╪▒┘ê ┘é╪╖╪╣█î ┘å█î╪│╪¬.' : locale === 'ar' ? '╪º╪░┘â╪▒ ┘ç╪░┘ç ╪º┘ä╪¬┘ü╪º╪╡┘è┘ä ╪╣┘å╪» ╪º┘ä╪º╪¬╪╡╪º┘ä ╪¿╪º┘ä╪º╪│╪¬┘é╪¿╪º┘ä╪¢ ╪º╪«╪¬┘è╪º╪▒┘â ┘ä┘è╪│ ╪¡╪¼╪▓╪º┘ï ┘à╪ñ┘â╪»╪º┘ï.' : 'Share these details when calling reception; this selection is not a confirmed reservation.';
      const dates = validateStayRange(range, todayLocalISO()) === 'OK' ? `${jalaliAccessibleDay(range.checkIn, locale)} ΓÇö ${jalaliAccessibleDay(range.checkOut, locale)}` : '';
      const number = (value) => new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
      const adultCount = locale === 'fa' ? `${number(guests)} ╪¿╪▓╪▒┌»╪│╪º┘ä` : locale === 'ar' ? `${number(guests)} ${guests === 1 ? '╪¿╪º┘ä╪║' : '╪¿╪º┘ä╪║┘è┘å'}` : `${number(guests)} ${guests === 1 ? 'adult' : 'adults'}`;
      const childCount = children > 0 ? locale === 'fa' ? `${number(children)} ┌⌐┘ê╪»┌⌐` : locale === 'ar' ? `${number(children)} ${children === 1 ? '╪╖┘ü┘ä' : '╪ú╪╖┘ü╪º┘ä'}` : `${number(children)} ${children === 1 ? 'child' : 'children'}` : '';
      const parsedAges = parseChildAges(childAges, children);
      const ageLabel = locale === 'fa' ? '╪│┘å ┌⌐┘ê╪»┌⌐╪º┘å' : locale === 'ar' ? '╪ú╪╣┘à╪º╪▒ ╪º┘ä╪ú╪╖┘ü╪º┘ä' : 'Child ages';
      const unknownAge = locale === 'fa' ? '┘å╪º┘à╪┤╪«╪╡' : locale === 'ar' ? '╪║┘è╪▒ ┘à╪¡╪»╪»' : 'not specified';
      const ageValues = parsedAges.ok ? parsedAges.ages.map(number) : Array.from({ length: children }, (_, index) => {
        const age = parseChildAges([childAges?.[index]], 1);
        return age.ok ? number(age.ages[0]) : unknownAge;
      });
      const ages = children > 0 ? ` ┬╖ ${ageLabel}: ${ageValues.join(', ')}` : '';
      const party = `${adultCount}${childCount ? ` ┬╖ ${childCount}${ages}` : ''}`;
      const staySummary = [selectedRoom?.title, dates, party, hint].filter(Boolean).join("\n");
      const copyLabel = locale === 'fa' ? '┌⌐┘╛█î ╪«┘ä╪º╪╡┘ç┘ö ╪º┘é╪º┘à╪¬' : locale === 'ar' ? '┘å╪│╪« ┘à┘ä╪«╪╡ ╪º┘ä╪Ñ┘é╪º┘à╪⌐' : 'Copy stay summary';
      const copiedMessage = locale === 'fa' ? '╪«┘ä╪º╪╡┘ç┘ö ╪º┘é╪º┘à╪¬ ┌⌐┘╛█î ╪┤╪».' : locale === 'ar' ? '╪¬┘à ┘å╪│╪« ┘à┘ä╪«╪╡ ╪º┘ä╪Ñ┘é╪º┘à╪⌐.' : 'Stay summary copied.';
      const copyFailedMessage = locale === 'fa' ? '┌⌐┘╛█î ╪«┘ê╪»┌⌐╪º╪▒ ╪º┘å╪¼╪º┘à ┘å╪┤╪». ┘à╪¬┘å ╪▒╪º ╪º┘å╪¬╪«╪º╪¿ ┘ê ╪»╪│╪¬█î ┌⌐┘╛█î ┌⌐┘å█î╪».' : locale === 'ar' ? '╪¬╪╣╪░╪▒ ╪º┘ä┘å╪│╪« ╪¬┘ä┘é╪º╪ª┘è╪º┘ï. ╪¡╪»┘æ╪» ╪º┘ä┘å╪╡ ┘ê╪º┘å╪│╪«┘ç ┘è╪»┘ê┘è╪º┘ï.' : 'Automatic copying failed. Select and copy the text manually.';
      const manualLabel = locale === 'fa' ? '╪«┘ä╪º╪╡┘ç┘ö ╪º┘é╪º┘à╪¬ ╪¿╪▒╪º█î ┌⌐┘╛█î ╪»╪│╪¬█î' : locale === 'ar' ? '┘à┘ä╪«╪╡ ╪º┘ä╪Ñ┘é╪º┘à╪⌐ ┘ä┘ä┘å╪│╪« ╪º┘ä┘è╪»┘ê┘è' : 'Stay summary for manual copying';
      summary.innerHTML = `<h2>${safeText(heading)}</h2>${selectedRoom ? `<p>${safeText(selectedRoom.title)}</p>` : ''}<p>${safeText(dates)} ┬╖ ${safeText(party)}</p><p>${safeText(hint)}</p><button type="button" class="button button--outline" data-copy-stay>${safeText(copyLabel)}</button><p role="status" aria-live="polite" data-copy-status></p><label data-copy-manual-label hidden>${safeText(manualLabel)}<textarea readonly data-copy-manual></textarea></label>`;
      const copyButton = summary.querySelector('[data-copy-stay]');
      const copyStatus = summary.querySelector('[data-copy-status]');
      const manualLabelElement = summary.querySelector('[data-copy-manual-label]');
      const manualText = summary.querySelector('[data-copy-manual]');
      copyButton.addEventListener('click', async () => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
          await navigator.clipboard.writeText(staySummary);
          manualLabelElement.hidden = true;
          copyStatus.textContent = copiedMessage;
        } catch {
          manualText.value = staySummary;
          manualLabelElement.hidden = false;
          copyStatus.textContent = copyFailedMessage;
          manualText.focus();
          manualText.select();
        }
      });
      const edit = document.createElement('a');
      edit.className = 'hospitality-text-link';
      edit.href = stayHref(selectedRoom ? `/rooms/${selectedRoom.slug}` : '/rooms');
      edit.textContent = locale === 'fa' ? '┘ê█î╪▒╪º█î╪┤ ╪¿╪▒┘å╪º┘à┘ç┘ö ╪º┘é╪º┘à╪¬' : locale === 'ar' ? '╪¬╪╣╪»┘è┘ä ╪«╪╖╪⌐ ╪º┘ä╪Ñ┘é╪º┘à╪⌐' : 'Edit stay plans';
      summary.append(edit);
      root.querySelector('.hospitality-contact-details')?.after(summary);

      // Guest portal link: fetch tenant mapping and append "Continue in guest portal" link
      const continueLabel = locale === 'fa' ? 'ادامه در دروازه مهمان' : locale === 'ar' ? 'متابعة في بوابة الضيف' : 'Continue in guest portal';
      (async () => {
        try {
          const portalResponse = await fetch('/api/hotel/v1/guest-portal', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' },
          });
          if (portalResponse.ok) {
            const mapping = await portalResponse.json();
            const selection = { range, guests, children, childAges };
            const portalPath = guestPortalHref(window.location.href, locale, mapping, selection);
            if (portalPath) {
              const portalLink = document.createElement('a');
              portalLink.className = 'hospitality-text-link';
              portalLink.href = portalPath;
              portalLink.textContent = continueLabel;
              summary.append(portalLink);
            }
          }
        } catch {
          // Guest portal unavailable; stay summary remains functional without the link.
        }
      })();
    }
  }
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileMenu = document.querySelector("#mobile-menu");
  const closeMenu = () => { if (!menuButton || !mobileMenu) return; menuButton.setAttribute("aria-expanded", "false"); menuButton.setAttribute("aria-label", ui.openMenu); mobileMenu.hidden = true; };
  menuButton?.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? ui.closeMenu : ui.openMenu);
    mobileMenu.hidden = !open;
    if (open) mobileMenu.querySelector("a")?.focus();
  });
  mobileMenu?.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") { closeMenu(); menuButton.focus(); } });
  document.querySelectorAll("[data-gallery-index]").forEach((button) => button.addEventListener("click", () => openGallery(Number(button.dataset.galleryIndex))));
}

function openGallery(startIndex) {
  let index = ((startIndex % gallery.length) + gallery.length) % gallery.length;
  const dialogRoot = document.querySelector("#gallery-dialog-root");
  const opener = document.activeElement;
  const draw = () => {
    const item = gallery[index];
    dialogRoot.innerHTML = `<div class="gallery-dialog-backdrop" data-dialog-backdrop><section class="gallery-dialog" role="dialog" aria-modal="true" aria-label="${safeText(ui.conceptImage)}" tabindex="-1"><button class="gallery-dialog__close" type="button" data-dialog-close aria-label="${safeText(ui.closeImageViewer)}">├ù</button><button class="gallery-dialog__prev" type="button" data-dialog-prev aria-label="${safeText(ui.previousImage)}">ΓÇ╣</button><figure><img src="${safeText(item.src)}" alt="${safeText(item.alt)}"><figcaption>${safeText(item.alt)} ┬╖ ${safeText(ui.conceptImage)}</figcaption></figure><button class="gallery-dialog__next" type="button" data-dialog-next aria-label="${safeText(ui.nextImage)}">ΓÇ║</button><p class="gallery-dialog__count">${safeText(ui.imageCount.replace("{current}", String(index + 1)).replace("{total}", String(gallery.length)))}</p></section></div>`;
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
