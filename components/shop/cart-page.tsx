"use client";

import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { getCartItemUnitPrice, useCart } from "@/lib/contexts/cart-context";
import { useShopRoutePaths } from "@/lib/contexts/shop-route-context";
import { formatToman, toPersianDigits } from "@/lib/persian";
import { buttonVariants } from "@/components/ui/button";

const fallbackRoutes = {
  productsHref: "/shop",
  checkoutHref: "/shop/checkout",
  orderHref: () => "/shop",
};

export function CartPage() {
  const { cart, isLoading, summary } = useCart();
  const { productsHref, checkoutHref } = useShopRoutePaths(fallbackRoutes);

  if (isLoading && !cart) {
    return <p className="container py-12 text-center text-muted-foreground">در حال بارگذاری سبد خرید…</p>;
  }

  return (
    <section className="container max-w-3xl space-y-6 py-8" aria-labelledby="cart-title">
      <div className="flex items-center justify-between gap-4">
        <h1 id="cart-title" className="text-2xl font-bold">سبد خرید</h1>
        <span className="text-sm text-muted-foreground">{toPersianDigits(summary.itemCount)} آیتم</span>
      </div>

      {!cart?.items.length ? (
        <div className="rounded-xl border p-10 text-center">
          <ShoppingBasket className="mx-auto mb-4 size-12 text-muted-foreground" aria-hidden="true" />
          <p className="mb-5 text-muted-foreground">سبد خرید شما خالی است.</p>
          <Link className={buttonVariants()} href={productsHref}>مشاهده محصولات</Link>
        </div>
      ) : (
        <>
          <ul className="divide-y rounded-xl border">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{item.variant.product.name}</p>
                  {item.variant.name ? <p className="text-sm text-muted-foreground">{item.variant.name}</p> : null}
                  <p className="text-sm text-muted-foreground">تعداد: {toPersianDigits(item.quantity)}</p>
                </div>
                <p className="font-medium">{formatToman(getCartItemUnitPrice(item) * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-xl border p-4 text-lg font-semibold">
            <span>جمع</span><span>{formatToman(summary.subtotal)}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Link className={buttonVariants({ variant: "outline" })} href={productsHref}>ادامه خرید</Link>
            <Link className={buttonVariants()} href={checkoutHref}>ادامه و ثبت سفارش</Link>
          </div>
        </>
      )}
    </section>
  );
}
