"use client";

import { appFetch } from "@/lib/app-base-path";
import { BUSINESS_VERTICALS, type BusinessVertical } from "@/lib/business-verticals";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Locale = "fa" | "en" | "ar";
type OrganizationType = "SHOP" | "APPOINTMENT";
type ProvisioningCapability = "SHOP" | "APPOINTMENT" | "CRM" | "LOYALTY" | "IAM" | "HOTEL_WEBSITE";
type Recipient = {
  recipientUserId: string;
  recipientUsername: string;
  recipientEmail: string;
  invitedRole: "ADMIN" | "MANAGER";
  ttlHours: 24;
};
type ExecutionConfiguration = {
  name: string;
  slug: string;
  locale: "fa" | "en" | "ar";
  vertical: BusinessVertical | null;
  type: OrganizationType | null;
  entitledCapabilities: ProvisioningCapability[];
  enabledCapabilities: ProvisioningCapability[];
  property?: { name: string; slug: string };
  recipients: Recipient[];
};
type ProvisioningInvitation = {
  id: string;
  status: string;
  invitedRole: "ADMIN" | "MANAGER";
  recipientUsername: string;
  recipientUserId: string;
  recipientEmail: string;
  expiresAt: string;
};
type RecipientLookupResult = { id: string; name: string; email: string };
type Plan = {
  id: string;
  status: string;
  executionConfiguration?: ExecutionConfiguration | null;
  approvedExecutionSha256?: string | null;
  executionReceipt?: {
    organizationId: string;
    organizationSlug: string;
    propertyId?: string | null;
    capabilities?: string[];
    invitationIds?: string[];
    [key: string]: unknown;
  } | null;
  invitations?: ProvisioningInvitation[];
  validationResult?: { ok?: boolean; status?: string; checks?: { code: string; ok: boolean; severity: string; message: string }[] } | null;
};
type ExecutionResult = {
  receipt: NonNullable<Plan["executionReceipt"]>;
  invitations: { invitationId: string; oneTimeToken: string; status: string; expiresAt: string }[];
  replayed: boolean;
};

const CAPABILITIES: readonly ProvisioningCapability[] = ["SHOP", "APPOINTMENT", "CRM", "LOYALTY", "IAM", "HOTEL_WEBSITE"];
const PLAN_STATES: Record<Locale, Record<string, string>> = {
  fa: { DRAFT: "پیش‌نویس", NEEDS_REVIEW: "نیازمند بررسی", READY: "آماده تأیید", APPROVED: "تأییدشده", COMPLETED: "ایجادشده", FAILED: "ناموفق" },
  en: { DRAFT: "Draft", NEEDS_REVIEW: "Needs review", READY: "Ready for approval", APPROVED: "Approved", COMPLETED: "Created", FAILED: "Failed" },
  ar: { DRAFT: "مسودة", NEEDS_REVIEW: "تحتاج المراجعة", READY: "جاهزة للموافقة", APPROVED: "موافق عليها", COMPLETED: "تم الإنشاء", FAILED: "فشل" },
};
const INITIAL_CONFIG: ExecutionConfiguration = {
  name: "",
  slug: "",
  locale: "fa",
  vertical: null,
  type: null,
  entitledCapabilities: [],
  enabledCapabilities: [],
  recipients: [{ recipientUserId: "", recipientUsername: "", recipientEmail: "", invitedRole: "ADMIN", ttlHours: 24 }],
};

