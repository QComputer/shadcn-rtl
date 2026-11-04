"use client";

import Image from "next/image";
import { useCatalogTheme } from "./use-catalog-theme";
import { selectCategoryThemeImage } from "@/lib/retail/category-theme-image";

export function ThemeAwareCategoryImage({ light, dark, fallback }: { light?: string | null; dark?: string | null; fallback?: string | null }) {
  const theme = useCatalogTheme();
  const src = selectCategoryThemeImage(theme, light, dark, fallback);
  if (!src) return null;
  return <Image src={src} alt="" fill unoptimized sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />;
}
