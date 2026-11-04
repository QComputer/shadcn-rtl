import type { ReactNode } from "react";
import { ShopLayoutContent, generateMetadata, generateViewport } from "./shop-layout-content";

export { generateMetadata, generateViewport };

type ShopLayoutRouteProps = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default function ShopLayout(props: ShopLayoutRouteProps) {
  return <ShopLayoutContent {...props} />;
}
