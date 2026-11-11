// Pure helpers for Damoon B2/B3 booking flow (no DOM). Keeps pricing/payload logic testable.

/** Carry only explicit stay selections; never send names, phone numbers or payment data. */
export function withStaySelection(target, { range, adults, guests, children, childAges }) {
  const url = new URL(target);
  for (const key of ["checkIn", "checkOut", "adults", "guests", "children", "childAges"]) url.searchParams.delete(key);
  if (range?.checkIn) url.searchParams.set("checkIn", range.checkIn);
  if (range?.checkOut) url.searchParams.set("checkOut", range.checkOut);
  const count = adults ?? guests ?? 2;
  url.searchParams.set("adults", String(count));
  url.searchParams.set("guests", String(count));
  url.searchParams.set("children", String(children ?? 0));
  if (children > 0 && Array.isArray(childAges) && childAges.length === children) {
    // Empty positions remain explicitly unknown, so language/navigation never invent ages.
    const ages = childAges.map(value => { const parsed = parseChildAges([value], 1); return parsed.ok ? String(parsed.ages[0]) : ""; });
    url.searchParams.set("childAges", ages.join(","));
  }
  return url;
}

export function guestPortalHref(currentUrl, locale, mapping, selection) {
  let current;
  try { current = new URL(currentUrl); } catch { return null; }
  if (!/^https?:$/.test(current.protocol) || current.username || current.password) return null;
  if (!mapping || mapping.enabled !== true || !/^[A-Za-z0-9_-]{1,128}$/.test(mapping.organizationId || "") || !/^[A-Za-z0-9_-]{1,128}$/.test(mapping.propertyId || "")) return null;
  if (!new Set(["fa", "en", "ar"]).has(locale)) return null;
  const target = new URL(`/${locale}/${mapping.mode === "RESERVATION" ? "hotel-reservations" : "hotel"}/${encodeURIComponent(mapping.organizationId)}/${encodeURIComponent(mapping.propertyId)}`, current.origin);
  const link = withStaySelection(target, selection);
  return link.pathname + link.search;
}

export function parseChildAges(inputs, expectedCount) {
  if (expectedCount === 0) return { ok: true, ages: [] };
  if (!Array.isArray(inputs) || inputs.length !== expectedCount) return { ok: false, ages: [] };
  const ages = [];
  for (const value of inputs) {
    const raw = String(value ?? "").trim().replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
    if (!/^\d{1,2}$/.test(raw)) return { ok: false, ages: [] };
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

function retentionText(basisPoints, penaltyBasis, locale) {
  const pct = Math.round((Number(basisPoints) / 10000) * 100);
  const firstNight = penaltyBasis === "FIRST_NIGHT";
  if (locale === "fa") return `${pct}% ${firstNight ? "شب اول" : "کل اقامت"}`;
  if (locale === "ar") return `${pct}% ${firstNight ? "الليلة الأولى" : "إجمالي الإقامة"}`;
  return `${pct}% of ${firstNight ? "first night" : "total stay"}`;
}

export function policySummary(policy, locale) {
  if (!policy || typeof policy !== "object") return null;
  const parts = [];
  const name = typeof policy.name === "string" ? policy.name.trim() : "";
  if (name) parts.push(name);
  const tiers = Array.isArray(policy.cancellationTiers) ? [...policy.cancellationTiers].filter((t) => t && Number.isFinite(Number(t.cutoffHours))) : [];
  tiers.sort((a, b) => Number(a.cutoffHours) - Number(b.cutoffHours));
  for (const tier of tiers) {
    const hours = Number(tier.cutoffHours);
    const bp = Number(tier.retentionBasisPoints);
    const basis = tier.penaltyBasis === "FIRST_NIGHT" ? "FIRST_NIGHT" : "RESERVATION_TOTAL";
    if (locale === "fa") parts.push(`تا ${hours} ساعت قبل از ورود: جریمه ${retentionText(bp, basis, locale)}`);
    else if (locale === "ar") parts.push(`حتى ${hours} ساعة قبل الوصول: غرامة ${retentionText(bp, basis, locale)}`);
    else parts.push(`Up to ${hours}h before check-in: penalty ${retentionText(bp, basis, locale)}`);
  }
  const freeHours = Number(policy.freeCancellationCutoffHours);
  const retention = Number(policy.fullCancellationRetention);
  if (tiers.length === 0 && Number.isFinite(freeHours) && freeHours >= 0 && Number.isFinite(retention)) {
    if (freeHours > 0 && retention < 1) {
      if (locale === "fa") parts.push(`لغو رایگان تا ${freeHours} ساعت قبل از ورود`);
      else if (locale === "ar") parts.push(`إلغاء مجاني حتى ${freeHours} ساعة قبل الوصول`);
      else parts.push(`Free cancellation until ${freeHours} hours before check-in`);
      if (retention > 0) {
        if (locale === "fa") parts.push(`پس از آن: ${Math.round(retention * 100)}% کل اقامت`);
        else if (locale === "ar") parts.push(`بعد ذلك: ${Math.round(retention * 100)}% من إجمالي الإقامة`);
        else parts.push(`After that: ${Math.round(retention * 100)}% of total stay`);
      }
    } else if (retention >= 1 || (freeHours === 0 && retention >= 1)) {
      if (locale === "fa") parts.push("غیرقابل استرداد");
      else if (locale === "ar") parts.push("غير قابل للاسترداد");
      else parts.push("Non-refundable");
    }
  }
  return parts.length ? parts.join(locale === "ar" ? " — " : " — ") : (policy.key || null);
}

export function holdAttemptFingerprint({ property, range, adults, children, childAges, option, contact }) {
  const policy = option?.ratePlan?.cancellationPolicy || {};
  return JSON.stringify({
    property,
    roomType: option?.roomType?.slug || "",
    ratePlan: option?.ratePlan?.code || "",
    checkIn: range?.checkIn || "",
    checkOut: range?.checkOut || "",
    adults,
    children,
    childAges: Array.isArray(childAges) ? childAges : [],
    contact: { fullName: contact?.fullName || "", phone: contact?.phone || "", email: contact?.email || "" },
    acceptedCancellationPolicyKey: policy.key || "",
    acceptedCancellationPolicyVersion: Number.isInteger(policy.version) ? policy.version : null,
    acceptedTotalRate: option?.totalRate == null ? null : String(option.totalRate),
    acceptedCurrency: option?.ratePlan?.currency || "",
  });
}

export function buildHoldPayload({ property, range, adults, children, childAges, option, contact }) {
  const policy = option?.ratePlan?.cancellationPolicy || {};
  const payload = {
    property,
    roomType: option.roomType.slug,
    ratePlan: option.ratePlan.code,
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    occupancy: { adults, children, childAges },
    guests: [{ fullName: contact.fullName, isPrimary: true }],
    contact,
    acceptedCancellationPolicyKey: policy.key || "",
  };
  if (Number.isInteger(policy.version)) payload.acceptedCancellationPolicyVersion = policy.version;
  if (option?.totalRate != null) payload.acceptedTotalRate = String(option.totalRate);
  if (option?.ratePlan?.currency) payload.acceptedCurrency = option.ratePlan.currency;
  return payload;
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `damoon-${crypto.randomUUID()}`;
  return `damoon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
