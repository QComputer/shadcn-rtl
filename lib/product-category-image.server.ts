import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";

const imageIdSchema = z.string().min(1).max(200).nullable();

/** Undefined leaves an existing image intact; null explicitly removes it. */
export async function resolveProductCategoryImage(organizationId: string, imageId: unknown) {
  if (imageId === undefined) return undefined;
  const id = imageIdSchema.parse(imageId);
  if (id === null) return null;
  const image = await prisma.image.findFirst({
    where: { id, organizationId, access: "PUBLIC" },
    select: { url: true },
  });
  if (!image) throw new ApiError(400, "Choose a public image belonging to this store.");
  return image.url;
}
