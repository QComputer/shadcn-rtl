import type { Metadata } from "next";
import { discoveryMetadata, ProductDiscoveryPage } from "@/components/retail/product-discovery-page";

type Params = { locale: string; organization: string };
type Props = { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const dynamic = "force-dynamic";

async function pageProps({ params, searchParams }: Props) {
  const { locale, organization } = await params;
  return { locale, organization, searchParams };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return discoveryMetadata(await pageProps(props));
}

export default async function PublicRetailDiscoveryRoute(props: Props) {
  return ProductDiscoveryPage(await pageProps(props));
}
