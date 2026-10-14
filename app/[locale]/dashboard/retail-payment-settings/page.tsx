import { RetailPaymentSettings } from "@/components/dashboard/retail-payment-settings";

export default async function RetailPaymentSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RetailPaymentSettings locale={locale === "en" ? "en" : "fa"} />;
}
