import type { Metadata } from "next";
import RetailCheckoutClient from "@/components/retail/checkout-client";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function CartPage({ params }: { params: Promise<{ locale: string; organization: string }> }) {
  const { locale, organization } = await params;
  return <RetailCheckoutClient locale={locale} organization={organization} cartOnly />;
}
