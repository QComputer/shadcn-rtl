import Link from "next/link";
import { Building2 } from "lucide-react";

type PlatformFooterProps = {
  locale: string;
  platformName: string;
};

export function PlatformFooter({ locale, platformName }: PlatformFooterProps) {
  return (
    <footer className="bg-muted/50 py-12 mt-12" aria-label={platformName}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
              <span className="font-bold text-lg">{platformName}</span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href={`/${locale}/features`} className="hover:text-foreground transition-colors">امکانات</Link>
            <Link href={`/${locale}/dashboard-showcase`} className="hover:text-foreground transition-colors">داشبورد</Link>
            <Link href={`/${locale}/demo`} className="hover:text-foreground transition-colors">نمونه‌ها</Link>
            <Link href={`/${locale}/onboarding`} className="hover:text-foreground transition-colors">ویزارد راه‌اندازی</Link>
            <Link href={`/${locale}/pricing`} className="hover:text-foreground transition-colors">تعرفه‌ها</Link>
            <Link href={`/${locale}/contact`} className="hover:text-foreground transition-colors">تماس</Link>
            <Link href={`/${locale}/request-demo`} className="hover:text-foreground transition-colors">درخواست دمو</Link>
            <Link href={`/${locale}/trust`} className="hover:text-foreground transition-colors">اعتماد</Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors">حریم خصوصی</Link>
            <Link href={`/${locale}/terms`} className="hover:text-foreground transition-colors">شرایط استفاده</Link>
          </div>
          <div className="flex items-center gap-4">
            <a
              referrerPolicy="origin"
              target="_blank"
              rel="noopener noreferrer"
              href="https://trustseal.enamad.ir/?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7"
              aria-label="Bazar Baz trust seal"
            >
              <img
                referrerPolicy="origin"
                src="https://trustseal.enamad.ir/logo.aspx?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7"
                alt=""
                className="cursor-pointer"
                slot="PIS9oHglTwxwasymJaZx3w3cO1wbPvA7"
              />
            </a>
            <p className="text-sm text-muted-foreground">بازار باز</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
