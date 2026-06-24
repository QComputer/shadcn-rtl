import { put, del, get } from "@vercel/blob";

export async function uploadToBlob(
  filename: string,
  buffer: Buffer,
  contentType: string,
  access: "PUBLIC" | "PRIVATE"
): Promise<string> {
  const blob = await put(filename, buffer, {
    contentType,
    access: access === "PUBLIC" ? "public" : "private",
  });
  return blob.url;
}

export async function deleteFromBlob(pathname: string): Promise<void> {
  await del(pathname, {});
}

export async function getFromBlob(pathname: string): Promise<{ buffer: Buffer; contentType: string }> {
  const result = await get(pathname, { access: "private" });
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
