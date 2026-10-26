import Link from "next/link";
import { BazarbaazLogo } from "@/components/brand/BazarbaazLogo";

type PlatformFooterProps = {
  locale: string;
  platformName: string;
};

const footerCopy = {
  fa: { demos: "نمونه‌ها", contact: "تماس", privacy: "حریم خصوصی", terms: "شرایط استفاده", seal: "نشان اعتماد بازارباز" },
  en: { demos: "Examples", contact: "Contact", privacy: "Privacy", terms: "Terms", seal: "Bazarbaaz trust seal" },
  ar: { demos: "النماذج", contact: "اتصل بنا", privacy: "الخصوصية", terms: "الشروط", seal: "شارة الثقة لبازارباز" },
} as const;

export function PlatformFooter({ locale, platformName }: PlatformFooterProps) {
  const language = locale in footerCopy ? locale as keyof typeof footerCopy : "fa";
  const copy = footerCopy[language];
  const basePath = `/${locale}`;

  return (
    <footer className="mt-12 bg-muted/50 py-8" aria-label={platformName}>
      <div className="container mx-auto flex flex-col items-center justify-between gap-5 px-4 md:flex-row">
        <Link href={basePath} className="flex items-center gap-2 text-primary transition-colors hover:text-primary/80">
          <BazarbaazLogo variant="mark" theme="auto" width={24} height={24} decorative />
          <span className="text-lg font-bold">{platformName}</span>
        </Link>

        <nav aria-label={platformName} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href={`${basePath}#examples`} className="transition-colors hover:text-foreground">{copy.demos}</Link>
          <Link href={`${basePath}/contact`} className="transition-colors hover:text-foreground">{copy.contact}</Link>
          <Link href={`${basePath}/privacy`} className="transition-colors hover:text-foreground">{copy.privacy}</Link>
          <Link href={`${basePath}/terms`} className="transition-colors hover:text-foreground">{copy.terms}</Link>
        </nav>

        <a
          referrerPolicy="origin"
          target="_blank"
          rel="noopener noreferrer"
          href="https://trustseal.enamad.ir/?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7"
          aria-label={copy.seal}
        >
          <img
            referrerPolicy="origin"
            src="https://trustseal.enamad.ir/logo.aspx?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7"
            alt=""
            className="cursor-pointer"
            slot="PIS9oHglTwxwasymJaZx3w3cO1wbPvA7"
          />
        </a>
      </div>
    </footer>
  );
}
