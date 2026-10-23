import type { Metadata } from "next";
import { discoveryMetadata, ProductDiscoveryPage } from "@/components/retail/product-discovery-page";

type Params = { locale: string; slug: string };
type Props = { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const dynamic = "force-dynamic";

async function pageProps({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  return { locale, organization: slug, searchParams };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return discoveryMetadata(await pageProps(props));
}

export default async function ShopDiscoveryRoute(props: Props) {
  return ProductDiscoveryPage(await pageProps(props));
}