const TEXT = {
  fa: {
    title: "راه‌اندازی هدایت‌شدهٔ فضای کسب‌وکار",
    intro: "تنظیمات، بازبینی، تأیید و اجرای ایجاد فضای کسب‌وکار در یک مسیر روشن.",
    config: "پیکربندی سازمان",
    configHint: "عمودی و قابلیت‌ها جدا هستند؛ انتخاب عمودی به‌تنهایی قابلیتی را فعال نمی‌کند.",
    name: "نام سازمان", slug: "شناسهٔ نشانی", locale: "زبان پیش‌فرض", vertical: "نوع کسب‌وکار", noVertical: "انتخاب نشده", chooseType: "انتخاب فعالیت",
    type: "فعالیت اصلی", shop: "فروشگاه", appointment: "خدمات نوبتی", hotelType: "برای هتل، انتخاب «فروشگاه» فقط سازگاری با ساختار قدیمی است و قابلیت فروش را فعال نمی‌کند.",
    capabilities: "قابلیت‌های مجاز", enabled: "قابلیت‌های فعال در شروع", hotelOnly: "فقط برای عمودی هتل قابل انتخاب است.",
    property: "ملک هتل", propertyName: "نام ملک", propertySlug: "شناسهٔ ملک", hotelWebsiteNote: "برای HOTEL_WEBSITE، عمودی HOTEL و مشخصات ملک الزامی است. قابلیت رزرو هتل در این جریان قابل انتخاب نیست.",
    recipients: "دسترسی اولیهٔ کاربران", recipientHint: "حداقل یک ADMIN لازم است. هیچ ایمیل یا پیام خودکاری ارسال نمی‌شود.",
    userId: "شناسهٔ کاربر (با انتخاب پر می‌شود)", username: "نام کاربری تأییدشده", email: "ایمیل تأییدشده", role: "نقش دعوت", admin: "مدیر سازمان", manager: "مدیر اجرایی", addRecipient: "افزودن کاربر", remove: "حذف", searchUser: "جست‌وجوی کاربر تأییدشده", searchMinimum: "برای جست‌وجو، نام کاربری یا ایمیل را وارد کنید (حداقل ۳ نویسه).", searchNoResults: "کاربر تأییدشده‌ای با این مشخصات پیدا نشد.", searchFailed: "جست‌وجوی کاربران انجام نشد.", selectUser: "انتخاب",
    saveCreate: "ساخت طرح و ادامه", save: "ذخیرهٔ پیکربندی", validate: "اعتبارسنجی", approve: "تأیید همین پیکربندی", execute: "اجرای ایجاد فضای کسب‌وکار", status: "وضعیت طرح", validation: "نتیجهٔ اعتبارسنجی", approvedHash: "اثر انگشت پیکربندی تأییدشده",
    reviewHint: "پیش از تأیید، نام و شناسهٔ سازمان، نوع کسب‌وکار، قابلیت‌های مجاز و فعال، ملک و کاربران را مرور کنید. اجرا فقط برای همان پیکربندی تأییدشده انجام می‌شود.",
    inviteTitle: "دعوت‌های ایجادشده", inviteHint: "وضعیت دعوت از وضعیت فعال‌شدن عضویت جداست. کاربر فقط پس از پذیرش هویتی دعوت عضو می‌شود.", tokenTitle: "رمزهای دعوت یک‌بار نمایش‌داده‌شده", tokenHint: "این رمزها فقط در همین پاسخ نمایش داده می‌شوند. آن‌ها را در مسیر امن خود به دریافت‌کننده برسانید؛ سامانه ایمیل یا پیام ارسال نمی‌کند.", copy: "کپی رمز", copied: "کپی شد", noToken: "پس از بارگذاری مجدد، رمز یک‌بارمصرف قابل بازیابی نیست.", noInvites: "هنوز دعوتی ثبت نشده است.", receipt: "رسید اجرای طرح", organizationId: "شناسهٔ سازمان", organizationSlug: "شناسهٔ نشانی سازمان", propertyId: "شناسهٔ ملک", currentCapabilities: "قابلیت‌های ثبت‌شده", replayed: "این پاسخ نتیجهٔ اجرای قبلی است.",
    revoke: "لغو دعوت", resend: "صدور دوبارهٔ دعوت", revokeConfirm: "دعوت لغو شود؟", resendHint: "صدور دوباره، رمز تازه‌ای می‌سازد و رمز قبلی را بازنمی‌گرداند.",
    loading: "در حال بارگذاری…", busy: "در حال انجام…", error: "انجام درخواست ممکن نشد.", required: "نام و شناسهٔ سازمان، حداقل یک ADMIN و فیلدهای هویتی دریافت‌کنندگان را کامل کنید.", hotelRequired: "برای HOTEL_WEBSITE، عمودی هتل و نام/شناسهٔ ملک را وارد کنید.",
    verticals: { RESTAURANT: "رستوران", SHOE_STORE: "فروشگاه کفش", CLOTHING_STORE: "فروشگاه پوشاک", PHARMACY: "داروخانه", SUPERMARKET: "سوپرمارکت", FLORIST: "گل‌فروشی", HOTEL: "هتل" },
    capabilityNames: { SHOP: "فروشگاه", APPOINTMENT: "نوبت‌دهی", CRM: "مدیریت مشتریان", LOYALTY: "وفاداری", IAM: "مدیریت دسترسی", HOTEL_WEBSITE: "وب‌سایت هتل" },
    statuses: { CREATED: "ایجادشده؛ در انتظار پذیرش", SENT: "ارسال‌شده؛ در انتظار پذیرش", CLAIMED: "پذیرفته‌شده و فعال‌شده", EXPIRED: "منقضی‌شده", REVOKED: "لغوشده" },
    done: "انجام شد", notReady: "برای این مرحله، وضعیت طرح باید مطابق پیش‌نیازهای سرور باشد.", unsaved: "تغییرات ذخیره‌نشده است؛ ابتدا پیکربندی را ذخیره کنید.", back: "بازگشت به فهرست طرح‌ها", nextSteps: "تنظیم، بررسی، تأیید و اجرا",
  },
  en: {
    title: "Guided workspace setup", intro: "Configure, review, approve, and execute workspace creation in one clear flow.", config: "Organization configuration", configHint: "Vertical and capabilities are separate. A vertical alone never enables a capability.",
    name: "Organization name", slug: "Organization slug", locale: "Default language", vertical: "Business vertical", noVertical: "Not selected", chooseType: "Choose an operation", type: "Primary operation", shop: "Store", appointment: "Appointments", hotelType: "For hotels, Store is a legacy compatibility type and does not enable the Shop capability.",
    capabilities: "Entitled capabilities", enabled: "Capabilities enabled at setup", hotelOnly: "Available only with the HOTEL vertical.", property: "Hotel property", propertyName: "Property name", propertySlug: "Property slug", hotelWebsiteNote: "HOTEL_WEBSITE requires the HOTEL vertical and property details. Hotel booking is not selectable in this flow.",
    recipients: "Initial user access", recipientHint: "At least one ADMIN is required. No email or message is sent automatically.", userId: "User ID (filled from the selected user)", username: "Verified username", email: "Verified email", role: "Invitation role", admin: "Organization administrator", manager: "Operations manager", addRecipient: "Add user", remove: "Remove", searchUser: "Search verified users", searchMinimum: "Enter a username or email to search (at least 3 characters).", searchNoResults: "No verified user matched those details.", searchFailed: "Could not search users.", selectUser: "Select",
    saveCreate: "Create plan and continue", save: "Save configuration", validate: "Validate", approve: "Approve this configuration", execute: "Execute workspace creation", status: "Plan status", validation: "Validation result", approvedHash: "Approved configuration fingerprint",
    reviewHint: "Before approval, review the organization name and slug, vertical, entitled and enabled capabilities, property, and users. Execution applies only to this approved configuration.",
    inviteTitle: "Created invitations", inviteHint: "Invitation state is separate from membership activation. A user joins only after identity-bound acceptance.", tokenTitle: "One-time invitation tokens", tokenHint: "Tokens appear only in this response. Deliver them through your approved secure channel; the system sends no email or message.", copy: "Copy token", copied: "Copied", noToken: "After reload, a one-time token cannot be recovered.", noInvites: "No invitations recorded yet.", receipt: "Execution receipt", organizationId: "Organization ID", organizationSlug: "Organization slug", propertyId: "Property ID", currentCapabilities: "Recorded capabilities", replayed: "This response is from a prior execution.",
    revoke: "Revoke invitation", resend: "Issue invitation again", revokeConfirm: "Revoke this invitation?", resendHint: "Reissuing creates a new token; it cannot recover the previous token.", loading: "Loading…", busy: "Working…", error: "The request could not be completed.", required: "Complete organization name and slug, at least one ADMIN, and recipient identity fields.", hotelRequired: "HOTEL_WEBSITE requires the HOTEL vertical and property name/slug.", verticals: { RESTAURANT: "Restaurant", SHOE_STORE: "Shoe store", CLOTHING_STORE: "Clothing store", PHARMACY: "Pharmacy", SUPERMARKET: "Supermarket", FLORIST: "Florist", HOTEL: "Hotel" }, capabilityNames: { SHOP: "Shop", APPOINTMENT: "Appointments", CRM: "Customer management", LOYALTY: "Loyalty", IAM: "Access management", HOTEL_WEBSITE: "Hotel website" }, statuses: { CREATED: "Created; awaiting acceptance", SENT: "Sent; awaiting acceptance", CLAIMED: "Accepted and activated", EXPIRED: "Expired", REVOKED: "Revoked" }, done: "Done", notReady: "The server requires a different plan state for this step.", unsaved: "You have unsaved changes. Save the configuration before continuing.", back: "Back to plans", nextSteps: "Configure, review, approve, execute",
  },
  ar: {
    title: "إعداد مساحة العمل الموجّه", intro: "تهيئة مساحة العمل ومراجعتها والموافقة عليها وتنفيذ إنشائها ضمن مسار واضح.", config: "إعداد المؤسسة", configHint: "المجال والقدرات منفصلان. اختيار المجال وحده لا يفعّل أي قدرة.",
    name: "اسم المؤسسة", slug: "معرّف المؤسسة", locale: "اللغة الافتراضية", vertical: "مجال العمل", noVertical: "غير محدد", chooseType: "اختر النشاط", type: "النشاط الرئيسي", shop: "متجر", appointment: "خدمات المواعيد", hotelType: "للفندق، اختيار «متجر» هو نوع توافق قديم ولا يفعّل قدرة المتجر.",
    capabilities: "القدرات المصرح بها", enabled: "القدرات المفعلة عند الإعداد", hotelOnly: "متاح فقط مع مجال HOTEL.", property: "عقار الفندق", propertyName: "اسم العقار", propertySlug: "معرّف العقار", hotelWebsiteNote: "تتطلب HOTEL_WEBSITE مجال HOTEL وبيانات العقار. حجز الفندق غير متاح للاختيار هنا.",
    recipients: "وصول المستخدمين الأولي", recipientHint: "يلزم مستخدم واحد على الأقل بدور ADMIN. لا يُرسل بريد أو إشعار تلقائيًا.", userId: "معرّف المستخدم (يُملأ عند الاختيار)", username: "اسم المستخدم المؤكد", email: "البريد المؤكد", role: "دور الدعوة", admin: "مدير المؤسسة", manager: "مدير العمليات", addRecipient: "إضافة مستخدم", remove: "حذف", searchUser: "البحث عن مستخدم مؤكد", searchMinimum: "أدخل اسم المستخدم أو البريد للبحث (ثلاثة أحرف على الأقل).", searchNoResults: "لم يُعثر على مستخدم مؤكد بهذه البيانات.", searchFailed: "تعذر البحث عن المستخدمين.", selectUser: "اختيار",
    saveCreate: "إنشاء الخطة والمتابعة", save: "حفظ الإعدادات", validate: "التحقق", approve: "الموافقة على هذه الإعدادات", execute: "تنفيذ إنشاء مساحة العمل", status: "حالة الخطة", validation: "نتيجة التحقق", approvedHash: "بصمة الإعدادات الموافق عليها",
    reviewHint: "قبل الموافقة، راجع اسم المؤسسة ومعرّفها والمجال والقدرات والعقار والمستخدمين. ينفذ النظام الإعدادات نفسها التي تمت الموافقة عليها فقط.",
    inviteTitle: "الدعوات المنشأة", inviteHint: "حالة الدعوة منفصلة عن تفعيل العضوية. ينضم المستخدم بعد قبول مرتبط بالهوية.", tokenTitle: "رموز الدعوة ذات الاستخدام الواحد", tokenHint: "تظهر الرموز في هذه الاستجابة فقط. سلّمها عبر قناة آمنة معتمدة؛ لا يرسل النظام بريدًا أو رسالة.", copy: "نسخ الرمز", copied: "تم النسخ", noToken: "بعد إعادة التحميل لا يمكن استعادة الرمز أحادي الاستخدام.", noInvites: "لا توجد دعوات مسجلة بعد.", receipt: "إيصال التنفيذ", organizationId: "معرّف المؤسسة", organizationSlug: "معرّف المؤسسة", propertyId: "معرّف العقار", currentCapabilities: "القدرات المسجلة", replayed: "هذه الاستجابة نتيجة تنفيذ سابق.",
    revoke: "إلغاء الدعوة", resend: "إصدار الدعوة مجددًا", revokeConfirm: "هل تريد إلغاء هذه الدعوة؟", resendHint: "الإصدار مجددًا ينشئ رمزًا جديدًا ولا يستعيد الرمز السابق.", loading: "جار التحميل…", busy: "جار التنفيذ…", error: "تعذر إكمال الطلب.", required: "أكمل اسم المؤسسة ومعرّفها ومستخدم ADMIN واحدًا على الأقل وبيانات هوية المستلمين.", hotelRequired: "تتطلب HOTEL_WEBSITE مجال HOTEL واسم/معرّف العقار.", verticals: { RESTAURANT: "مطعم", SHOE_STORE: "متجر أحذية", CLOTHING_STORE: "متجر ملابس", PHARMACY: "صيدلية", SUPERMARKET: "سوبرماركت", FLORIST: "متجر زهور", HOTEL: "فندق" }, capabilityNames: { SHOP: "متجر", APPOINTMENT: "مواعيد", CRM: "إدارة العملاء", LOYALTY: "الولاء", IAM: "إدارة الوصول", HOTEL_WEBSITE: "موقع الفندق" }, statuses: { CREATED: "أُنشئت؛ بانتظار القبول", SENT: "أُرسلت؛ بانتظار القبول", CLAIMED: "قُبلت وفُعّلت", EXPIRED: "منتهية", REVOKED: "ملغاة" }, done: "تم", notReady: "تتطلب هذه الخطوة حالة مختلفة للخطة من الخادم.", unsaved: "لديك تغييرات غير محفوظة. احفظ الإعدادات قبل المتابعة.", back: "العودة إلى الخطط", nextSteps: "الإعداد، المراجعة، الموافقة، التنفيذ",
  },
} as const;

