"use client";

import React from "react";
import { useGuestCart } from "@/lib/contexts/guest-cart-context";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface CartBadgeProps {
  className?: string;
  iconClassName?: string;
  badgeClassName?: string;
}

export function CartBadge({ className, iconClassName, badgeClassName }: CartBadgeProps) {
  const { summary, isLoading } = useGuestCart();

  if (isLoading) {
    return (
      <div className={cn("relative", className)}>
        <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
      {summary.itemCount > 0 && (
        <span
          className={cn(
            "absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium",
            badgeClassName
          )}
        >
          {summary.itemCount > 99 ? "99+" : summary.itemCount}
        </span>
      )}
    </div>
  );
}
