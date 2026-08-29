import type { MetadataRoute } from "next";
import { appPath } from "@/lib/app-base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bazarbaaz | بازارباز",
    short_name: "Bazarbaaz",
    description: "Bazarbaaz multi-business platform",
    start_url: appPath("/fa"),
    scope: appPath("/"),
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "fa",
    background_color: "#0f172a",
    theme_color: "#2F5BFF",
    categories: ["business", "shopping", "productivity"],
    icons: [
      {
        src: appPath("/icons/icon-192x192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: appPath("/icons/icon-512x512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: appPath("/icons/icon-maskable-192x192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: appPath("/icons/icon-maskable-512x512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "فروشگاه‌ها", short_name: "فروشگاه", url: appPath("/fa") },
      { name: "ورود به پنل", short_name: "پنل", url: appPath("/fa/dashboard") },
    ],
  };
}
