import { TenantBrand } from "./tenant-brand";
import { TenantInformation } from "./tenant-information";

export type TenantFooterKind = "shop" | "service";

export type TenantFooterViewModel = {
  kind: TenantFooterKind;
  locale: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  homeHref: string;
  cartHref?: string | null;
  profileHref?: string | null;
  servicesHref?: string | null;
  bookingHref?: string | null;
  poweredByHref: string;
};


export function TenantFooter({ footer }: { footer: TenantFooterViewModel }) {
  const labels = footer.locale === "en" ? { about: "About us", contact: "Contact us" }
    : footer.locale === "ar" ? { about: "من نحن", contact: "اتصل بنا" }
    : { about: "دربارهٔ ما", contact: "تماس با ما" };
  const information = { locale: footer.locale, name: footer.name, description: footer.description, address: footer.address, phone: footer.phone, email: footer.email };
  return <footer dir={footer.locale === "en" ? "ltr" : "rtl"} className="border-t border-border bg-background py-6 pb-24 text-foreground lg:pb-6" aria-label={footer.name}>
    <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:gap-6">
      <TenantBrand name={footer.name} logo={footer.logo} href={footer.homeHref} />
      <nav aria-label={footer.locale === "en" ? "About and contact" : footer.locale === "ar" ? "من نحن والتواصل" : "درباره و تماس"} className="flex items-center gap-2 text-sm">
        <TenantInformation {...information} kind="about"><button type="button" className="min-h-11 rounded-xl px-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{labels.about}</button></TenantInformation>
        <TenantInformation {...information} kind="contact"><button type="button" className="min-h-11 rounded-xl px-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{labels.contact}</button></TenantInformation>
      </nav>
    </div>
  </footer>;
}
