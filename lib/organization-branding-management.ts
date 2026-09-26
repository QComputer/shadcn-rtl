import { z } from "zod";

const safeUrl = z.string().trim().min(1).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Asset URL must be an internal path or an http(s) URL");

const optionalUrl = z.union([safeUrl, z.literal("")]).optional().nullable();
const optionalColor = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a six-digit hex value"), z.literal("")]).optional().nullable();

export const organizationBrandingPatchSchema = z.object({
  displayName: z.string().trim().max(120).optional().nullable(),
  applicationName: z.string().trim().max(120).optional().nullable(),
  shortName: z.string().trim().max(40).optional().nullable(),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  appleTouchIconUrl: optionalUrl,
  pwaIcon192Url: optionalUrl,
  pwaIcon512Url: optionalUrl,
  pwaMaskable192Url: optionalUrl,
  pwaMaskable512Url: optionalUrl,
  monochromeIconUrl: optionalUrl,
  markUrl: optionalUrl,
  logoInverseUrl: optionalUrl,
  ogImageUrl: optionalUrl,
  themeColor: optionalColor,
  backgroundColor: optionalColor,
}).strict();

export type OrganizationBrandingPatch = z.infer<typeof organizationBrandingPatchSchema>;
