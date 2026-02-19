"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { 
  formatPersianDate, 
  formatRelativePersianDate, 
  formatToman, 
  toPersianDigits,
  formatNumber 
} from "@/lib/persian"

// Demo product data
const products = [
  { id: 1, name: "گوشی هوشمند", price: 15000000, oldPrice: 18000000, inventory: 15 },
  { id: 2, name: "لپ‌تاپ", price: 25000000, inventory: 8 },
  { id: 3, name: "هدفون", price: 3500000, inventory: 25 },
  { id: 4, name: "ساعت هوشمند", price: 5200000, inventory: 0 },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date>(new Date())
  
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
              <h1 className="text-3xl font-bold text-foreground">در حال بارگذاری...</h1>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              فروشگاه آنلاین
            </h1>
            <p className="text-muted-foreground mt-2">
              بهترین محصولات با بهترین قیمت
            </p>
          </div>
          <ThemeSwitcher />
        </div>

        {/* Date Display */}
        <Card>
          <CardHeader>
            <CardTitle>تاریخ شمسی</CardTitle>
            <CardDescription>نمایش تاریخ به صورت جلالی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">تاریخ کامل</p>
                <p className="text-lg font-semibold">{formatPersianDate(now, 'full')}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">تاریخ</p>
                <p className="text-lg font-semibold">{formatPersianDate(now, 'date')}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">زمان و تاریخ</p>
                <p className="text-lg font-semibold">{formatPersianDate(now, 'datetime')}</p>
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">زمان نسبی</p>
              <p className="text-lg font-semibold">{formatRelativePersianDate(now)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Currency Display */}
        <Card>
          <CardHeader>
            <CardTitle>قیمت به تومان</CardTitle>
            <CardDescription>نمایش قیمت با اعداد فارسی</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div key={product.id} className="p-4 border rounded-lg">
                  <h3 className="font-semibold">{product.name}</h3>
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
                    {product.inventory === 0 ? (
                      <Badge variant="destructive">ناموجود</Badge>
                    ) : product.inventory < 10 ? (
                      <Badge variant="secondary">موجودی محدود</Badge>
                    ) : (
                      <Badge>موجود</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Number Formatting */}
        <Card>
          <CardHeader>
            <CardTitle>اعداد فارسی</CardTitle>
            <CardDescription>تبدیل اعداد انگلیسی به فارسی</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{toPersianDigits(1234567)}</p>
                <p className="text-sm text-muted-foreground">عدد</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{formatNumber(9876543)}</p>
                <p className="text-sm text-muted-foreground">با جداکننده</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{toPersianDigits("0912")} {toPersianDigits("345")} {toPersianDigits("6789")}</p>
                <p className="text-sm text-muted-foreground">شماره تلفن</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{toPersianDigits("1404/01/01")}</p>
                <p className="text-sm text-muted-foreground">تاریخ</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Persian Typography */}
        <Card>
          <CardHeader>
            <CardTitle>تایپوگرافی فارسی</CardTitle>
            <CardDescription>نمایش متون فارسی با فونت وزیرمتن</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="font-persian">
              <h1 className="text-4xl font-bold">عنوان اصلی</h1>
              <h2 className="text-3xl font-bold mt-4">عنوان دوم</h2>
              <h3 className="text-2xl font-semibold mt-4">عنوان سوم</h3>
              <p className="text-lg mt-4 leading-relaxed">
                این یک متن نمونه فارسی است که برای نمایش قابلیت‌های تایپوگرافی سیستم استفاده می‌شود.
                متن فارسی باید به صورت راست‌چین نمایش داده شود و از فونت مناسب فارسی استفاده کند.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                این یک متن با رنگ کم‌رنگ‌تر است که برای متن‌های توضیحی استفاده می‌شود.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Theme Showcase */}
        <Card>
          <CardHeader>
            <CardTitle>تم‌های مختلف</CardTitle>
            <CardDescription>می‌توانید تم را از منوی بالا تغییر دهید</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">دکمه اصلی</button>
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md">دکمه ثانویه</button>
                <button className="px-4 py-2 border border-input bg-background rounded-md">دکمه مرزی</button>
                <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md">دکمه خطر</button>
              </div>
              <div className="flex gap-4 flex-wrap">
                <Badge>برچسب پیش‌فرض</Badge>
                <Badge variant="secondary">برچسب ثانویه</Badge>
                <Badge variant="outline">برچسب مرزی</Badge>
                <Badge variant="destructive">برچسب خطر</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center text-muted-foreground py-8">
          <p>© ۱۴۰۴ - تمامی حقوق محفوظ است</p>
        </footer>
      </div>
    </div>
  )
}
