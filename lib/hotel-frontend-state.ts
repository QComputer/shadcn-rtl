import type { HotelPublicLocale } from "./hotel-public-read-adapter";

/** Guest-facing states; never include raw route errors or internal identifiers. */
export type HotelFrontendStateCode =
  | "LOADING"
  | "NO_APPROVED_CONTENT"
  | "NO_PUBLISHED_ROOMS"
  | "CONTENT_CONTRACT_PENDING"
  | "MISSING_TRANSLATION"
  | "UNAVAILABLE_PROPERTY"
  | "PUBLICATION_DISABLED"
  | "TEMPORARY_UNAVAILABLE"
  | "PREVIEW_ONLY"
  | "BOOKING_DISABLED";

type StateText = Readonly<{ title: string; detail: string }>;

const messages: Record<HotelPublicLocale, Record<HotelFrontendStateCode, StateText>> = {
  fa: {
    LOADING: { title: "در حال آماده‌سازی", detail: "لطفاً کمی صبر کنید." },
    NO_APPROVED_CONTENT: { title: "اطلاعاتی برای نمایش نیست", detail: "محتوای تأییدشده‌ای برای این بخش منتشر نشده است." },
    NO_PUBLISHED_ROOMS: { title: "اطلاعات اتاق‌ها موجود نیست", detail: "هنوز دستهٔ اقامتی تأییدشده‌ای برای نمایش نداریم." },
    CONTENT_CONTRACT_PENDING: { title: "این بخش هنوز در دسترس نیست", detail: "نمایش اطلاعات تأییدشدهٔ این بخش هنوز فعال نشده است." },
    MISSING_TRANSLATION: { title: "متن این زبان آماده نیست", detail: "ترجمهٔ تأییدشده‌ای برای این بخش در دسترس نیست." },
    UNAVAILABLE_PROPERTY: { title: "این صفحه در دسترس نیست", detail: "لطفاً نشانی را بررسی کنید یا بعداً دوباره سر بزنید." },
    PUBLICATION_DISABLED: { title: "نمایش هتل فعلاً فعال نیست", detail: "اطلاعات تأییدشدهٔ هتل در حال حاضر نمایش داده نمی‌شود." },
    TEMPORARY_UNAVAILABLE: { title: "دریافت اطلاعات ممکن نشد", detail: "لطفاً کمی بعد دوباره تلاش کنید." },
    PREVIEW_ONLY: { title: "پیش‌نمایش طراحی", detail: "این محتوا منتشر نشده و اطلاعات قطعی هتل نیست." },
    BOOKING_DISABLED: { title: "رزرو آنلاین فعال نیست", detail: "این صفحه در حال حاضر امکان بررسی موجودی یا ثبت رزرو ندارد." },
  },
  en: {
    LOADING: { title: "Preparing information", detail: "Please wait a moment." },
    NO_APPROVED_CONTENT: { title: "Nothing to display yet", detail: "No approved content has been published for this section." },
    NO_PUBLISHED_ROOMS: { title: "Room information unavailable", detail: "No approved room categories are published yet." },
    CONTENT_CONTRACT_PENDING: { title: "This section is not available yet", detail: "Approved information for this section is not available to display." },
    MISSING_TRANSLATION: { title: "Text unavailable in this language", detail: "An approved translation is not available for this section." },
    UNAVAILABLE_PROPERTY: { title: "This page is unavailable", detail: "Check the address or try again later." },
    PUBLICATION_DISABLED: { title: "Hotel display is not active", detail: "Approved hotel information is not currently available." },
    TEMPORARY_UNAVAILABLE: { title: "Information could not be loaded", detail: "Please try again later." },
    PREVIEW_ONLY: { title: "Design preview", detail: "This content is unpublished and does not represent confirmed hotel information." },
    BOOKING_DISABLED: { title: "Online booking is unavailable", detail: "Availability search and reservations are not active on this page." },
  },
  ar: {
    LOADING: { title: "جارٍ تجهيز المعلومات", detail: "يرجى الانتظار قليلاً." },
    NO_APPROVED_CONTENT: { title: "لا يوجد محتوى للعرض", detail: "لم يُنشر محتوى معتمد لهذا القسم بعد." },
    NO_PUBLISHED_ROOMS: { title: "معلومات الغرف غير متاحة", detail: "لم تُنشر فئات غرف معتمدة بعد." },
    CONTENT_CONTRACT_PENDING: { title: "هذا القسم غير متاح بعد", detail: "عرض المعلومات المعتمدة لهذا القسم غير متاح حالياً." },
    MISSING_TRANSLATION: { title: "النص غير متاح بهذه اللغة", detail: "لا تتوفر ترجمة معتمدة لهذا القسم." },
    UNAVAILABLE_PROPERTY: { title: "هذه الصفحة غير متاحة", detail: "تحقق من العنوان أو حاول لاحقاً." },
    PUBLICATION_DISABLED: { title: "عرض الفندق غير مفعل", detail: "معلومات الفندق المعتمدة غير متاحة حالياً." },
    TEMPORARY_UNAVAILABLE: { title: "تعذر تحميل المعلومات", detail: "يرجى المحاولة لاحقاً." },
    PREVIEW_ONLY: { title: "معاينة التصميم", detail: "هذا المحتوى غير منشور ولا يمثل معلومات مؤكدة عن الفندق." },
    BOOKING_DISABLED: { title: "الحجز الإلكتروني غير متاح", detail: "البحث عن التوافر والحجوزات غير مفعّلين في هذه الصفحة." },
  },
};

export function hotelFrontendStateText(code: HotelFrontendStateCode, locale: HotelPublicLocale): StateText {
  return messages[locale][code];
}

/** Pure mapping for the committed R1 error envelope; never surface the raw body. */
export function hotelPublicReadErrorState(status: number, raw: unknown): HotelFrontendStateCode {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "TEMPORARY_UNAVAILABLE";
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== 1) return "TEMPORARY_UNAVAILABLE";
  if (status === 404 && record.error === "NOT_FOUND") return "UNAVAILABLE_PROPERTY";
  if (status === 503 && record.error === "PUBLICATION_DISABLED") return "PUBLICATION_DISABLED";
  return "TEMPORARY_UNAVAILABLE";
}

export function localizedTextState(value: string | null): "READY" | "MISSING_TRANSLATION" {
  return value === null ? "MISSING_TRANSLATION" : "READY";
}
