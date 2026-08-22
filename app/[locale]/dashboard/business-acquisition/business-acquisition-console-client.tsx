"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  Circle,
  ClipboardCopy,
  FileCheck2,
  KeyRound,
  ListChecks,
  RefreshCcw,
  Send,
  Sparkles,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { SupportedLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type IndustryKey = "RESTAURANT" | "PHARMACY" | "DENTAL_CLINIC" | "FASHION_BOUTIQUE" | "RETAIL_SHOP" | "OTHER";
type PlatformCapability = "SHOP" | "APPOINTMENT" | "CRM" | "USSD" | "LOYALTY" | "IAM" | "ICV" | "EBC" | "SMS";
type RecommendationCapability = PlatformCapability | "SEO" | "CAMPAIGN" | "CUSTOMER_ENGAGEMENT" | "CONTENT";
type WizardStep = "business" | "capabilities" | "preview" | "finalize";

type RecommendationResponse = {
  industryTemplate: {
    industryKey: IndustryKey;
    displayName: string;
    description: string;
  };
  recommendedCapabilities: RecommendationCapability[];
  recommendedPlatformCapabilities: PlatformCapability[];
  selectedCapabilities: PlatformCapability[];
  onboardingChecklist: string[];
  suggestedIntegrations: string[];
  organizationType: "SHOP" | "APPOINTMENT";
};

type Overview = {
  counts: {
    acquiredOrganizations: number;
    pendingInvitations: number;
    pendingClaims: number;
    activeOrganizations: number;
  };
  acquisitions: Array<{
    id: string;
    sourceType: string;
    industryKey: IndustryKey;
    createdAt: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      type: string;
      isActive: boolean;
      capabilities: PlatformCapability[];
      activationPlan: ActivationPlan | null;
      growthIntelligence: GrowthSummary | null;
    };
    createdBy: { name: string; role: string } | null;
  }>;
  invitations: Array<{
    id: string;
    publicId: string;
    organizationId: string;
    invitedRole: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    organization: { name: string; slug: string };
  }>;
  claimRequests: Array<{
    id: string;
    publicId: string;
    organizationId: string;
    status: string;
    requesterEmail?: string | null;
    requesterPhone?: string | null;
    createdAt: string;
    organization: { name: string; slug: string };
  }>;
};

type ActivationAction = {
  key: string;
  title: string;
  description: string;
  category: "PROFILE" | "CAPABILITY" | "SEO" | "IAM" | "CUSTOMER_JOURNEY" | "INTEGRATION";
  priority: "LOW" | "MEDIUM" | "HIGH";
  relatedCapability?: PlatformCapability | null;
};

type ActivationPlan = {
  id: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  recommendedActions: ActivationAction[];
  completedActions: string[];
  growthOpportunities: {
    seo?: Array<{ id: string; publicId: string; type: string; priority: string; status: string }>;
    iamPageBlueprintHints?: string[];
    customerJourneySuggestions?: string[];
    recommendedInotiServices?: string[];
    businessEntityReadiness?: { ready: boolean; rootEntityId?: string };
  };
  ownerOnboardingReadModel: {
    businessProfileCompleteness?: { score: number; missingItems: string[] };
    enabledCapabilities?: PlatformCapability[];
    missingSetupItems?: string[];
  };
};

type GrowthSummary = {
  status: "DRAFT" | "ACTIVE" | "READY" | "ARCHIVED";
  keywordPlanCount: number;
  recommendationCount: number;
  updatedAt: string;
  externalProviderCalls: false;
};

type GrowthPlan = {
  readiness: {
    seoStrategyStatus: "READY" | "NOT_READY";
    seoScore: number;
    keywordPlanCount: number;
    iamRecommendationCount: number;
    contentOpportunityCount: number;
    nextAction: string | null;
    externalProviderCalls: false;
  };
  ownerNextActions: Array<{ title: string; reason: string; priority: string }>;
};

