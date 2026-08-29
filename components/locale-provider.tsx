"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { supportedLocales, type SupportedLocale } from "@/lib/i18n"
import { appCookiePath } from "@/lib/app-base-path"

interface LocaleContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  isRTL: boolean
  dir: "rtl" | "ltr"
}

const LocaleContext = React.createContext<LocaleContextValue | undefined>(undefined)

interface LocaleProviderProps {
  children: React.ReactNode
  defaultLocale?: SupportedLocale
}

export function LocaleProvider({
  children,
  defaultLocale = "fa"
}: LocaleProviderProps) {
  const [locale, setLocaleState] = React.useState<SupportedLocale>(defaultLocale)
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    // Get locale from cookie on mount
    if (typeof window !== "undefined") {
      const cookieLocale = document.cookie
        .split("; ")
        .find((row) => row.startsWith("locale="))
        ?.split("=")[1] as SupportedLocale | undefined

      if (cookieLocale && supportedLocales.includes(cookieLocale)) {
        setLocaleState(cookieLocale)
      }
    }
  }, [])

  React.useEffect(() => {
    // Update document direction when locale changes
    const dir = locale === "fa" || locale === "ar" ? "rtl" : "ltr"
    document.documentElement.dir = dir
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = React.useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale)
    
    // Set cookie
    document.cookie = `locale=${newLocale};path=${appCookiePath()};max-age=31536000`
    
    // Get current path without locale
    const currentLocale = pathname.split("/")[1]
    let newPath = pathname
    
    if (supportedLocales.includes(currentLocale as SupportedLocale)) {
      // Replace existing locale in path
      newPath = `/${newLocale}${pathname.slice(currentLocale.length + 1)}`
    } else {
      // Add locale to path
      newPath = `/${newLocale}${pathname}`
    }
    
    router.push(newPath)
  }, [pathname, router])

  const isRTL = locale === "fa" || locale === "ar"
  const dir = isRTL ? "rtl" : "ltr"

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isRTL, dir }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = React.useContext(LocaleContext)
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider")
  }
  return context
}

export function useIsRTL() {
  const { isRTL } = useLocale()
  return isRTL
}
