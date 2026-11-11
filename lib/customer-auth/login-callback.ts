const callbackBase = "https://same-origin.invalid";
const allowedLocales = new Set(["fa", "en", "ar"]);

/** Resolve a login callback to a same-origin path, or to the localized app root. */
export function resolveCustomerLoginCallback(value: string | undefined, locale: string): string {
  const safeLocale = allowedLocales.has(locale) ? locale : "fa";
  const fallback = `/${safeLocale}`;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /%(?:2f|5c)/i.test(value)) return fallback;
  try {
    const parsed = new URL(value, callbackBase);
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (parsed.origin !== callbackBase || !decodedPath.startsWith("/") || decodedPath.startsWith("//") || decodedPath.includes("\\") || parsed.username || parsed.password) return fallback;
    if (parsed.searchParams.has("token") || parsed.hash.toLowerCase().includes("token=")) return fallback;
    return value;
  } catch {
    return fallback;
  }
}
