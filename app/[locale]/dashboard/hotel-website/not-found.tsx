"use client";

import { useLocale } from "@/components/locale-provider";
import { HotelDataState } from "@/components/hotel-data-state";

export default function HotelWebsiteWorkspaceNotFound() {
  const { locale } = useLocale();
  return <div data-testid="hotel-cms-unavailable"><HotelDataState code="UNAVAILABLE_PROPERTY" locale={locale === "en" || locale === "ar" ? locale : "fa"} /></div>;
}
