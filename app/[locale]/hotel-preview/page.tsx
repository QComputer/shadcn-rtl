import { notFound } from "next/navigation";
import { DamoonHome } from "@/components/damoon-home";

/** Concept-only preview; production access requires an explicit local opt-in. */
export default async function HotelPreviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.F2D_LOCAL_PREVIEW_ENABLED !== "1") notFound();
  return <DamoonHome />;
}
