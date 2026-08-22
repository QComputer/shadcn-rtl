"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoPresentationPanels } from "@/components/demo-universe/demo-presentation-panels";
import { DemoProgressTimeline } from "@/components/demo-universe/demo-progress-timeline";
import { buildDemoPresentationPanels, type DemoJourneyStep } from "@/lib/demo-universe/demo-walkthrough";

type DemoRole = "PLATFORM_ADMIN" | "ORGANIZATION_OWNER" | "MANAGER" | "STAFF" | "DRIVER" | "CUSTOMER";

type DemoShellPayload = Record<string, unknown>;
type DemoScenarioPayload = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  steps: Array<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    role: string;
    action: string | null;
    completedAt: string | null;
  }>;
  journeySteps?: DemoJourneyStep[];
};

const ROLE_ENDPOINT: Record<DemoRole, string> = {
  PLATFORM_ADMIN: "/api/demo/platform/dashboard",
  ORGANIZATION_OWNER: "/api/demo/manager/dashboard",
  MANAGER: "/api/demo/manager/dashboard",
  STAFF: "/api/demo/staff/dashboard",
  DRIVER: "/api/demo/driver/dashboard",
  CUSTOMER: "/api/demo/customer/dashboard",
};

const ROLE_TITLES: Record<DemoRole, string> = {
  PLATFORM_ADMIN: "نمای پلتفرم",
  ORGANIZATION_OWNER: "نمای مالک سازمان",
  MANAGER: "نمای مدیر",
  STAFF: "نمای کارمند",
  DRIVER: "نمای راننده",
  CUSTOMER: "نمای مشتری",
};

const ROLE_EXPERIENCE: Record<DemoRole, {
  label: string;
  explanation: string;
  suggestedActions: string[];
  capabilities: string[];
}> = {
  PLATFORM_ADMIN: {
    label: "Platform Admin",
    explanation: "You are comparing demo tenants, ecosystem readiness, and public experience quality across BazarBaaz.",
    suggestedActions: ["Compare tenants", "Review ecosystem readiness", "Inspect SEO/content status"],
    capabilities: ["Platform analytics", "Demo portfolio", "Integration readiness"],
  },
  ORGANIZATION_OWNER: {
    label: "Business Owner",
    explanation: "You are seeing the business as an owner: operations, customers, growth signals, and readiness in one place.",
    suggestedActions: ["Review growth panel", "Inspect CRM signals", "Check readiness"],
    capabilities: ["Operations", "CRM", "SEO", "Engagement"],
  },
  MANAGER: {
    label: "Manager",
    explanation: "You are managing the day-to-day business flow: orders, appointments, customers, content, and campaigns.",
    suggestedActions: ["Review operations", "Check customer intelligence", "Run dry-run campaign"],
    capabilities: ["Operations", "CRM", "Campaigns", "SEO"],
  },
  STAFF: {
    label: "Staff",
    explanation: "You are handling assigned work without seeing unrelated tenant data or unauthorized management surfaces.",
    suggestedActions: ["Prepare pending work", "Mark work ready", "Review assigned tasks"],
    capabilities: ["Staff workflow", "Order preparation", "Appointment follow-up"],
  },
  DRIVER: {
    label: "Driver",
    explanation: "You are seeing only delivery work available to the driver role for this demo organization.",
    suggestedActions: ["Review assigned delivery", "Complete delivery", "Return to manager view"],
    capabilities: ["Delivery queue", "Tenant-scoped access"],
  },
  CUSTOMER: {
    label: "Customer",
    explanation: "You are experiencing the public customer side: discovery, order or booking, and follow-up signals.",
    suggestedActions: ["Create demo order", "Review active order", "Switch to manager to see CRM impact"],
    capabilities: ["Public discovery", "Ordering/booking", "Customer profile"],
  },
};

