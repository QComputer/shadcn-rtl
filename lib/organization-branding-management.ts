import { z } from "zod";

const safeAssetUrl = z.string().trim().min(1).max(2048).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Asset URL must be a same-origin path or HTTPS URL");

const optionalAssetUrl = safeAssetUrl.optional().nullable();
const optionalColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable();

export const organizationBrandingPatchSchema = z.object({
  displayName: z.string().trim().max(120).optional().nullable(),
  shortName: z.string().trim().max(40).optional().nullable(),
  logoUrl: optionalAssetUrl,
  faviconUrl: optionalAssetUrl,
  appleTouchIconUrl: optionalAssetUrl,
  pwaIcon192Url: optionalAssetUrl,
  pwaIcon512Url: optionalAssetUrl,
  pwaMaskable192Url: optionalAssetUrl,
  pwaMaskable512Url: optionalAssetUrl,
  ogImageUrl: optionalAssetUrl,
  themeColor: optionalColor,
  backgroundColor: optionalColor,
}).strict();
