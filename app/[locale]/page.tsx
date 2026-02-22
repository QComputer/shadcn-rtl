"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { LocaleSwitcher } from "@/components/ui/locale-switcher"
import { 
  formatPersianDate, 
  formatRelativePersianDate, 
  formatToman, 
  toPersianDigits,
  formatNumber 
} from "@/lib/persian"
import { useLocale } from "@/components/locale-provider"
import { getDictionary, getDictValue, type Dictionary } from "@/lib/dictionary"

// Product data - localized names stored in dictionary
const products = [
  { id: 1, price: 15000000, oldPrice: 18000000, inventory: 15 },
  { id: 2, price: 25000000, inventory: 8 },
  { id: 3, price: 3500000, inventory: 25 },
  { id: 4, price: 5200000, inventory: 0 },
]

// Product name keys in dictionary
const productNameKeys = [
  "home.products.smartphone",
  "home.products.laptop", 
  "home.products.headphone",
  "home.products.smartwatch"
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date>(new Date())
  const { locale } = useLocale()
  
  // Get dictionary based on locale
  const dict = useMemo(() => getDictionary(locale), [locale])
  
  // Helper function to get translated value
  const t = (key: string): string => getDictValue(dict, key)
  
  // Product name getter
  const getProductName = (index: number): string => {
    const key = productNameKeys[index]
    if (key) {
      const value = t(key)
      // If key not found in dictionary, fall back to Persian
      return value === key ? getProductFallback(index) : value
    }
    return getProductFallback(index)
  }
  
  // Fallback product names in Persian
  const getProductFallback = (index: number): string => {
    const persianNames = ["گوشی هوشمند", "لپ‌تاپ", "هدفون", "ساعت هوشمند"]
    return persianNames[index] || "محصول"
  }
  
  // Stock status helper
  const getStockStatus = (inventory: number): { label: string; variant: "default" | "secondary" | "destructive" } => {
    if (inventory === 0) {
      return { label: t("product.outOfStock"), variant: "destructive" }
    }
    if (inventory < 10) {
      return { label: t("product.limitedStock"), variant: "secondary" }
    }
    return { label: t("product.inStock"), variant: "default" }
  }
  
  useEffect(() => {
    setMounted(true)
    setNow(new Date())
  }, [])
  
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("common.loading")}</h1>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t("home.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("home.subtitle")}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <LocaleSwitcher />
            <ThemeSwitcher />
          </div>
        </div>

        {/* Date Display */}
        <Card>
          <CardHeader>
            <CardTitle>{t("home.dateTitle")}</CardTitle>
            <CardDescription>{t("home.dateDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("home.fullDate")}</p>
                <p className="text-lg font-semibold">{formatPersianDate(now, 'full')}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("home.date")}</p>
                <p className="text-lg font-semibold">{formatPersianDate(now, 'date')}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("home.dateTime")}</p>
                <p className="text-lg font-semibold">{formatPersianDate(now, 'datetime')}</p>
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t("home.relativeDate")}</p>
              <p className="text-lg font-semibold">{formatRelativePersianDate(now)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Currency Display */}
        <Card>
          <CardHeader>
            <CardTitle>{t("home.currencyTitle")}</CardTitle>
            <CardDescription>{t("home.currencyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {products.map((product) => {
                const stock = getStockStatus(product.inventory)
                return (
                  <div key={product.id} className="p-4 border rounded-lg">
                    <h3 className="font-semibold">{getProductName(product.id - 1)}</h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-xl font-bold text-primary">
                        {formatToman(product.price)}
                      </p>
                      {product.oldPrice && (
                        <p className="text-sm text-muted-foreground line-through">
                          {formatToman(product.oldPrice)}
                        </p>
                      )}
                    </div>
                    <div className="mt-2">
                      <Badge variant={stock.variant}>{stock.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Number Formatting */}
        <Card>
          <CardHeader>
            <CardTitle>{t("home.numberTitle")}</CardTitle>
            <CardDescription>{t("home.numberDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{toPersianDigits(1234567)}</p>
                <p className="text-sm text-muted-foreground">{t("home.number")}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{formatNumber(9876543)}</p>
                <p className="text-sm text-muted-foreground">{t("home.withSeparator")}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{toPersianDigits("0912")} {toPersianDigits("345")} {toPersianDigits("6789")}</p>
                <p className="text-sm text-muted-foreground">{t("home.phone")}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{toPersianDigits("1404/01/01")}</p>
                <p className="text-sm text-muted-foreground">{t("home.dateStr")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Persian Typography */}
        <Card>
          <CardHeader>
            <CardTitle>{t("home.typographyTitle")}</CardTitle>
            <CardDescription>{t("home.typographyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="font-persian">
              <h1 className="text-4xl font-bold">{t("home.mainTitle")}</h1>
              <h2 className="text-3xl font-bold mt-4">{t("home.secondTitle")}</h2>
              <h3 className="text-2xl font-semibold mt-4">{t("home.thirdTitle")}</h3>
              <p className="text-lg mt-4 leading-relaxed">
                {t("home.sampleText")}
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {t("home.mutedText")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Theme Showcase */}
        <Card>
          <CardHeader>
            <CardTitle>{t("home.themeTitle")}</CardTitle>
            <CardDescription>{t("home.themeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">{t("home.primaryBtn")}</button>
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md">{t("home.secondaryBtn")}</button>
                <button className="px-4 py-2 border border-input bg-background rounded-md">{t("home.outlineBtn")}</button>
                <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md">{t("home.dangerBtn")}</button>
              </div>
              <div className="flex gap-4 flex-wrap">
                <Badge>{t("home.defaultBadge")}</Badge>
                <Badge variant="secondary">{t("home.secondaryBadge")}</Badge>
                <Badge variant="outline">{t("home.outlineBadge")}</Badge>
                <Badge variant="destructive">{t("home.dangerBadge")}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center text-muted-foreground py-8">
          <p>© ۱۴۰۴ - {t("home.footer")}</p>
        </footer>
      </div>
    </div>
  )
}
