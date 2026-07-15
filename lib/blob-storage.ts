import {
  deleteVercelBlobObject,
  getVercelBlobObject,
  uploadVercelBlobObject,
} from "@/lib/storage/vercel-blob-storage";

// Vercel Blob storage - requires BLOB_READ_WRITE_TOKEN in all environments
export function shouldUseVercelBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function isLocalBlobStorage() {
  return !shouldUseVercelBlob();
}

export function canServeLocalBlobStorage() {
  return false; // Vercel Blob only - no local serving
}

export async function uploadToBlob(
  filename: string,
  buffer: Buffer,
  contentType: string,
  access: "PUBLIC" | "PRIVATE"
): Promise<{ url: string; access: "public" | "private" }> {
  if (!shouldUseVercelBlob()) {
    throw new Error("BLOB_READ_WRITE_TOKEN environment variable is required for image storage");
  }

  const preferredAccess = access === "PUBLIC" ? "public" : "private";

  async function putWithAccess(blobAccess: "public" | "private") {
    const blob = await uploadVercelBlobObject({ key: filename, buffer, contentType, access: blobAccess });
    return { url: blob.url, access: blobAccess };
  }

  try {
    return await putWithAccess(preferredAccess);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (preferredAccess === "public" && /public access on a private store/i.test(message)) {
      return putWithAccess("private");
    }

    if (preferredAccess === "private" && /private access on a public store/i.test(message)) {
      return putWithAccess("public");
    }

    throw error;
  }
}

export async function deleteFromBlob(pathname: string): Promise<void> {
  if (!shouldUseVercelBlob()) {
    throw new Error("BLOB_READ_WRITE_TOKEN environment variable is required for image storage");
  }

  await deleteVercelBlobObject(pathname);
}

export async function getFromBlob(pathname: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!shouldUseVercelBlob()) {
    throw new Error("BLOB_READ_WRITE_TOKEN environment variable is required for image storage");
  }

  const result = await getVercelBlobObject(pathname);
  if (!result) {
    throw new Error("Blob not found");
  }
  const chunks: Buffer[] = [];
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: result.headers.get("content-type") || "application/octet-stream",
  };
}
