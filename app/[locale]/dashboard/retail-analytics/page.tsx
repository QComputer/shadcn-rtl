import { RetailAnalytics } from "@/components/dashboard/retail-analytics";

type Search = Record<string, string | string[] | undefined>;

export default async function RetailAnalyticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const [{ locale }, values] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") query.set(key, value);
  return <RetailAnalytics locale={locale === "en" ? "en" : "fa"} initialQuery={query.toString()} />;
}