type FinalizeResult = {
  organization: {
    id: string;
    name: string;
    slug: string;
    type: string;
  };
  selectedCapabilities: PlatformCapability[];
  onboardingChecklist: string[];
  suggestedIntegrations: string[];
  nextHooks: {
    publicPageReady: boolean;
    demoExperienceReady: boolean;
    seoReadinessPrepared: boolean;
    businessEntityGraphPrepared: boolean;
    integrationsPrepared: Array<{ integration: string; mode: string }>;
  };
  activationPlan: ActivationPlan;
  growthPlan: GrowthPlan;
};

type InvitationResult = {
  invitation: {
    publicId: string;
    organizationId: string;
    invitedRole: string;
    expiresAt: string;
    status: string;
  };
  oneTimeToken: string;
};

const INDUSTRIES: Array<{ key: IndustryKey; label: string; hint: string }> = [
  { key: "RESTAURANT", label: "رستوران", hint: "منو، سفارش، CRM و رشد محلی" },
  { key: "PHARMACY", label: "داروخانه", hint: "محصولات، مشتریان و تعامل مجدد" },
  { key: "DENTAL_CLINIC", label: "کلینیک دندان‌پزشکی", hint: "خدمات، نوبت‌دهی و سوابق مشتری" },
  { key: "FASHION_BOUTIQUE", label: "مزون و پوشاک", hint: "کاتالوگ، سلیقه مشتری و محتوا" },
  { key: "RETAIL_SHOP", label: "فروشگاه", hint: "کاتالوگ عمومی و CRM" },
  { key: "OTHER", label: "سایر", hint: "انتخاب دستی قابلیت‌ها" },
];

