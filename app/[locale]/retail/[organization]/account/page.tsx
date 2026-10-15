import ShopProfilePage from "@/app/[locale]/[slug]/shop/profile/page";
import { ShopRouteProvider } from "@/lib/contexts/shop-route-context";

export const dynamic = "force-dynamic";

export default async function RetailCustomerAccount({ params }: { params: Promise<{ locale: string; organization: string }> }) {
  const { locale, organization } = await params;
  const storefront = `/${encodeURIComponent(locale)}/retail/${encodeURIComponent(organization)}`;
  return <ShopRouteProvider value={{
    productsHref: storefront,
    checkoutHref: `${storefront}/checkout`,
    orderHrefPrefix: `/${encodeURIComponent(locale)}/${encodeURIComponent(organization)}/shop/order/`,
  }}><ShopProfilePage params={Promise.resolve({ locale, slug: organization })} /></ShopRouteProvider>;
}
