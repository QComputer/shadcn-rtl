export type AiMediaLegacyJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED";

export type AiMediaCanonicalStatus =
  | "ACCEPTED"
  | "QUEUED_WAITING_FOR_GPU"
  | "QUEUED_GPU_OFFLINE"
  | "QUEUED_GPU_BUSY"
  | "CLAIMED_BY_WORKER"
  | "PROCESSING"
  | "RESULT_READY"
  | "IMPORTED_BY_BAZAR_BAZ"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "CANCELLED"
  | "EXPIRED"
  | "UNKNOWN";

export type AiMediaEtaConfidence = "none" | "unknown" | "low" | "medium" | "high";
export type AiMediaWorkerAvailability = "available" | "busy" | "offline" | "unknown";

export type NormalizedAiMediaStatus = {
  canonicalStatus: AiMediaCanonicalStatus;
  legacyStatus: AiMediaLegacyJobStatus;
  terminal: boolean;
  success: boolean;
  failure: boolean;
  retryable: boolean;
  inFlight: boolean;
  unavailable: boolean;
  queue: {
    queueRank: number | null;
    jobsAhead: number | null;
  };
  eta: {
    etaSeconds: number | null;
    confidence: AiMediaEtaConfidence;
    displayable: boolean;
    approximate: boolean;
  };
  workerAvailability: AiMediaWorkerAvailability;
};

export type AiMediaStatusDisplay = {
  label: string;
  description: string;
  badgeText: string;
  tone: "default" | "success" | "warning" | "danger" | "muted";
};

const CANONICAL_STATUS_VALUES = new Set<AiMediaCanonicalStatus>([
  "ACCEPTED",
  "QUEUED_WAITING_FOR_GPU",
  "QUEUED_GPU_OFFLINE",
  "QUEUED_GPU_BUSY",
  "CLAIMED_BY_WORKER",
  "PROCESSING",
  "RESULT_READY",
  "IMPORTED_BY_BAZAR_BAZ",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "CANCELLED",
  "EXPIRED",
  "UNKNOWN",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeStatusValue(value: unknown): AiMediaCanonicalStatus {
  const raw = getString(value)?.toUpperCase().replace(/[\s-]+/g, "_");
  if (!raw) return "UNKNOWN";
  if (raw === "QUEUED") return "QUEUED_WAITING_FOR_GPU";
  if (raw === "CLAIMED" || raw === "RUNNING") return "CLAIMED_BY_WORKER";
  if (raw === "COMPLETED" || raw === "SUCCEEDED" || raw === "SUCCESS") return "RESULT_READY";
  if (raw === "FAILED") return "FAILED_FINAL";
  if (raw === "CANCELED") return "CANCELLED";
  if (CANONICAL_STATUS_VALUES.has(raw as AiMediaCanonicalStatus)) return raw as AiMediaCanonicalStatus;
  return "UNKNOWN";
}

export function mapAiMediaStatusToLegacyStatus(status: AiMediaCanonicalStatus): AiMediaLegacyJobStatus {
  switch (status) {
    case "CLAIMED_BY_WORKER":
    case "PROCESSING":
      return "PROCESSING";
    case "RESULT_READY":
    case "IMPORTED_BY_BAZAR_BAZ":
      return "COMPLETED";
    case "FAILED_RETRYABLE":
    case "FAILED_FINAL":
    case "EXPIRED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELED";
    case "ACCEPTED":
    case "QUEUED_WAITING_FOR_GPU":
    case "QUEUED_GPU_OFFLINE":
    case "QUEUED_GPU_BUSY":
    case "UNKNOWN":
    default:
      return "QUEUED";
  }
}

function normalizeEtaConfidence(value: unknown): AiMediaEtaConfidence {
  const raw = getString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  if (raw === "none" || raw === "no_eta" || raw === "not_available") return "none";
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "unknown") return raw;
  return "unknown";
}

function normalizeWorkerAvailability(status: AiMediaCanonicalStatus, value: unknown): AiMediaWorkerAvailability {
  const raw = getString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "available" || raw === "online" || raw === "ready") return "available";
  if (raw === "busy" || raw === "saturated") return "busy";
  if (raw === "offline" || raw === "unavailable" || raw === "disconnected") return "offline";
  if (status === "QUEUED_GPU_OFFLINE") return "offline";
  if (status === "QUEUED_GPU_BUSY") return "busy";
  return "unknown";
}