const PLATFORM_CAPABILITIES: PlatformCapability[] = ["SHOP", "APPOINTMENT", "CRM", "LOYALTY", "USSD", "IAM", "ICV", "EBC", "SMS"];
const STEPS: Array<{ key: WizardStep; title: string; description: string }> = [
  { key: "business", title: "اطلاعات کسب‌وکار", description: "نام، صنعت، تماس و شرح اولیه" },
  { key: "capabilities", title: "پیشنهاد قابلیت‌ها", description: "پیشنهاد template و انتخاب اپراتور" },
  { key: "preview", title: "پیش‌نمایش فعال‌سازی", description: "مرور قبل از ایجاد سازمان" },
  { key: "finalize", title: "نهایی‌سازی و دعوت", description: "ایجاد سازمان و دعوت مالک" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function makeSlug(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  if (normalized.length <= 10) return normalized;

  const segments = normalized.split("-").filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "";
  if (lastSegment.length >= 3) return lastSegment.slice(-10);

  const firstSegment = segments[0] ?? normalized;
  const prefixLength = Math.max(1, 9 - lastSegment.length);
  return `${firstSegment.slice(0, prefixLength)}-${lastSegment}`.replace(/-+$/g, "").slice(0, 10);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "درخواست ناموفق بود");
  return data as T;
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black">{value.toLocaleString("fa-IR")}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

function Stepper({ step }: { step: WizardStep }) {
  const activeIndex = STEPS.findIndex((entry) => entry.key === step);
  return (
    <ol className="grid gap-3 md:grid-cols-4" aria-label="Business acquisition steps">
      {STEPS.map((entry, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={entry.key} className={cn("rounded-lg border p-3", active ? "border-primary bg-primary/5" : "bg-card")}>
            <div className="flex items-start gap-3">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", complete ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">{entry.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.description}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActivationTimeline({ result, invitation }: { result: FinalizeResult | null; invitation: InvitationResult | null }) {
  const items = [
    { label: "ایجاد توسط تیم بازارباز", done: Boolean(result), detail: result?.organization.name ?? "در انتظار نهایی‌سازی" },
    { label: "قابلیت‌ها تنظیم شد", done: Boolean(result?.selectedCapabilities.length), detail: result?.selectedCapabilities.join(", ") ?? "در انتظار انتخاب" },
    { label: "دعوت مالک ساخته شد", done: Boolean(invitation), detail: invitation ? `نقش ${invitation.invitation.invitedRole}` : "در انتظار ایجاد دعوت" },
    { label: "مالک claim کرد", done: false, detail: "برای milestone آینده" },
    { label: "کسب‌وکار فعال شد", done: Boolean(result?.organization), detail: result ? "سازمان فعال است" : "در انتظار ایجاد" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline فعال‌سازی</CardTitle>
        <CardDescription>وضعیت عملیاتی جذب کسب‌وکار برای تیم بازارباز.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.label} className="flex gap-3 rounded-lg border bg-background p-3">
              <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", item.done ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {item.done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">{item.label}</p>
                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ActivationReadinessPanel({ plan }: { plan: ActivationPlan | null | undefined }) {
  const actions = plan?.recommendedActions ?? [];
  const completed = new Set(plan?.completedActions ?? []);
  const readinessPercent = actions.length > 0 ? Math.round((completed.size / actions.length) * 100) : 0;
  const topActions = actions.filter((action) => !completed.has(action.key)).slice(0, 5);
  const profileScore = plan?.ownerOnboardingReadModel.businessProfileCompleteness?.score ?? 0;
  const seoCount = plan?.growthOpportunities.seo?.length ?? 0;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Activation readiness</CardTitle>
        <CardDescription>برنامه فعال‌سازی از template صنعت و داده‌های همین سازمان ساخته شده است.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">پیشرفت</p>
            <p className="mt-1 text-xl font-black">{readinessPercent.toLocaleString("fa-IR")}٪</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">پروفایل</p>
            <p className="mt-1 text-xl font-black">{profileScore.toLocaleString("fa-IR")}٪</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">SEO</p>
            <p className="mt-1 text-xl font-black">{seoCount.toLocaleString("fa-IR")}</p>
          </div>
        </div>

        <div className="space-y-2">
          {topActions.map((action) => (
            <div key={action.key} className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold">{action.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p>
              </div>
              <Badge className="shrink-0" variant={action.priority === "HIGH" ? "default" : "outline"}>{action.priority}</Badge>
            </div>
          ))}
          {topActions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">برنامه فعال‌سازی آماده است.</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {(plan?.growthOpportunities.recommendedInotiServices ?? []).map((service) => (
            <Badge key={service} variant="outline">{service}: readiness only</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GrowthReadinessPanel({ growthPlan }: { growthPlan: GrowthPlan | null | undefined }) {
  if (!growthPlan) return null;
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Growth intelligence</CardTitle>
        <CardDescription>پیشنهادهای رشد از template صنعت، Business Entity، SEO Opportunity و readiness موجود ساخته شده‌اند.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">SEO</p>
            <p className="mt-1 text-xl font-black">{growthPlan.readiness.seoScore.toLocaleString("fa-IR")}/100</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Keywords</p>
            <p className="mt-1 text-xl font-black">{growthPlan.readiness.keywordPlanCount.toLocaleString("fa-IR")}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">iAM</p>
            <p className="mt-1 text-xl font-black">{growthPlan.readiness.iamRecommendationCount.toLocaleString("fa-IR")}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Content</p>
            <p className="mt-1 text-xl font-black">{growthPlan.readiness.contentOpportunityCount.toLocaleString("fa-IR")}</p>
          </div>
        </div>
        {growthPlan.readiness.nextAction ? (
          <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold">{growthPlan.readiness.nextAction}</p>
              <p className="mt-1 text-xs text-muted-foreground">Blueprint only; no publish, provider call, or external activation.</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BusinessAcquisitionConsoleClient({ locale }: { locale: SupportedLocale }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [step, setStep] = useState<WizardStep>("business");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [industryKey, setIndustryKey] = useState<IndustryKey>("RESTAURANT");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [selectedCapabilities, setSelectedCapabilities] = useState<PlatformCapability[]>([]);
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [invitation, setInvitation] = useState<InvitationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isRtl = locale !== "en";

  const selectedIndustry = useMemo(() => INDUSTRIES.find((industry) => industry.key === industryKey) ?? INDUSTRIES[0], [industryKey]);
  const canFinalize = businessName.trim().length >= 2 && slug.trim().length >= 3 && selectedCapabilities.length > 0;

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      setOverview(await fetchJson<Overview>("/api/platform/business-acquisition/overview"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "خطا در بارگذاری داشبورد جذب");
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  function updateBusinessName(value: string) {
    setBusinessName(value);
    if (!slugManuallyEdited) setSlug(makeSlug(value));
  }

  function updateSlug(value: string) {
    setSlugManuallyEdited(true);
    setSlug(makeSlug(value));
  }

  function loadRecommendations() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const data = await fetchJson<RecommendationResponse>("/api/platform/business-acquisition/recommendations", {
          method: "POST",
          body: JSON.stringify({ industryKey, selectedCapabilities: selectedCapabilities.length ? selectedCapabilities : undefined }),
        });
        setRecommendation(data);
        setSelectedCapabilities(data.selectedCapabilities);
        setStep("capabilities");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "دریافت پیشنهادها ناموفق بود");
      }
    });
  }

  function toggleCapability(capability: PlatformCapability, checked: boolean) {
    setSelectedCapabilities((current) => {
      if (checked) return Array.from(new Set([...current, capability]));
      return current.filter((entry) => entry !== capability);
    });
  }

  function finalizeOrganization() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const data = await fetchJson<FinalizeResult>("/api/platform/business-acquisition/organizations", {
          method: "POST",
          body: JSON.stringify({
            sourceType: "BAZARBAAZ_TEAM",
            industryKey,
            name: businessName,
            slug,
            description: description || undefined,
            address: address || undefined,
            phone: phone || undefined,
            email: email || undefined,
            selectedCapabilities,
            metadata: {
              console: "business-acquisition",
              selectedIndustryLabel: selectedIndustry.label,
            },
          }),
        });
        setResult(data);
        setMessage("سازمان با موفقیت ایجاد شد.");
        setStep("finalize");
        await loadOverview();
      } catch (finalizeError) {
        setError(finalizeError instanceof Error ? finalizeError.message : "ایجاد سازمان ناموفق بود");
      }
    });
  }

  function createInvitation() {
    if (!result) return;
    startTransition(async () => {
      setError(null);
      try {
        const data = await fetchJson<InvitationResult>("/api/platform/business-acquisition/invitations", {
          method: "POST",
          body: JSON.stringify({
            organizationId: result.organization.id,
            invitedRole: "ADMIN",
            ttlHours: 72,
            metadata: { console: "business-acquisition", deliveryMode: "manual-code" },
          }),
        });
        setInvitation(data);
        setMessage("دعوت مالک ساخته شد. کد فقط همین حالا نمایش داده می‌شود.");
        await loadOverview();
      } catch (inviteError) {
        setError(inviteError instanceof Error ? inviteError.message : "ایجاد دعوت ناموفق بود");
      }
    });
  }

  async function copyInvitationToken() {
    if (!invitation?.oneTimeToken) return;
    await navigator.clipboard.writeText(invitation.oneTimeToken).catch(() => undefined);
    setMessage("کد دعوت کپی شد.");
  }

  return (
    <main className="min-w-0 space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Badge variant="secondary">Business Acquisition</Badge>
          <h1 className="mt-3 text-2xl font-black tracking-tight">کنسول جذب کسب‌وکار</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            ابزار داخلی تیم بازارباز برای ساخت کسب‌وکار، انتخاب صنعت، بررسی پیشنهاد قابلیت‌ها، ایجاد سازمان و دعوت مالک.
          </p>
        </div>
        <Button variant="outline" onClick={loadOverview} disabled={pending}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          تازه‌سازی
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {message ? <div className="rounded-lg border bg-card p-3 text-sm text-card-foreground">{message}</div> : null}

      <section className="grid gap-3 md:grid-cols-4" aria-label="Business acquisition overview">
        <StatTile icon={Building2} label="سازمان‌های جذب‌شده" value={overview?.counts.acquiredOrganizations ?? 0} />
        <StatTile icon={KeyRound} label="دعوت‌های باز" value={overview?.counts.pendingInvitations ?? 0} />
        <StatTile icon={FileCheck2} label="Claimهای در انتظار" value={overview?.counts.pendingClaims ?? 0} />
        <StatTile icon={Store} label="سازمان فعال" value={overview?.counts.activeOrganizations ?? 0} />
      </section>

      <Stepper step={step} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wizard ایجاد کسب‌وکار</CardTitle>
              <CardDescription>فرآیند چندمرحله‌ای برای اپراتور بازارباز. کانال فعال فقط BAZARBAAZ_TEAM است.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === "business" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business-name">نام کسب‌وکار</Label>
                    <Input id="business-name" value={businessName} onChange={(event) => updateBusinessName(event.target.value)} placeholder="مثلاً کافه رستوران برگ" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-slug">اسلاگ</Label>
                    <Input id="business-slug" dir="ltr" value={slug} onChange={(event) => updateSlug(event.target.value)} placeholder="barg-cafe" />
                  </div>
                  <div className="space-y-2">
                    <Label>صنعت</Label>
                    <Select value={industryKey} onValueChange={(value) => setIndustryKey(value as IndustryKey)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((industry) => (
                          <SelectItem key={industry.key} value={industry.key}>
                            {industry.label} - {industry.hint}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-phone">شماره تماس</Label>
                    <Input id="business-phone" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+9821..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="business-address">موقعیت/آدرس اولیه</Label>
                    <Input id="business-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="تهران، ..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-email">ایمیل</Label>
                    <Input id="business-email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="business-description">توضیح کوتاه</Label>
                    <Textarea id="business-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="شرح عمومی قابل استفاده برای صفحه کسب‌وکار" />
                  </div>
                  <div className="md:col-span-2">
                    <Button onClick={loadRecommendations} disabled={pending || businessName.trim().length < 2}>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      دریافت پیشنهاد قابلیت‌ها
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === "capabilities" && recommendation ? (
                <div className="space-y-5">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h2 className="font-bold">{selectedIndustry.label}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{recommendation.industryTemplate.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recommendation.recommendedCapabilities.map((capability) => (
                        <Badge key={capability} variant={recommendation.recommendedPlatformCapabilities.includes(capability as PlatformCapability) ? "default" : "secondary"}>
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {PLATFORM_CAPABILITIES.map((capability) => (
                      <label key={capability} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-background p-3">
                        <Checkbox
                          checked={selectedCapabilities.includes(capability)}
                          onCheckedChange={(checked) => toggleCapability(capability, checked === true)}
                        />
                        <span className="text-sm font-medium">{capability}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setSelectedCapabilities(recommendation.recommendedPlatformCapabilities)}>پذیرش پیشنهاد اصلی</Button>
                    <Button onClick={() => setStep("preview")} disabled={selectedCapabilities.length === 0}>ادامه به پیش‌نمایش</Button>
                  </div>
                </div>
              ) : null}

              {step === "preview" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs text-muted-foreground">Organization</p>
                      <p className="mt-1 font-bold">{businessName}</p>
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{slug}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs text-muted-foreground">Industry</p>
                      <p className="mt-1 font-bold">{selectedIndustry.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selectedIndustry.hint}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      "Public organization shell",
                      `Selected capabilities: ${selectedCapabilities.join(", ")}`,
                      selectedCapabilities.includes("CRM") ? "CRM foundation" : "CRM readiness note",
                      "SEO readiness",
                      "Integration readiness",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm">
                        <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="break-words">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setStep("capabilities")}>بازگشت</Button>
                    <Button onClick={finalizeOrganization} disabled={!canFinalize || pending}>نهایی‌سازی ایجاد سازمان</Button>
                  </div>
                </div>
              ) : null}

              {step === "finalize" ? (
                <div className="space-y-5">
                  <div className="rounded-lg border bg-primary/5 p-4">
                    <h2 className="font-black">سازمان ایجاد شد</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{result?.organization.name} آماده ادامه عملیات است.</p>
                    {result ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/${locale}/organization/${result.organization.slug}`}>
                          <Button variant="outline" size="sm">صفحه عمومی</Button>
                        </Link>
                        <Link href={`/${locale}/dashboard/organizations`}>
                          <Button variant="outline" size="sm">لیست سازمان‌ها</Button>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  <ActivationReadinessPanel plan={result?.activationPlan} />
                  <GrowthReadinessPanel growthPlan={result?.growthPlan} />
                  <Card className="border-dashed">
                    <CardHeader>
                      <CardTitle>دعوت مالک کسب‌وکار</CardTitle>
                      <CardDescription>فعلاً ارسال واقعی SMS یا provider انجام نمی‌شود؛ فقط کد/لینک دعوت ساخته می‌شود.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button onClick={createInvitation} disabled={!result || pending || Boolean(invitation)}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        ساخت دعوت مالک
                      </Button>
                      {invitation ? (
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs text-muted-foreground">کد یک‌بارنمایش دعوت</p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <code className="min-w-0 flex-1 overflow-auto rounded-md bg-muted px-3 py-2 text-xs" dir="ltr">{invitation.oneTimeToken}</code>
                            <Button variant="outline" onClick={copyInvitationToken}>
                              <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                              کپی
                            </Button>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">Token ذخیره‌شده نیست؛ فقط hash در دیتابیس باقی می‌ماند.</p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>آخرین کسب‌وکارهای ایجادشده</CardTitle>
              <CardDescription>وضعیت Created، Owner Invited و Claim Pending برای تیم داخلی.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(overview?.acquisitions ?? []).slice(0, 6).map((entry) => {
                const hasInvite = overview?.invitations.some((invitationEntry) => invitationEntry.organizationId === entry.organization.id);
                const hasClaim = overview?.claimRequests.some((claim) => claim.organizationId === entry.organization.id);
                return (
                  <div key={entry.id} className="rounded-lg border bg-background p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold">{entry.organization.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{entry.organization.slug}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{entry.industryKey}</Badge>
                        <Badge variant={hasInvite ? "secondary" : "outline"}>{hasInvite ? "Owner Invited" : "Created"}</Badge>
                        {hasClaim ? <Badge variant="secondary">Claim Pending</Badge> : null}
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(entry.createdAt)}</span>
                      <span>{entry.organization.capabilities.join(", ")}</span>
                    </div>
                    {entry.organization.activationPlan ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-md border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Activation</p>
                          <p className="text-sm font-bold">{entry.organization.activationPlan.status}</p>
                        </div>
                        <div className="rounded-md border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Next steps</p>
                          <p className="text-sm font-bold">{entry.organization.activationPlan.recommendedActions.length.toLocaleString("fa-IR")}</p>
                        </div>
                        <div className="rounded-md border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Growth</p>
                          <p className="text-sm font-bold">{(entry.organization.growthIntelligence?.recommendationCount ?? 0).toLocaleString("fa-IR")} recs</p>
                        </div>
                        <div className="rounded-md border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Keywords</p>
                          <p className="text-sm font-bold">{(entry.organization.growthIntelligence?.keywordPlanCount ?? 0).toLocaleString("fa-IR")}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {overview && overview.acquisitions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">هنوز acquisition ثبت نشده است.</div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <aside className="min-w-0 space-y-6">
          <ActivationTimeline result={result} invitation={invitation} />

          <Card>
            <CardHeader>
              <CardTitle>اقدام‌های بعدی</CardTitle>
              <CardDescription>فقط hook و ناوبری؛ اجرای کامل در milestoneهای بعدی.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(result?.activationPlan ? result.activationPlan.recommendedActions.slice(0, 5).map((action) => action.title) : result ? [
                selectedCapabilities.includes("SHOP") ? "افزودن منو یا کاتالوگ" : "افزودن خدمات اولیه",
                "تنظیم صفحه عمومی",
                "بررسی SEO readiness",
                "آماده‌سازی Integration readiness",
                "ساخت دعوت مالک",
              ] : [
                "اطلاعات کسب‌وکار را وارد کنید",
                "قابلیت‌ها را تأیید کنید",
                "پیش‌نمایش فعال‌سازی را بررسی کنید",
              ]).map((action) => (
                <div key={action} className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm">
                  <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{action}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration readiness</CardTitle>
              <CardDescription>آمادگی مفهومی بدون تماس خارجی واقعی.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(recommendation?.suggestedIntegrations.length ? recommendation.suggestedIntegrations : ["iAM", "iCV", "EBC", "USSD"]).map((integration) => (
                <Badge key={integration} variant="outline">{integration}: Ready to configure</Badge>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
