import type { HotelPublicLocale } from "../lib/hotel-public-read-adapter";
import { hotelFrontendStateText, type HotelFrontendStateCode } from "../lib/hotel-frontend-state";
import styles from "./hotel-data-state.module.css";

/** Reusable non-sensitive status view for later server-provided hotel snapshots. */
export function HotelDataState({ code, locale }: { code: HotelFrontendStateCode; locale: HotelPublicLocale }) {
  const message = hotelFrontendStateText(code, locale);
  return <section className={styles.notice} role="status" dir={locale === "en" ? "ltr" : "rtl"} data-hotel-state={code}>
    <strong>{message.title}</strong>
    <p>{message.detail}</p>
  </section>;
}
