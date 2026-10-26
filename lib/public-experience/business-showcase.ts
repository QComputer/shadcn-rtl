export const BUSINESS_SHOWCASE_SAMPLES = [
  { id: "aka-shoes", name: "آکاشوز", category: "فروشگاه", description: "کاتالوگ کفش، مشاهدهٔ محصولات و انتخاب مدل دلخواه.", href: "https://www.akashoes.ir/", image: "/brand/showcase/aka-shoes.png", alt: "تصویر واقعی فروشگاه آکاشوز" },
  { id: "cafe-leo", name: "کافه لئو", category: "کافه", description: "منوی آنلاین کافه لئو در بازارباز، بدون نیاز به دامنهٔ اختصاصی.", href: "https://bazarbaaz.ir/fa/cafe-leo", image: "/brand/showcase/cafe-leo.png", alt: "تصویر واقعی منوی کافه لئو" },
  { id: "restaurant-13", name: "رستوران سیزده", category: "رستوران", description: "معرفی رستوران و دسترسی آسان به منوی آنلاین.", href: "https://bazarbaaz.ir/fa/italiano-13", image: "/brand/showcase/restaurant-13.png", alt: "تصویر واقعی رستوران سیزده" },
] as const;

export type BusinessShowcaseLocale = "fa" | "en" | "ar";

const localizedSamples = {
  en: [
    { name: "Aka Shoes", category: "Shoe store", description: "Browse the shoe catalog, explore products, and find a style you like.", alt: "Aka Shoes storefront page" },
    { name: "Cafe Leo", category: "Cafe", description: "Cafe Leo’s online menu on Bazarbaaz, with no dedicated domain required.", alt: "Cafe Leo online menu" },
    { name: "Restaurant 13", category: "Restaurant", description: "Discover the restaurant and browse its online menu.", alt: "Restaurant 13 business page" },
  ],
  ar: [
    { name: "آكا شوز", category: "متجر أحذية", description: "تصفّح كتالوج الأحذية والمنتجات واختر الطراز المناسب لك.", alt: "صفحة متجر آكا شوز" },
    { name: "مقهى ليو", category: "مقهى", description: "قائمة مقهى ليو على بازارباز دون الحاجة إلى نطاق خاص.", alt: "قائمة مقهى ليو الإلكترونية" },
    { name: "مطعم ١٣", category: "مطعم", description: "تعرّف على المطعم وانتقل بسهولة إلى قائمته الإلكترونية.", alt: "صفحة مطعم ١٣" },
  ],
} as const;

export function getBusinessShowcaseSamples(locale: BusinessShowcaseLocale) {
  if (locale === "fa") return BUSINESS_SHOWCASE_SAMPLES;
  const translations = localizedSamples[locale];
  return BUSINESS_SHOWCASE_SAMPLES.map((sample, index) => ({
    ...sample,
    ...translations[index],
  }));
}
