import { z } from "zod";

const destination = z.string().trim().max(500).refine(value => !value || (/^\/(?!\/)/.test(value) && !/[\\\s\x00-\x1f]/.test(value)), "مسیر داخلی معتبر وارد کنید.");
export const retailHeroSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(["CAMPAIGN", "PRODUCTS"]).default("CAMPAIGN"),
  heading: z.string().trim().min(1).max(100),
  description: z.string().trim().max(240).default(""),
  ctaLabel: z.string().trim().min(1).max(40),
  ctaHref: destination.default(""),
  desktopImageId: z.string().max(128).default(""),
  mobileImageId: z.string().max(128).default(""),
  darkDesktopImageId: z.string().max(128).default(""),
  darkMobileImageId: z.string().max(128).default(""),
  imageAlt: z.string().trim().max(180).default(""),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  focalX: z.number().int().min(0).max(100).default(50),
  focalY: z.number().int().min(0).max(100).default(50),
  productIds: z.array(z.string().min(1).max(128)).max(3).default([]).refine(ids => new Set(ids).size === ids.length, "محصول تکراری است."),
  autoplay: z.boolean().default(false),
}).strict().superRefine((hero, ctx) => {
  if (!hero.enabled) return;
  if (hero.mode === "PRODUCTS" && !hero.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "حداقل یک محصول انتخاب کنید." });
});
export type RetailHeroConfig = z.infer<typeof retailHeroSchema>;
export type PublishedRetailHero = Omit<RetailHeroConfig, "desktopImageId" | "mobileImageId" | "darkDesktopImageId" | "darkMobileImageId"> & { desktopImage: string | null; mobileImage: string | null; darkDesktopImage: string | null; darkMobileImage: string | null };
export type RetailHeroThemeImageSource = Pick<PublishedRetailHero, "desktopImage" | "mobileImage" | "darkDesktopImage" | "darkMobileImage">;
export function resolveRetailHeroThemeImages(hero: RetailHeroThemeImageSource, theme: "light" | "dark") {
  const hasMobileImage = Boolean(hero.mobileImage || hero.darkMobileImage);
  if (theme === "dark") {
    return {
      desktop: hero.darkDesktopImage || hero.darkMobileImage || hero.desktopImage || hero.mobileImage,
      mobile: hero.darkMobileImage || hero.darkDesktopImage || hero.mobileImage || hero.desktopImage,
      hasMobileImage,
    };
  }
  return {
    desktop: hero.desktopImage || hero.mobileImage || hero.darkDesktopImage || hero.darkMobileImage,
    mobile: hero.mobileImage || hero.desktopImage || hero.darkMobileImage || hero.darkDesktopImage,
    hasMobileImage,
  };
}
export type RetailHeroPublication = { revisionId: string | null; previousRevisionId: string | null; publishedAt: string };
export const retailHeroPublicationSchema = z.object({ revisionId: z.string().min(1).nullable(), previousRevisionId: z.string().min(1).nullable(), publishedAt: z.string().datetime() }).strict();
export function readRetailHeroPublication(settings: unknown): RetailHeroPublication | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const parsed = retailHeroPublicationSchema.safeParse((settings as Record<string, unknown>).retailHeroPublication);
  return parsed.success ? { revisionId: parsed.data.revisionId ?? null, previousRevisionId: parsed.data.previousRevisionId ?? null, publishedAt: parsed.data.publishedAt } : null;
}
export const changeRetailHeroPublicationSchema = z.object({
  action: z.enum(["publish", "rollback"]), revisionId: z.string().min(1).max(128),
  basePublishedRevisionId: z.string().max(128).nullable(),
}).strict();
