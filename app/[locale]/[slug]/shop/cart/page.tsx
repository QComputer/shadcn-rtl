import type { Metadata } from "next";
import { CartPage } from "@/components/shop/cart-page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ShopCartPage() {
  return <CartPage />;
}
