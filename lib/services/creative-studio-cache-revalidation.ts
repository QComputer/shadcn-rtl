import { revalidatePath, revalidateTag } from "next/cache";
import { supportedLocales } from "@/lib/i18n";

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
      paths.push(`/${locale}/shop/${input.organizationSlug}`);
      paths.push(`/${locale}/shop/${input.organizationSlug}/product/${input.productSlugOrId}`);
      if (input.categorySlugOrId) {
        paths.push(`/${locale}/shop/${input.organizationSlug}/category/${input.categorySlugOrId}`);
      }
    }

    if (input.targetField === "organization.logo" || input.targetField === "organization.coverImage") {
      paths.push(`/${locale}/shop/${input.organizationSlug}`);
      paths.push(`/${locale}/shop/${input.organizationSlug}/fanpage`);
      paths.push(`/${locale}/shop/${input.organizationSlug}/profile`);
      paths.push(`/${locale}/appointment/${input.organizationSlug}`);
      paths.push(`/${locale}/appointment/${input.organizationSlug}/fanpage`);
    }

    if (input.targetField === "fanpagePost.image") {
      paths.push(`/${locale}/shop/${input.organizationSlug}/fanpage`);
      paths.push(`/${locale}/appointment/${input.organizationSlug}/fanpage`);
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
