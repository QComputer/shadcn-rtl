import { createRoot } from "react-dom/client";
import { PublishedHotelWebsitePage } from "../../components/published-hotel-website-page";
import type { HotelPublicLocale } from "../../lib/hotel/public-api-contract";

const queryLocale = new URLSearchParams(window.location.search).get("locale");
const locale: HotelPublicLocale = queryLocale === "en" || queryLocale === "ar" ? queryLocale : "fa";

createRoot(document.getElementById("root")!).render(<PublishedHotelWebsitePage propertySlug="synthetic-preview-property" locale={locale} />);
