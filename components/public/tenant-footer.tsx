import Link from "next/link";
import { ExternalLink, Home, Mail, MapPin, Phone, ShoppingCart } from "lucide-react";

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

function cleanOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function telHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function mailHref(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : null;
}

export function TenantFooter({ footer }: { footer: TenantFooterViewModel }) {
  const description = cleanOptional(footer.description);
  const address = cleanOptional(footer.address);
  const phone = cleanOptional(footer.phone);
  const email = cleanOptional(footer.email);
  const logo = cleanOptional(footer.logo);
  const phoneHref = phone ? telHref(phone) : null;
  const emailHref = email ? mailHref(email) : null;
  const isShop = footer.kind === "shop";

  return (
    <footer className="border-t bg-background py-10 pb-24 md:pb-10" aria-label={footer.name}>
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.7fr)_minmax(220px,0.9fr)]">
          <section className="space-y-4" aria-label={footer.name}>
            <Link href={footer.homeHref} className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {logo ? (
                <img src={logo} alt={`${footer.name} logo`} className="h-12 w-12 rounded-md object-cover ring-1 ring-border" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  {initials(footer.name)}
                </span>
              )}
              <span className="text-lg font-semibold text-foreground">{footer.name}</span>
            </Link>
            {description ? (
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
            ) : null}
            <a
              href={footer.poweredByHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Powered by Bazar Baz
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </section>

          <nav className="space-y-3 text-sm" aria-label={isShop ? "Shop footer navigation" : "Organization footer navigation"}>
            <p className="font-medium text-foreground">{isShop ? "Shop" : "Organization"}</p>
            <Link href={footer.homeHref} className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
              <Home className="h-4 w-4" aria-hidden="true" />
              {isShop ? "Menu" : "Profile"}
            </Link>
            {footer.profileHref ? (
              <Link href={footer.profileHref} className="block text-muted-foreground transition-colors hover:text-foreground">
                Profile
              </Link>
            ) : null}
            {footer.servicesHref ? (
              <Link href={footer.servicesHref} className="block text-muted-foreground transition-colors hover:text-foreground">
                Services
              </Link>
            ) : null}
            {footer.bookingHref ? (
              <Link href={footer.bookingHref} className="block text-muted-foreground transition-colors hover:text-foreground">
                Booking
              </Link>
            ) : null}
            {footer.cartHref ? (
              <Link href={footer.cartHref} className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Cart
              </Link>
            ) : null}
          </nav>

          <section className="space-y-3 text-sm" aria-label={`${footer.name} contact`}>
            <p className="font-medium text-foreground">Contact</p>
            {address ? (
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{address}</span>
              </p>
            ) : null}
            {phone && phoneHref ? (
              <a href={phoneHref} className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>{phone}</span>
              </a>
            ) : null}
            {email && emailHref ? (
              <a href={emailHref} className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>{email}</span>
              </a>
            ) : null}
          </section>
        </div>
      </div>
    </footer>
  );
}
