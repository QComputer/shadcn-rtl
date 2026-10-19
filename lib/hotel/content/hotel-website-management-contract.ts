import { z } from "zod";
import { createHotelWebsiteDraftSchema, hotelWebsiteContentSchema } from "@/lib/hotel/content/hotel-website-contract";

export const hotelWebsiteReviewNoteSchema = z.object({ note: z.string().trim().max(1000).optional() }).strict();
export const hotelWebsiteRevokeSchema = z.object({ reason: z.string().trim().min(1).max(1000).optional() }).strict();

export type HotelWebsiteDraftRequest = z.infer<typeof createHotelWebsiteDraftSchema>;
export type HotelWebsiteReviewNote = z.infer<typeof hotelWebsiteReviewNoteSchema>;
export type HotelWebsiteRevokeRequest = z.infer<typeof hotelWebsiteRevokeSchema>;

export type HotelWebsiteRevisionSummary = {
  revisionId: string;
  revisionNumber: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  content: z.infer<typeof hotelWebsiteContentSchema>;
  contentSha256: string;
  createdAt: string;
};

export type HotelWebsitePreviewResponse = {
  mode: "PREVIEW";
  locale: "fa" | "en" | "ar";
  revisionId: string;
  revisionNumber: number;
  status: HotelWebsiteRevisionSummary["status"];
  pageKey: string;
  content: HotelWebsiteRevisionSummary["content"];
  media: Array<{ imageId: string; src: string; scope: "PROPERTY" | "ROOM_CATEGORY"; roomTypeId: string | null; slot: string; sortOrder: number; altText: Record<string, string> }>;
};
