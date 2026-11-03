"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/hooks/use-theme";
import { retailBrandStyle } from "@/lib/retail/brand-color";

import { RetailBrandContext } from "@/lib/contexts/retail-brand-context";

/** React context also carries the same scoped variables into Radix portals. */
export function RetailBrandScope({ color, children }: { color?: string | null; children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const style = retailBrandStyle(color, resolvedTheme);
  return <RetailBrandContext.Provider value={style}><div data-retail-brand-scope style={style}>{children}</div></RetailBrandContext.Provider>;
}
