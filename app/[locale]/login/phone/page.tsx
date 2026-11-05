import { CustomerPhoneLogin } from "@/components/auth/customer-phone-login";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organization?: string | string[]; callbackUrl?: string | string[] }>;
};

export default async function CustomerPhoneLoginPage({ params, searchParams }: PageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  let organizationHint = typeof query.organization === "string" ? query.organization : undefined;
  let callbackUrl: string | undefined;
  if (typeof query.callbackUrl === "string" && query.callbackUrl.startsWith("/") && !query.callbackUrl.startsWith("//") && !query.callbackUrl.includes("\\")) {
    try {
      const parsedCallback = new URL(query.callbackUrl, "https://same-origin.invalid");
      if (!parsedCallback.searchParams.has("token") && !parsedCallback.hash.toLowerCase().includes("token=")) callbackUrl = query.callbackUrl;
    } catch { /* ignore malformed callback context */ }
  }
  if (!organizationHint && callbackUrl) {
    try { organizationHint = new URL(callbackUrl, "https://same-origin.invalid").searchParams.get("organization") ?? undefined; } catch { /* ignore malformed callback context */ }
  }
  return <CustomerPhoneLogin locale={locale} organizationHint={organizationHint} callbackUrl={callbackUrl} />;
}
