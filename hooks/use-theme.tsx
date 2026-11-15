"use client"

import * as React from "react"

export type Theme = "light" | "dark" | "warm-cream" | "charcoal-gray" | "system"

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "shadcn-rtl-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [preferenceLoaded, setPreferenceLoaded] = React.useState(false)

  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("dark")

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved === "light" || saved === "dark" || saved === "warm-cream" || saved === "charcoal-gray" || saved === "system") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore a browser-only preference after hydration to keep server and client markup identical.
        setThemeState(saved)
      }
    } catch {
      // Storage can be unavailable; the server default remains usable.
    }
    setPreferenceLoaded(true)
  }, [storageKey])

  React.useEffect(() => {
    if (!preferenceLoaded) return
    const root = window.document.documentElement

    // Remove old theme class
    root.classList.remove("light", "dark", "warm-cream", "charcoal-gray")

    // Resolve system theme
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"

    // Determine the resolved theme
    let resolved: "light" | "dark"
    
    if (theme === "system") {
      resolved = systemTheme
    } else if (theme === "light" || theme === "warm-cream") {
      resolved = "light"
    } else {
      resolved = "dark"
    }
    
    setResolvedTheme(resolved)

    // Apply the theme class (for backward compatibility with .dark class)
    root.classList.add(resolved)
    
    // Also set data-theme attribute for custom themes
    root.setAttribute("data-theme", theme)
  }, [theme, preferenceLoaded])

  // Listen for system theme changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    
    const handleChange = () => {
      if (theme === "system") {
        const resolved = mediaQuery.matches ? "dark" : "light"
        setResolvedTheme(resolved)
        
        const root = window.document.documentElement
        root.classList.remove("light", "dark", "warm-cream", "charcoal-gray")
        root.classList.add(resolved)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(storageKey, newTheme)
    } catch {
      // Keep the in-memory theme switch working when storage is unavailable.
    }
  }, [storageKey])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

// Helper to get theme value for components that need it
export function useResolvedTheme() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme
}

// Hook for components that need to react to theme changes
export function useThemeEffect(callback: (theme: "light" | "dark") => void) {
  const { resolvedTheme } = useTheme()
  
  React.useEffect(() => {
    callback(resolvedTheme)
  }, [callback, resolvedTheme])
}

// Theme display names for UI (in Persian)
export const themeNames: Record<Theme, string> = {
  light: "سفید",
  dark: "تیره",
  "warm-cream": "کرم گرم",
  "charcoal-gray": "خاکستری",
  system: "سیستم",
}

// Theme descriptions (in Persian)
export const themeDescriptions: Record<Theme, string> = {
  light: "تم روشن و سفید",
  dark: "تم تیره با رنگ آبی",
  "warm-cream": "تم روشن با رنگ کرم گرم",
  "charcoal-gray": "تم تیره با رنگ خاکستری تیره",
  system: "پیروی از تنظیمات سیستم",
}
