import { redirect } from "next/navigation";
import { MessageSquareReply, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { getOwnerReviewsSummary } from "@/lib/customer-reputation/customer-reputation.service";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ locale: string }> };

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export default async function ReputationDashboardPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/reputation`)}`);
  if (!session.user.organizationId && session.user.role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);
  const organizationId = session.user.organizationId;
  if (!organizationId) redirect(`/${locale}/dashboard/organizations`);

  const summary = await getOwnerReviewsSummary({ organizationId });
  const isRtl = locale === "fa" || locale === "ar";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6" dir={isRtl ? "rtl" : "ltr"}>
      <header className="space-y-2 border-b pb-5">
        <Badge variant="secondary">Reputation</Badge>
        <h1 className="text-2xl font-semibold">Business Reputation</h1>
        <p className="text-sm text-muted-foreground">{summary.organization.name}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Score" value={`${summary.reputationScore}/100`} />
        <Metric label="Average rating" value={String(summary.factors.averageRating)} />
        <Metric label="Verified reviews" value={String(summary.factors.verifiedReviewCount)} />
        <Metric label="Response rate" value={`${Math.round(summary.factors.responseRate * 100)}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.publicReviews.length ? summary.publicReviews.map((review) => (
              <article key={review.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: review.rating }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}
                  </div>
                  <Badge variant="outline">{review.verifiedInteraction ? "Verified" : "Unverified"}</Badge>
                </div>
                {review.title && <p className="font-medium">{review.title}</p>}
                {review.text && <p className="text-sm leading-6 text-muted-foreground">"{review.text}"</p>}
                {review.businessResponse && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <MessageSquareReply className="mb-1 h-4 w-4" />
                    {review.businessResponse.text}
                  </div>
                )}
              </article>
            )) : <p className="text-sm text-muted-foreground">No approved reviews yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Pending responses: {summary.ownerActions.pendingResponses}</p>
            <p>Open review requests: {summary.ownerActions.openReviewRequests}</p>
            <p>Trend: {summary.trend.direction}</p>
            <p>Review topics: {summary.reviewTopics.status}</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
