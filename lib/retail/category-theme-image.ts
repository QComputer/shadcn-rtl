export type CatalogImageTheme = "light" | "dark" | null;

/** Selects an explicit category image for the active theme, then shared fallbacks. */
export function selectCategoryThemeImage(
  theme: CatalogImageTheme,
  light?: string | null,
  dark?: string | null,
  fallback?: string | null,
): string | null {
  if (!theme) return null;
  return theme === "dark"
    ? dark || light || fallback || null
    : light || dark || fallback || null;
}
