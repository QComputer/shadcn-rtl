"use client";

import { Calendar, ImageIcon, Package, Store } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type PublicImageKind = "organization" | "shop" | "product" | "service";

const iconByKind = {
  organization: Store,
  shop: Store,
  product: Package,
  service: Calendar,
} satisfies Record<PublicImageKind, typeof Store>;

export function PublicImage({
  src,
  alt,
  kind = "organization",
  className,
  fallbackClassName,
  loading = "lazy",
  decorative = false,
}: {
  src?: string | null;
  alt: string;
  kind?: PublicImageKind;
  className?: string;
  fallbackClassName?: string;
  loading?: "eager" | "lazy";
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = typeof src === "string" && src.trim().length > 0 ? src : null;

  if (!normalizedSrc || failed) {
    const Icon = iconByKind[kind] ?? ImageIcon;
    return (
      <div
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
        role={decorative ? undefined : "img"}
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted text-primary/45",
          fallbackClassName,
          className,
        )}
      >
        <Icon className="h-1/3 min-h-6 w-1/3 min-w-6 max-w-16" />
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
