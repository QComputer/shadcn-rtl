import { RetailPaymentReports } from "@/components/dashboard/retail-payment-reports";

export default async function RetailPaymentReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RetailPaymentReports locale={locale === "en" ? "en" : "fa"} />;
}
