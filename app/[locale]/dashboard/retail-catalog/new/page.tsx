import { RetailProductEditor } from "@/components/dashboard/retail-product-editor";

type PageProps = { params: Promise<{ locale: string }> };

export default async function NewRetailProductPage({ params }: PageProps) {
  const { locale } = await params;
  const supportedLocale = locale === "en" || locale === "ar" ? locale : "fa";
  return <RetailProductEditor locale={supportedLocale} />;
}
