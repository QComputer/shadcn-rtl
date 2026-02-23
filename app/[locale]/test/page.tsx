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

export default function TestPage() {
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
      return value === key ? ["گوشی هوشمند", "لپ تاپ", "هدفون", "ساعت هوشمند"][index] : value
    }
    return ""
  }

  useEffect(() => {
    setMounted(true)
    
    // Update time every second
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div className="h-12 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("home.title") || "فروشگاه اینترنتی"}</h1>
            <p className="text-muted-foreground mt-1">
              {t("home.subtitle") || "بهترین محصولات با بهترین قیمت"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <ThemeSwitcher />
          </div>
        </div>

        {/* Time Display */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("home.currentDate") || "تاریخ امروز"}</p>
                <p className="text-2xl font-bold mt-1">{formatPersianDate(now)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm text-muted-foreground">{t("home.currentTime") || "ساعت فعلی"}</p>
                <p className="text-3xl font-bold font-mono mt-1">{toPersianDigits(now.toLocaleTimeString("fa-IR"))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-6">{t("home.featuredProducts") || "محصولات ویژه"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-6xl">📱</span>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mt-2">{getProductName(index)}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xl font-bold text-primary">
                      {formatToman(product.price)}
                    </span>
                    {product.oldPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatToman(product.oldPrice)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <Badge variant={product.inventory > 0 ? "default" : "destructive"}>
                      {product.inventory > 0 
                        ? `${t("home.inStock") || "موجود"} (${toPersianDigits(product.inventory)})`
                        : t("home.outOfStock") || "ناموجود"
                      }
                    </Badge>
                    {product.oldPrice && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {toPersianDigits(Math.round((1 - product.price / product.oldPrice) * 100))}%
                        {t("home.discount") || "تخفیف"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-3xl">🚚</span>
                {t("home.features.freeDelivery.title") || "ارسال رایگان"}
              </CardTitle>
              <CardDescription>
                {t("home.features.freeDelivery.desc") || "برای خریدهای بالای ۵۰۰ هزار تومان"}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-3xl">🛡️</span>
                {t("home.features.guarantee.title") || "گارانتی معتبر"}
              </CardTitle>
              <CardDescription>
                {t("home.features.guarantee.desc") || "گارانتی ۱۸ ماهه محصولات"}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-3xl">📞</span>
                {t("home.features.support.title") || "پشتیبانی ۲۴/۷"}
              </CardTitle>
              <CardDescription>
                {t("home.features.support.desc") || "پشتیبانی شبانه‌روزی در خدمت شما"}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}