import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Instagram, MapPin, Phone, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/db";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";
import { resolveOrganizationBranding, type ResolvedOrganizationBranding } from "@/lib/organization-branding";
import { resolveOrganizationHomeContent, type OrganizationHomeContent } from "@/lib/organization-home-content";
import { TenantFooter } from "@/components/public/tenant-footer";

interface OrganizationBrandHomeProps { params: Promise<{ locale: string; slug: string }> }
type OrganizationContact = { name: string; description: string | null; address: string | null; phone: string | null; email: string | null };
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function EditorialHome({ locale, slug, isCustomDomain, content, branding, organization, hasShop }: {
  locale: string; slug: string; isCustomDomain: boolean; content: OrganizationHomeContent;
  branding: ResolvedOrganizationBranding; organization: OrganizationContact; hasShop: boolean;
}) {
  const rootHref = buildOrganizationRootPath({ locale, organizationSlug: slug, isCustomDomain });
  const shopHref = hasShop ? buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "shop", isCustomDomain }) : null;
  const phone = organization.phone?.trim() || content.contact.phoneFallback || null;
  const address = organization.address?.trim() || content.contact.addressFallback || null;
  const instagram = content.contact.instagramUrl || null;
  const themeStyle = { "--organization-home-accent": content.theme.accent, "--organization-home-background": content.theme.background } as CSSProperties;

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--organization-home-background)] text-stone-950" style={themeStyle}>
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f7f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-10">
          <Link href={rootHref} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--organization-home-accent)]">
            <Image src={branding.logo} alt={branding.displayName} width={190} height={64} priority className="h-9 w-auto object-contain sm:h-11" />
          </Link>
          <nav aria-label="پیمایش صفحه" className="hidden items-center gap-7 text-sm font-medium md:flex">
            {shopHref ? <Link href={shopHref} className="transition-colors hover:text-[var(--organization-home-accent)]">{content.header.shopLabel}</Link> : null}
            <a href="#collections" className="transition-colors hover:text-[var(--organization-home-accent)]">{content.header.collectionLabel}</a>
            <a href="#lookbook" className="transition-colors hover:text-[var(--organization-home-accent)]">{content.header.lookbookLabel}</a>
            <a href="#contact" className="transition-colors hover:text-[var(--organization-home-accent)]">{content.header.contactLabel}</a>
          </nav>
          {shopHref ? <Link href={shopHref} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-950 px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--organization-home-accent)] focus-visible:ring-offset-2"><ShoppingBag className="h-4 w-4" aria-hidden="true" /><span className="hidden min-[390px]:inline">{content.header.shopLabel}</span></Link> : null}
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1440px] items-stretch lg:min-h-[720px] lg:grid-cols-[0.9fr_1.1fr]" aria-labelledby="organization-home-title">
          <div className="order-2 flex items-center px-5 py-12 sm:px-8 sm:py-16 lg:order-1 lg:px-14 xl:px-20">
            <div className="max-w-xl">
              <p className="mb-5 text-xs font-bold tracking-[0.25em] text-[var(--organization-home-accent)] sm:text-sm">{content.hero.eyebrow}</p>
              <h1 id="organization-home-title" className="text-balance text-3xl font-black leading-[1.25] tracking-tight sm:text-4xl lg:text-5xl">{content.hero.title}</h1>
              <p className="mt-7 text-4xl font-black leading-[1.2] text-[var(--organization-home-accent)] sm:text-5xl xl:text-6xl">{content.hero.statement}</p>
              <p className="mt-6 max-w-lg text-base leading-8 text-stone-600 sm:text-lg">{content.hero.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {shopHref ? <Link href={shopHref} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--organization-home-accent)] px-6 font-bold text-white shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2">{content.hero.primaryCta}<ArrowLeft className="h-4 w-4" aria-hidden="true" /></Link> : null}
                {phone ? <a href={telHref(phone)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-stone-300 bg-white px-6 font-bold transition-colors hover:border-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--organization-home-accent)]"><Phone className="h-4 w-4" aria-hidden="true" />{content.hero.contactCta}</a> : null}
                {instagram ? <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full px-3 text-sm font-semibold text-stone-600 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--organization-home-accent)]"><Instagram className="h-4 w-4" aria-hidden="true" />{content.hero.socialCta}</a> : null}
              </div>
            </div>
          </div>
          <div className="order-1 relative min-h-[440px] overflow-hidden bg-stone-200 sm:min-h-[560px] lg:order-2 lg:min-h-full">
            <picture className="absolute inset-0 block"><source media="(max-width: 767px)" srcSet={content.hero.mobileImage.src} /><Image src={content.hero.desktopImage.src} alt={content.hero.desktopImage.alt} fill priority sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover object-center" /></picture>
          </div>
        </section>

        <section aria-label={content.sectionLabels.highlightsAriaLabel} className="border-y border-black/5 bg-white">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-4 py-5 text-center text-xs font-bold sm:grid-cols-4 sm:text-sm">
            {content.highlights.map((item) => <p key={item} className="border-black/10 px-2 py-2 even:border-r sm:border-r sm:first:border-r-0">{item}</p>)}
          </div>
        </section>

        <section id="collections" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
          <div className="mb-8 flex items-end justify-between gap-4 sm:mb-12"><div><p className="text-xs font-bold tracking-[0.2em] text-[var(--organization-home-accent)]">{content.sectionLabels.collectionsEyebrow}</p><h2 className="mt-3 text-3xl font-black sm:text-5xl">{content.sectionLabels.collectionsTitle}</h2></div><span className="hidden text-sm text-stone-500 sm:block">{content.sectionLabels.collectionsDescription}</span></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {content.collections.map(({ title, image }) => <article key={image.src} className="group relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-stone-200 sm:rounded-[2rem]"><Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 1023px) 50vw, 25vw" className="h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none group-hover:scale-[1.035]" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-5 pt-16 text-white sm:px-6 sm:pb-7"><h3 className="text-base font-black sm:text-xl">{title}</h3></div></article>)}
          </div>
        </section>

        <section id="new" className="scroll-mt-24 bg-stone-950 py-16 text-white sm:py-24">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="mb-10 max-w-2xl"><p className="text-xs font-bold tracking-[0.2em] text-[var(--organization-home-accent)]">{content.sectionLabels.featuredEyebrow}</p><h2 className="mt-3 text-3xl font-black sm:text-5xl">{content.featured.title}</h2><p className="mt-4 leading-7 text-stone-400">{content.featured.description}</p></div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-6">
              {content.featured.items.map(({ title, image }) => <article key={image.src} className="group"><div className="aspect-square overflow-hidden rounded-2xl bg-stone-800"><Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 17vw" className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105" /></div><h3 className="mt-3 text-sm font-bold sm:text-base">{title}</h3></article>)}
            </div>
            {shopHref ? <div className="mt-10"><Link href={shopHref} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-stone-950 transition-colors hover:bg-[var(--organization-home-accent)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{content.featured.shopCta}<ArrowLeft className="h-4 w-4" aria-hidden="true" /></Link></div> : null}
          </div>
        </section>

        <section id="lookbook" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
          <div className="mb-10 grid gap-4 md:grid-cols-2 md:items-end"><h2 className="text-4xl font-black sm:text-6xl">{content.lookbook.title}</h2><p className="max-w-lg text-lg leading-8 text-stone-600 md:justify-self-end">{content.lookbook.description}</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2">
            {content.lookbook.items.map(({ title, image }, index) => <article key={image.src} className={`group relative min-h-[420px] overflow-hidden rounded-[1.75rem] bg-stone-200 ${index === 0 ? "lg:col-span-7 lg:row-span-2 lg:min-h-[900px]" : index === 1 ? "lg:col-span-5 lg:min-h-[442px]" : index === 2 ? "lg:col-span-2 lg:min-h-[442px]" : "lg:col-span-3 lg:min-h-[442px]"}`}><Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes={index === 0 ? "(max-width: 1023px) 100vw, 58vw" : "(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 42vw"} className="h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none group-hover:scale-[1.025]" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-20 text-white"><h3 className="text-xl font-black">{title}</h3></div></article>)}
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 sm:pb-24 lg:px-10"><div className="relative overflow-hidden rounded-[2rem] bg-[var(--organization-home-accent)] px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-20"><div className="absolute -left-20 -top-20 h-64 w-64 rounded-full border-[48px] border-white/10" aria-hidden="true" /><div className="relative max-w-2xl"><p className="text-xs font-bold tracking-[0.2em] text-white">{content.campaign.eyebrow}</p><h2 className="mt-4 text-3xl font-black sm:text-5xl">{content.campaign.title}</h2><p className="mt-4 text-base leading-8 text-white sm:text-lg">{content.campaign.description}</p>{instagram ? <a href={instagram} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-stone-950 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950"><Instagram className="h-5 w-5" aria-hidden="true" />{content.campaign.cta}</a> : null}</div></div></section>

        <section id="contact" className="scroll-mt-24 border-t border-black/5 bg-white py-16 sm:py-24"><div className="mx-auto grid max-w-[1200px] gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center"><div><p className="text-xs font-bold tracking-[0.2em] text-[var(--organization-home-accent)]">{content.sectionLabels.contactEyebrow}</p><h2 className="mt-3 text-3xl font-black sm:text-5xl">{content.contact.title}</h2><p className="mt-5 max-w-lg text-base leading-8 text-stone-600">{content.contact.description}</p></div><div className="rounded-[1.75rem] bg-[#f7f5f0] p-6 sm:p-8">{address ? <p className="flex items-start gap-3 text-base leading-7"><MapPin className="mt-1 h-5 w-5 shrink-0 text-[var(--organization-home-accent)]" aria-hidden="true" /><span>{address}</span></p> : null}<div className="mt-6 flex flex-wrap gap-3">{phone ? <a href={telHref(phone)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-stone-950 px-5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--organization-home-accent)]"><Phone className="h-4 w-4" aria-hidden="true" />{content.contact.callLabel}</a> : null}{instagram ? <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-stone-300 bg-white px-5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--organization-home-accent)]"><Instagram className="h-4 w-4" aria-hidden="true" />{content.contact.instagramLabel}</a> : null}</div></div></div></section>
      </main>

      <div className="bg-stone-950 text-white [&_footer]:mt-0 [&_footer]:border-white/10 [&_footer]:bg-stone-950 [&_footer_a]:text-stone-300 [&_footer_p]:text-stone-400 [&_footer_span]:text-inherit"><TenantFooter footer={{ kind: "shop", locale, name: branding.displayName, slug, description: organization.description, logo: branding.logo, address, phone, email: organization.email, homeHref: rootHref, profileHref: shopHref ? `${shopHref.replace(/\/$/, "")}/profile` : null, cartHref: null, poweredByHref: "https://bazarbaaz.ir" }} /></div>
    </div>
  );
}

