/** Shared section semantics; vertical content stays in its own contract. */
export function moveWebsiteSection<T extends { sections: { key: string; order: number }[] }>(content: T, key: string, direction: -1 | 1): T {
  const ordered = [...content.sections].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const index = ordered.findIndex((section) => section.key === key);
  const neighbor = ordered[index + direction];
  const current = ordered[index];
  if (!current || !neighbor) return content;
  return { ...content, sections: content.sections.map((section) => section.key === current.key
    ? { ...section, order: neighbor.order } : section.key === neighbor.key ? { ...section, order: current.order } : section) };
}

/** Reuse the Hotel picker policy: explicitly public tenant uploads only. */
export function isEligibleWebsiteImage(image: { filename: string | null; url: string; mimeType: string | null }) {
  if (!image.filename || !/^[A-Za-z0-9_.-]+$/.test(image.filename)) return false;
  if (!image.mimeType || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.mimeType)) return false;
  if (image.url === `/uploads/${image.filename}`) return true;
  try {
    const url = new URL(image.url);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && url.pathname.split("/").at(-1) === image.filename;
  } catch { return false; }
}

/** Persistent disk URLs are eligible only when matched to an authorized Image record. */
export function isTenantDiskWebsiteImage(image: { filename: string | null; url: string; mimeType: string | null; id?: string; organizationId?: string | null; access?: string }) {
  if (image.access !== "PUBLIC" || !image.organizationId || !image.filename || !image.id || !image.mimeType
    || !["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)
    || !/^[A-Za-z0-9_-]+$/.test(image.organizationId)
    || !/^[A-Za-z0-9_.-]+$/.test(image.filename)) return false;
  try {
    const url = new URL(image.url, "https://bazarbaaz.invalid");
    if (/%2f|%5c/i.test(url.pathname)) return false;
    const rawParts = url.pathname.split("/").filter(Boolean);
    const parts = rawParts.map(decodeURIComponent);
    return url.origin === "https://bazarbaaz.invalid" && parts.length === 5 && parts[0] === "api" && parts[1] === "media"
      && parts[2] === image.organizationId && parts[3] === "tenants" && parts[4] === image.filename
      && url.search === "" && url.hash === "";
  } catch { return false; }
}
