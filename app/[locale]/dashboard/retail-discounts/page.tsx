import { RetailDiscountManager } from "@/components/dashboard/retail-discount-manager";

type PageProps = { params: Promise<{ locale: string }> };

export default async function RetailDiscountsPage({ params }: PageProps) {
  const { locale } = await params;
  return <RetailDiscountManager locale={locale === "en" || locale === "ar" ? locale : "fa"} />;
}
