/** A public image association returned from a tenant-owned product relation. */
export type TenantProductImage = {
  url: string;
  organizationId: string | null;
  access: "PUBLIC" | "PRIVATE" | string;
};

/**
 * Public catalog image policy: allow same-origin absolute paths and HTTPS CDN
 * URLs, but reject protocol-relative URLs, credentials, control characters,
 * and non-HTTPS schemes such as javascript:, data:, and vbscript:.
 */
export function isSafePublicMediaUrl(value: string) {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    try { return new URL(value, "https://bazarbaaz.invalid").origin === "https://bazarbaaz.invalid"; } catch { return false; }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

/** Filter already product-associated media at the server projection boundary. */
export function filterTenantPublicProductImages<T extends TenantProductImage>(images: readonly T[], organizationId: string): T[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (image.organizationId !== organizationId || image.access !== "PUBLIC" || !isSafePublicMediaUrl(image.url) || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}
