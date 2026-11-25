import type { ReceptionDateIssue } from "../domain/property-calendar";

const messages = {
  fa: {
    REQUIRED: "تاریخ ورود و خروج را انتخاب کنید.", INVALID: "تاریخ معتبر وارد کنید.",
    PAST: "تاریخ ورود نباید قبل از امروز در منطقه زمانی هتل باشد.", ORDER: "تاریخ خروج باید بعد از تاریخ ورود باشد.",
    TOO_LONG: "حداکثر مدت این رزرو ۳۱ شب است.", LIMIT: "مدت اقامت یا تاریخ انتخاب‌شده با محدودیت‌های هتل سازگار نیست.",
    ROOM: "اتاق انتخاب‌شده برای این اقامت قابل تخصیص نیست؛ اتاق دیگری انتخاب کنید.",
    MAINTENANCE: "اتاق انتخاب‌شده در بازه اقامت تعمیرات دارد.", SCHEMA: "داده تعمیرات در دسترس نیست؛ تخصیص اتاق و ثبت ورود متوقف شد.",
    INVENTORY: "برای این تاریخ‌ها ظرفیت قابل رزرو وجود ندارد.", CHANGED: "ظرفیت یا اتاق تغییر کرده است؛ اطلاعات را تازه‌سازی و دوباره بررسی کنید.",
    POLICY: "قانون لغو برای این نرخ آماده نیست.", RATE: "نوع اتاق، نرخ یا ارز انتخاب‌شده در دسترس نیست.",
    GUEST: "مشخصات مهمانان با تعداد یا سن افراد مطابقت ندارد.", PHONE: "شماره تماس مهمان معتبر نیست.",
    ASSIGN: "قبل از ثبت ورود، اتاق را تخصیص دهید.", TRANSITION: "وضعیت فعلی رزرو اجازه این عملیات را نمی‌دهد.",
    AUTH: "دسترسی لازم برای این عملیات وجود ندارد؛ ورود و نقش کاربری را بررسی کنید.",
    RELOAD: "عملیات انجام شد، اما تازه‌سازی فهرست ناموفق بود. بارگذاری دوباره را بزنید.",
    UNAVAILABLE: "سرویس موقتاً در دسترس نیست. دوباره تلاش کنید.",
  },
  en: {
    REQUIRED: "Select check-in and check-out dates.", INVALID: "Enter valid dates.",
    PAST: "Check-in cannot precede today in the hotel's time zone.", ORDER: "Check-out must be after check-in.",
    TOO_LONG: "This reservation can be at most 31 nights.", LIMIT: "The selected dates or stay length are outside the hotel's limits.",
    ROOM: "The selected room cannot be assigned for this stay. Choose another room.",
    MAINTENANCE: "The selected room has scheduled maintenance during the stay.", SCHEMA: "Maintenance data is unavailable; room assignment and check-in are blocked.",
    INVENTORY: "No reservable inventory is available for these dates.", CHANGED: "Room or inventory changed. Refresh and check again.",
    POLICY: "The cancellation policy for this rate is not ready.", RATE: "The selected room type, rate or currency is unavailable.",
    GUEST: "Guest details do not match the party size or ages.", PHONE: "Enter a valid guest phone number.",
    ASSIGN: "Assign a room before check-in.", TRANSITION: "The current reservation status does not allow this action.",
    AUTH: "This action is not authorized. Check the session and user role.",
    RELOAD: "The action succeeded, but the list could not refresh. Use Refresh.", UNAVAILABLE: "The service is temporarily unavailable. Try again.",
  },
  ar: {
    REQUIRED: "اختر تاريخي الوصول والمغادرة.", INVALID: "أدخل تواريخ صحيحة.",
    PAST: "لا يمكن أن يسبق تاريخ الوصول اليوم حسب التوقيت المحلي للفندق.", ORDER: "يجب أن يكون تاريخ المغادرة بعد الوصول.",
    TOO_LONG: "الحد الأقصى لهذا الحجز 31 ليلة.", LIMIT: "التواريخ أو مدة الإقامة خارج حدود الفندق.",
    ROOM: "لا يمكن تخصيص الغرفة لهذه الإقامة؛ اختر غرفة أخرى.",
    MAINTENANCE: "توجد صيانة مجدولة للغرفة خلال الإقامة.", SCHEMA: "بيانات الصيانة غير متاحة؛ تم إيقاف تخصيص الغرفة وتسجيل الوصول.",
    INVENTORY: "لا توجد سعة قابلة للحجز في هذه التواريخ.", CHANGED: "تغيرت الغرفة أو السعة؛ حدّث البيانات وتحقق مجدداً.",
    POLICY: "سياسة الإلغاء لهذا السعر غير جاهزة.", RATE: "نوع الغرفة أو السعر أو العملة غير متاح.",
    GUEST: "بيانات الضيوف لا تطابق العدد أو الأعمار.", PHONE: "أدخل رقم هاتف صحيحاً.",
    ASSIGN: "خصص غرفة قبل تسجيل الوصول.", TRANSITION: "حالة الحجز الحالية لا تسمح بهذا الإجراء.",
    AUTH: "الإجراء غير مصرح به؛ تحقق من الجلسة والدور.",
    RELOAD: "تم الإجراء، لكن تعذر تحديث القائمة. استخدم زر التحديث.", UNAVAILABLE: "الخدمة غير متاحة مؤقتاً. حاول مرة أخرى.",
  },
} as const;

