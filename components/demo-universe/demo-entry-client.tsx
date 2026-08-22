"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startPublicDemoSession } from "@/lib/public-experience/demo-session-client";
import type { DemoRole } from "@/lib/public-experience/types";

type DemoOrganization = {
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  capabilities: string[];
  demoRoles: DemoRole[];
  integrations: Record<string, { ready: boolean; integrationConfigured: boolean }>;
};

const ROLE_LABELS: Record<DemoRole, string> = {
  PLATFORM_ADMIN: "مدیر پلتفرم",
  ORGANIZATION_OWNER: "مالک کسب‌وکار",
  MANAGER: "مدیر",
  STAFF: "کارمند",
  DRIVER: "راننده",
  CUSTOMER: "مشتری",
};

export function DemoEntryClient({ locale }: { locale: string }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<DemoOrganization[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedRole, setSelectedRole] = useState<DemoRole>("CUSTOMER");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/demo-organizations")
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const nextOrganizations = payload.organizations ?? [];
        setOrganizations(nextOrganizations);
        setSelectedSlug(nextOrganizations[0]?.slug ?? "");
        setSelectedRole(nextOrganizations[0]?.demoRoles?.[0] ?? "CUSTOMER");
      })
      .catch(() => setError("خطا در دریافت دموها"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.slug === selectedSlug) ?? organizations[0],
    [organizations, selectedSlug],
  );

  const effectiveRole = selectedOrganization?.demoRoles.includes(selectedRole)
    ? selectedRole
    : selectedOrganization?.demoRoles[0] ?? "CUSTOMER";

  async function startDemo() {
    if (!selectedOrganization) return;
    setStarting(true);
    setError(null);
    try {
      await startPublicDemoSession({ organizationSlug: selectedOrganization.slug, role: effectiveRole });
    } catch {
      setError("شروع دمو ناموفق بود");
      setStarting(false);
      return;
    }
    router.push(`/${locale}/demo/${selectedOrganization.slug}?role=${effectiveRole}`);
  }

  return (
    <div className="space-y-8">
      {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}
      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">در حال آماده‌سازی دمو...</Card>
      ) : organizations.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">هنوز سازمان نمایشی فعال نشده است.</Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {organizations.map((organization) => (
              <button
                key={organization.slug}
                type="button"
                onClick={() => setSelectedSlug(organization.slug)}
                className={`rounded-2xl text-start transition ${selectedSlug === organization.slug ? "ring-2 ring-primary" : "ring-1 ring-border"}`}
              >
                <Card className="h-full p-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">{organization.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{organization.slug}</p>
                      </div>
                      <Badge variant="secondary">دموی زنده</Badge>
                    </div>
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {organization.description || "یک کسب‌وکار نمایشی برای تجربه گردش کامل بازارباز."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {organization.capabilities.slice(0, 5).map((capability) => (
                        <Badge key={capability} variant="outline" className="text-[10px]">{capability}</Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          <Card className="p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">نقش ورود به دمو</p>
                <h3 className="mt-2 text-2xl font-black">{selectedOrganization?.name}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  نقش مورد نظر را انتخاب کنید. سشن دمو با کوکی امن HttpOnly ساخته می‌شود و به همین سازمان محدود است.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedOrganization?.demoRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`rounded-xl border p-3 text-sm font-medium transition ${effectiveRole === role ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted"}`}
                    >
                      {ROLE_LABELS[role] ?? role}
                    </button>
                  ))}
                </div>
                <Button size="lg" className="w-full rounded-xl" onClick={startDemo} disabled={starting}>
                  {starting ? "در حال ورود..." : "شروع شبیه‌سازی کسب‌وکار"}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
