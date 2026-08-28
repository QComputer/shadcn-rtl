import type { MetadataRoute } from "next";
import { supportedLocales } from "@/lib/i18n";
import { getCanonicalUrl } from "@/lib/seo";

const transactionalDisallows = supportedLocales.flatMap((locale) => [
  `/${locale}/*/shop/checkout`,
  `/${locale}/*/shop/order/*`,
  `/${locale}/*/appointment/booking`,
  `/${locale}/*/appointment/my-appointments`,
]);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard/",
          "/fa/dashboard/",
          "/en/dashboard/",
          "/ar/dashboard/",
          ...transactionalDisallows,
        ],
      },
    ],
    sitemap: getCanonicalUrl("/sitemap.xml"),
    host: getCanonicalUrl("/").replace(/\/$/, ""),
  };
}