export function DemoShellClient({ organizationSlug, initialRole }: { organizationSlug: string; initialRole: DemoRole }) {
  const [role, setRole] = useState<DemoRole>(initialRole);
  const [payload, setPayload] = useState<DemoShellPayload | null>(null);
  const [scenario, setScenario] = useState<DemoScenarioPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [catalogPreview, setCatalogPreview] = useState<DemoShellPayload | null>(null);

  const endpoint = useMemo(() => ROLE_ENDPOINT[role] ?? ROLE_ENDPOINT.CUSTOMER, [role]);
  const presentationPanels = useMemo(() => buildDemoPresentationPanels(payload), [payload]);
  const journeySteps = scenario?.journeySteps ?? [];
  const roleExperience = ROLE_EXPERIENCE[role];

  async function loadDashboard(nextRole = role) {
    setMessage(null);
    const response = await fetch(ROLE_ENDPOINT[nextRole], {
      headers: { "x-demo-organization-slug": organizationSlug },
    });
    if (!response.ok) {
      setPayload(null);
      setMessage("دسترسی این نقش به این بخش مجاز نیست یا سشن دمو منقضی شده است.");
      return;
    }
    setPayload(await response.json());
  }

  async function loadScenario() {
    const response = await fetch("/api/demo/scenario", {
      headers: { "x-demo-organization-slug": organizationSlug },
    });
    if (response.ok) {
      const body = await response.json();
      setScenario(body.scenario);
    }
  }

  useEffect(() => {
    loadDashboard(role);
    loadScenario();
  }, [endpoint, organizationSlug]);

  async function createOrder() {
    const response = await fetch("/api/demo/orders/create", {
      method: "POST",
      headers: { "x-demo-organization-slug": organizationSlug },
    });
    setMessage(response.ok ? "سفارش نمایشی ساخته شد و CRM به‌روزرسانی شد." : "ساخت سفارش ناموفق بود.");
    await loadDashboard();
    await loadScenario();
  }

  async function catalogAnalyze() {
    setMessage(null);
    const create = await fetch("/api/demo/catalog/connections", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-organization-slug": organizationSlug },
      body: JSON.stringify({ provider: "SNAPPFOOD", externalUrl: "https://example.test/demo-menu" }),
    });
    if (!create.ok) {
      setMessage("ایجاد اتصال کاتالوگ ناموفق بود.");
      return;
    }
    const connection = (await create.json()).connection;
    const preview = await fetch(`/api/demo/catalog/connections/${connection.id}/preview`, {
      method: "POST",
      headers: { "x-demo-organization-slug": organizationSlug },
    });
    const previewPayload = await preview.json();
    const mappings = await fetch(`/api/demo/catalog/connections/${connection.id}/mappings`, {
      method: "POST",
      headers: { "x-demo-organization-slug": organizationSlug },
    });
    const approve = await fetch(`/api/demo/catalog/connections/${connection.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-organization-slug": organizationSlug },
      body: JSON.stringify({}),
    });
    const imported = await fetch(`/api/demo/catalog/connections/${connection.id}/import`, {
      method: "POST",
      headers: { "x-demo-organization-slug": organizationSlug },
    });
    const dryRun = await fetch(`/api/demo/catalog/connections/${connection.id}/sync-dry-run`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-organization-slug": organizationSlug },
      body: JSON.stringify({ entityType: "PRODUCT" }),
    });
    setCatalogPreview({
      preview: previewPayload,
      mappings: await mappings.json(),
      approval: await approve.json(),
      import: await imported.json(),
      syncDryRun: await dryRun.json(),
    });
    setMessage("کاتالوگ بیرونی به‌صورت mock بررسی، تأیید و به داده‌های BazarBaaz تبدیل شد؛ هیچ سیستم بیرونی تغییر نکرد.");
    await loadDashboard();
  }

  async function resetDemo() {
    await fetch(`/api/public/demo/${organizationSlug}/session`, { method: "DELETE" });
    window.location.href = "/fa/demo";
  }

  return (
    <div className="bg-muted/20">
      <div className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary">Demo Universe</Badge>
            <h1 className="mt-3 text-3xl font-black">You are experiencing BazarBaaz as: {roleExperience.label}</h1>
            <p className="mt-2 text-sm text-muted-foreground">سازمان: {organizationSlug}</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{roleExperience.explanation}</p>
          </div>
          <Button variant="outline" onClick={resetDemo}>خروج و شروع دوباره</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.keys(ROLE_ENDPOINT).map((nextRole) => (
            <button
              key={nextRole}
              type="button"
              onClick={async () => {
                const demoRole = nextRole as DemoRole;
                const response = await fetch(`/api/public/demo/${organizationSlug}/session`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ role: demoRole }),
                });
                if (!response.ok) {
                  setMessage("ساخت سشن برای این نقش مجاز نیست.");
                  return;
                }
                setRole(demoRole);
              }}
              className={`rounded-md border p-3 text-sm ${role === nextRole ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
              aria-pressed={role === nextRole}
            >
              {ROLE_TITLES[nextRole as DemoRole]}
            </button>
          ))}
        </div>

        {message ? <div className="rounded-xl border bg-background p-4 text-sm">{message}</div> : null}

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-6">
            <Card className="p-5">
              <h2 className="text-lg font-black">Role Experience</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {roleExperience.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline">{capability}</Badge>
                ))}
              </div>
              <div className="mt-5 grid gap-2">
                {roleExperience.suggestedActions.map((action) => (
                  <div key={action} className="rounded-md border bg-background px-3 py-2 text-sm">{action}</div>
                ))}
              </div>
            </Card>

            {journeySteps.length ? (
              <DemoProgressTimeline steps={journeySteps} />
            ) : null}

            <Card className="p-6">
              <h2 className="text-xl font-bold">وضعیت نقش</h2>
              <pre className="mt-4 max-h-[420px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-4 text-xs leading-6 ltr:text-left">
                {JSON.stringify(payload ?? { status: "empty" }, null, 2)}
              </pre>
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            <DemoPresentationPanels panels={presentationPanels} />

            <Card className="p-6">
              <h2 className="text-xl font-bold">{scenario?.title ?? "سناریوی هدایت‌شده"}</h2>
              {scenario?.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{scenario.description}</p>
              ) : null}
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                {(scenario?.steps ?? []).map((step, index) => (
                  <li key={step.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>{index + 1}. {step.title}</span>
                      {step.completedAt ? <Badge variant="secondary">انجام شد</Badge> : <Badge variant="outline">{step.role}</Badge>}
                    </div>
                    {step.description ? <p className="mt-2 leading-6">{step.description}</p> : null}
                  </li>
                ))}
              </ol>
              <Button className="mt-5 w-full" onClick={createOrder}>ساخت سفارش نمایشی</Button>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold">اتصال کاتالوگ بیرونی</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                نمونه اتصال SnappFood/EZY به صورت mock فقط پیش‌نمایش import می‌سازد و محصول واقعی را تغییر نمی‌دهد.
              </p>
              <Button className="mt-5 w-full" variant="outline" onClick={catalogAnalyze}>تحلیل منوی بیرونی</Button>
              {catalogPreview ? (
                <pre className="mt-4 max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-xs">
                  {JSON.stringify(catalogPreview, null, 2)}
                </pre>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
