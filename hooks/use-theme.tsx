"use client"

import * as React from "react"

export type Theme = "light" | "dark" | "system"

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
  defaultTheme = "system",
  storageKey = "shadcn-rtl-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") {
      return defaultTheme
    }
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme
  })

  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const root = window.document.documentElement

    // Remove old theme class
    root.classList.remove("light", "dark")

    // Resolve system theme
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"

    // Determine the resolved theme
    const resolved = theme === "system" ? systemTheme : theme
    setResolvedTheme(resolved)

    // Apply the theme class
    root.classList.add(resolved)
    
    // Also set data-theme attribute for custom themes
    root.setAttribute("data-theme", theme)
  }, [theme])

  // Listen for system theme changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    
    const handleChange = () => {
      if (theme === "system") {
        const resolved = mediaQuery.matches ? "dark" : "light"
        setResolvedTheme(resolved)
        
        const root = window.document.documentElement
        root.classList.remove("light", "dark")
        root.classList.add(resolved)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(storageKey, newTheme)
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
