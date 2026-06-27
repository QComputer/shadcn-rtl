import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "My Appointments | Bazar Baz",
  "Appointment lookup pages can expose customer-specific booking state and are not intended for search indexing.",
);

export default function MyAppointmentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
