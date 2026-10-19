import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RetailPreview from "./retail-preview";

type Store = "fashion" | "electronics";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; store: string }> }): Promise<Metadata> {
  const { store } = await params;
  if (store !== "fashion" && store !== "electronics") return {};
  const label = store === "fashion" ? "بوتیک آکا | پیش‌نمایش فروشگاه مد" : "تک‌استور | پیش‌نمایش فروشگاه موبایل";
  return { title: label, description: "پیش‌نمایش نمایشی پلتفرم فروشگاه خرده‌فروشی بازارباز؛ اطلاعات این صفحه نمونه است." };
}

export default async function RetailPreviewPage({ params }: { params: Promise<{ locale: string; store: string }> }) {
  const { locale, store } = await params;
  if (locale !== "fa" || (store !== "fashion" && store !== "electronics")) notFound();
  return <RetailPreview store={store as Store} />;
}
