"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useShopRoutePaths } from "@/lib/contexts/shop-route-context";
import { buildShopProductsPath, buildShopCheckoutPath, buildShopOrderPath } from "@/lib/shop-public-paths";
import type { CartDrawerProps } from "@/components/shop/cart-drawer";
const Cart = dynamic(()=>import("./checkout-client"),{loading:()=> <p role="status" className="p-6 text-sm">در حال دریافت سبد…</p>});
export function RetailCartDrawer({organizationSlug,locale="fa",trigger,children,open,onOpenChange}:CartDrawerProps){
  const [internal,setInternal]=useState(false);const active=open??internal;
  const paths=useShopRoutePaths({productsHref:buildShopProductsPath({locale,shopSlug:organizationSlug}),checkoutHref:buildShopCheckoutPath({locale,shopSlug:organizationSlug}),orderHref:n=>buildShopOrderPath({locale,shopSlug:organizationSlug,orderNumber:n})});
  return <Sheet open={active} onOpenChange={value=>{setInternal(value);onOpenChange?.(value);}}><SheetTrigger asChild>{children??trigger??<button type="button" aria-label="سبد خرید" className="grid size-11 place-items-center rounded-xl border"><ShoppingBag className="size-5" /></button>}</SheetTrigger><SheetContent dir="rtl" className="flex w-full flex-col gap-0 overflow-y-auto bg-[#fcfbf8] p-0 sm:max-w-xl"><SheetHeader className="border-b border-stone-200 px-5 py-5"><SheetTitle className="text-sm">سبد خرید فروشگاه</SheetTitle></SheetHeader>{active&&<Cart locale={locale} organization={organizationSlug} storefrontPath={paths.productsHref} checkoutPath={paths.checkoutHref} embedded cartOnly drawer />}</SheetContent></Sheet>;
}
