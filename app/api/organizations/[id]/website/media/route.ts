import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { createStoredImageFilename, deleteStoredImage, writeStoredImage } from "@/lib/media-storage";
import { RetailWebsiteService } from "@/lib/website-studio/retail.service";
import { retailWebsiteMedia } from "@/lib/website-studio/brand-media";
import { MAX_RETAIL_HERO_UPLOAD_BYTES, validateRetailHeroUpload } from "@/lib/website-studio/hero-upload.server";

export const runtime = "nodejs";
const service = new RetailWebsiteService();
const MAX_BYTES = MAX_RETAIL_HERO_UPLOAD_BYTES;
type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const session = await requireAuthSession();
  const principal = { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId };
  const loaded = await service.load(principal, id);
  return { session, organizationId: loaded.organization.id! };
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { organizationId } = await authorize(id);
    const rows = await prisma.image.findMany({ where: { organizationId, access: "PUBLIC" }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, organizationId: true } });
    const eligibleIds = new Set(retailWebsiteMedia(organizationId, rows).map((image) => image.id));
    const images = rows.filter((image) => eligibleIds.has(image.id));
    return NextResponse.json({ images }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, "بارگذاری گالری فروشگاه انجام نشد."); }
}

export async function POST(request: Request, { params }: Context) {
  let stored: { pathname: string; url: string } | null = null;
  let createdId: string | null = null;
  let ownerId: string | null = null;
  try {
    requireSameOriginMutation(request);
    const { id } = await params;
    const { session, organizationId } = await authorize(id);
    ownerId = organizationId;
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isSafeInteger(length) || length <= 0) throw new ApiError(411, "اندازه درخواست تصویر مشخص نیست.");
    if (length > MAX_BYTES + 64 * 1024) throw new ApiError(413, "حداکثر اندازه تصویر ۵ مگابایت است.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "یک فایل تصویر انتخاب کنید.");
    if (file.size > MAX_BYTES) throw new ApiError(413, "حداکثر اندازه تصویر ۵ مگابایت است.");
    const buffer = Buffer.from(await file.arrayBuffer());
    await validateRetailHeroUpload(buffer, file.type, file.size);
    const filename = createStoredImageFilename(file.type, "retail-hero");
    stored = await writeStoredImage(filename, buffer, "PUBLIC", organizationId);
    const image = await prisma.$transaction(async (tx) => {
      const created = await tx.image.create({ data: {
        url: stored!.url, filename: stored!.pathname, mimeType: file.type, sizeBytes: buffer.length,
        purpose: "retail-hero", access: "PUBLIC", uploadedByUserId: session.user.id, organizationId,
      }, select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, organizationId: true } });
      createdId = created.id;
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "Image", entityId: created.id, description: "Uploaded a Retail Website Studio hero image.", userId: session.user.id, organizationId, newValue: { mimeType: file.type, sizeBytes: buffer.length, purpose: "retail-hero", access: "PUBLIC" } } });
      return created;
    });
    return NextResponse.json({ image }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (createdId) await prisma.image.deleteMany({ where: { id: createdId } }).catch(() => undefined);
    if (stored && ownerId) await deleteStoredImage(stored.pathname, ownerId).catch(() => undefined);
    return jsonError(error, "آپلود تصویر انجام نشد.");
  }
}
