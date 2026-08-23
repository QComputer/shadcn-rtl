import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import {
  getRealPilotLaunchWorkspace,
  recordPilotLaunchReview,
  registerPilotSourceAssessment,
  updateRealPilotBusinessIntake,
  type PilotSourceKind,
  type PilotSourceAssessmentStatus,
} from "@/lib/pilot-operations/pilot-workspace.service";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

function csv(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function optional(value: string) {
  return value.length > 0 ? value : null;
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    DATA_COLLECTION: "جمع‌آوری داده",
    PROFILE_SETUP: "تکمیل پروفایل",
    CATALOG_SETUP: "آماده‌سازی کاتالوگ",
    INTEGRATION_SETUP: "آماده‌سازی اتصال",
    GROWTH_SETUP: "آماده‌سازی رشد",
    TRUST_SETUP: "اعتماد و اعتبار",
    LAUNCH_REVIEW: "بازبینی لانچ",
    READY_TO_LAUNCH: "آماده لانچ",
    LIVE: "زنده",
    PAUSED: "متوقف",
  };
  return labels[stage] ?? stage;
}

function stateLabel(state: string) {
  const labels: Record<string, string> = {
    READY: "آماده",
    MISSING: "ناقص",
    NEEDS_OPERATOR_INPUT: "نیازمند ورودی اپراتور",
    PENDING_VERIFICATION: "در انتظار تایید",
    OPTIONAL: "اختیاری",
    BLOCKED: "مسدود",
    NOT_CONFIGURED: "پیکربندی نشده",
    CONFIGURED: "پیکربندی محلی",
    READY_TO_CONNECT: "آماده اتصال",
    CONNECTION_PENDING: "در انتظار اتصال",
    VERIFIED_EXTERNALLY: "تایید خارجی",
    ACTIVE: "فعال پس از تایید",
  };
  return labels[state] ?? state;
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" }) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return <span className={`inline-flex w-fit items-center border px-2 py-1 text-xs font-medium ${classes[tone]}`}>{children}</span>;
}

function readinessTone(state: string): "green" | "amber" | "red" | "slate" {
  if (state === "READY" || state === "CONFIGURED" || state === "READY_TO_CONNECT") return "green";
  if (state === "MISSING" || state === "BLOCKED") return "red";
  if (state === "OPTIONAL") return "slate";
  return "amber";
}

