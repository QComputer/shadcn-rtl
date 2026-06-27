import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Checkout | Bazar Baz",
  "Checkout pages are private transaction surfaces and are not intended for search indexing.",
);

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
