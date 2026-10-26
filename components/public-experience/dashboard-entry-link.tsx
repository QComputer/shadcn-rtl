"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function DashboardEntryLink({ locale }: { locale: string }) {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const labels = locale === "en" ? ["Sign in to dashboard", "My dashboard"] : locale === "ar" ? ["الدخول إلى لوحة التحكم", "لوحة التحكم"] : ["ورود به داشبورد", "داشبورد من"];
  const dashboard = `/${locale}/dashboard`;
  return <Link href={authenticated ? dashboard : `/${locale}/login?callbackUrl=${encodeURIComponent(dashboard)}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-accent">{labels[authenticated ? 1 : 0]}</Link>;
}
