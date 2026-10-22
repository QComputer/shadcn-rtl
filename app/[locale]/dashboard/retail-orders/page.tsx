import { MerchantOrders } from "@/components/retail/merchant-orders";

export default async function RetailOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <MerchantOrders locale={locale === "en" ? "en" : "fa"} />;
}
