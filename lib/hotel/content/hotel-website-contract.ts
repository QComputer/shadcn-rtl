import { z } from "zod";

const plainText = (max: number) => z.string().trim().max(max).refine((value) => !/<\/?[a-z][\s\S]*>/i.test(value), "HTML markup is not accepted");

export const hotelWebsiteLocalizedTextSchema = z.object({
  fa: plainText(4000).optional(),
  en: plainText(4000).optional(),
  ar: plainText(4000).optional(),
}).strict();

const localizedRequired = hotelWebsiteLocalizedTextSchema.refine(
  (value) => Object.values(value).some((text) => typeof text === "string" && text.length > 0),
  "Provide text in at least one supported locale",
);

const sectionBase = {
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  order: z.number().int().safe().min(0).max(1000),
  visible: z.boolean(),
};

const editorialSectionSchema = z.discriminatedUnion("kind", [
  z.object({ ...sectionBase, kind: z.literal("TEXT"), heading: hotelWebsiteLocalizedTextSchema, body: localizedRequired }).strict(),
  z.object({ ...sectionBase, kind: z.literal("FEATURE_LIST"), heading: localizedRequired, items: z.array(z.object({ key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), label: localizedRequired, description: hotelWebsiteLocalizedTextSchema.optional() }).strict()).max(30) }).strict(),
  z.object({ ...sectionBase, kind: z.literal("FAQ"), heading: hotelWebsiteLocalizedTextSchema, items: z.array(z.object({ question: localizedRequired, answer: localizedRequired }).strict()).max(30) }).strict(),
]);

export const hotelWebsiteContentSchema = z.object({
  title: localizedRequired,
  hero: z.object({
    eyebrow: hotelWebsiteLocalizedTextSchema.optional(),
    heading: localizedRequired,
    subheading: hotelWebsiteLocalizedTextSchema.optional(),
  }).strict(),
  introduction: z.object({
    heading: hotelWebsiteLocalizedTextSchema.optional(),
    body: localizedRequired,
  }).strict(),
  sections: z.array(editorialSectionSchema).max(40).superRefine((sections, context) => {
    const keys = new Set<string>();
    const positions = new Set<number>();
    for (const section of sections) {
      if (keys.has(section.key)) context.addIssue({ code: "custom", message: "Section keys must be unique" });
      if (positions.has(section.order)) context.addIssue({ code: "custom", message: "Section ordering must be unique" });
      keys.add(section.key);
      positions.add(section.order);
    }
  }),
  contact: z.object({
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().max(254).optional(),
    address: hotelWebsiteLocalizedTextSchema.optional(),
  }).strict(),
}).strict();

export const hotelWebsiteMediaAssociationInputSchema = z.object({
  imageId: z.string().trim().min(1).max(128),
  scope: z.enum(["PROPERTY", "ROOM_CATEGORY"]),
  roomTypeId: z.string().trim().min(1).max(128).nullable(),
  slot: z.enum(["GALLERY", "HERO_DESKTOP", "HERO_MOBILE"]).default("GALLERY"),
  sortOrder: z.number().int().safe().min(0).max(1000),
  altText: hotelWebsiteLocalizedTextSchema,
}).strict().superRefine((value, context) => {
  if (value.scope === "PROPERTY" && value.roomTypeId !== null) context.addIssue({ code: "custom", path: ["roomTypeId"], message: "Property media cannot reference a room category" });
  if (value.scope === "ROOM_CATEGORY" && value.roomTypeId === null) context.addIssue({ code: "custom", path: ["roomTypeId"], message: "Room-category media requires a room type" });
});

export const createHotelWebsiteDraftSchema = z.object({
  content: hotelWebsiteContentSchema,
  media: z.array(hotelWebsiteMediaAssociationInputSchema).max(80),
}).strict().superRefine(({ media }, context) => {
  const orders = new Set<string>();
  for (const item of media) {
    const key = `${item.scope}:${item.roomTypeId ?? "property"}:${item.slot}:${item.sortOrder}`;
    if (orders.has(key)) context.addIssue({ code: "custom", path: ["media"], message: "Gallery order must be unique within each scope and slot" });
    orders.add(key);
  }
});

export type HotelWebsiteContent = z.infer<typeof hotelWebsiteContentSchema>;
export type HotelWebsiteMediaAssociationInput = z.infer<typeof hotelWebsiteMediaAssociationInputSchema>;

export const hotelWebsitePublishedPageSchema = z.object({
  mode: z.literal("PUBLISHED"),
  locale: z.enum(["fa", "en", "ar"]),
  propertySlug: z.string(),
  content: hotelWebsiteContentSchema,
  propertyGallery: z.array(z.object({ src: z.string().startsWith("/api/"), altText: hotelWebsiteLocalizedTextSchema, sortOrder: z.number().int().safe().min(0) }).strict()),
  roomGalleries: z.array(z.object({ roomTypeSlug: z.string(), items: z.array(z.object({ src: z.string().startsWith("/api/"), altText: hotelWebsiteLocalizedTextSchema, sortOrder: z.number().int().safe().min(0) }).strict()) }).strict()),
}).strict();

export const hotelWebsiteDraftPreviewSchema = z.object({
  mode: z.literal("PREVIEW"),
  locale: z.enum(["fa", "en", "ar"]),
  propertySlug: z.string(),
  revisionNumber: z.number().int().positive(),
  content: hotelWebsiteContentSchema,
  propertyGallery: z.array(z.object({ src: z.string().startsWith("/api/"), altText: hotelWebsiteLocalizedTextSchema, sortOrder: z.number().int().safe().min(0) }).strict()),
  roomGalleries: z.array(z.object({ roomTypeSlug: z.string(), items: z.array(z.object({ src: z.string().startsWith("/api/"), altText: hotelWebsiteLocalizedTextSchema, sortOrder: z.number().int().safe().min(0) }).strict()) }).strict()),
}).strict();

export type HotelWebsitePublishedPage = z.infer<typeof hotelWebsitePublishedPageSchema>;
export type HotelWebsiteDraftPreview = z.infer<typeof hotelWebsiteDraftPreviewSchema>;
