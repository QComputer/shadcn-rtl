import { NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess, requireRole } from "@/lib/api-guards";
import { getPersistentDiskAssetMetadata, readPersistentDiskAsset } from "@/lib/storage/persistent-disk-storage";
import { PLATFORM_MEDIA_NAMESPACE, usesPersistentMedia } from "@/lib/storage/tenant-image-storage.server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string; key: string[] }> }) {
  try {
    if (!usesPersistentMedia()) throw new ApiError(404, "Media not found");
    const { organizationId, key } = await params;
    if (!/^[A-Za-z0-9_-]+$/.test(organizationId) || key.length < 3 || key.some(part => !/^[A-Za-z0-9._-]+$/.test(part) || part === "." || part === "..") || key[1] !== organizationId) {
      throw new ApiError(404, "Media not found");
    }
    const reference = { organizationId, key: key.join("/") };
    const metadata = await getPersistentDiskAssetMetadata(reference);
    if (!metadata) throw new ApiError(404, "Media not found");
    // Receipts are served only through the established audited payment-receipt API.
    if (key[0] === "retail-payment") throw new ApiError(404, "Media not found");
    if (metadata.access === "private") {
      const session = await requireAuthSession();
      if (organizationId === PLATFORM_MEDIA_NAMESPACE) requireRole(session, ["SUPER_ADMIN"]);
      else await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
    }
    const asset = await readPersistentDiskAsset(reference);
    if (!asset) throw new ApiError(404, "Media not found");
    return new NextResponse(new Uint8Array(asset.buffer), { headers: {
      "Content-Type": metadata.mimeType,
      "Content-Length": String(asset.buffer.length),
      "Cache-Control": metadata.access === "private" ? "private, no-store" : "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "ETag": `"${metadata.checksumSha256}"`,
    } });
  } catch (error) { return jsonError(error, "Could not load media"); }
}