export function normalizeAiMediaServiceStatusPayload(value: unknown): NormalizedAiMediaStatus {
  const input = asRecord(value);
  const queue = asRecord(input.queue);
  const eta = asRecord(input.eta);
  const worker = asRecord(input.worker);
  const readiness = asRecord(input.readiness);

  const canonicalStatus = normalizeStatusValue(
    input.canonical_status
      ?? input.canonicalStatus
      ?? input.status
      ?? asRecord(input.job).canonical_status
      ?? asRecord(input.job).status,
  );
  const legacyStatus = mapAiMediaStatusToLegacyStatus(canonicalStatus);
  const etaSeconds = getNumber(
    eta.eta_seconds
      ?? eta.etaSeconds
      ?? eta.seconds
      ?? input.eta_seconds
      ?? input.etaSeconds
      ?? input.estimated_seconds
      ?? input.estimatedSeconds,
  );
  const confidence = normalizeEtaConfidence(eta.confidence ?? eta.eta_confidence ?? input.eta_confidence ?? input.etaConfidence);
  const workerAvailability = normalizeWorkerAvailability(
    canonicalStatus,
    input.worker_availability
      ?? input.workerAvailability
      ?? worker.availability
      ?? readiness.worker_availability
      ?? readiness.workerAvailability,
  );
  const displayableEta = etaSeconds !== null && confidence !== "none" && confidence !== "unknown";
  const failure = canonicalStatus === "FAILED_RETRYABLE" || canonicalStatus === "FAILED_FINAL" || canonicalStatus === "EXPIRED";

  return {
    canonicalStatus,
    legacyStatus,
    terminal: ["RESULT_READY", "IMPORTED_BY_BAZAR_BAZ", "FAILED_FINAL", "CANCELLED", "EXPIRED"].includes(canonicalStatus),
    success: canonicalStatus === "RESULT_READY" || canonicalStatus === "IMPORTED_BY_BAZAR_BAZ",
    failure,
    retryable: canonicalStatus === "FAILED_RETRYABLE",
    inFlight: ["ACCEPTED", "QUEUED_WAITING_FOR_GPU", "QUEUED_GPU_OFFLINE", "QUEUED_GPU_BUSY", "CLAIMED_BY_WORKER", "PROCESSING", "FAILED_RETRYABLE", "UNKNOWN"].includes(canonicalStatus),
    unavailable: canonicalStatus === "QUEUED_GPU_OFFLINE" || workerAvailability === "offline" || canonicalStatus === "UNKNOWN",
    queue: {
      queueRank: getNumber(queue.queue_rank ?? queue.queueRank ?? input.queue_rank ?? input.queueRank),
      jobsAhead: getNumber(queue.jobs_ahead ?? queue.jobsAhead ?? input.jobs_ahead ?? input.jobsAhead),
    },
    eta: {
      etaSeconds,
      confidence,
      displayable: displayableEta,
      approximate: displayableEta && confidence === "low",
    },
    workerAvailability,
  };
}

export function isAiMediaStatusInFlight(value: unknown): boolean {
  return normalizeAiMediaServiceStatusPayload(value).inFlight;
}

export function isAiMediaStatusTerminal(value: unknown): boolean {
  return normalizeAiMediaServiceStatusPayload(value).terminal;
}

function localeKey(locale: string): "fa" | "en" | "ar" {
  return locale === "en" || locale === "ar" ? locale : "fa";
}

