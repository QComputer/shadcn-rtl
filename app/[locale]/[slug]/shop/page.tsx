import ShopContent from "./shop-content";

export const dynamic = "force-dynamic";

export default async function ShopPage({ params }: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  return <ShopContent params={params} />;
}
