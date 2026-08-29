import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Booking | Bazarbaaz",
  "Booking forms are transactional appointment surfaces and are not intended for search indexing.",
);

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
