import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "پنل مدیریت - فروشگاه آنلاین",
  description: "پلتفرم تجارت الکترونیک و رزرو خدمات",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout should NOT redirect - middleware handles locale redirects
  // The [locale] layout will handle locale-specific rendering
  return (
    // This is a minimal root layout
    // All actual content is rendered by app/[locale]/layout.tsx
    <>
      {children}
    </>
  );
}