export function getAiMediaStatusDisplay(value: unknown, locale = "fa"): AiMediaStatusDisplay {
  const status = normalizeAiMediaServiceStatusPayload(value).canonicalStatus;
  const messages: Record<AiMediaCanonicalStatus, Record<"fa" | "en" | "ar", AiMediaStatusDisplay>> = {
    ACCEPTED: {
      fa: { label: "درخواست ثبت شد", badgeText: "در صف", description: "درخواست دریافت شده و منتظر شروع پردازش است.", tone: "muted" },
      en: { label: "Request accepted", badgeText: "Queued", description: "The request was accepted and is waiting to start.", tone: "muted" },
      ar: { label: "تم استلام الطلب", badgeText: "في الصف", description: "تم استلام الطلب وهو بانتظار بدء المعالجة.", tone: "muted" },
    },
    QUEUED_WAITING_FOR_GPU: {
      fa: { label: "در صف پردازش", badgeText: "در صف", description: "درخواست در صف است و پس از آزاد شدن ظرفیت پردازش می‌شود.", tone: "muted" },
      en: { label: "Waiting in queue", badgeText: "Queued", description: "The request is queued and will run when capacity is available.", tone: "muted" },
      ar: { label: "في صف المعالجة", badgeText: "في الصف", description: "الطلب في الصف وسيبدأ عند توفر السعة.", tone: "muted" },
    },
    QUEUED_GPU_OFFLINE: {
      fa: { label: "پردازشگر فعلا آفلاین است", badgeText: "منتظر پردازشگر", description: "درخواست نگه داشته شده است؛ آفلاین بودن پردازشگر به معنی شکست درخواست نیست.", tone: "warning" },
      en: { label: "Worker temporarily offline", badgeText: "Waiting", description: "The request is held safely; an offline worker is not a failed request.", tone: "warning" },
      ar: { label: "المعالج غير متصل مؤقتا", badgeText: "بانتظار المعالج", description: "تم حفظ الطلب؛ عدم اتصال المعالج لا يعني فشل الطلب.", tone: "warning" },
    },
    QUEUED_GPU_BUSY: {
      fa: { label: "پردازشگر مشغول است", badgeText: "صف شلوغ", description: "درخواست در صف ظرفیت پردازش قرار دارد.", tone: "warning" },
      en: { label: "Worker busy", badgeText: "Busy queue", description: "The request is waiting for processing capacity.", tone: "warning" },
      ar: { label: "المعالج مشغول", badgeText: "صف مزدحم", description: "الطلب ينتظر توفر سعة المعالجة.", tone: "warning" },
    },
    CLAIMED_BY_WORKER: {
      fa: { label: "پردازش آغاز شد", badgeText: "در حال پردازش", description: "درخواست توسط پردازشگر دریافت شده است.", tone: "muted" },
      en: { label: "Worker claimed", badgeText: "Processing", description: "A worker has picked up the request.", tone: "muted" },
      ar: { label: "بدأت المعالجة", badgeText: "قيد المعالجة", description: "استلم المعالج الطلب.", tone: "muted" },
    },
    PROCESSING: {
      fa: { label: "در حال تولید تصویر", badgeText: "در حال پردازش", description: "تصویر در حال تولید یا آماده‌سازی نتیجه است.", tone: "muted" },
      en: { label: "Generating image", badgeText: "Processing", description: "The image is being generated or prepared.", tone: "muted" },
      ar: { label: "جاري توليد الصورة", badgeText: "قيد المعالجة", description: "يتم توليد الصورة أو تجهيز النتيجة.", tone: "muted" },
    },
    RESULT_READY: {
      fa: { label: "نتیجه آماده است", badgeText: "آماده", description: "نتیجه آماده شده و هنوز باید توسط سرور بازارباز وارد دارایی‌ها شود.", tone: "success" },
      en: { label: "Result ready", badgeText: "Ready", description: "The result is ready and still must be imported by the Bazar Baz server.", tone: "success" },
      ar: { label: "النتيجة جاهزة", badgeText: "جاهز", description: "النتيجة جاهزة ويجب إدخالها عبر خادم بازارباز.", tone: "success" },
    },
    IMPORTED_BY_BAZAR_BAZ: {
      fa: { label: "در بازارباز ذخیره شد", badgeText: "ذخیره شد", description: "نتیجه توسط سرور بازارباز اعتبارسنجی و به دارایی امن تبدیل شده است.", tone: "success" },
      en: { label: "Imported by Bazar Baz", badgeText: "Imported", description: "The Bazar Baz server validated and stored the result as an asset.", tone: "success" },
      ar: { label: "تم الإدخال في بازارباز", badgeText: "تم الحفظ", description: "تحقق خادم بازارباز من النتيجة وحفظها كأصل.", tone: "success" },
    },
    FAILED_RETRYABLE: {
      fa: { label: "نیازمند تلاش مجدد", badgeText: "قابل تلاش مجدد", description: "خطای موقت رخ داده است و تلاش مجدد می‌تواند انجام شود.", tone: "warning" },
      en: { label: "Retry needed", badgeText: "Retryable", description: "A temporary failure occurred and retry is allowed.", tone: "warning" },
      ar: { label: "يتطلب إعادة المحاولة", badgeText: "قابل للإعادة", description: "حدث خطأ مؤقت ويمكن إعادة المحاولة.", tone: "warning" },
    },
    FAILED_FINAL: {
      fa: { label: "تولید ناموفق بود", badgeText: "ناموفق", description: "درخواست با خطای نهایی متوقف شد.", tone: "danger" },
      en: { label: "Generation failed", badgeText: "Failed", description: "The request stopped with a final failure.", tone: "danger" },
      ar: { label: "فشل التوليد", badgeText: "فشل", description: "توقف الطلب بخطأ نهائي.", tone: "danger" },
    },
    CANCELLED: {
      fa: { label: "درخواست لغو شد", badgeText: "لغو شد", description: "درخواست توسط کاربر یا سامانه لغو شده است.", tone: "muted" },
      en: { label: "Request canceled", badgeText: "Canceled", description: "The request was canceled by the user or system.", tone: "muted" },
      ar: { label: "تم إلغاء الطلب", badgeText: "ألغي", description: "تم إلغاء الطلب بواسطة المستخدم أو النظام.", tone: "muted" },
    },
    EXPIRED: {
      fa: { label: "درخواست منقضی شد", badgeText: "منقضی", description: "زمان نگهداری درخواست به پایان رسیده است.", tone: "danger" },
      en: { label: "Request expired", badgeText: "Expired", description: "The request retention window has expired.", tone: "danger" },
      ar: { label: "انتهت صلاحية الطلب", badgeText: "منتهي", description: "انتهت مدة الاحتفاظ بالطلب.", tone: "danger" },
    },
    UNKNOWN: {
      fa: { label: "وضعیت در حال بررسی", badgeText: "در حال بررسی", description: "وضعیت دریافتی برای نمایش مستقیم مناسب نیست؛ درخواست با حالت امن پیگیری می‌شود.", tone: "warning" },
      en: { label: "Status under review", badgeText: "Checking", description: "The returned status is not displayed directly; the request remains in a safe pending state.", tone: "warning" },
      ar: { label: "جار التحقق من الحالة", badgeText: "قيد التحقق", description: "الحالة المستلمة لا تعرض مباشرة ويبقى الطلب في حالة انتظار آمنة.", tone: "warning" },
    },
  };
  return messages[status][localeKey(locale)];
}

