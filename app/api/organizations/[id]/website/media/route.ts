import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { createStoredImageFilename, validateImageBuffer, writeStoredImage } from "@/lib/media-storage";
import { RetailWebsiteService } from "@/lib/website-studio/retail.service";

export const runtime = "nodejs";
const service = new RetailWebsiteService();
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request, { params }: Context) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const organizationId = (await params).id;
    const principal = { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId };
    // Reuse Studio authorization for active tenant membership, ADMIN/MANAGER
    // role, and the active SHOP capability (SUPER_ADMIN is rechecked in DB).
    await service.load(principal, organizationId);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "یک تصویر برای بارگذاری انتخاب کنید.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ApiError(415, "فقط تصویر JPEG، PNG یا WebP مجاز است.");
    const buffer = Buffer.from(await file.arrayBuffer());
    validateImageBuffer(buffer, file.type, file.size);
    const stored = await writeStoredImage(createStoredImageFilename(file.type, "retail-website"), buffer, "PUBLIC", organizationId);
    const image = await prisma.image.create({ data: {
      url: stored.url, filename: stored.pathname, mimeType: file.type, sizeBytes: file.size,
      purpose: "retail-website", access: "PUBLIC", uploadedByUserId: session.user.id, organizationId,
    }, select: { id: true, url: true, filename: true, mimeType: true, organizationId: true, access: true } });
    await prisma.auditLog.create({ data: {
      action: "CREATE", entityType: "Image", entityId: image.id,
      description: "Uploaded a Retail website image.", userId: session.user.id, organizationId,
      newValue: { mimeType: image.mimeType, sizeBytes: file.size, purpose: "retail-website", access: image.access },
    } });
    return NextResponse.json({ image }, { status: 201, headers });
  } catch (error) {
    const response = jsonError(error, "بارگذاری تصویر وب‌سایت انجام نشد.");
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    return response;
  }
}
