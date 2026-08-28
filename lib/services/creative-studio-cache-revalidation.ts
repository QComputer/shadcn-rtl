import { revalidatePath, revalidateTag } from "next/cache";
import { supportedLocales } from "@/lib/i18n";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

export type CreativeStudioApplyTargetField =
  | "product.image"
  | "organization.logo"
  | "organization.coverImage"
  | "fanpagePost.image";

export type CreativeStudioRevalidationInput =
  | {
      targetField: "product.image";
      organizationSlug: string;
      productSlugOrId: string;
      categorySlugOrId?: string | null;
    }
  | {
      targetField: "organization.logo" | "organization.coverImage";
      organizationSlug: string;
    }
  | {
      targetField: "fanpagePost.image";
      organizationSlug: string;
    };

export type CreativeStudioRevalidationResult = {
  attempted: true;
  paths: string[];
  warnings: string[];
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function revalidateCreativeStudioPublicTarget(input: CreativeStudioRevalidationInput): CreativeStudioRevalidationResult {
  const paths: string[] = [];
  const warnings: string[] = [];

  for (const locale of supportedLocales) {
    if (input.targetField === "product.image") {
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop" }));
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop", subPath: `/product/${input.productSlugOrId}` }));
      if (input.categorySlugOrId) {
        paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop", subPath: `/category/${input.categorySlugOrId}` }));
      }
    }

    if (input.targetField === "organization.logo" || input.targetField === "organization.coverImage") {
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop" }));
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop", subPath: "/fanpage" }));
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop", subPath: "/profile" }));
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "appointment" }));
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "appointment", subPath: "/fanpage" }));
    }

    if (input.targetField === "fanpagePost.image") {
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "shop", subPath: "/fanpage" }));
      paths.push(buildOrganizationPublicPath({ locale, organizationSlug: input.organizationSlug, surface: "appointment", subPath: "/fanpage" }));
    }
  }

  for (const path of unique(paths)) {
    try {
      revalidatePath(path);
    } catch (error) {
      warnings.push(`${path}: ${error instanceof Error ? error.message : "revalidation failed"}`);
    }
  }

  try {
    revalidateTag("home-page", "max");
  } catch (error) {
    warnings.push(`home-page tag: ${error instanceof Error ? error.message : "revalidation failed"}`);
  }

  return { attempted: true, paths: unique(paths), warnings };
}
