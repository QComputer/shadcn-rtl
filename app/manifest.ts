import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "\u0628\u0627\u0632\u0627\u0631 \u0628\u0627\u0632",
    short_name: "\u0628\u0627\u0632\u0627\u0631\u0628\u0627\u0632",
    description: "\u067e\u0644\u062a\u0641\u0631\u0645 \u0641\u0627\u0631\u0633\u06cc \u0641\u0631\u0648\u0634\u06af\u0627\u0647 \u0648 \u0631\u0632\u0631\u0648 \u0622\u0646\u0644\u0627\u06cc\u0646",
    start_url: "/fa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "fa",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    categories: ["business", "shopping", "productivity"],
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "\u0641\u0631\u0648\u0634\u06af\u0627\u0647\u200c\u0647\u0627",
        short_name: "\u0641\u0631\u0648\u0634\u06af\u0627\u0647",
        url: "/fa",
      },
      {
        name: "\u0648\u0631\u0648\u062f \u0628\u0647 \u067e\u0646\u0644",
        short_name: "\u067e\u0646\u0644",
        url: "/fa/dashboard",
      },
    ],
  }
}
