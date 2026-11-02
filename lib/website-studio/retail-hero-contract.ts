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
  imageAlt: z.string().trim().max(180).default(""),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  focalX: z.number().int().min(0).max(100).default(50),
  focalY: z.number().int().min(0).max(100).default(50),
  productIds: z.array(z.string().min(1).max(128)).max(3).default([]).refine(ids => new Set(ids).size === ids.length, "محصول تکراری است."),
  autoplay: z.boolean().default(false),
}).strict().superRefine((hero, ctx) => {
  if (!hero.enabled) return;
  if (hero.mode === "CAMPAIGN" && !hero.desktopImageId) ctx.addIssue({ code: "custom", path: ["desktopImageId"], message: "تصویر اصلی مجموعه را انتخاب کنید." });
  if (hero.mode === "PRODUCTS" && !hero.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "حداقل یک محصول انتخاب کنید." });
});
export type RetailHeroConfig = z.infer<typeof retailHeroSchema>;
export type PublishedRetailHero = Omit<RetailHeroConfig, "desktopImageId" | "mobileImageId"> & { desktopImage: string | null; mobileImage: string | null };
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
