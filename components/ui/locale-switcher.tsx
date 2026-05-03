"use client"

import * as React from "react"
import { supportedLocales, localeConfig, type SupportedLocale } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"

interface LocaleSwitcherProps {
  className?: string
  variant?: "default" | "outline" | "ghost" | "link" | "secondary" | "destructive" | null | undefined
  size?: "default" | "sm" | "lg" | "icon" | null | undefined
}

export function LocaleSwitcher({
  className,
  variant = "ghost",
  size = "default"
}: LocaleSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentLocale, setCurrentLocale] = React.useState<SupportedLocale>("fa")
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // Get locale from cookie on mount
    if (typeof window !== "undefined") {
      const cookieLocale = document.cookie
        .split("; ")
        .find((row) => row.startsWith("locale="))
        ?.split("=")[1] as SupportedLocale | undefined

      if (cookieLocale && supportedLocales.includes(cookieLocale)) {
        setCurrentLocale(cookieLocale)
      }
    }
  }, [])

  React.useEffect(() => {
    // Update document direction when locale changes
    const dir = currentLocale === "fa" || currentLocale === "ar" ? "rtl" : "ltr"
    document.documentElement.dir = dir
    document.documentElement.lang = currentLocale
  }, [currentLocale])

  const handleLocaleChange = (locale: SupportedLocale) => {
    setCurrentLocale(locale)
    setIsOpen(false)
    
    // Set cookie
    document.cookie = `locale=${locale};path=/;max-age=31536000`
    
    // Get current path without locale
    const currentPath = window.location.pathname
    const pathParts = currentPath.split("/").filter(Boolean)
    
    // Check if first part is a locale
    if (supportedLocales.includes(pathParts[0] as SupportedLocale)) {
      pathParts[0] = locale
    } else {
      pathParts.unshift(locale)
    }
    
    const newPath = "/" + pathParts.join("/")
    window.location.href = newPath || "/"
  }

  const isRTL = currentLocale === "fa" || currentLocale === "ar"

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="تغییر زبان"
        aria-expanded={isOpen}
      >
        <Globe className="h-4 w-4" />
        <span className={isRTL ? "mr-2" : "ml-2"}>
          {localeConfig[currentLocale].nativeName}
        </span>
      </Button>
      
      {isOpen && (
        <div 
          className={`
            absolute top-full mt-1 z-50 min-w-[140px] 
            rounded-lg bg-popover p-1 shadow-md ring-1 ring-border
            ${isRTL ? "left-0" : "right-0"}
          `}
        >
          {supportedLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`
                flex w-full items-center rounded-md px-2 py-1.5 text-sm 
                hover:bg-accent hover:text-accent-foreground
                ${currentLocale === loc ? "bg-accent" : ""}
              `}
            >
              <span className={isRTL ? "ml-2" : "mr-2"}>
                {localeConfig[loc].dir === "rtl" ? "←" : "→"}
              </span>
              {localeConfig[loc].nativeName}
              {loc === currentLocale && (
                <span className="mr-auto text-xs text-muted-foreground">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// Simplified version with basic select styling
export function SimpleLocaleSwitcher({
  className,
  currentLocale = "fa",
  onChange
}: {
  className?: string
  currentLocale?: SupportedLocale
  onChange?: (locale: SupportedLocale) => void
}) {
  const isRTL = currentLocale === "fa" || currentLocale === "ar"

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value as SupportedLocale
    
    if (onChange) {
      onChange(newLocale)
    } else {
      // Default behavior: redirect to locale-prefixed path
      document.cookie = `locale=${newLocale};path=/;max-age=31536000`
      
      const currentPath = window.location.pathname
      const pathParts = currentPath.split("/").filter(Boolean)
      
      if (supportedLocales.includes(pathParts[0] as SupportedLocale)) {
        pathParts[0] = newLocale
      } else {
        pathParts.unshift(newLocale)
      }
      
      window.location.href = "/" + pathParts.join("/") || "/"
    }
  }

  return (
    <select
      value={currentLocale}
      onChange={handleChange}
      className={`
        rounded-md border border-input bg-background px-3 py-1.5 
        text-sm focus:outline-none focus:ring-2 focus:ring-ring
        ${className}
      `}
      aria-label="انتخاب زبان"
    >
      {supportedLocales.map((loc) => (
        <option key={loc} value={loc}>
          {localeConfig[loc].nativeName}
        </option>
      ))}
    </select>
  )
}
