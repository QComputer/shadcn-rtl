import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Appointment Status | Bazarbaaz",
  "Appointment status pages can include customer booking details and are not intended for search indexing.",
);

export default function AppointmentStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
