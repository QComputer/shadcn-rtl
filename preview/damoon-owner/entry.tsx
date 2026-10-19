"use client";

import { createRoot } from "react-dom/client";
import { PublishedHotelWebsitePage } from "@/components/published-hotel-website-page";
import type { HotelOrganizationSitePresentation } from "@/lib/hotel/organization-site-presentation";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";
import type { ConceptRoomCardData } from "@/lib/rooms/room-showcase-model";

const LOCALE_CODES = ["fa", "en", "ar"] as const satisfies readonly HotelPublicLocale[];

const copy = {
  fa: {
    title: "هتل دامون",
    eyebrow: "اقامتی برای مکث و آرامش",
    heading: "روایتی مفهومی از یک اقامت آرام",
    subheading: "پیش‌نمایشی برای مرور حال‌وهوای طراحی؛ اطلاعات واقعی هتل در این صفحه ارائه نمی‌شود.",
    aboutHeading: "دربارهٔ این پیش‌نمایش",
    about: "این صفحه نمونه‌ای مفهومی از تجربهٔ وب هتل دامون است. تصاویر برای نمایش ایدهٔ بصری انتخاب شده‌اند و عکس واقعی هتل نیستند.",
    roomsHeading: "تصویرهای مفهومی فضاهای اقامت",
    banner: "پیش‌نمایش مصنوعی و مفهومی است. همهٔ تصاویر این صفحه مفهومی‌اند و هیچ‌کدام عکس واقعی هتل یا تأییدکنندهٔ امکانات، قیمت یا ظرفیت نیستند.",
    locales: "زبان صفحه",
    galleryAlts: ["تصویر مفهومی فضای داخلی؛ عکس واقعی هتل نیست", "تصویر مفهومی فضای نشیمن؛ عکس واقعی هتل نیست", "تصویر مفهومی نور و چوب؛ عکس واقعی هتل نیست"],
    rooms: ["نمونهٔ تصویری یک", "نمونهٔ تصویری دو", "نمونهٔ تصویری سه"],
    roomAlt: ["تصویر مفهومی یک؛ عکس واقعی هتل نیست", "تصویر مفهومی دو؛ عکس واقعی هتل نیست", "تصویر مفهومی سه؛ عکس واقعی هتل نیست"],
    gallerySection: "تصویرهایی برای الهام از فضا و نور",
  },
  en: {
    title: "Hotel Damoon",
    eyebrow: "A pause for calm",
    heading: "A concept for a quieter stay",
    subheading: "A design preview for exploring the mood of the experience. This page does not provide verified hotel information.",
    aboutHeading: "About this preview",
    about: "This page is a conceptual sample of a Hotel Damoon website experience. Its images illustrate a visual direction and are not photographs of the hotel.",
    roomsHeading: "Concept images for accommodation spaces",
    banner: "Synthetic concept preview. Every image on this page is conceptual; none is an actual hotel photograph or a claim about amenities, prices, or capacity.",
    locales: "Page language",
    galleryAlts: ["Concept interior image; not an actual hotel photograph", "Concept lounge image; not an actual hotel photograph", "Concept light and wood image; not an actual hotel photograph"],
    rooms: ["Visual sample one", "Visual sample two", "Visual sample three"],
    roomAlt: ["Concept image one; not an actual hotel photograph", "Concept image two; not an actual hotel photograph", "Concept image three; not an actual hotel photograph"],
    gallerySection: "Images inspired by space and light",
  },
  ar: {
    title: "فندق دامون",
    eyebrow: "استراحة من أجل الهدوء",
    heading: "تصور لإقامة أكثر هدوءًا",
    subheading: "معاينة تصميم لاستكشاف أجواء التجربة. لا تقدم هذه الصفحة معلومات مؤكدة عن الفندق.",
    aboutHeading: "حول هذه المعاينة",
    about: "هذه الصفحة نموذج تصوري لتجربة موقع فندق دامون. الصور تعرض اتجاهًا بصريًا وليست صورًا حقيقية للفندق.",
    roomsHeading: "صور تصورية لمساحات الإقامة",
    banner: "معاينة اصطناعية وتصورية. جميع الصور في هذه الصفحة تصورية؛ ولا تمثل أي منها صورة حقيقية للفندق أو تأكيدًا للمرافق أو الأسعار أو السعة.",
    locales: "لغة الصفحة",
    galleryAlts: ["صورة داخلية تصورية؛ ليست صورة حقيقية للفندق", "صورة صالة تصورية؛ ليست صورة حقيقية للفندق", "صورة تصورية للضوء والخشب؛ ليست صورة حقيقية للفندق"],
    rooms: ["نموذج بصري أول", "نموذج بصري ثانٍ", "نموذج بصري ثالث"],
    roomAlt: ["صورة تصورية أولى؛ ليست صورة حقيقية للفندق", "صورة تصورية ثانية؛ ليست صورة حقيقية للفندق", "صورة تصورية ثالثة؛ ليست صورة حقيقية للفندق"],
    gallerySection: "صور تستلهم المساحة والضوء",
  },
} satisfies Record<HotelPublicLocale, {
  title: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  aboutHeading: string;
  about: string;
  roomsHeading: string;
  banner: string;
  locales: string;
  galleryAlts: readonly [string, string, string];
  rooms: readonly [string, string, string];
  roomAlt: readonly [string, string, string];
  gallerySection: string;
}>;

