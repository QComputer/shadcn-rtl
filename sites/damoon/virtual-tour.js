export const DAMOON_VTOUR_TENANT = "damoon";
export const DAMOON_VTOUR_ALLOWED_ORIGINS = Object.freeze(["https://andarama.bazarbaaz.ir"]);
const DAMOON_VTOUR_ROOM_SLUGS = new Set([
  "vip", "single-room", "fourth-floor-suite",
  "single", "double", "suite", "suite-3-bed", "suite-4-5-bed",
]);
export const DAMOON_VTOUR_CATALOG = Object.freeze([
  {
    id: "test-damoon-hotel",
    tenantId: "damoon",
    url: "https://andarama.bazarbaaz.ir/t/test-damoon-hotel#s=n2ohIYwAprMY3uMSoejp3&y=-76.6&p=3.1&f=111.3",
    roomSlugs: [],
    approved: true,
    representation: "CONCEPTUAL_PREVIEW",
  },
]);

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
    if (tour.representation === "CONCEPTUAL_PREVIEW") publishedTour.representation = tour.representation;
    return [publishedTour];
  });
}

export function tourViewerMarkup(tour, title, allowedOrigins = DAMOON_VTOUR_ALLOWED_ORIGINS, locale = "en") {
  const url = allowedVirtualTourUrl(tour?.url, allowedOrigins);
  if (!url) return "";
  const escaped = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const directLabel = locale === "fa" ? "بازکردن مستقیم تور ↗" : locale === "ar" ? "فتح الجولة مباشرةً ↗" : "Open the tour directly ↗";
  return `<div class="vtour-viewer" data-tour-representation="${tour?.representation === "CONCEPTUAL_PREVIEW" ? "conceptual" : "unverified"}"><iframe src="${escaped(url)}" title="${escaped(title)}" loading="lazy" allow="fullscreen; xr-spatial-tracking" allowfullscreen referrerpolicy="no-referrer"></iframe><a class="vtour-viewer__direct" href="${escaped(url)}" target="_blank" rel="noopener noreferrer">${escaped(directLabel)}</a></div>`;
}
