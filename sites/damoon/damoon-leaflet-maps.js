import { damoonAttractionsData as data } from "./damoon-attractions-data.js";

const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const copy = {
  fa: { load: "بارگذاری نقشه", defer: "نقشه با رسیدن به این بخش بارگذاری می‌شود.", loading: "نقشه در حال بارگذاری است…", error: "نقشه در دسترس نیست. از پیوند نقشه استفاده کنید.", tileNote: "نمایش نقشه به دسترسی سرویس نقشه وابسته است و ممکن است موقتاً در دسترس نباشد.", hotel: "هتل دامون", pending: data.labels.fa.pinPending, open: "بازکردن در نقشه", attraction: "جاهای دیدنی" },
  en: { load: "Load map", defer: "The map loads when this section is visible.", loading: "Loading map…", error: "Map tiles are unavailable. Use the map link below.", tileNote: "Map tiles are provided on a best-effort basis and may be temporarily unavailable.", hotel: "Damoon Hotel", pending: data.labels.en.pinPending, open: "Open map", attraction: "Attractions" },
  ar: { load: "تحميل الخريطة", defer: "تُحمّل الخريطة عند ظهور هذا القسم.", loading: "جارٍ تحميل الخريطة…", error: "الخريطة غير متاحة. استخدم رابط الخريطة أدناه.", tileNote: "تُعرض خرائط التجانب حسب التوفر وقد لا تكون متاحة مؤقتاً.", hotel: "فندق دامون", pending: data.labels.ar.pinPending, open: "فتح الخريطة", attraction: "المعالم" },
};
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
let leafletPromise;

export const hotelMapUrl = () => `https://www.openstreetmap.org/?mlat=${data.hotel.geo.lat}&mlon=${data.hotel.geo.lng}#map=15/${data.hotel.geo.lat}/${data.hotel.geo.lng}`;
export const attractionMapUrl = place => `https://www.openstreetmap.org/?mlat=${place.geo.lat}&mlon=${place.geo.lng}#map=16/${place.geo.lat}/${place.geo.lng}`;
export function getDamoonMapPoints(kind, slug = "") {
  if (kind === "hotel") return [{ id: "hotel", lat: data.hotel.geo.lat, lng: data.hotel.geo.lng, name: data.hotel.name }];
  if (kind === "attraction") return data.attractions.filter(item => item.id === slug).map(item => ({ id: item.id, lat: item.geo.lat, lng: item.geo.lng, name: item.content.en.name }));
  return [{ id: "hotel", lat: data.hotel.geo.lat, lng: data.hotel.geo.lng, name: data.hotel.name }, ...data.attractions.map(item => ({ id: item.id, lat: item.geo.lat, lng: item.geo.lng, name: item.content.en.name }))];
}

export function renderDamoonMap({ kind, locale = "fa", slug = "" }) {
  locale = copy[locale] ? locale : "fa";
  const mapTitle = kind === "hotel" ? copy[locale].hotel : kind === "attraction" ? data.attractions.find(item => item.id === slug)?.content[locale]?.name : copy[locale].attraction;
  if (!mapTitle) return "";
  const url = kind === "attraction" ? attractionMapUrl(data.attractions.find(item => item.id === slug)) : hotelMapUrl();
  const pending = kind === "hotel" || kind === "attractions" ? `<p class="da-pin-pending" role="note">${esc(copy[locale].pending)}</p>` : "";
  return `<section class="da-live-map" aria-label="${esc(mapTitle)}"><div class="da-map-shell" data-da-map data-map-kind="${esc(kind)}"${kind === "attraction" ? ` data-map-id="${esc(slug)}"` : ""} data-locale="${locale}"><div class="da-map-canvas" role="region" tabindex="0" aria-label="${esc(mapTitle)}"></div><div class="da-map-overlay"><p role="status" data-map-status>${esc(copy[locale].defer)}</p><button type="button" data-map-load>${esc(copy[locale].load)}</button></div></div>${pending}<p class="da-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p><p class="da-map-service-note">${esc(copy[locale].tileNote)}</p><a class="da-map-external" href="${url}" target="_blank" rel="noopener noreferrer">${esc(copy[locale].open)} ↗</a></section>`;
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/damoon-front/vendor/leaflet/leaflet.css";
    css.dataset.damoonLeaflet = "style";
    const script = document.createElement("script");
    script.src = "/damoon-front/vendor/leaflet/leaflet.js";
    script.dataset.damoonLeaflet = "script";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet failed to initialize"));
    script.onerror = () => reject(new Error("Leaflet script unavailable"));
    css.onerror = () => reject(new Error("Leaflet stylesheet unavailable"));
    document.head.append(css, script);
  }).catch(error => { leafletPromise = null; throw error; });
  return leafletPromise;
}

