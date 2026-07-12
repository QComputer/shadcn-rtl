"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ClipboardList, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingWizardContent } from "@/lib/content/b2b-onboarding-wizard-content";

type Locale = "fa" | "en" | "ar";

type WizardState = {
  businessType: string;
  priorities: string[];
  readiness: string[];
  volume: string;
  ownerName: string;
  businessName: string;
  phone: string;
  city: string;
  consent: boolean;
};

const appointmentBusinessTypes = new Set(["clinic", "beauty", "service"]);
const shopBusinessTypes = new Set(["shop", "restaurant", "pharmacy", "repair", "education"]);

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function getBusinessPath(businessType: string, priorities: string[]) {
  if (appointmentBusinessTypes.has(businessType)) return "appointment";
  if (shopBusinessTypes.has(businessType)) return "shop";
  if (priorities.includes("appointments") && !priorities.includes("orders")) return "appointment";
  if (priorities.includes("orders") || priorities.includes("catalog")) return "shop";
  return "hybrid";
}

function optionClass(selected: boolean) {
  return [
    "min-h-[84px] rounded-lg border p-4 text-start transition-colors",
    selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background hover:bg-muted/60",
  ].join(" ");
}

export function BusinessOnboardingWizard({
  locale,
  content,
}: {
  locale: Locale;
  content: OnboardingWizardContent;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    businessType: "",
    priorities: [],
    readiness: [],
    volume: "",
    ownerName: "",
    businessName: "",
    phone: "",
    city: "",
    consent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isRtl = locale !== "en";
  const businessPath = useMemo(
    () => getBusinessPath(state.businessType, state.priorities),
    [state.businessType, state.priorities],
  );
  const readinessScore = state.readiness.length;
  const recommendation = useMemo(() => {
    const pathCopy =
      businessPath === "appointment"
        ? content.recommendations.appointment
        : businessPath === "shop"
          ? content.recommendations.shop
          : content.recommendations.hybrid;
    const readinessCopy = readinessScore >= 3 ? content.recommendations.fast : content.recommendations.guided;
    return `${pathCopy} ${readinessCopy}`;
  }, [businessPath, content, readinessScore]);

  const selectedBusiness = content.businessTypes.find((item) => item.id === state.businessType);
  const selectedVolume = content.volumeOptions.find((item) => item.id === state.volume);

  function updateState(patch: Partial<WizardState>) {
    setState((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function canContinue() {
    if (step === 0) return Boolean(state.businessType);
    if (step === 1) return state.priorities.length > 0 && Boolean(state.volume);
    if (step === 2) return true;
    return Boolean(
      state.ownerName.trim() &&
        state.businessName.trim() &&
        state.phone.trim() &&
        state.consent,
    );
  }

  function handleNext() {
    if (!canContinue()) {
      setError("لطفاً اطلاعات همین مرحله را کامل کنید.");
      return;
    }
    setStep((current) => Math.min(current + 1, content.steps.length - 1));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canContinue()) {
      setError("لطفاً نام، کسب‌وکار، شماره تماس و تأییدیه را کامل کنید.");
      return;
    }

    setLoading(true);
    setError(null);

    const priorityLabels = content.priorities
      .filter((item) => state.priorities.includes(item.id))
      .map((item) => item.label);
    const readinessLabels = content.readiness
      .filter((item) => state.readiness.includes(item.id))
      .map((item) => item.label);

    try {
      const response = await fetch("/api/request-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: state.ownerName.trim(),
          businessName: state.businessName.trim(),
          businessType: state.businessType || "other",
          phone: state.phone.trim(),
          city: state.city.trim(),
          preferredContactTime: "پیگیری پس از تکمیل ویزارد راه‌اندازی",
          needSummary: [
            "منبع: business-onboarding-wizard",
            `نوع کسب‌وکار: ${selectedBusiness?.label || state.businessType}`,
            `حجم فعالیت: ${selectedVolume?.label || state.volume}`,
            `مسیر پیشنهادی: ${businessPath}`,
            `اولویت‌ها: ${priorityLabels.join("، ") || "ثبت نشده"}`,
            `آمادگی محتوا: ${readinessLabels.join("، ") || "نیاز به تکمیل"}`,
            `جمع‌بندی: ${recommendation}`,
          ].join("\n"),
          consentAccepted: state.consent,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "ثبت درخواست انجام نشد.");
      }

      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ثبت درخواست انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-black">{content.successTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{content.successMessage}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${locale}/demo`}>
            <Button variant="outline">مشاهده نمونه‌ها</Button>
          </Link>
          <Link href={`/${locale}/features`}>
            <Button variant="outline">امکانات بازارباز</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[280px_1fr]" dir={isRtl ? "rtl" : "ltr"}>
      <aside className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          مسیر پیشنهادی
        </div>
        <ol className="mt-5 space-y-3">
          {content.steps.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3">
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                  index === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : index < step
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                ].join(" ")}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={index === step ? "font-bold" : "text-sm text-muted-foreground"}>{item.label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-lg border bg-background p-4 text-sm leading-7 text-muted-foreground">
          {recommendation}
        </div>
      </aside>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black">نوع کسب‌وکار شما چیست؟</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                انتخاب این بخش تعیین می‌کند شروع بازارباز فروشگاهی، نوبت‌دهی یا ترکیبی باشد.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {content.businessTypes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={optionClass(state.businessType === item.id)}
                  onClick={() => updateState({ businessType: item.id })}
                >
                  <span className="block font-bold">{item.label}</span>
                  <span className="mt-2 block text-xs leading-6 text-muted-foreground">{item.helper}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black">اولویت‌های شروع را انتخاب کنید</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                چند گزینه را انتخاب کنید تا برنامه راه‌اندازی با نیاز واقعی کسب‌وکار شما هماهنگ شود.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {content.priorities.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={optionClass(state.priorities.includes(item.id))}
                  onClick={() => updateState({ priorities: toggleValue(state.priorities, item.id) })}
                >
                  <span className="flex items-center gap-2 font-bold">
                    {state.priorities.includes(item.id) && <Check className="h-4 w-4 text-primary" />}
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="font-bold">حجم فعلی فعالیت</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {content.volumeOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={optionClass(state.volume === item.id)}
                    onClick={() => updateState({ volume: item.id })}
                  >
                    <span className="block font-bold">{item.label}</span>
                    <span className="mt-2 block text-xs leading-6 text-muted-foreground">{item.helper}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black">چه چیزهایی آماده است؟</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                این بخش کمک می‌کند تیم بازارباز بداند جلسه دمو باید روی راه‌اندازی سریع تمرکز کند یا آماده‌سازی داده‌ها.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.readiness.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={optionClass(state.readiness.includes(item.id))}
                  onClick={() => updateState({ readiness: toggleValue(state.readiness, item.id) })}
                >
                  <span className="flex items-center gap-2 font-bold">
                    {state.readiness.includes(item.id) && <Check className="h-4 w-4 text-primary" />}
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-7 text-muted-foreground">
              {recommendation}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black">ثبت درخواست دمو</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                نتیجه ویزارد همراه فرم دمو ارسال می‌شود تا پیگیری بعدی دقیق‌تر باشد.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ownerName">{content.labels.ownerName}</Label>
                <Input id="ownerName" value={state.ownerName} onChange={(event) => updateState({ ownerName: event.target.value })} disabled={loading} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">{content.labels.businessName}</Label>
                <Input id="businessName" value={state.businessName} onChange={(event) => updateState({ businessName: event.target.value })} disabled={loading} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{content.labels.phone}</Label>
                <Input id="phone" type="tel" value={state.phone} onChange={(event) => updateState({ phone: event.target.value })} disabled={loading} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{content.labels.city}</Label>
                <Input id="city" value={state.city} onChange={(event) => updateState({ city: event.target.value })} disabled={loading} />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-4 text-sm leading-7">
              <input
                type="checkbox"
                checked={state.consent}
                onChange={(event) => updateState({ consent: event.target.checked })}
                disabled={loading}
                className="mt-1 h-4 w-4 shrink-0"
                required
              />
              <span>{content.labels.consent}</span>
            </label>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0 || loading}
          >
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {content.labels.back}
          </Button>

          {step < content.steps.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              {content.labels.next}
              {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? content.labels.submitting : content.labels.submit}
            </Button>
          )}
        </div>
      </section>
    </form>
  );
}
