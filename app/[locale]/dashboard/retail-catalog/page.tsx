import { RetailCatalogManager } from "@/components/dashboard/retail-catalog-manager";

type PageProps = { params: Promise<{ locale: string }> };

export default async function RetailCatalogPage({ params }: PageProps) {
  const { locale } = await params;
  const supportedLocale = locale === "en" || locale === "ar" ? locale : "fa";
  return <RetailCatalogManager locale={supportedLocale} />;
}
