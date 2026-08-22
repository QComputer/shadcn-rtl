"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicImage } from "@/components/public/public-image";
import { startPublicDemoSession } from "@/lib/public-experience/demo-session-client";
import { DEMO_ROLE_LABELS, type DemoRole } from "@/lib/public-experience/types";
import type { PublicDemoJourneySummary, PublicDemoOrganizationSummary } from "@/lib/public-experience/homepage-view-model";

type DemoLauncherClientProps = {
  locale: string;
  organizations: PublicDemoOrganizationSummary[];
  journeys: PublicDemoJourneySummary[];
};

function firstRole(organization?: PublicDemoOrganizationSummary): DemoRole {
  return organization?.demoRoles?.[0] ?? "CUSTOMER";
}

export function DemoLauncherClient({ locale, organizations, journeys }: DemoLauncherClientProps) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState(organizations[0]?.slug ?? "");
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.slug === selectedSlug) ?? organizations[0],
    [organizations, selectedSlug],
  );
  const [selectedRole, setSelectedRole] = useState<DemoRole>(firstRole(selectedOrganization));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableRoles: DemoRole[] = selectedOrganization?.demoRoles?.length ? selectedOrganization.demoRoles : ["CUSTOMER"];
  const effectiveRole = availableRoles.includes(selectedRole) ? selectedRole : firstRole(selectedOrganization);
  const visibleJourneys = journeys.filter((journey) => availableRoles.includes(journey.role));
  const selectedShowcase = selectedOrganization?.showcase ?? null;
  const fallbackJourneys: PublicDemoJourneySummary[] = availableRoles.map((role, index) => ({
    key: role.toLowerCase(),
    title: DEMO_ROLE_LABELS[role],
    role,
    route: `/demo?role=${role}`,
    ordering: index,
  }));

  function selectOrganization(slug: string) {
    const organization = organizations.find((item) => item.slug === slug);
    setSelectedSlug(slug);
    setSelectedRole(firstRole(organization));
    setError(null);
  }

  async function startDemo() {
    if (!selectedOrganization) return;
    setStarting(true);
    setError(null);
    try {
      await startPublicDemoSession({ organizationSlug: selectedOrganization.slug, role: effectiveRole });
    } catch {
      setError("شروع دمو ناموفق بود. لطفا نقش یا کسب‌وکار دیگری را انتخاب کنید.");
      setStarting(false);
      return;
    }
    router.push(`/${locale}/demo/${selectedOrganization.slug}?role=${effectiveRole}`);
  }

  if (organizations.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        هنوز کسب‌وکار نمایشی فعال نشده است.
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        {organizations.slice(0, 4).map((organization) => (
          <button
            key={organization.slug}
            type="button"
            onClick={() => selectOrganization(organization.slug)}
            className={`rounded-lg text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selectedOrganization?.slug === organization.slug ? "ring-2 ring-primary" : "ring-1 ring-border"
            }`}
            aria-pressed={selectedOrganization?.slug === organization.slug}
          >
            <Card className="h-full overflow-hidden p-0">
              <PublicImage
                src={organization.coverImage}
                alt=""
                decorative
                kind="organization"
                className="h-24 w-full object-cover"
                fallbackClassName="h-24"
              />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold">{organization.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{organization.showcase?.industryLabel ?? organization.slug}</p>
                  </div>
                  <Badge variant="secondary">{organization.showcase ? "Showcase" : "Demo"}</Badge>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {organization.showcase?.tagline || organization.description || "یک سناریوی ایزوله برای تجربه جریان کامل بازارباز."}
                </p>
                {organization.showcase?.highlights?.length ? (
                  <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                    {organization.showcase.highlights.slice(0, 2).map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {organization.capabilities.slice(0, 4).map((capability) => (
                    <Badge key={capability} variant="outline" className="text-[10px]">{capability}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserRoundCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xl font-black">مسیر استفاده این کسب‌وکار از BazarBaaz</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {selectedShowcase?.tagline ?? "نقش انتخاب‌شده با API سشن دمو فعال می‌شود و فقط به همین کسب‌وکار نمایشی دسترسی دارد."}
            </p>
          </div>
        </div>

        {selectedShowcase ? (
          <div className="mt-5 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap gap-2">
              {selectedShowcase.artifacts.slice(0, 4).map((artifact) => (
                <Badge key={artifact} variant="outline">{artifact}</Badge>
              ))}
            </div>
            <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
              {selectedShowcase.storySteps.slice(0, 5).map((step, index) => (
                <li key={step.key} className="flex gap-2 leading-6">
                  <span className="font-bold text-foreground">{index + 1}</span>
                  <span>{step.title} — {step.businessValue}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2">
          {(visibleJourneys.length ? visibleJourneys : fallbackJourneys).map((journey) => (
            <button
              key={journey.role}
              type="button"
              onClick={() => {
                setSelectedRole(journey.role);
                setError(null);
              }}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                effectiveRole === journey.role ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted"
              }`}
              aria-pressed={effectiveRole === journey.role}
            >
              <span>{DEMO_ROLE_LABELS[journey.role] ?? journey.title}</span>
              <span className="text-xs text-muted-foreground">{journey.key}</span>
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        <Button size="lg" className="mt-5 w-full rounded-md" onClick={startDemo} disabled={starting}>
          <Play className="h-4 w-4" aria-hidden="true" />
          {starting ? "در حال ورود..." : "شروع دمو"}
        </Button>
      </Card>
    </div>
  );
}