export async function OrganizationBrandHome({ params }: OrganizationBrandHomeProps) {
  const { locale, slug } = await params;
  const isCustomDomain = (await headers()).get("x-bazar-custom-domain") === "true";
  const organization = await prisma.organization.findUnique({ where: { slug }, select: {
    id: true, name: true, description: true, address: true, phone: true, email: true, logo: true, coverImage: true,
    capabilities: { where: { status: "ACTIVE" }, select: { key: true } },
    domains: { where: { isPrimary: true, status: "ACTIVE" }, select: { domain: true }, take: 1 },
    branding: { select: { organizationId: true, displayName: true, shortName: true, logoUrl: true, faviconUrl: true, appleTouchIconUrl: true, pwaIcon192Url: true, pwaIcon512Url: true, ogImageUrl: true, source: true } },
  } });
  if (!organization) notFound();
  const branding = resolveOrganizationBranding({ organizationId: organization.id, name: organization.name, logo: organization.logo, coverImage: organization.coverImage, branding: organization.branding });
  const content = resolveOrganizationHomeContent({ organizationSlug: slug, locale });
  const hasShop = organization.capabilities.some((capability) => capability.key === "SHOP");
  if (content) return <EditorialHome locale={locale} slug={slug} isCustomDomain={isCustomDomain} content={content} branding={branding} organization={organization} hasShop={hasShop} />;

  const hasAppointment = organization.capabilities.some((capability) => capability.key === "APPOINTMENT");
  const primaryDomain = organization.domains[0]?.domain;
  return <main className="min-h-screen bg-background">{organization.coverImage ? <div className="relative h-48 bg-muted md:h-64"><Image src={organization.coverImage} alt={organization.name} fill sizes="100vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" /></div> : null}<section className={`${organization.coverImage ? "-mt-20" : "pt-8"} relative`}><div className="container mx-auto px-4 py-8"><div className="mb-6 flex items-center gap-4"><Image src={branding.logo} alt={organization.name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" /><div><h1 className="text-3xl font-bold">{organization.name}</h1>{primaryDomain ? <p className="text-muted-foreground">{primaryDomain}</p> : null}</div></div>{organization.description ? <p className="mb-8 max-w-2xl text-lg text-muted-foreground">{organization.description}</p> : null}<div className="flex flex-wrap gap-4">{hasShop ? <Link href={buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "shop", isCustomDomain })} className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-6 text-primary-foreground hover:bg-primary/90">فروشگاه</Link> : null}{hasAppointment ? <Link href={buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "appointment", subPath: "/services", isCustomDomain })} className="inline-flex min-h-12 items-center justify-center rounded-md border px-6 hover:bg-accent">رزرو خدمات</Link> : null}</div></div></section></main>;
}
