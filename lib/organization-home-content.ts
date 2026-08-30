/**
 * Temporary file-backed adapter for organization editorial homepages.
 *
 * The resolver is deliberately the only tenant lookup boundary. Presentation
 * components consume OrganizationHomeContent and can later be backed by an
 * admin-managed content store without tenant-specific UI changes.
 */

export type OrganizationHomeImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type OrganizationHomeContent = {
  locale: string;
  theme: { accent: string; background: string };
  seo: { title: string; description: string };
  header: { shopLabel: string; collectionLabel: string; lookbookLabel: string; contactLabel: string };
  hero: {
    eyebrow: string;
    title: string;
    statement: string;
    description: string;
    desktopImage: OrganizationHomeImage;
    mobileImage: OrganizationHomeImage;
    primaryCta: string;
    contactCta: string;
    socialCta: string;
  };
  highlights: string[];
  collections: Array<{ title: string; image: OrganizationHomeImage }>;
  featured: {
    title: string;
    description: string;
    shopCta: string;
    items: Array<{ title: string; image: OrganizationHomeImage }>;
  };
  lookbook: {
    title: string;
    description: string;
    items: Array<{ title: string; image: OrganizationHomeImage }>;
  };
  campaign: { eyebrow: string; title: string; description: string; cta: string };
  contact: {
    title: string;
    description: string;
    phoneFallback?: string;
    addressFallback?: string;
    instagramUrl?: string;
    instagramLabel?: string;
    callLabel: string;
  };
};

const homeAsset = (path: string, alt: string, width: number, height: number): OrganizationHomeImage => ({
  src: `/brand/tenants/aka-shoes/home/${path}`,
  alt,
  width,
  height,
});

const AKA_SHOES_FA: OrganizationHomeContent = {
  locale: "fa",
  theme: { accent: "#16734a", background: "#f7f5f0" },
  seo: {
    title: "آکا شوز شهرکرد | کفش و کتونی",
    description: "آکا شوز شهرکرد؛ مشاهده مدل‌های جدید کفش و کتونی، استایل‌های پیشنهادی و راه‌های ارتباط با فروشگاه.",
  },
  header: {
    shopLabel: "فروشگاه",
    collectionLabel: "استایل‌ها",
    lookbookLabel: "نگاه آکا",
    contactLabel: "تماس",
  },
  hero: {
    eyebrow: "آکا شوز شهرکرد",
    title: "آکا شوز؛ فروشگاه کفش و کتونی در شهرکرد",
    statement: "استایل تو، قدم‌های تو",
    description: "مدل‌های جدید کفش و کتونی آکا شوز؛ از استایل روزمره تا انتخاب‌های اسپرت و متفاوت.",
    desktopImage: homeAsset("hero/aka-home-hero-desktop.webp", "مدل با کتونی آکا شوز در استایل شهری", 1600, 900),
    mobileImage: homeAsset("hero/aka-home-hero-mobile.webp", "مدل با کتونی آکا شوز در استایل شهری", 900, 1200),
    primaryCta: "مشاهده مدل‌های جدید",
    contactCta: "تماس با آکا شوز",
    socialCta: "اینستاگرام آکا",
  },
  highlights: ["مدل‌های جدید", "تنوع استایل", "خرید حضوری در شهرکرد", "اطلاع از موجودی و سایز"],
  collections: [
    { title: "روشن و روزمره", image: homeAsset("collections/aka-collection-light.webp", "کتونی روشن در استایل روزمره آکا شوز", 720, 540) },
    { title: "تیره و اسپرت", image: homeAsset("collections/aka-collection-dark.webp", "کتونی تیره در استایل اسپرت آکا شوز", 720, 540) },
    { title: "رنگی و متفاوت", image: homeAsset("collections/aka-collection-color.webp", "کتونی رنگی در مجموعه آکا شوز", 720, 540) },
    { title: "مینیمال", image: homeAsset("collections/aka-collection-minimal.webp", "کتونی مینیمال در مجموعه آکا شوز", 720, 540) },
  ],
  featured: {
    title: "تازه‌های آکا",
    description: "چند انتخاب تصویری از مدل‌ها و استایل‌های این روزهای آکا شوز",
    shopCta: "مشاهده محصولات",
    items: [
      { title: "پاستلی و سبک", image: homeAsset("products/aka-product-pastel-pink.webp", "کتونی روشن پاستلی آکا شوز", 640, 640) },
      { title: "آبی و یاسی", image: homeAsset("products/aka-product-aqua-lavender.webp", "کتونی آبی و یاسی آکا شوز", 640, 640) },
      { title: "ذغالی", image: homeAsset("products/aka-product-charcoal.webp", "کتونی ذغالی آکا شوز", 640, 640) },
      { title: "مشکی و سفید", image: homeAsset("products/aka-product-black-white.webp", "کتونی مشکی و سفید آکا شوز", 640, 640) },
      { title: "سبز و زرد", image: homeAsset("products/aka-product-green-yellow.webp", "کتونی سبز و زرد آکا شوز", 640, 640) },
      { title: "قرمز و مشکی", image: homeAsset("products/aka-product-red-black.webp", "کتونی قرمز و مشکی آکا شوز", 640, 640) },
    ],
  },
  lookbook: {
    title: "استایل آکا",
    description: "کفش فقط بخشی از استایل نیست؛ گاهی نقطه شروع آن است.",
    items: [
      { title: "استایل روزمره", image: homeAsset("lookbook/aka-lookbook-pastel.webp", "استایل روزمره پاستلی آکا شوز", 800, 1000) },
      { title: "Urban Black", image: homeAsset("lookbook/aka-lookbook-dark.webp", "استایل شهری تیره آکا شوز", 800, 1000) },
      { title: "Color Energy", image: homeAsset("lookbook/aka-lookbook-green-yellow.webp", "استایل سبز و زرد آکا شوز", 800, 1000) },
      { title: "Street Statement", image: homeAsset("lookbook/aka-lookbook-red-black.webp", "استایل خیابانی قرمز و مشکی آکا شوز", 800, 1000) },
    ],
  },
  campaign: {
    eyebrow: "Aka Shoes / New Drop",
    title: "جدیدها را از دست نده",
    description: "مدل‌های تازه، استایل‌های جدید و خبرهای آکا شوز را دنبال کنید.",
    cta: "مشاهده اینستاگرام",
  },
  contact: {
    title: "آکا شوز در شهرکرد",
    description: "برای اطلاع از موجودی، رنگ و سایز با فروشگاه در تماس باشید.",
    phoneFallback: "09138881602",
    addressFallback: "شهرکرد، چهارراه فردوسی، نبش کوچه ۶۴",
    instagramUrl: "https://instagram.com/aka.shoes",
    instagramLabel: "@aka.shoes",
    callLabel: "تماس با فروشگاه",
  },
};

const PILOT_HOME_CONTENT = new Map<string, Readonly<Record<string, OrganizationHomeContent>>>([
  ["aka-shoes", { fa: AKA_SHOES_FA }],
]);

export function resolveOrganizationHomeContent(input: {
  organizationSlug: string;
  locale: string;
}): OrganizationHomeContent | null {
  const localized = PILOT_HOME_CONTENT.get(input.organizationSlug);
  if (!localized) return null;
  return localized[input.locale] ?? localized.fa ?? null;
}
