"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/hooks/use-theme";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Delay image requests until the persisted theme is known, avoiding a wrong-theme flash. */
export function useCatalogTheme(): "light" | "dark" | null {
  const { resolvedTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!mounted) return null;
  if (theme === "light" || theme === "warm-cream") return "light";
  if (theme === "dark" || theme === "charcoal-gray") return "dark";
  return typeof window !== "undefined" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : resolvedTheme;
}