function markerPopup(L, place, locale, isHotel = false) {
  const title = isHotel ? copy[locale].hotel : place.content[locale].name;
  const node = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  node.append(heading);
  if (isHotel) {
    const note = document.createElement("p");
    note.textContent = copy[locale].pending;
    node.append(note);
    const link = document.createElement("a");
    link.href = hotelMapUrl();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = copy[locale].open;
    node.append(link);
  } else {
    const detail = document.createElement("a");
    detail.href = `/${locale}/attractions/${encodeURIComponent(place.id)}`;
    detail.textContent = data.labels[locale].readMore;
    node.append(detail);
    const directions = document.createElement("a");
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${place.geo.lat}%2C${place.geo.lng}&travelmode=driving`;
    directions.target = "_blank";
    directions.rel = "noopener noreferrer";
    directions.textContent = data.labels[locale].directions;
    node.append(document.createElement("br"), directions);
  }
  return L.popup({ autoPan: false }).setContent(node);
}

function setupMap(L, element) {
  const locale = copy[element.dataset.locale] ? element.dataset.locale : "fa";
  const kind = element.dataset.mapKind;
  const target = element.querySelector(".da-map-canvas");
  const status = element.querySelector("[data-map-status]");
  const overlay = element.querySelector(".da-map-overlay");
  const map = L.map(target, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, zoomControl: true, attributionControl: true, keyboard: true, preferCanvas: false });
  const markerData = kind === "hotel" ? [{ hotel: true, geo: data.hotel.geo }] : kind === "attraction" ? data.attractions.filter(item => item.id === element.dataset.mapId) : [{ hotel: true, geo: data.hotel.geo }, ...data.attractions];
  const markers = markerData.map(place => {
    const marker = L.marker([place.geo.lat, place.geo.lng], { keyboard: true, title: place.hotel ? copy[locale].hotel : place.content[locale].name, alt: place.hotel ? copy[locale].hotel : place.content[locale].name });
    marker.bindPopup(markerPopup(L, place, locale, Boolean(place.hotel)));
    marker.addTo(map);
    return marker;
  });
  if (kind === "attractions") map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [24, 24], maxZoom: 10, animate: false });
  else {
    const point = kind === "hotel" ? data.hotel.geo : data.attractions.find(item => item.id === element.dataset.mapId)?.geo;
    if (!point) throw new Error("Attraction map point missing");
    map.setView([point.lat, point.lng], kind === "hotel" ? 15 : 16, { animate: false });
  }
  const tiles = L.tileLayer(tileUrl, { maxZoom: 19, maxNativeZoom: 19, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 0, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>' });
  let tileFailed = false;
  tiles.on("tileerror", () => {
    tileFailed = true;
    status.textContent = copy[locale].error;
    status.hidden = false;
    overlay.classList.add("is-error");
  });
  tiles.on("tileload", () => {
    if (!tileFailed) overlay.hidden = true;
  });
  tiles.addTo(map);
  map.invalidateSize({ pan: false });
  return map;
}

export function mountDamoonMaps(root = document) {
  const pending = new WeakSet();
  const load = async element => {
    if (pending.has(element) || element.dataset.mapLoaded === "true") return;
    pending.add(element);
    const status = element.querySelector("[data-map-status]");
    const overlay = element.querySelector(".da-map-overlay");
    try {
      status.textContent = copy[element.dataset.locale]?.loading || copy.fa.loading;
      const L = await loadLeaflet();
      setupMap(L, element);
      element.dataset.mapLoaded = "true";
    } catch {
      status.textContent = copy[element.dataset.locale]?.error || copy.fa.error;
      status.hidden = false;
      overlay.classList.add("is-error");
    } finally {
      pending.delete(element);
    }
  };
  root.querySelectorAll("[data-da-map]").forEach(element => {
    element.querySelector("[data-map-load]")?.addEventListener("click", () => load(element));
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          load(element);
        }
      }, { rootMargin: "0px", threshold: 0.01 });
      observer.observe(element);
    }
  });
}
