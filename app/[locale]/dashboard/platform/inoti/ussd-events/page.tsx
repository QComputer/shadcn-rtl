import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { INOTI_PLATFORM_ORGANIZATION_SLUG } from "@/lib/integrations/inoti-ussd/credentials";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function PlatformInotiUssdEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/platform/inoti/ussd-events`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  const platformOrganization = await prisma.organization.findFirst({
    where: {
      slug: INOTI_PLATFORM_ORGANIZATION_SLUG,
      isPlatformOwner: true,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!platformOrganization) {
    redirect(`/${locale}/dashboard/organizations`);
  }

  const events = await prisma.ussdEvent.findMany({
    where: { organizationId: platformOrganization.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      publicId: true,
      sessionIdHash: true,
      eventType: true,
      metadata: true,
      createdAt: true,
      integration: {
        select: {
          id: true,
          publicId: true,
          provider: true,
          status: true,
          codeName: true,
          organization: {
            select: { slug: true, name: true },
          },
        },
      },
    },
  });

  const sanitized = events.map((event) => ({
    ...event,
    metadata: sanitizeMetadata(event.metadata),
  }));

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <header className="border-b pb-5">
        <h1 className="text-2xl font-semibold">Observability USSD</h1>
        <p className="text-sm text-muted-foreground">Recent iNoti USSD events · read-only</p>
      </header>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-right">Created</th>
              <th className="px-4 py-2 text-right">Event</th>
              <th className="px-4 py-2 text-right">Session</th>
              <th className="px-4 py-2 text-right">Integration</th>
              <th className="px-4 py-2 text-right">Organization</th>
              <th className="px-4 py-2 text-right">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {sanitized.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No events recorded yet.</td>
              </tr>
            )}
            {sanitized.map((event) => (
              <tr key={event.id} className="border-t">
                <td className="px-4 py-2 text-xs text-muted-foreground">{event.createdAt.toISOString()}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{event.eventType}</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{event.sessionIdHash.slice(0, 16)}…</td>
                <td className="px-4 py-2 text-xs">
                  {event.integration ? `${event.integration.provider}:${event.integration.codeName ?? event.integration.publicId?.slice(0, 8)}` : "—"}
                </td>
                <td className="px-4 py-2 text-xs">{event.integration?.organization?.slug ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {event.metadata && Object.keys(event.metadata).length > 0 ? JSON.stringify(event.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function sanitizeMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (key === "password" || key === "token" || key === "pepper" || key === "secret") continue;
    sanitized[key] = value;
  }
  return sanitized;
}