const roomImages = [
  "/images/room-concept-1.webp",
  "/images/room-concept-2.webp",
  "/images/room-concept-3.webp",
] as const;

const galleryImages = [
  "/images/gallery-concept-1.webp",
  "/images/gallery-concept-2.webp",
  "/images/gallery-concept-3.webp",
] as const;

function conceptRoomsFor(locale: HotelPublicLocale): readonly ConceptRoomCardData[] {
  const text = copy[locale];
  return roomImages.map((src, index) => ({
    kind: "concept",
    id: `concept-room-${index + 1}`,
    title: text.rooms[index],
    images: [{ src, alt: text.roomAlt[index] }],
  }));
}

function presentationFor(locale: HotelPublicLocale): HotelOrganizationSitePresentation {
  const text = copy[locale];
  const propertyGallery = galleryImages.map((src, index) => ({
    src,
    alt: text.galleryAlts[index],
    sortOrder: index,
  }));

  return {
    status: "PREVIEW",
    source: "SYNTHETIC_PREVIEW",
    organizationId: "synthetic-damoon-preview",
    organizationSlug: "damoon-hotel",
    locale,
    propertySlug: "synthetic-preview-property",
    revisionStatus: "DRAFT",
    website: {
      mode: "PUBLISHED",
      locale,
      propertySlug: "synthetic-preview-property",
      revisionNumber: 1,
      content: {
        title: text.title,
        hero: { eyebrow: text.eyebrow, heading: text.heading, subheading: text.subheading },
        introduction: { heading: text.aboutHeading, body: text.about },
        sections: [{
          key: "concept-gallery-introduction",
          order: 1,
          visible: true,
          kind: "TEXT",
          heading: text.gallerySection,
          body: text.banner,
        }],
        contact: {},
      },
      roomGalleries: [],
      roomCards: [],
      heroDesktop: { src: "/images/lobby-concept.webp", alt: text.galleryAlts[0] },
      heroMobile: { src: "/images/lobby-concept.webp", alt: text.galleryAlts[0] },
      propertyGallery,
    },
  };
}

export default function DamoonOwnerPreviewEntry() {
  const pathname = typeof window === "undefined" ? "/fa/preview/damoon-owner" : window.location.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const locale = LOCALE_CODES.includes(segments[0] as HotelPublicLocale)
    ? segments[0] as HotelPublicLocale
    : "fa";
  const text = copy[locale];
  const pathWithoutLocale = `/${segments.slice(1).join("/")}`;
  const presentation = presentationFor(locale);

  return (
    <div className="damoonOwnerPreview" lang={locale}>
      <header className="damoonOwnerPreview__bar">
        <a className="damoonOwnerPreview__brand" href={`/${locale}/`}>{text.title}</a>
        <nav className="damoonOwnerPreview__locales" aria-label={text.locales}>
          {LOCALE_CODES.map((code) => (
            <a key={code} href={`/${code}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`} lang={code} aria-current={locale === code ? "page" : undefined}>
              {code.toUpperCase()}
            </a>
          ))}
        </nav>
      </header>
      <aside id="synthetic-preview-banner" className="damoonOwnerPreview__banner" role="status">
        <span aria-hidden="true">✳</span>
        <p>{text.banner}</p>
      </aside>
      <PublishedHotelWebsitePage
        propertySlug="synthetic-preview-property"
        locale={locale}
        presentation={presentation}
        syntheticRoomCards={conceptRoomsFor(locale)}
      />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Damoon owner preview root is missing");
createRoot(root).render(<DamoonOwnerPreviewEntry />);
