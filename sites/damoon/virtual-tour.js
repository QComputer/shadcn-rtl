// Public catalog stays empty until each tour is approved for Damoon publication.
// Add entries here (not in page markup) after verifying its Andarama URL and rights.
export const DAMOON_VTOUR_TENANT = "damoon";
export const DAMOON_VTOUR_ALLOWED_ORIGINS = Object.freeze([]);
export const DAMOON_VTOUR_CATALOG = Object.freeze([
  // { id: "lobby", tenantId: "damoon", url: "https://approved.andarama.host/tour/<id>", roomSlugs: [], approved: true }
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
    const roomSlugs = Array.isArray(tour.roomSlugs) ? tour.roomSlugs.filter((slug) => ["single", "double", "suite"].includes(slug)) : [];
    return [{ id: tour.id, url, roomSlugs }];
  });
}

export function tourViewerMarkup(tour, title, allowedOrigins = DAMOON_VTOUR_ALLOWED_ORIGINS) {
  const url = allowedVirtualTourUrl(tour?.url, allowedOrigins);
  if (!url) return "";
  const escaped = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return `<div class="vtour-viewer"><iframe src="${escaped(url)}" title="${escaped(title)}" loading="lazy" allow="fullscreen; xr-spatial-tracking" allowfullscreen referrerpolicy="no-referrer"></iframe><a class="vtour-viewer__direct" href="${escaped(url)}" target="_blank" rel="noopener noreferrer">${escaped(title)} ↗</a></div>`;
}