type FeedbackKey = keyof typeof messages.fa;
const dictionary = (locale: string) => messages[locale as keyof typeof messages] ?? messages.fa;
export const receptionDateMessage = (issue: ReceptionDateIssue, locale: string) => dictionary(locale)[issue];
export const receptionReloadMessage = (locale: string) => dictionary(locale).RELOAD;

/** Only allowlisted domain failures are localized. Never expose raw stack/SQL/PII. */
export function reservationActionMessage(message: string, locale: string, fallback: string, status?: number): string {
  const lower = message.toLowerCase();
  let key: FeedbackKey | undefined;
  if (lower.includes("hotel_maintenance_schema_not_ready")) key = "SCHEMA";
  else if (lower.includes("check-in precedes property today")) key = "PAST";
  else if (lower.includes("stay is outside property limits")) key = "LIMIT";
  else if (lower.includes("stay must be 1 to 31 nights")) key = "LIMIT";
  else if (lower.includes("room_maintenance_conflict") || lower.includes("scheduled maintenance")) key = "MAINTENANCE";
  else if (lower.includes("inventory changed") || lower.includes("room or inventory changed")) key = "CHANGED";
  else if (lower.includes("selected physical room is") || lower.includes("room is already assigned") || lower.includes("room is not available")) key = "ROOM";
  else if (lower.includes("no inventory") || lower.includes("no room inventory") || lower.includes("requested hotel inventory")) key = "INVENTORY";
  else if (lower.includes("cancellation policy")) key = "POLICY";
  else if (lower.includes("room, rate plan or currency") || lower.includes("room type is not available")) key = "RATE";
  else if (lower.includes("guest details do not match") || lower.includes("valid age for each child") || /^(occupancy_exceeds_room_max|adults_exceed_room_capacity|children_exceed_room_capacity|not_enough_beds)$/.test(lower)) key = "GUEST";
  else if (lower.includes("valid guest phone number")) key = "PHONE";
  else if (lower.includes("assign a room before check-in")) key = "ASSIGN";
  else if (lower.includes("invalid reception transition") || lower.includes("only confirmed reservations")) key = "TRANSITION";
  else if (status === 401 || status === 403 || lower === "unauthorized" || lower === "forbidden" || lower.includes("manual room management is disabled")) key = "AUTH";
  else if (status === 503) key = "UNAVAILABLE";
  return key ? dictionary(locale)[key] : fallback;
}

export const reservationCenterRefreshEvent = "hotel:reservation-center:refresh";
export type ReservationCenterRefresh = { organizationId: string; propertyId: string };
export function refreshMatches(detail: unknown, scope: ReservationCenterRefresh): boolean {
  if (!detail || typeof detail !== "object") return false;
  const value = detail as Partial<ReservationCenterRefresh>;
  return value.organizationId === scope.organizationId && value.propertyId === scope.propertyId;
}

export class ReservationRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ReservationRequestError";
    this.status = status;
  }
}

export function receptionActionSuccess(action: unknown, locale: string): string {
  const copy = {
    fa: { "assign-room": "اتاق تخصیص یافت.", "check-in": "ورود مهمان ثبت شد.", "check-out": "خروج مهمان ثبت شد.", cancel: "رزرو لغو شد.", "confirm-reservation": "رزرو تأیید شد." },
    en: { "assign-room": "Room assigned.", "check-in": "Guest checked in.", "check-out": "Guest checked out.", cancel: "Reservation cancelled.", "confirm-reservation": "Reservation confirmed." },
    ar: { "assign-room": "تم تخصيص الغرفة.", "check-in": "تم تسجيل وصول الضيف.", "check-out": "تم تسجيل مغادرة الضيف.", cancel: "تم إلغاء الحجز.", "confirm-reservation": "تم تأكيد الحجز." },
  } as const;
  const localized = copy[locale as keyof typeof copy] ?? copy.fa;
  return typeof action === "string" && Object.hasOwn(localized, action) ? localized[action as keyof typeof localized] : "";
}
