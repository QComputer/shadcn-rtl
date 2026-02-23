"use client"

import { useState, useEffect, use } from "react"
import { Save, User, Bell, Lock, Palette, Globe } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"

export default function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  if (!mounted) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  // Settings is a universal access page - all authenticated users can access
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <DashboardBreadcrumb locale={locale} />
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t("navigation.settings") || "تنظیمات"}</h2>
        <p className="text-muted-foreground">
          {t("user.settings") || "مدیریت تنظیمات حساب کاربری"}
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("user.profile") || "پروفایل"}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t("user.notifications") || "اعلانات"}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">{"امنیت"}</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{t("theme.appearance") || "ظاهر"}</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("user.profile") || "اطلاعات پروفایل"}</CardTitle>
              <CardDescription>
                {t("user.settings") || "اطلاعات شخصی خود را ویرایش کنید"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">{t("user.username") || "نام کاربری"}</Label>
                  <Input id="username" defaultValue="محمدی" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("user.firstName") || "نام"}</Label>
                  <Input id="firstName" defaultValue="علی" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("user.lastName") || "نام خانوادگی"}</Label>
                  <Input id="lastName" defaultValue="محمدی" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("user.email") || "ایمیل"}</Label>
                <Input id="email" type="email" defaultValue="admin@store.com" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("user.phone") || "شماره تماس"}</Label>
                <Input id="phone" defaultValue="۰۹۱۲۳۴۵۶۷۸۹" />
              </div>
              <Button>
                <Save className="h-4 w-4 ml-2" />
                {t("common.save") || "ذخیره"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("user.notifications") || "تنظیمات اعلانات"}</CardTitle>
              <CardDescription>
                {t("user.preferences") || "نحوه دریافت اعلانات را انتخاب کنید"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">اعلانات ایمیلی</p>
                  <p className="text-sm text-muted-foreground">دریافت اعلانات مهم از طریق ایمیل</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">اعلانات پیامکی</p>
                  <p className="text-sm text-muted-foreground">دریافت پیامک برای سفارشات جدید</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">اعلانات مرورگر</p>
                  <p className="text-sm text-muted-foreground">نمایش اعلانات در مرورگر</p>
                </div>
                <Switch />
              </div>
              <Button>
                <Save className="h-4 w-4 ml-2" />
                {t("common.save") || "ذخیره"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{"امنیت"}</CardTitle>
              <CardDescription>
                {"تنظیمات امنیتی حساب کاربری"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{"رمز عبور فعلی"}</Label>
                <Input id="currentPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{"رمز عبور جدید"}</Label>
                <Input id="newPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{"تأیید رمز عبور جدید"}</Label>
                <Input id="confirmPassword" type="password" />
              </div>
              <Button>
                <Save className="h-4 w-4 ml-2" />
                {t("common.save") || "تغییر رمز عبور"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{t("theme.appearance") || "ظاهر برنامه"}</CardTitle>
              <CardDescription>
                {"شخصی‌سازی ظاهر برنامه"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{"زبان رابط کاربری"}</Label>
                <div className="flex gap-2">
                  <Button variant={locale === "fa" ? "default" : "outline"} size="sm">
                    <Globe className="h-4 w-4 ml-1" />
                    فارسی
                  </Button>
                  <Button variant={locale === "en" ? "default" : "outline"} size="sm">
                    <Globe className="h-4 w-4 ml-1" />
                    English
                  </Button>
                  <Button variant={locale === "ar" ? "default" : "outline"} size="sm">
                    <Globe className="h-4 w-4 ml-1" />
                    العربية
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("theme.selectTheme") || "انتخاب تم"}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Palette className="h-4 w-4 ml-1" />
                    {t("theme.light") || "روشن"}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Palette className="h-4 w-4 ml-1" />
                    {t("theme.dark") || "تاریک"}
                  </Button>
                  <Button variant="default" size="sm" className="flex-1">
                    <Palette className="h-4 w-4 ml-1" />
                    {t("theme.system") || "سیستم"}
                  </Button>
                </div>
              </div>
              <Button>
                <Save className="h-4 w-4 ml-2" />
                {t("common.save") || "ذخیره"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