function makeIdempotencyKey() {
  const secureCrypto = globalThis.crypto;
  if (!secureCrypto) throw new Error("Secure browser context required");
  if (typeof secureCrypto.randomUUID === "function") return secureCrypto.randomUUID().replaceAll("-", "");
  const bytes = new Uint8Array(24);
  secureCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function configurationFrom(value: unknown): ExecutionConfiguration {
  if (!value || typeof value !== "object") return INITIAL_CONFIG;
  const raw = value as Partial<ExecutionConfiguration>;
  const recipients = Array.isArray(raw.recipients) && raw.recipients.length
    ? raw.recipients.map((recipient) => ({
      recipientUserId: recipient.recipientUserId || "",
      recipientUsername: recipient.recipientUsername || "",
      recipientEmail: recipient.recipientEmail || "",
      invitedRole: recipient.invitedRole === "MANAGER" ? "MANAGER" as const : "ADMIN" as const,
      ttlHours: 24 as const,
    }))
    : INITIAL_CONFIG.recipients;
  const entitled = Array.isArray(raw.entitledCapabilities) ? raw.entitledCapabilities.filter((item): item is ProvisioningCapability => CAPABILITIES.includes(item as ProvisioningCapability)) : [];
  const enabled = Array.isArray(raw.enabledCapabilities) ? raw.enabledCapabilities.filter((item): item is ProvisioningCapability => entitled.includes(item as ProvisioningCapability)) : [];
  return {
    name: raw.name ?? "",
    slug: raw.slug ?? "",
    vertical: raw.vertical && (BUSINESS_VERTICALS as readonly string[]).includes(raw.vertical) ? raw.vertical : null,
    locale: raw.locale === "en" || raw.locale === "ar" ? raw.locale : "fa",
    type: raw.type === "APPOINTMENT" || raw.type === "SHOP" ? raw.type : null,
    entitledCapabilities: entitled,
    enabledCapabilities: enabled,
    recipients,
    property: raw.vertical === "HOTEL" && raw.property ? { name: raw.property.name || "", slug: raw.property.slug || "" } : undefined,
  };
}

export function UniversalProvisioningWizard({ locale, planId }: { locale: Locale; planId?: string }) {
  const router = useRouter();
  const text = TEXT[locale];
  const [config, setConfig] = useState<ExecutionConfiguration>(INITIAL_CONFIG);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [savedConfigurationKey, setSavedConfigurationKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(planId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [oneTimeTokens, setOneTimeTokens] = useState<ExecutionResult["invitations"]>([]);
  const [copiedInvitationId, setCopiedInvitationId] = useState("");
  const [recipientLookups, setRecipientLookups] = useState<Record<number, { loading: boolean; searched: boolean; results: RecipientLookupResult[]; error: boolean }>>({});
  const createKey = useRef<string | null>(null);
  const executeKey = useRef<string | null>(null);
  const resendKeys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError("");
    try {
      const response = await appFetch(`/api/dashboard/tenant-provisioning-plans/${planId}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      setPlan(data as Plan);
      if (data.executionConfiguration) {
        const saved = configurationFrom(data.executionConfiguration);
        setConfig(saved);
        setSavedConfigurationKey(JSON.stringify(saved));
      } else {
        const legacyLocale = data.proposedDefaultLocale === "en" || data.proposedDefaultLocale === "ar" ? data.proposedDefaultLocale : "fa";
        const initial: ExecutionConfiguration = {
          ...INITIAL_CONFIG,
          name: typeof data.proposedName === "string" ? data.proposedName : "",
          slug: typeof data.proposedSlug === "string" ? data.proposedSlug : "",
          locale: legacyLocale,
          type: data.proposedOrganizationType === "APPOINTMENT" ? "APPOINTMENT" : "SHOP",
          vertical: null,
          entitledCapabilities: [],
          enabledCapabilities: [],
          recipients: INITIAL_CONFIG.recipients.map((recipient) => ({ ...recipient })),
        };
        setConfig(initial);
        setSavedConfigurationKey(null);
        setOneTimeTokens([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [planId, text.error]);

  useEffect(() => { void load(); }, [load]);

  function setField<K extends keyof ExecutionConfiguration>(key: K, value: ExecutionConfiguration[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function setVertical(vertical: BusinessVertical | null) {
    setConfig((current) => {
      const keepHotel = vertical === "HOTEL";
      const entitledCapabilities = keepHotel ? current.entitledCapabilities : current.entitledCapabilities.filter((capability) => capability !== "HOTEL_WEBSITE");
      const enabledCapabilities = keepHotel ? current.enabledCapabilities : current.enabledCapabilities.filter((capability) => capability !== "HOTEL_WEBSITE");
      return { ...current, vertical, type: keepHotel ? "SHOP" : current.type, entitledCapabilities, enabledCapabilities, property: keepHotel ? current.property ?? { name: "", slug: "" } : undefined };
    });
  }

  function toggleCapability(kind: "entitledCapabilities" | "enabledCapabilities", capability: ProvisioningCapability, checked: boolean) {
    setConfig((current) => {
      if (kind === "enabledCapabilities" && checked && !current.entitledCapabilities.includes(capability)) return current;
      if (capability === "HOTEL_WEBSITE" && checked && current.vertical !== "HOTEL") return current;
      const list = current[kind].filter((item) => item !== capability);
      return {
        ...current,
        [kind]: checked ? [...list, capability] : list,
        ...(kind === "entitledCapabilities" && !checked
          ? { enabledCapabilities: current.enabledCapabilities.filter((item) => item !== capability) }
          : {}),
      };
    });
  }

  function updateRecipient(index: number, patch: Partial<Recipient>) {
    setConfig((current) => ({ ...current, recipients: current.recipients.map((recipient, recipientIndex) => recipientIndex === index ? { ...recipient, ...patch } : recipient) }));
  }

  async function searchRecipients(index: number) {
    const recipient = config.recipients[index];
    if (!recipient) return;
    const username = recipient.recipientUsername.trim();
    const email = recipient.recipientEmail.trim();
    const query = username.length >= 3 ? username : email.length >= 3 ? email : "";
    if (!query) {
      setRecipientLookups((current) => ({ ...current, [index]: { loading: false, searched: false, results: [], error: false } }));
      setError(text.searchMinimum);
      return;
    }
    setError("");
    setRecipientLookups((current) => ({ ...current, [index]: { loading: true, searched: false, results: [], error: false } }));
    try {
      const response = await appFetch(`/api/dashboard/tenant-provisioning-recipients?query=${encodeURIComponent(query)}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.items)) throw new Error(text.searchFailed);
      const results = data.items.filter((item: unknown): item is RecipientLookupResult => Boolean(item && typeof item === "object" && typeof (item as RecipientLookupResult).id === "string" && typeof (item as RecipientLookupResult).name === "string" && typeof (item as RecipientLookupResult).email === "string"));
      setRecipientLookups((current) => ({ ...current, [index]: { loading: false, searched: true, results, error: false } }));
    } catch {
      setRecipientLookups((current) => ({ ...current, [index]: { loading: false, searched: false, results: [], error: true } }));
    }
  }

  function selectRecipient(index: number, result: RecipientLookupResult) {
    updateRecipient(index, { recipientUserId: result.id, recipientUsername: result.name, recipientEmail: result.email });
    setRecipientLookups((current) => ({ ...current, [index]: { loading: false, searched: false, results: [], error: false } }));
  }

  function validateClient(): boolean {
    const validRecipients = config.recipients.length > 0
      && config.recipients.some((recipient) => recipient.invitedRole === "ADMIN")
      && config.recipients.every((recipient) => recipient.recipientUserId.trim() && recipient.recipientUsername.trim() && recipient.recipientEmail.trim());
    const websiteRequested = config.entitledCapabilities.includes("HOTEL_WEBSITE") || config.enabledCapabilities.includes("HOTEL_WEBSITE");
    const hotelValid = !websiteRequested
      || (config.vertical === "HOTEL" && Boolean(config.property?.name.trim()) && Boolean(config.property?.slug.trim()));
    if (!config.name.trim() || !config.slug.trim() || !config.type || !validRecipients) { setError(text.required); return false; }
    if (!hotelValid) { setError(text.hotelRequired); return false; }
    setError("");
    return true;
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateClient()) return;
    const idempotencyKey = createKey.current ?? makeIdempotencyKey();
    createKey.current = idempotencyKey;
    setBusy(true);
    setError("");
    try {
      const response = await appFetch("/api/dashboard/tenant-provisioning-plans", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ manual: { ...config, type: config.type as OrganizationType } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      createKey.current = null;
      setPlan(data as Plan);
      const createdId = typeof data.id === "string" ? data.id : "";
      if (createdId) router.replace(`/${locale}/dashboard/tenant-provisioning/${createdId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : text.error);
    } finally {
      setBusy(false);
    }
  }

  async function saveConfiguration() {
    if (!planId || !plan || !validateClient()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await appFetch(`/api/dashboard/tenant-provisioning-plans/${planId}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionConfiguration: { ...config, type: config.type as OrganizationType } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      setPlan(data as Plan); setNotice(text.done); await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.error);
    } finally { setBusy(false); }
  }

  async function planAction(action: "validate" | "approve") {
    if (!planId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await appFetch(`/api/dashboard/tenant-provisioning-plans/${planId}/${action}`, { method: "POST", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      setPlan(data as Plan); setNotice(text.done); await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : text.error);
    } finally { setBusy(false); }
  }

  async function execute() {
    if (!planId || !plan?.approvedExecutionSha256) return;
    const idempotencyKey = executeKey.current ?? makeIdempotencyKey();
    executeKey.current = idempotencyKey;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await appFetch(`/api/dashboard/tenant-provisioning-plans/${planId}/execute`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ approvedSha256: plan.approvedExecutionSha256 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      executeKey.current = null;
      const result = data as ExecutionResult;
      setOneTimeTokens(Array.isArray(result.invitations) ? result.invitations.filter((invitation) => typeof invitation?.invitationId === "string" && typeof invitation.oneTimeToken === "string" && invitation.oneTimeToken.length > 0) : []);
      setNotice(result.replayed ? text.replayed : text.done);
      await load();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : text.error);
    } finally { setBusy(false); }
  }

  async function revokeInvitation(invitationId: string) {
    if (!window.confirm(text.revokeConfirm)) return;
    setBusy(true); setError("");
    try {
      const response = await appFetch("/api/platform/organization-onboarding/invitations/revoke", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      setOneTimeTokens((current) => current.filter((token) => token.invitationId !== invitationId)); await load();
    } catch (revokeError) { setError(revokeError instanceof Error ? revokeError.message : text.error); }
    finally { setBusy(false); }
  }

  async function resendInvitation(invitation: ProvisioningInvitation) {
    const organizationId = plan?.executionReceipt?.organizationId;
    if (!organizationId) return;
    const key = resendKeys.current[invitation.id] ?? makeIdempotencyKey();
    resendKeys.current[invitation.id] = key;
    setBusy(true); setError("");
    setOneTimeTokens([]);
    try {
      if (invitation.status !== "REVOKED") {
        const revokeResponse = await appFetch("/api/platform/organization-onboarding/invitations/revoke", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationId: invitation.id }),
        });
        const revokeData = await revokeResponse.json().catch(() => ({}));
        if (!revokeResponse.ok) throw new Error(typeof revokeData.error === "string" ? revokeData.error : text.error);
      }
      const response = await appFetch("/api/platform/organization-onboarding/invitations", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ organizationId, recipientUserId: invitation.recipientUserId, recipientUsername: invitation.recipientUsername, recipientEmail: invitation.recipientEmail, invitedRole: invitation.invitedRole, ttlHours: 24 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : text.error);
      delete resendKeys.current[invitation.id];
      const oneTimeToken = typeof data.oneTimeToken === "string" ? data.oneTimeToken : "";
      setOneTimeTokens(oneTimeToken ? [{ invitationId: data.invitationId, oneTimeToken, status: data.status, expiresAt: data.expiresAt }] : []);
      await load();
    } catch (resendError) { setError(resendError instanceof Error ? resendError.message : text.error); await load(); }
    finally { setBusy(false); }
  }

  async function copyToken(invitationId: string, token: string) {
    try { await navigator.clipboard.writeText(token); setCopiedInvitationId(invitationId); }
    catch { setError(text.error); }
  }

  const hotelSelected = config.vertical === "HOTEL";
  const isExisting = Boolean(planId);
  const validations = plan?.validationResult?.checks ?? [];
  const configurationDirty = Boolean(plan && (savedConfigurationKey === null || JSON.stringify(config) !== savedConfigurationKey));
  const steps = locale === "fa" ? ["۱ · تنظیم", "۲ · بررسی", "۳ · تأیید", "۴ · اجرا"] : locale === "ar" ? ["١ · الإعداد", "٢ · المراجعة", "٣ · الموافقة", "٤ · التنفيذ"] : ["1 · Configure", "2 · Review", "3 · Approve", "4 · Execute"];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-3 py-5 sm:px-6 sm:py-8" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-gradient-to-br from-background to-muted/50 p-5 sm:p-7">
        <div className="space-y-2">
          <a href={`/${locale}/dashboard/tenant-provisioning`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">{text.back}</a>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{text.title}</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{text.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={text.nextSteps}>
          {steps.map((step) => <Badge variant="outline" key={step}>{step}</Badge>)}
          {plan && <Badge variant={plan.status === "COMPLETED" ? "default" : plan.status === "APPROVED" ? "secondary" : "outline"}>{PLAN_STATES[locale][plan.status] ?? plan.status}</Badge>}
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{notice}</div>}
      {loading && <p role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">{text.loading}</p>}

      {!loading && (
        <form onSubmit={isExisting ? (event) => event.preventDefault() : createPlan} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section className="space-y-5">
            <Card>
              <CardHeader><CardTitle>{text.config}</CardTitle><CardDescription>{text.configHint}</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="provisioning-name">{text.name}</Label><Input id="provisioning-name" data-testid="p14-name" value={config.name} required maxLength={200} onChange={(event) => setField("name", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="provisioning-slug">{text.slug}</Label><Input id="provisioning-slug" data-testid="p14-slug" dir="ltr" value={config.slug} required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setField("slug", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="provisioning-locale">{text.locale}</Label><select id="provisioning-locale" data-testid="p14-locale" className="min-h-11 w-full rounded-md border bg-background px-3 py-2" value={config.locale} onChange={(event) => setField("locale", event.target.value as ExecutionConfiguration["locale"])}><option value="fa">فارسی · fa</option><option value="en">English · en</option><option value="ar">العربية · ar</option></select></div>
                <div className="space-y-2"><Label htmlFor="provisioning-vertical">{text.vertical}</Label><select id="provisioning-vertical" data-testid="p14-vertical" className="min-h-11 w-full rounded-md border bg-background px-3 py-2" value={config.vertical ?? "none"} onChange={(event) => setVertical(event.target.value === "none" ? null : event.target.value as BusinessVertical)}><option value="none">{text.noVertical}</option>{BUSINESS_VERTICALS.map((vertical) => <option key={vertical} value={vertical}>{text.verticals[vertical]}</option>)}</select></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="provisioning-type">{text.type}</Label><select id="provisioning-type" data-testid="p14-type" required className="min-h-11 w-full rounded-md border bg-background px-3 py-2 sm:max-w-md" value={config.type ?? "none"} disabled={hotelSelected} onChange={(event) => setField("type", event.target.value === "SHOP" || event.target.value === "APPOINTMENT" ? event.target.value : null)}><option value="none">{text.chooseType}</option><option value="SHOP">{text.shop}</option><option value="APPOINTMENT">{text.appointment}</option></select>{hotelSelected && <p className="text-xs leading-6 text-muted-foreground">{text.hotelType}</p>}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{text.capabilities}</CardTitle><CardDescription>{text.configHint}</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {CAPABILITIES.map((capability) => {
                  const hotelGate = capability === "HOTEL_WEBSITE" && !hotelSelected;
                  return <label key={`entitled-${capability}`} className={`flex min-h-14 items-center gap-3 rounded-lg border p-3 ${hotelGate ? "opacity-60" : ""}`}>
                    <input type="checkbox" data-testid={`p14-entitlement-${capability}`} className="size-4 accent-primary" checked={config.entitledCapabilities.includes(capability)} disabled={hotelGate} onChange={(event) => toggleCapability("entitledCapabilities", capability, event.target.checked)} />
                    <span className="min-w-0 flex-1 text-sm font-medium">{text.capabilityNames[capability]}</span><code className="text-[10px] text-muted-foreground">{capability}</code>
                  </label>;
                })}
                <p className="text-xs leading-6 text-muted-foreground md:col-span-2">{text.hotelWebsiteNote}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{text.enabled}</CardTitle><CardDescription>{text.configHint}</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {CAPABILITIES.map((capability) => {
                  const disabled = !config.entitledCapabilities.includes(capability) || (capability === "HOTEL_WEBSITE" && !hotelSelected);
                  return <label key={`enabled-${capability}`} className={`flex min-h-14 items-center gap-3 rounded-lg border p-3 ${disabled ? "opacity-60" : ""}`}>
                    <input type="checkbox" data-testid={`p14-capability-${capability}`} className="size-4 accent-primary" checked={config.enabledCapabilities.includes(capability)} disabled={disabled} onChange={(event) => toggleCapability("enabledCapabilities", capability, event.target.checked)} />
                    <span className="min-w-0 flex-1 text-sm font-medium">{text.capabilityNames[capability]}</span><code className="text-[10px] text-muted-foreground">{capability}</code>
                  </label>;
                })}
              </CardContent>
            </Card>

            {hotelSelected && (
              <Card>
                <CardHeader><CardTitle>{text.property}</CardTitle><CardDescription>{text.hotelWebsiteNote}</CardDescription></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="property-name">{text.propertyName}</Label><Input id="property-name" data-testid="p14-property-name" required={config.entitledCapabilities.includes("HOTEL_WEBSITE")} value={config.property?.name ?? ""} onChange={(event) => setField("property", { name: event.target.value, slug: config.property?.slug ?? "" })} /></div>
                  <div className="space-y-2"><Label htmlFor="property-slug">{text.propertySlug}</Label><Input id="property-slug" data-testid="p14-property-slug" dir="ltr" required={config.entitledCapabilities.includes("HOTEL_WEBSITE")} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={config.property?.slug ?? ""} onChange={(event) => setField("property", { name: config.property?.name ?? "", slug: event.target.value })} /></div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>{text.recipients}</CardTitle><CardDescription>{text.recipientHint}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {config.recipients.map((recipient, index) => (
                  <fieldset key={`recipient-${index}`} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                    <legend className="px-1 text-xs font-semibold text-muted-foreground">{text.role}: {recipient.invitedRole === "ADMIN" ? text.admin : text.manager}</legend>
                    <div className="space-y-2"><Label htmlFor={`recipient-user-id-${index}`}>{text.userId}</Label><Input id={`recipient-user-id-${index}`} data-testid={`p14-recipient-${index}-userId`} dir="ltr" autoComplete="off" required value={recipient.recipientUserId} onChange={(event) => updateRecipient(index, { recipientUserId: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor={`recipient-username-${index}`}>{text.username}</Label><Input id={`recipient-username-${index}`} data-testid={`p14-recipient-${index}-username`} dir="ltr" autoComplete="username" required pattern="[a-z0-9][a-z0-9-]{2,63}" value={recipient.recipientUsername} onChange={(event) => updateRecipient(index, { recipientUsername: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor={`recipient-email-${index}`}>{text.email}</Label><Input id={`recipient-email-${index}`} data-testid={`p14-recipient-${index}-email`} dir="ltr" type="email" autoComplete="email" required value={recipient.recipientEmail} onChange={(event) => updateRecipient(index, { recipientEmail: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor={`recipient-role-${index}`}>{text.role}</Label><select id={`recipient-role-${index}`} data-testid={`p14-recipient-${index}-role`} className="min-h-11 w-full rounded-md border bg-background px-3 py-2" value={recipient.invitedRole} onChange={(event) => updateRecipient(index, { invitedRole: event.target.value as Recipient["invitedRole"] })}><option value="ADMIN">{text.admin}</option><option value="MANAGER">{text.manager}</option></select></div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs leading-6 text-muted-foreground">{text.searchMinimum}</p>
                        <Button type="button" data-testid={`p14-recipient-${index}-search`} variant="outline" disabled={recipientLookups[index]?.loading} onClick={() => void searchRecipients(index)}>{recipientLookups[index]?.loading ? text.busy : text.searchUser}</Button>
                      </div>
                      {recipientLookups[index]?.error && <p role="status" className="text-sm text-destructive">{text.searchFailed}</p>}
                      {recipientLookups[index]?.searched && recipientLookups[index].results.length === 0 && <p role="status" className="text-sm text-muted-foreground">{text.searchNoResults}</p>}
                      {recipientLookups[index]?.results.map((result) => <Button key={result.id} type="button" variant="outline" className="flex h-auto w-full flex-wrap justify-between gap-2 px-3 py-2 text-start" onClick={() => selectRecipient(index, result)}><span>{result.name}</span><span dir="ltr" className="text-muted-foreground">{result.email}</span><span className="text-xs">{text.selectUser}</span></Button>)}
                    </div>
                    {config.recipients.length > 1 && <Button type="button" variant="outline" className="sm:col-span-2 sm:justify-self-start" onClick={() => setConfig((current) => ({ ...current, recipients: current.recipients.filter((_, recipientIndex) => recipientIndex !== index) }))}>{text.remove}</Button>}
                  </fieldset>
                ))}
                <Button type="button" data-testid="p14-add-recipient" variant="outline" onClick={() => setConfig((current) => ({ ...current, recipients: [...current.recipients, { recipientUserId: "", recipientUsername: "", recipientEmail: "", invitedRole: "MANAGER", ttlHours: 24 }] }))}>{text.addRecipient}</Button>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <Card>
              <CardHeader><CardTitle>{text.reviewHint}</CardTitle><CardDescription>{text.status}: {plan ? PLAN_STATES[locale][plan.status] ?? plan.status : isExisting ? text.loading : PLAN_STATES[locale].DRAFT}{configurationDirty && <span className="mt-1 block text-destructive">{text.unsaved}</span>}</CardDescription></CardHeader>
              <CardContent className="grid gap-2">
                {!isExisting ? <Button type="submit" data-testid="p14-save" disabled={busy}>{busy ? text.busy : text.saveCreate}</Button> : <>
                  <Button type="button" data-testid="p14-save" onClick={saveConfiguration} disabled={busy}>{busy ? text.busy : text.save}</Button>
                  <Button type="button" data-testid="p14-validate" variant="outline" onClick={() => void planAction("validate")} disabled={busy || configurationDirty}>{text.validate}</Button>
                  <Button type="button" data-testid="p14-approve" variant="secondary" onClick={() => void planAction("approve")} disabled={busy || configurationDirty || plan?.status !== "READY"}>{text.approve}</Button>
                  <Button type="button" data-testid="p14-execute" variant="destructive" onClick={() => void execute()} disabled={busy || configurationDirty || plan?.status !== "APPROVED" || !plan.approvedExecutionSha256 || Boolean(plan.executionReceipt)}>{text.execute}</Button>
                </>}
                {plan?.approvedExecutionSha256 && <div className="mt-2 rounded-lg bg-muted p-3"><p className="text-xs font-semibold">{text.approvedHash}</p><code className="mt-2 block break-all text-[10px]" dir="ltr">{plan.approvedExecutionSha256}</code></div>}
              </CardContent>
            </Card>

            {plan?.validationResult && <Card><CardHeader><CardTitle>{text.validation}</CardTitle><CardDescription>{plan.validationResult.status ?? (plan.validationResult.ok ? "READY" : "NEEDS_REVIEW")}</CardDescription></CardHeader><CardContent className="space-y-2">{validations.map((check) => <div key={check.code} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs"><div><code>{check.code}</code><p className="mt-1 text-muted-foreground">{check.message}</p></div><Badge variant={check.ok ? "default" : check.severity === "WARNING" ? "secondary" : "destructive"}>{check.ok ? "OK" : check.severity}</Badge></div>)}</CardContent></Card>}

            {plan?.executionReceipt && <Card><CardHeader><CardTitle>{text.receipt}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">{text.organizationId}: </span><code dir="ltr">{plan.executionReceipt.organizationId}</code></p><p><span className="text-muted-foreground">{text.organizationSlug}: </span><code dir="ltr">{plan.executionReceipt.organizationSlug}</code></p>{plan.executionReceipt.propertyId && <p><span className="text-muted-foreground">{text.propertyId}: </span><code dir="ltr">{plan.executionReceipt.propertyId}</code></p>}<p><span className="text-muted-foreground">{text.currentCapabilities}: </span>{(plan.executionReceipt.capabilities ?? []).map((key) => text.capabilityNames[key as ProvisioningCapability] ?? key).join(", ")}</p><Link data-testid="p14-organization-link" href={`/${locale}/dashboard/organizations/${plan.executionReceipt.organizationId}`} className="inline-flex min-h-11 items-center rounded-md border px-3 text-primary underline-offset-4 hover:underline">{locale === "fa" ? "مشاهده جزئیات سازمان" : locale === "ar" ? "عرض تفاصيل المؤسسة" : "View organization details"}</Link></CardContent></Card>}

                {(plan?.invitations?.length || oneTimeTokens.length > 0) && <Card><CardHeader><CardTitle>{text.inviteTitle}</CardTitle><CardDescription>{text.inviteHint}</CardDescription></CardHeader><CardContent className="space-y-3">{plan?.invitations?.map((invitation) => <div key={invitation.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong dir="ltr">{invitation.recipientUsername}</strong><p className="text-xs text-muted-foreground" dir="ltr">{invitation.recipientEmail}</p><p className="mt-1 text-xs">{text.statuses[invitation.status as keyof typeof text.statuses] ?? invitation.status} · {invitation.invitedRole === "ADMIN" ? text.admin : text.manager}</p><p className="text-xs text-muted-foreground">{new Date(invitation.expiresAt).toLocaleString(locale)}</p></div>{invitation.status !== "CLAIMED" && <div className="flex flex-wrap gap-2">{(invitation.status === "REVOKED" || invitation.status === "EXPIRED") && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void resendInvitation(invitation)}>{text.resend}</Button>}{invitation.status !== "REVOKED" && <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void revokeInvitation(invitation.id)}>{text.revoke}</Button>}</div>}</div></div>)}{!plan?.invitations?.length && <p className="text-sm text-muted-foreground">{text.noInvites}</p>}{oneTimeTokens.length > 0 && <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3"><p className="font-semibold">{text.tokenTitle}</p><p className="text-xs leading-6 text-muted-foreground">{text.tokenHint}</p>{oneTimeTokens.map((invitation) => <div key={invitation.invitationId} data-testid={`p14-token-${invitation.invitationId}`} className="space-y-2 rounded-lg bg-background p-3"><code data-testid="p14-token" className="block break-all text-xs" dir="ltr">{invitation.oneTimeToken}</code><Button type="button" size="sm" variant="outline" onClick={() => void copyToken(invitation.invitationId, invitation.oneTimeToken)}>{copiedInvitationId === invitation.invitationId ? text.copied : text.copy}</Button></div>)}</div>}{plan && !oneTimeTokens.length && <p className="text-xs leading-6 text-muted-foreground">{text.noToken}</p>}</CardContent></Card>}
          </aside>
        </form>
      )}
    </main>
  );
}
