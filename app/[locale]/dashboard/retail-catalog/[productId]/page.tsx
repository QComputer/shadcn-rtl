import { RetailProductEditor } from "@/components/dashboard/retail-product-editor";

type PageProps = { params: Promise<{ locale: string; productId: string }> };

export default async function EditRetailProductPage({ params }: PageProps) {
  const { locale, productId } = await params;
  const supportedLocale = locale === "en" || locale === "ar" ? locale : "fa";
  return <RetailProductEditor locale={supportedLocale} productId={productId} />;
}
