import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Order Status | Bazar Baz",
  "Order status pages can include customer transaction details and are not intended for search indexing.",
);

export default function OrderStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
