import { z } from "zod";

const text = z.string().trim().max(5000);
export const websiteDestination = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  if (/^\/(?!\/)/.test(value) && !/[\\\s\x00-\x1f]/.test(value)) return true;
  try { const url = new URL(value); return ["https:", "tel:", "mailto:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, "نشانی معتبر https، تلفن، ایمیل یا مسیر داخلی وارد کنید.");
const imageId = z.string().max(128);
const common = { key: z.string().min(1).max(80), order: z.number().int().min(0).max(40), visible: z.boolean(), heading: text };
export const retailContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sections: z.array(z.discriminatedUnion("kind", [
    z.object({ ...common, kind: z.literal("HERO"), subtitle: text, body: text, ctaLabel: text, ctaHref: websiteDestination, imageId }),
    z.object({ ...common, kind: z.literal("ABOUT"), body: text, imageId }),
    z.object({ ...common, kind: z.literal("GALLERY"), imageIds: z.array(imageId.min(1)).max(30).refine((ids) => new Set(ids).size === ids.length) }),
    z.object({ ...common, kind: z.literal("FEATURES"), items: z.array(z.object({ heading: text, body: text, icon: z.string().max(8) })).max(30) }),
    z.object({ ...common, kind: z.literal("CONTACT"), address: text, phone: z.string().max(100), email: z.string().max(200), links: z.array(z.object({ label: text, href: websiteDestination })).max(12) }),
  ])).length(5),
}).strict().superRefine((value, ctx) => {
  for (const field of ["key", "order", "kind"] as const) {
    if (new Set(value.sections.map((s) => s[field])).size !== value.sections.length) ctx.addIssue({ code: "custom", path: ["sections"], message: "شناسه، نوع و ترتیب بخش‌ها باید یکتا باشند." });
  }
});
export type RetailContent = z.infer<typeof retailContentSchema>;
export type RetailSection = RetailContent["sections"][number];
export type WebsiteMedia = { id: string; url: string; filename: string | null; mimeType: string | null };
export type WebsiteRevision = { id: string; content: RetailContent; createdAt: string };
export const saveRetailDraftSchema = z.object({ content: retailContentSchema, baseRevisionId: z.string().max(128).nullable(), requestId: z.string().uuid() }).strict();

export function referencedWebsiteImages(content: RetailContent) {
  return [...new Set(content.sections.flatMap((s) => s.kind === "GALLERY" ? s.imageIds : "imageId" in s && s.imageId ? [s.imageId] : []))];
}
export function initialRetailContent(org: { name: string; description: string | null; phone: string | null; address: string | null; email: string | null }): RetailContent {
  return { title: org.name, sections: [
    { key: "hero", kind: "HERO", order: 0, visible: true, heading: org.name, subtitle: "", body: "", ctaLabel: "", ctaHref: "", imageId: "" },
    { key: "about", kind: "ABOUT", order: 1, visible: true, heading: "درباره ما", body: org.description ?? "", imageId: "" },
    { key: "gallery", kind: "GALLERY", order: 2, visible: true, heading: "گالری", imageIds: [] },
    { key: "features", kind: "FEATURES", order: 3, visible: true, heading: "ویژگی‌ها", items: [] },
    { key: "contact", kind: "CONTACT", order: 4, visible: true, heading: "تماس با ما", address: org.address ?? "", phone: org.phone ?? "", email: org.email ?? "", links: [] },
  ] };
}
