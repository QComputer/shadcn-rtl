import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false, noimageindex: true } } };
export default function WebsiteStudioLayout({ children }: { children: React.ReactNode }) { return children; }
