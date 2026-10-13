import { z } from "zod";

const publicLocalizedText = z.string().nullable();
const publicSection = z.discriminatedUnion("kind", [
  z.object({ key: z.string(), order: z.number().int(), visible: z.boolean(), kind: z.literal("TEXT"), heading: publicLocalizedText, body: publicLocalizedText }).strict(),
  z.object({ key: z.string(), order: z.number().int(), visible: z.boolean(), kind: z.literal("FEATURE_LIST"), heading: publicLocalizedText, items: z.array(z.object({ key: z.string(), label: publicLocalizedText, description: publicLocalizedText.optional() }).strict()) }).strict(),
  z.object({ key: z.string(), order: z.number().int(), visible: z.boolean(), kind: z.literal("FAQ"), heading: publicLocalizedText, items: z.array(z.object({ question: publicLocalizedText, answer: publicLocalizedText }).strict()) }).strict(),
]);

export const hotelWebsitePublicContentSchema = z.object({
  title: publicLocalizedText,
  hero: z.object({ eyebrow: publicLocalizedText.optional(), heading: publicLocalizedText, subheading: publicLocalizedText.optional() }).strict(),
  introduction: z.object({ heading: publicLocalizedText.optional(), body: publicLocalizedText }).strict(),
  sections: z.array(publicSection),
  contact: z.object({ phone: z.string().optional(), email: z.string().email().optional() }).strict(),
}).strict();

const galleryItem = z.object({ src: z.string().startsWith("/api/hotel/v1/website/media/"), altText: publicLocalizedText, sortOrder: z.number().int().nonnegative(), slot: z.enum(["GALLERY", "HERO_DESKTOP", "HERO_MOBILE"]) }).strict();

export const publishedHotelWebsiteResponseSchema = z.object({
  mode: z.literal("PUBLISHED"),
  locale: z.enum(["fa", "en", "ar"]),
  propertySlug: z.string(),
  revisionNumber: z.number().int().positive(),
  content: hotelWebsitePublicContentSchema,
  propertyGallery: z.array(galleryItem),
  roomGalleries: z.array(z.object({ roomTypeSlug: z.string(), items: z.array(galleryItem) }).strict()),
}).strict();

export const unpublishedHotelWebsiteResponseSchema = z.object({ mode: z.literal("UNPUBLISHED"), locale: z.enum(["fa", "en", "ar"]), propertySlug: z.string(), content: z.null(), propertyGallery: z.array(galleryItem), roomGalleries: z.array(z.never()) }).strict();
export const hotelWebsiteResponseSchema = z.union([publishedHotelWebsiteResponseSchema, unpublishedHotelWebsiteResponseSchema]);

export const hotelWebsiteRoomCategoriesResponseSchema = z.object({
  mode: z.enum(["PUBLISHED", "UNPUBLISHED"]),
  locale: z.enum(["fa", "en", "ar"]),
  propertySlug: z.string(),
  roomCategories: z.array(z.object({
    slug: z.string(), name: z.string(), description: z.string().nullable(), localizedText: publicLocalizedText,
    maxAdults: z.number().int(), maxChildren: z.number().int(), maxOccupancy: z.number().int(), beds: z.unknown(), sizeSqm: z.number().int().nullable(), gallery: z.array(galleryItem),
  }).strict()),
}).strict();

export const hotelWebsitePublicErrorSchema = z.object({ error: z.enum(["INVALID_REQUEST", "NOT_FOUND", "UNAVAILABLE"]) }).strict();

export type PublishedHotelWebsiteResponse = z.infer<typeof publishedHotelWebsiteResponseSchema>;
export type HotelWebsiteRoomCategoriesResponse = z.infer<typeof hotelWebsiteRoomCategoriesResponseSchema>;
