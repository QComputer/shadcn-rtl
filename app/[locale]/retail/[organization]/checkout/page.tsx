import RetailCheckoutClient from "@/components/retail/checkout-client";

export default async function RetailCheckoutPage({ params }: { params: Promise<{ locale: string; organization: string }> }) {
  const { locale, organization } = await params;
  return <RetailCheckoutClient locale={locale} organization={organization} />;
}
