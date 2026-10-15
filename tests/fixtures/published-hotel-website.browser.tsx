import { createRoot } from "react-dom/client";
import { PublishedHotelWebsitePage } from "../../components/published-hotel-website-page";
import type { HotelPublicLocale } from "../../lib/hotel/public-api-contract";
import { adaptAuthenticatedHotelWebsitePreview } from "../../lib/hotel/organization-site-presentation";

const queryLocale = new URLSearchParams(window.location.search).get("locale");
const locale: HotelPublicLocale = queryLocale === "en" || queryLocale === "ar" ? queryLocale : "fa";
const reviewCopy = {
  fa: { title: "پیش‌نمایش مصنوعی دامون", heading: "محتوای مفهومی برای بازبینی", subtitle: "هیچ ادعای واقعی درباره هتل نیست.", intro: "این داده فقط در مرورگر آزمون استفاده می‌شود.", alt: "تصویر مفهومی آزمون" },
  en: { title: "Synthetic Damoon preview", heading: "Conceptual content for review", subtitle: "No real hotel claim is made.", intro: "This data exists only in the browser test.", alt: "Conceptual test image" },
  ar: { title: "معاينة دامون اصطناعية", heading: "محتوى تصوري للمراجعة", subtitle: "لا يتضمن ذلك أي ادعاء حقيقي عن الفندق.", intro: "تُستخدم هذه البيانات في اختبار المتصفح فقط.", alt: "صورة اختبار تصورية" },
} as const;

const reviewMode = new URLSearchParams(window.location.search).get("mode") === "review";
const reviewPresentation = reviewMode ? adaptAuthenticatedHotelWebsitePreview({
  mode: "PREVIEW", locale, revisionId: "synthetic-revision", revisionNumber: 1, status: "DRAFT", pageKey: "HOME",
  content: {
    title: { [locale]: reviewCopy[locale].title },
    hero: { heading: { [locale]: reviewCopy[locale].heading }, subheading: { [locale]: reviewCopy[locale].subtitle } },
    introduction: { body: { [locale]: reviewCopy[locale].intro } },
    sections: [], contact: {},
  },
  media: [{ imageId: "synthetic-preview-image", src: "/uploads/synthetic-preview.webp", scope: "PROPERTY", roomTypeId: null, slot: "HERO_DESKTOP", sortOrder: 0, altText: { [locale]: reviewCopy[locale].alt } }],
}, { organizationId: "synthetic-organization-id", organizationSlug: "damoon-hotel", propertySlug: "synthetic-preview-property", locale }) : undefined;

createRoot(document.getElementById("root")!).render(<PublishedHotelWebsitePage propertySlug="synthetic-preview-property" locale={locale} presentation={reviewPresentation} />);
