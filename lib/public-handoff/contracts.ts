import { z } from "zod";

export const PUBLIC_HANDOFF_VERSION = "v1" as const;

export const publicHandoffQuerySchema = z.object({
  externalSource: z.string().trim().min(1).max(160),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
}).strict();

export type PublicHandoffItem = {
  externalId: string;
  purchase: { href: string } | null;
};

export type PublicHandoffData = {
  organization: { slug: string };
  externalSource: string;
  items: PublicHandoffItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
