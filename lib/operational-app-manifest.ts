import type { MetadataRoute } from "next";
import { appPath, appResourceUrl } from "@/lib/app-base-path";
import type { ResolvedOrganizationBranding } from "@/lib/organization-branding";

type AppBasePath = "" | "/app";

function safeIconUrl(value: string, fallback: string, basePath: AppBasePath): string {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return appResourceUrl(value, basePath);
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
  } catch {
    // Fall through to the application-owned icon.
  }
  return appPath(fallback, basePath);
}

export function buildOperationalAppManifest(input: {
  basePath: AppBasePath;
  branding?: ResolvedOrganizationBranding | null;
}): MetadataRoute.Manifest {
  const { basePath, branding } = input;
  const name = branding?.displayName || "Bazarbaaz | بازارباز";
  const shortName = branding?.shortName || "Bazarbaaz";

  return {
    name,
    short_name: shortName,
    description: branding
      ? `${name} operational application powered by Bazarbaaz`
      : "Bazarbaaz multi-business platform",
    start_url: appPath("/fa", basePath),
    scope: appPath("/", basePath),
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "fa",
    background_color: "#0f172a",
    theme_color: "#2F5BFF",
    categories: ["business", "shopping", "productivity"],
    icons: [
      {
        src: safeIconUrl(branding?.pwaIcons.icon192 || "/icons/icon-192x192.png", "/icons/icon-192x192.png", basePath),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: safeIconUrl(branding?.pwaIcons.icon512 || "/icons/icon-512x512.png", "/icons/icon-512x512.png", basePath),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: appPath("/icons/icon-maskable-192x192.png", basePath),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: appPath("/icons/icon-maskable-512x512.png", basePath),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "فروشگاه‌ها", short_name: "فروشگاه", url: appPath("/fa", basePath) },
      { name: "ورود به پنل", short_name: "پنل", url: appPath("/fa/dashboard", basePath) },
    ],
  };
}
