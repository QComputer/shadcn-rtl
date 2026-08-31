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
  sectionLabels: {
    highlightsAriaLabel: string;
    collectionsEyebrow: string;
    collectionsTitle: string;
    collectionsDescription: string;
    featuredEyebrow: string;
    contactEyebrow: string;
  };
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

const homeAsset = (tenant: string, path: string, alt: string, width: number, height: number): OrganizationHomeImage => ({
  src: `/brand/tenants/${tenant}/home/${path}`,
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
  sectionLabels: {
    highlightsAriaLabel: "ویژگی‌های آکا شوز",
    collectionsEyebrow: "CURATED STYLES",
    collectionsTitle: "انتخاب بر اساس استایل",
    collectionsDescription: "چهار حال‌وهوای متفاوت، یک امضای آکا",
    featuredEyebrow: "AKA EDIT",
    contactEyebrow: "VISIT / CONNECT",
  },
  hero: {
    eyebrow: "آکا شوز شهرکرد",
    title: "آکا شوز؛ فروشگاه کفش و کتونی در شهرکرد",
    statement: "استایل تو، قدم‌های تو",
    description: "مدل‌های جدید کفش و کتونی آکا شوز؛ از استایل روزمره تا انتخاب‌های اسپرت و متفاوت.",
    desktopImage: homeAsset("aka-shoes", "hero/aka-home-hero-desktop.webp", "مدل با کتونی آکا شوز در استایل شهری", 1600, 900),
    mobileImage: homeAsset("aka-shoes", "hero/aka-home-hero-mobile.webp", "مدل با کتونی آکا شوز در استایل شهری", 900, 1200),
    primaryCta: "مشاهده مدل‌های جدید",
    contactCta: "تماس با آکا شوز",
    socialCta: "اینستاگرام آکا",
  },
  highlights: ["مدل‌های جدید", "تنوع استایل", "خرید حضوری در شهرکرد", "اطلاع از موجودی و سایز"],
  collections: [
    { title: "روشن و روزمره", image: homeAsset("aka-shoes", "collections/aka-collection-light.webp", "کتونی روشن در استایل روزمره آکا شوز", 720, 540) },
    { title: "تیره و اسپرت", image: homeAsset("aka-shoes", "collections/aka-collection-dark.webp", "کتونی تیره در استایل اسپرت آکا شوز", 720, 540) },
    { title: "رنگی و متفاوت", image: homeAsset("aka-shoes", "collections/aka-collection-color.webp", "کتونی رنگی در مجموعه آکا شوز", 720, 540) },
    { title: "مینیمال", image: homeAsset("aka-shoes", "collections/aka-collection-minimal.webp", "کتونی مینیمال در مجموعه آکا شوز", 720, 540) },
  ],
  featured: {
    title: "تازه‌های آکا",
    description: "چند انتخاب تصویری از مدل‌ها و استایل‌های این روزهای آکا شوز",
    shopCta: "مشاهده محصولات",
    items: [
      { title: "پاستلی و سبک", image: homeAsset("aka-shoes", "products/aka-product-pastel-pink.webp", "کتونی روشن پاستلی آکا شوز", 640, 640) },
      { title: "آبی و یاسی", image: homeAsset("aka-shoes", "products/aka-product-aqua-lavender.webp", "کتونی آبی و یاسی آکا شوز", 640, 640) },
      { title: "ذغالی", image: homeAsset("aka-shoes", "products/aka-product-charcoal.webp", "کتونی ذغالی آکا شوز", 640, 640) },
      { title: "مشکی و سفید", image: homeAsset("aka-shoes", "products/aka-product-black-white.webp", "کتونی مشکی و سفید آکا شوز", 640, 640) },
      { title: "سبز و زرد", image: homeAsset("aka-shoes", "products/aka-product-green-yellow.webp", "کتونی سبز و زرد آکا شوز", 640, 640) },
      { title: "قرمز و مشکی", image: homeAsset("aka-shoes", "products/aka-product-red-black.webp", "کتونی قرمز و مشکی آکا شوز", 640, 640) },
    ],
  },
  lookbook: {
    title: "استایل آکا",
    description: "کفش فقط بخشی از استایل نیست؛ گاهی نقطه شروع آن است.",
    items: [
      { title: "استایل روزمره", image: homeAsset("aka-shoes", "lookbook/aka-lookbook-pastel.webp", "استایل روزمره پاستلی آکا شوز", 800, 1000) },
      { title: "Urban Black", image: homeAsset("aka-shoes", "lookbook/aka-lookbook-dark.webp", "استایل شهری تیره آکا شوز", 800, 1000) },
      { title: "Color Energy", image: homeAsset("aka-shoes", "lookbook/aka-lookbook-green-yellow.webp", "استایل سبز و زرد آکا شوز", 800, 1000) },
      { title: "Street Statement", image: homeAsset("aka-shoes", "lookbook/aka-lookbook-red-black.webp", "استایل خیابانی قرمز و مشکی آکا شوز", 800, 1000) },
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

const ITALIANO_13_FA: OrganizationHomeContent = {
  locale: "fa",
  theme: { accent: "#C94035", background: "#F7F1E9" },
  seo: {
    title: "رستوران ایتالیایی سیزده | شهرکرد",
    description: "منوی رستوران ۱۳: پیتزا، برگر، پاستا و غذاهای فرنگی در شهرکرد. مشاهده منو و تماس با رستوران.",
  },
  header: {
    shopLabel: "مشاهده منو",
    collectionLabel: "دسته‌بندی‌ها",
    lookbookLabel: "ویژه‌ها",
    contactLabel: "تماس",
  },
  sectionLabels: {
    highlightsAriaLabel: "ویژگی‌های رستوران ۱۳",
    collectionsEyebrow: "MENU COLLECTIONS",
    collectionsTitle: "انتخاب بر اساس دسته‌بندی منو",
    collectionsDescription: "چهار دسته محبوب از آشپزخانه رستوران ۱۳",
    featuredEyebrow: "RESTAURANT 13 PICKS",
    contactEyebrow: "VISIT / CONNECT",
  },
  hero: {
    eyebrow: "رستوران ایتالیایی سیزده",
    title: "رستوران ۱۳؛ پیتزا، برگر و پاستا در شهرکرد",
    statement: "طعم ایتالیایی، با حال‌وهوای محلی",
    description: "پیتزا، برگر، پاستا و غذاهای فرنگی تازه در قلب شهرکرد. سفارش مستقیم یا تماس برای رزرو.",
    desktopImage: homeAsset("restaurant-13", "hero/hero-main.webp", "رستوران ایتالیایی سیزده شهرکرد", 1279, 720),
    mobileImage: homeAsset("restaurant-13", "hero/hero-main-mobile.webp", "رستوران ایتالیایی سیزده شهرکرد", 900, 507),
    primaryCta: "مشاهده منو",
    contactCta: "تماس با رستوران",
    socialCta: "اینستاگرام ۱۳",
  },
  highlights: ["پیتزا تازه", "برگر و همبرگر", "پاستا و لازانیا", "سفارش در شهرکرد"],
  collections: [
    { title: "پیتزا", image: homeAsset("restaurant-13", "collections/featured-pizza.webp", "پیتزا میکس سیزده", 800, 600) },
    { title: "برگر", image: homeAsset("restaurant-13", "collections/featured-burger.webp", "برگر ذغالی", 800, 600) },
    { title: "پاستا", image: homeAsset("restaurant-13", "collections/featured-pasta.webp", "پاستا آلفردو", 800, 600) },
    { title: "ویژه‌ها", image: homeAsset("restaurant-13", "collections/featured-special-dish.webp", "چیکن استیک پارمزان", 800, 600) },
  ],
  featured: {
    title: "تازه‌های منو",
    description: "انتخاب تصویری از پیتزا، برگر، پاستا و غذاهای ویژه رستوران ۱۳",
    shopCta: "مشاهده منو کامل",
    items: [
      { title: "پیتزا میکس سیزده", image: homeAsset("restaurant-13", "products/pizza-signature.webp", "پیتزا میکس سیزده", 960, 720) },
      { title: "برگر ذغالی", image: homeAsset("restaurant-13", "products/burger-signature.webp", "برگر ذغالی", 960, 720) },
      { title: "پاستا آلفردو", image: homeAsset("restaurant-13", "products/pasta-alfredo.webp", "پاستا آلفردو", 960, 720) },
      { title: "چیکن استیک پارمزان", image: homeAsset("restaurant-13", "products/chicken-parmesan.webp", "چیکن استیک پارمزان", 960, 720) },
      { title: "بشقاب سوخاری", image: homeAsset("restaurant-13", "products/crispy-platter.webp", "بشقاب سوخاری", 960, 720) },
    ],
  },
  lookbook: {
    title: "منوهای رستوران ۱۳",
    description: "نگاهی به چند دسته محبوب و تازه‌های آشپزخانه رستوران.",
    items: [
      { title: "پیش‌غذا", image: homeAsset("restaurant-13", "lookbook/featured-appetizer.webp", "پیش‌غذای ویژه رستوران ۱۳", 800, 600) },
      { title: "برگر", image: homeAsset("restaurant-13", "products/burger-signature.webp", "برگر", 960, 720) },
      { title: "پاستا", image: homeAsset("restaurant-13", "products/pasta-alfredo.webp", "پاستا", 960, 720) },
      { title: "ویژه‌ها", image: homeAsset("restaurant-13", "products/chicken-parmesan.webp", "ویژه‌ها", 960, 720) },
    ],
  },
  campaign: {
    eyebrow: "Restaurant 13 / Shahrekord",
    title: "منوی رستوران ۱۳ را از دست نده",
    description: "پیتزا، برگر، پاستا و غذاهای فرنگی در شهرکرد. دنبال کنید.",
    cta: "پیج اینستاگرام",
  },
  contact: {
    title: "رستوران ۱۳ در شهرکرد",
    description: "شهرکرد، بلوار آیت‌الله کاشانی. برای سفارش یا رزرو با ما تماس بگیرید.",
    phoneFallback: "03832251313",
    addressFallback: "شهرکرد، بلوار آیت‌الله کاشانی",
    instagramUrl: "https://www.instagram.com/restaurant_13_/",
    instagramLabel: "@restaurant_13_",
    callLabel: "تماس با رستوران",
  },
};

const PILOT_HOME_CONTENT = new Map<string, Readonly<Record<string, OrganizationHomeContent>>>([
  ["aka-shoes", { fa: AKA_SHOES_FA }],
  ["italiano-13", { fa: ITALIANO_13_FA }],
]);

export function resolveOrganizationHomeContent(input: {
  organizationSlug: string;
  locale: string;
}): OrganizationHomeContent | null {
  const localized = PILOT_HOME_CONTENT.get(input.organizationSlug);
  if (!localized) return null;
  return localized[input.locale] ?? localized.fa ?? null;
}
