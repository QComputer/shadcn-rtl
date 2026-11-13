import "server-only";
import { isEligibleWebsiteImage } from "./core";
import type { WebsiteMedia } from "./retail-contract";

function isCanonicalTenantDiskUrl(url: string, organizationId: string, filename: string) {
  const raw = url.split("/");
  if (raw.length !== 8 || raw[0] !== "" || raw[1] !== "api" || raw[2] !== "media") return false;
  try {
    const encoded = raw.slice(3);
    const decoded = encoded.map((part) => decodeURIComponent(part));
    const [routeOrg, tenants, keyOrg, uploads, keyFilename] = decoded;
    return encoded.every((part, index) => encodeURIComponent(decoded[index]!) === part)
      && routeOrg === organizationId && tenants === "tenants" && keyOrg === organizationId
      && uploads === "uploads" && keyFilename === filename
      && /^[A-Za-z0-9_-]+$/.test(organizationId)
      && /^[A-Za-z0-9_.-]+$/.test(filename) && !filename.includes("..");
  } catch { return false; }
}

/** Images are selected from PUBLIC Image rows scoped by the owning organization. */
export function retailWebsiteMedia(organizationId: string, images: WebsiteMedia[]) {
  return images.filter((image) => image.organizationId === organizationId && (isEligibleWebsiteImage(image)
    || (Boolean(image.filename) && isCanonicalTenantDiskUrl(image.url, organizationId, image.filename!))));
}
