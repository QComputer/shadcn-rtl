// Pure helpers for Damoon B2/B3 booking flow (no DOM). Keeps pricing/payload logic testable.

export function parseChildAges(inputs, expectedCount) {
  if (expectedCount === 0) return { ok: true, ages: [] };
  if (!Array.isArray(inputs) || inputs.length !== expectedCount) return { ok: false, ages: [] };
  const ages = [];
  for (const value of inputs) {
    const raw = typeof value === "number" ? String(value) : String(value ?? "").trim();
    if (raw === "") return { ok: false, ages: [] };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 17) return { ok: false, ages: [] };
    ages.push(n);
  }
  return { ok: true, ages };
}

export function validateContact(contact) {
  const fullName = typeof contact?.fullName === "string" ? contact.fullName.trim() : "";
  const phone = typeof contact?.phone === "string" ? contact.phone.trim() : "";
  const email = typeof contact?.email === "string" ? contact.email.trim() : "";
  if (fullName.length < 2 || fullName.length > 120) return { ok: false };
  if (!/^[+\d][\d\s\-()]{7,23}$/.test(phone)) return { ok: false };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false };
  return { ok: true, value: { fullName, phone, ...(email ? { email } : {}) } };
}

export function availableOptions(result) {
  const options = Array.isArray(result?.options) ? result.options : [];
  return options.filter((o) => o && o.isAvailable !== false && o.roomType?.slug && o.ratePlan?.code);
}

export function formatMoney(amount, currency, locale) {
  const n = typeof amount === "bigint" ? Number(amount) : Number(amount);
  if (!Number.isFinite(n)) return "";
  const formatted = new Intl.NumberFormat(locale || "fa", { maximumFractionDigits: 0 }).format(n);
  if (currency === "TOMAN" || !currency) return locale === "fa" ? `${formatted} تومان` : locale === "ar" ? `${formatted} تومان` : `${formatted} Toman`;
  return `${formatted} ${currency}`;
}

export function policySummary(policy, locale) {
  if (!policy || typeof policy !== "object") return null;
  const freeHours = Number(policy.freeCancellationCutoffHours);
  const retention = Number(policy.fullCancellationRetention);
  if (Number.isFinite(freeHours) && freeHours > 0 && retention < 1) {
    if (locale === "fa") return `لغو رایگان تا ${freeHours} ساعت قبل از ورود.`;
    if (locale === "ar") return `إلغاء مجاني حتى ${freeHours} ساعة قبل تسجيل الوصول.`;
    return `Free cancellation until ${freeHours} hours before check-in.`;
  }
  if (retention >= 1) {
    if (locale === "fa") return "این نرخ غیرقابل استرداد است.";
    if (locale === "ar") return "هذا السعر غير قابل للاسترداد.";
    return "This rate is non-refundable.";
  }
  return policy.name || policy.key || null;
}

export function buildHoldPayload({ property, range, adults, children, childAges, option, contact }) {
  const policyKey = option?.ratePlan?.cancellationPolicy?.key || "";
  const guests = [{ fullName: contact.fullName, isPrimary: true, isChild: false }];
  for (let i = 0; i < children; i += 1) guests.push({ fullName: contact.fullName, isPrimary: false, isChild: true, age: childAges[i] });
  return {
    property,
    roomType: option.roomType.slug,
    ratePlan: option.ratePlan.code,
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    occupancy: { adults, children, childAges },
    guests,
    contact,
    acceptedCancellationPolicyKey: policyKey,
  };
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `damoon-${crypto.randomUUID()}`;
  return `damoon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
