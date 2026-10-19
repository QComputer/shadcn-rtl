import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RetailPreview from "../../retail-preview";
import { phones, shoes, type RetailStore } from "../../retail-data";

const data = { fashion: shoes, electronics: phones };
type Params = { locale: string; store: string; product: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, product: id } = await params;
  if (store !== "fashion" && store !== "electronics") return {};
  const product = data[store].find(({ id: productId }) => productId === id);
  return product ? { title: `${product.title} | پیش‌نمایش ${store === "fashion" ? "بوتیک آکا" : "تک‌استور"}`, description: `${product.note} · اطلاعات نمونه پیش‌نمایش.` } : {};
}

export default async function RetailPreviewProductPage({ params }: { params: Promise<Params> }) {
  const { locale, store, product } = await params;
  if (locale !== "fa" || (store !== "fashion" && store !== "electronics") || !data[store].some(({ id }) => id === product)) notFound();
  return <RetailPreview store={store as RetailStore} productId={product} />;
}