function formatNumber(value: number, locale: string) {
  const numberLocale = locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en";
  return new Intl.NumberFormat(numberLocale).format(value);
}

function formatDuration(seconds: number, locale: string) {
  if (seconds < 60) {
    return localeKey(locale) === "en" ? `${formatNumber(seconds, locale)} sec` : `${formatNumber(seconds, locale)} ثانیه`;
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return localeKey(locale) === "en" ? `${formatNumber(minutes, locale)} min` : `${formatNumber(minutes, locale)} دقیقه`;
}

export function getAiMediaStatusDetailLines(value: unknown, locale = "fa"): string[] {
  const normalized = normalizeAiMediaServiceStatusPayload(value);
  const key = localeKey(locale);
  const lines: string[] = [];

  if (normalized.queue.queueRank !== null) {
    lines.push(key === "en"
      ? `Queue rank: ${formatNumber(normalized.queue.queueRank, locale)}`
      : key === "ar"
        ? `الترتيب في الصف: ${formatNumber(normalized.queue.queueRank, locale)}`
        : `رتبه در صف: ${formatNumber(normalized.queue.queueRank, locale)}`);
  }
  if (normalized.queue.jobsAhead !== null) {
    lines.push(key === "en"
      ? `Jobs ahead: ${formatNumber(normalized.queue.jobsAhead, locale)}`
      : key === "ar"
        ? `طلبات قبل هذا الطلب: ${formatNumber(normalized.queue.jobsAhead, locale)}`
        : `درخواست‌های جلوتر: ${formatNumber(normalized.queue.jobsAhead, locale)}`);
  }
  if (normalized.eta.displayable && normalized.eta.etaSeconds !== null) {
    const duration = formatDuration(normalized.eta.etaSeconds, locale);
    lines.push(key === "en"
      ? `${normalized.eta.approximate ? "Approximate " : ""}ETA: ${duration}`
      : key === "ar"
        ? `${normalized.eta.approximate ? "الوقت التقريبي: " : "الوقت المتوقع: "}${duration}`
        : `${normalized.eta.approximate ? "زمان تقریبی: " : "زمان مورد انتظار: "}${duration}`);
  }

  return lines;
}
