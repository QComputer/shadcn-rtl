import { z } from "zod";

const localeSchema = z.enum(["fa", "en", "ar"]);
const mediaSchema = z.object({
  src: z.string().startsWith("/api/hotel/v1/website/media/"),
  altText: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
  slot: z.enum(["GALLERY", "HERO_DESKTOP", "HERO_MOBILE"]),
}).strict();

const sectionSchema = z.discriminatedUnion("kind", [
  z.object({ key: z.string(), order: z.number().int(), visible: z.boolean(), kind: z.literal("TEXT"), heading: z.string().nullable(), body: z.string().nullable() }).strict(),
  z.object({ key: z.string(), order: z.number().int(), visible: z.boolean(), kind: z.literal("FEATURE_LIST"), heading: z.string().nullable(), items: z.array(z.object({ key: z.string(), label: z.string().nullable(), description: z.string().nullable().optional() }).strict()) }).strict(),
  z.object({ key: z.string(), order: z.number().int(), visible: z.boolean(), kind: z.literal("FAQ"), heading: z.string().nullable(), items: z.array(z.object({ question: z.string().nullable(), answer: z.string().nullable() }).strict()) }).strict(),
]);

export const publishedHotelWebsiteResponseSchema = z.object({
  mode: z.literal("PUBLISHED"),
  locale: localeSchema,
  propertySlug: z.string(),
  revisionNumber: z.number().int().positive(),
  content: z.object({
    title: z.string().nullable(),
    hero: z.object({ eyebrow: z.string().nullable().optional(), heading: z.string().nullable(), subheading: z.string().nullable().optional() }).strict(),
    introduction: z.object({ heading: z.string().nullable().optional(), body: z.string().nullable() }).strict(),
    sections: z.array(sectionSchema),
    contact: z.object({ phone: z.string().optional(), email: z.string().email().optional() }).strict(),
  }).strict(),
  propertyGallery: z.array(mediaSchema),
  roomGalleries: z.array(z.object({ roomTypeSlug: z.string(), items: z.array(mediaSchema) }).strict()),
}).strict();

export const unpublishedHotelWebsiteResponseSchema = z.object({
  mode: z.literal("UNPUBLISHED"),
  locale: localeSchema,
  propertySlug: z.string(),
  content: z.null(),
  propertyGallery: z.array(mediaSchema),
  roomGalleries: z.array(z.never()),
}).strict();

export const hotelWebsiteResponseSchema = z.union([publishedHotelWebsiteResponseSchema, unpublishedHotelWebsiteResponseSchema]);

const publicRoomCategorySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  localizedText: z.string().nullable(),
  maxAdults: z.number().int(),
  maxChildren: z.number().int(),
  maxOccupancy: z.number().int(),
  beds: z.unknown(),
  sizeSqm: z.number().int().nullable(),
  gallery: z.array(mediaSchema),
}).strict();

export const hotelWebsiteRoomCategoriesResponseSchema = z.object({
  mode: z.enum(["PUBLISHED", "UNPUBLISHED"]),
  locale: localeSchema,
  propertySlug: z.string(),
  roomCategories: z.array(publicRoomCategorySchema),
}).strict();

export type PublishedHotelWebsiteResponse = z.infer<typeof publishedHotelWebsiteResponseSchema>;
export type UnpublishedHotelWebsiteResponse = z.infer<typeof unpublishedHotelWebsiteResponseSchema>;
export type HotelWebsiteRoomCategoriesResponse = z.infer<typeof hotelWebsiteRoomCategoriesResponseSchema>;
