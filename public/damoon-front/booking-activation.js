export const DAMOON_PUBLIC_BOOKING_ACTIVATION = Object.freeze({
  enabled: false,
  property: "damoon-hotel",
  ownerApproval: null,
});

// Owner-authorized demonstration is isolated to the separate synthetic property.
// Normal Damoon booking stays request-only until its independent approval gate opens.
export const DAMOON_DEMO_BOOKING_ACTIVATION = Object.freeze({
  enabled: true,
  organization: "damoon-hotel",
  property: "damoon-demo",
  hosts: ["damoon-hotel.ir", "www.damoon-hotel.ir"],
});

export function isDamoonDemoBookingActivated(hostname, activation = DAMOON_DEMO_BOOKING_ACTIVATION) {
  return activation?.enabled === true
    && activation.organization === "damoon-hotel"
    && activation.property === "damoon-demo"
    && Array.isArray(activation.hosts)
    && activation.hosts.includes(String(hostname || "").trim().toLowerCase());
}

export function isDamoonPublicBookingActivated(activation = DAMOON_PUBLIC_BOOKING_ACTIVATION) {
  const approval = activation?.ownerApproval;
  if (activation?.enabled !== true || activation.property !== "damoon-hotel") return false;
  if (approval?.approvedBy !== "property_owner") return false;
  if (typeof approval.reference !== "string" || !/^DAMOON-BOOKING-[A-Z0-9-]{6,40}$/.test(approval.reference)) return false;
  if (typeof approval.approvedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approval.approvedAt)) return false;
  return Number.isFinite(Date.parse(approval.approvedAt)) && new Date(approval.approvedAt).toISOString() === approval.approvedAt;
}

const demoReservationCopy = Object.freeze({
  fa: Object.freeze({
    title: "نمایش رزرو آنلاین هتل دامون",
    description: "در این نمایش، جست‌وجو، قیمت و موجودی همگی ساختگی‌اند. رزرو و پرداخت نیز شبیه‌سازی می‌شوند و رزرو نمایشی فقط در پذیرش نمایشی دامون دیده می‌شود؛ هیچ خدمت رزرو یا پرداخت واقعی ارائه نمی‌شود.",
    badge: "رزرو نمایشی · داده‌ها و پرداخت ساختگی",
    start: "رفتن به فرم رزرو نمایشی",
    search: "جست‌وجوی گزینه‌های نمایشی",
    planning: "تاریخ و تعداد مهمانان را برای جست‌وجوی نمایشی انتخاب کنید؛ قیمت و موجودی واقعی نیستند.",
  }),
  en: Object.freeze({
    title: "Damoon Hotel booking demo",
    description: "Search results, prices, and inventory in this demonstration are synthetic. Reservations and payments are simulated, and demo reservations appear only in Damoon demo reception; no real booking or payment service is provided.",
    badge: "Booking demo · synthetic data and payment",
    start: "Go to the demo booking form",
    search: "Search demo options",
    planning: "Choose dates and guest counts to search the demo; prices and inventory are synthetic.",
  }),
  ar: Object.freeze({
    title: "عرض الحجز التجريبي لفندق دامون",
    description: "نتائج البحث والأسعار والتوفر في هذا العرض اصطناعية. الحجوزات والمدفوعات محاكاة، وتظهر الحجوزات التجريبية في استقبال دامون التجريبي فقط؛ ولا تُقدّم خدمة حجز أو دفع حقيقية.",
    badge: "حجز تجريبي · بيانات ودفع اصطناعيان",
    start: "الانتقال إلى نموذج الحجز التجريبي",
    search: "بحث عن خيارات تجريبية",
    planning: "اختر التواريخ وعدد الضيوف للبحث التجريبي؛ الأسعار والتوفر اصطناعيان.",
  }),
});

export function getDamoonDemoBookingCopy(locale) {
  return demoReservationCopy[locale] || demoReservationCopy.fa;
}

export function getDamoonReservationPageCopy({ mode, hostname, locale }) {
  const isDemo = mode === "DEMO_BOOKING" && isDamoonDemoBookingActivated(hostname);
  if (isDemo) return { ...getDamoonDemoBookingCopy(locale), isDemo: true };
  const requestCopy = {
    fa: { title: "درخواست هماهنگی اقامت", description: "تاریخ و ترکیب مهمانان را برای ارسال درخواست هماهنگی به پذیرش انتخاب کنید؛ این مسیر موجودی یا قیمت را بررسی و رزرو یا پرداخت انجام نمی‌دهد." },
    en: { title: "Request stay coordination", description: "Choose dates and guests to send a coordination request to reception. This route does not check availability, confirm a rate, hold a room, or take payment." },
    ar: { title: "طلب تنسيق الإقامة", description: "اختر التواريخ والضيوف لإرسال طلب تنسيق إلى الاستقبال؛ لا يتحقق هذا المسار من التوفر أو الأسعار ولا ينشئ حجزاً أو دفعة." },
  };
  return { ...requestCopy[locale] || requestCopy.fa, isDemo: false };
}
