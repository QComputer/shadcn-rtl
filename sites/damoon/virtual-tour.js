// No VTour delivery origin has been approved for the Damoon preview yet.
// Add a reviewed exact origin only after confirming ownership and embed policy.
export const DAMOON_VTOUR_ALLOWED_ORIGINS = Object.freeze([]);

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
