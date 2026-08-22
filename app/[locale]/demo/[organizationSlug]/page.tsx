import { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DemoShellClient } from "@/components/demo-universe/demo-shell-client";
import { getPublicDemoShowcaseBySlug } from "@/lib/demo-universe/demo-public.service";
import { DEMO_ROLE_LABELS } from "@/lib/public-experience/types";

type DemoRole = "PLATFORM_ADMIN" | "ORGANIZATION_OWNER" | "MANAGER" | "STAFF" | "DRIVER" | "CUSTOMER";

export const metadata: Metadata = {
  title: "اجرای دموی تعاملی بازارباز",
  description: "پوسته ایزوله برای اجرای نقش‌های مختلف در دمو بازارباز.",
};

function normalizeRole(role: string | string[] | undefined): DemoRole {
  const value = Array.isArray(role) ? role[0] : role;
  if (
    value === "PLATFORM_ADMIN" ||
    value === "ORGANIZATION_OWNER" ||
    value === "MANAGER" ||
    value === "STAFF" ||
    value === "DRIVER" ||
    value === "CUSTOMER"
  ) {
    return value;
  }
  return "CUSTOMER";
}

export default async function DemoShellPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationSlug: string }>;
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const [{ locale, organizationSlug }, query] = await Promise.all([params, searchParams]);
  const showcase = await getPublicDemoShowcaseBySlug(organizationSlug);
  return (
    <div className="min-h-screen bg-muted/20">
      {showcase ? (
        <section className="border-b bg-background">
          <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[1fr_.8fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Demo Universe</Badge>
                <Badge variant="outline">{showcase.industryLabel}</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-black md:text-4xl">{showcase.organization.name}</h1>
                <p className="mt-3 max-w-3xl text-base leading-8 text-muted-foreground">{showcase.tagline}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {showcase.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline">{capability}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/${locale}/demo`} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                  انتخاب سناریوی دیگر
                </Link>
                <a href="#demo-workbench" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  ورود به میز کار دمو
                </a>
              </div>
            </div>

            <Card className="p-5">
              <h2 className="text-lg font-bold">چه چیزی را تجربه می‌کنید؟</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                {showcase.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                {showcase.artifacts.map((artifact) => (
                  <Badge key={artifact} variant="secondary">{artifact}</Badge>
                ))}
              </div>
            </Card>
          </div>

          <div className="container mx-auto grid gap-4 px-4 pb-8 md:grid-cols-2 xl:grid-cols-4">
            {showcase.roleExperiences.map((experience) => (
              <Card key={experience.role} className="p-4">
                <Badge variant="outline">{DEMO_ROLE_LABELS[experience.role]}</Badge>
                <h3 className="mt-3 font-bold">{experience.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{experience.description}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div id="demo-workbench">
        <DemoShellClient
          organizationSlug={organizationSlug}
          initialRole={normalizeRole(query.role)}
        />
      </div>
    </div>
  );
}
