import type { ReactNode } from "react";
import { ShopLayoutContent, generateMetadata } from "./shop-layout-content";

export { generateMetadata };

type ShopLayoutRouteProps = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default function ShopLayout(props: ShopLayoutRouteProps) {
  return <ShopLayoutContent {...props} />;
}