export default async function PilotLaunchWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
}) {
  const { locale: rawLocale, organizationId } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/pilots/${organizationId}`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  async function updateIntake(formData: FormData) {
    "use server";
    const actionSession = await auth();
    if (!actionSession?.user || actionSession.user.role !== "SUPER_ADMIN") return;
    await updateRealPilotBusinessIntake({
      organizationId,
      actorUserId: actionSession.user.id,
      name: optional(value(formData, "name")) ?? undefined,
      description: optional(value(formData, "description")),
      industry: value(formData, "industry") as never,
      address: optional(value(formData, "address")),
      phone: optional(value(formData, "phone")),
      email: optional(value(formData, "email")),
      website: optional(value(formData, "website")),
      socialUrls: csv(formData.get("socialUrls")),
      operatingAreas: csv(formData.get("operatingAreas")),
      preferredGoals: csv(formData.get("preferredGoals")),
      preferredKeywords: csv(formData.get("preferredKeywords")),
      notes: optional(value(formData, "notes")),
    });
    revalidatePath(`/${locale}/dashboard/pilots/${organizationId}`);
  }

  async function addSource(formData: FormData) {
    "use server";
    const actionSession = await auth();
    if (!actionSession?.user || actionSession.user.role !== "SUPER_ADMIN") return;
    await registerPilotSourceAssessment({
      organizationId,
      actorUserId: actionSession.user.id,
      sourceKind: value(formData, "sourceKind") as PilotSourceKind,
      displayName: optional(value(formData, "displayName")),
      sourceUrl: optional(value(formData, "sourceUrl")),
      intendedPurpose: value(formData, "intendedPurpose"),
      assessmentStatus: value(formData, "assessmentStatus") as PilotSourceAssessmentStatus,
      legalAssessmentStatus: value(formData, "assessmentStatus") as PilotSourceAssessmentStatus,
      technicalAssessmentStatus: value(formData, "assessmentStatus") as PilotSourceAssessmentStatus,
      dataExpected: csv(formData.get("dataExpected")),
      manualImportRequired: formData.get("manualImportRequired") === "on",
      adapterSupport: value(formData, "adapterSupport") as never,
      externalVerificationRequired: formData.get("externalVerificationRequired") === "on",
    });
    revalidatePath(`/${locale}/dashboard/pilots/${organizationId}`);
  }

  async function approveLaunch(formData: FormData) {
    "use server";
    const actionSession = await auth();
    if (!actionSession?.user || actionSession.user.role !== "SUPER_ADMIN") return;
    await recordPilotLaunchReview({
      organizationId,
      actorUserId: actionSession.user.id,
      notes: optional(value(formData, "notes")),
    });
    revalidatePath(`/${locale}/dashboard/pilots/${organizationId}`);
  }

  const launch = await getRealPilotLaunchWorkspace({ organizationId });
  const isRtl = locale !== "en";

  return (
    <main className="space-y-6 p-4 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-emerald-700">Real Pilot Launch Workspace</p>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{launch.organization.name}</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              مسیر عملیاتی اپراتور برای داده واقعی، ارزیابی منبع، آماده‌سازی کاتالوگ/خدمت، رشد، اعتماد، تجربه عمومی و بازبینی لانچ.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="border border-slate-200 bg-white p-3">
              <div className="text-slate-500">مرحله</div>
              <div className="font-bold text-slate-950">{stageLabel(launch.launch.stage)}</div>
            </div>
            <div className="border border-red-200 bg-red-50 p-3">
              <div className="text-red-700">Blockers</div>
              <div className="font-bold text-red-900">{launch.launch.blockerCount}</div>
            </div>
            <div className="border border-amber-200 bg-amber-50 p-3">
              <div className="text-amber-700">Recommendations</div>
              <div className="font-bold text-amber-900">{launch.launch.recommendationCount}</div>
            </div>
            <div className="border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-emerald-700">Review</div>
              <div className="font-bold text-emerald-900">{launch.launch.approval.completed ? "Completed" : "Pending"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Blockers vs Recommendations
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                {launch.blockers.map((blocker) => (
                  <div key={blocker.key} className="border border-red-100 bg-red-50 p-3">
                    <div className="font-semibold text-red-950">{blocker.title}</div>
                    <div className="mt-1 text-sm text-red-800">{blocker.nextAction}</div>
                  </div>
                ))}
                {launch.blockers.length === 0 && <Pill tone="green">هیچ مانع لانچ اجباری ثبت نشده است</Pill>}
              </div>
              <div className="space-y-2">
                {launch.recommendations.map((recommendation) => (
                  <div key={recommendation.key} className="border border-amber-100 bg-amber-50 p-3">
                    <div className="font-semibold text-amber-950">{recommendation.title}</div>
                    <div className="mt-1 text-sm text-amber-800">{recommendation.nextAction}</div>
                  </div>
                ))}
                {launch.recommendations.length === 0 && <Pill tone="green">پیشنهاد اختیاری باز نمانده است</Pill>}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["Profile", launch.profileReadiness.state, launch.profileReadiness.missing.join(", ") || "Complete"],
              ["Catalog / Service", launch.catalogReadiness.state, `${launch.catalogReadiness.productCount} products · ${launch.catalogReadiness.serviceCount} services`],
              ["Growth", launch.growthReadiness.state, `${launch.growthReadiness.seoScore}/100 SEO readiness`],
              ["Trust", launch.trustReadiness.state, `${launch.trustReadiness.verifiedReviewCount} verified reviews`],
              ["Public", launch.publicExperienceReadiness.state, launch.publicExperienceReadiness.missingPublicFields.join(", ") || "Serializable"],
              ["Security", "READY", "Credentials and customer identity excluded"],
            ].map(([title, state, detail]) => (
              <div key={title} className="border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{title}</div>
                  <Pill tone={readinessTone(state)}>{stateLabel(state)}</Pill>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              </div>
            ))}
          </div>

          <div className="border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
              <Database className="h-5 w-5 text-slate-700" />
              Source Assessment
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {launch.sourceAssessments.map((source) => (
                <div key={`${source.sourceKind}-${source.sourceUrl ?? source.displayName}`} className="border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{source.displayName}</div>
                      <div className="mt-1 text-xs text-slate-500">{source.sourceKind} · {source.adapterSupport}</div>
                    </div>
                    <Pill tone={source.persisted ? "green" : "slate"}>{source.persisted ? "Recorded" : "Suggested"}</Pill>
                  </div>
                  {source.sourceUrl && (
                    <div className="mt-2 flex items-center gap-1 break-all text-xs text-slate-600">
                      <ExternalLink className="h-3 w-3" />
                      {source.sourceUrl}
                    </div>
                  )}
                  <p className="mt-2 text-sm leading-6 text-slate-600">{source.intendedPurpose}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="amber">{stateLabel(source.connectionState)}</Pill>
                    <Pill>{source.assessmentStatus}</Pill>
                    <Pill>{source.manualImportRequired ? "Manual review required" : "Local input ready"}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              iNoti / Growth Readiness
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {launch.integrationReadiness.services.map((service) => (
                <div key={service.key} className="border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{service.label}</div>
                    <Pill tone={service.recommended ? "green" : "slate"}>{service.recommended ? "Recommended" : "Optional"}</Pill>
                  </div>
                  <div className="mt-2"><Pill tone={readinessTone(service.connectionState)}>{stateLabel(service.connectionState)}</Pill></div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone={service.credentialState === "CREDENTIALS_AVAILABLE" ? "green" : "amber"}>{service.credentialState}</Pill>
                    <Pill tone="slate">{service.readOnlyVerification}</Pill>
                    <Pill tone="red">Live: {service.realExecution}</Pill>
                  </div>
                  {service.key === "USSD" && (
                    <div className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
                      <p>USSD dial code: {service.ussdDialStringConfigured ? "configured" : "not configured"} · CodeName: {service.ussdCodeNameConfigured ? "configured" : "missing"}</p>
                      {service.publicIntegrationId && <p className="break-all">Public Integration ID: LOCAL {service.publicIntegrationId}</p>}
                      {service.publicIntegrationId && <p>Provider registration: NOT CONFIRMED</p>}
                      {service.callbackUrl && <p className="break-all">Callback URL: {service.callbackUrl}</p>}
                    </div>
                  )}
                  {service.key === "SMS" && (
                    <p className="mt-2 text-xs leading-5 text-slate-500">SMS token: {service.smsTokenConfigured ? "configured" : "missing"}</p>
                  )}
                  <p className="mt-2 text-sm leading-6 text-slate-600">{service.nextAction}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <form action={updateIntake} className="space-y-3 border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <FileText className="h-5 w-5" />
              Data Intake
            </div>
            <input name="name" defaultValue={launch.organization.name} className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="نام عمومی کسب‌وکار" />
            <textarea name="description" className="min-h-20 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="توضیح عمومی" />
            <select name="industry" defaultValue={launch.acquisition.industry} className="w-full border border-slate-300 px-3 py-2 text-sm">
              {["RESTAURANT", "PHARMACY", "DENTAL_CLINIC", "FASHION_BOUTIQUE", "RETAIL_SHOP", "OTHER"].map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            <input name="address" className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="شهر / موقعیت عمومی" />
            <input name="phone" className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="شماره عمومی" />
            <input name="email" className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="ایمیل عمومی" />
            <input name="website" className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="وب‌سایت" />
            <textarea name="socialUrls" className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="لینک‌های اجتماعی، هر خط یک مورد" />
            <textarea name="operatingAreas" className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="مناطق فعالیت" />
            <textarea name="preferredGoals" className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="اهداف کسب‌وکار" />
            <textarea name="preferredKeywords" className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="کلمات کلیدی ترجیحی" />
            <textarea name="notes" className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="یادداشت داخلی اپراتور" />
            <button className="w-full border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">ثبت داده داخلی</button>
          </form>

          <form action={addSource} className="space-y-3 border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ClipboardCheck className="h-5 w-5" />
              Register Source Assessment
            </div>
            <select name="sourceKind" className="w-full border border-slate-300 px-3 py-2 text-sm">
              {["SNAPPFOOD", "WEBSITE", "INSTAGRAM", "INOTI", "IAM", "MANUAL", "CSV", "OTHER"].map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
            <input name="displayName" className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="نام منبع" />
            <input name="sourceUrl" className="w-full border border-slate-300 px-3 py-2 text-sm" placeholder="URL در صورت وجود" />
            <textarea name="intendedPurpose" required className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="هدف استفاده از منبع" />
            <select name="assessmentStatus" className="w-full border border-slate-300 px-3 py-2 text-sm">
              {["NOT_ASSESSED", "MANUAL_ONLY", "ADAPTER_AVAILABLE", "READY_FOR_REVIEW", "REQUIRES_CREDENTIALS", "REQUIRES_EXTERNAL_APPROVAL", "UNSUPPORTED"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="adapterSupport" className="w-full border border-slate-300 px-3 py-2 text-sm">
              {["NONE", "LOCAL_PREVIEW_FIXTURE", "MANUAL_INPUT", "FUTURE_CONNECTOR"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <textarea name="dataExpected" className="min-h-16 w-full border border-slate-300 px-3 py-2 text-sm" placeholder="داده‌های مورد انتظار" />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="manualImportRequired" defaultChecked />
              Manual import/review required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="externalVerificationRequired" defaultChecked />
              Requires external verification
            </label>
            <button className="w-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white">ثبت ارزیابی منبع</button>
          </form>

          <form action={approveLaunch} className="space-y-3 border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 font-bold text-emerald-950">
              <ShieldCheck className="h-5 w-5" />
              Launch Review
            </div>
            <p className="text-sm leading-6 text-emerald-900">
              تایید لانچ فقط یعنی پیکربندی بازارباز آماده است؛ هیچ اتصال خارجی یا انتشار تولیدی انجام نمی‌شود.
            </p>
            <textarea name="notes" className="min-h-20 w-full border border-emerald-300 bg-white px-3 py-2 text-sm" placeholder="یادداشت بازبینی" />
            <button className="w-full border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
              {launch.launch.approval.completed ? "به‌روزرسانی بازبینی" : "ثبت بازبینی لانچ"}
            </button>
          </form>

          <div className="border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              Next Actions
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              {launch.nextActions.map((action) => (
                <li key={action.key} className="border border-slate-100 p-2">
                  <div className="font-semibold">{action.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{action.area} · {action.priority}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
