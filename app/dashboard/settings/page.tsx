"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  LayoutDashboard, ShoppingCart, Package, Calendar, Users, Settings, Menu, Bell, Save, User, Lock, Bell as BellIcon, Palette, Globe 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeSwitcher, ThemeSelector } from "@/components/ui/theme-switcher"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const navItems = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, href: "/dashboard" },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingCart, href: "/dashboard/orders" },
  { id: "products", label: "محصولات", icon: Package, href: "/dashboard/products" },
  { id: "appointments", label: "نوبت‌ها", icon: Calendar, href: "/dashboard/appointments" },
  { id: "customers", label: "مشتریان", icon: Users, href: "/dashboard/customers" },
  { id: "settings", label: "تنظیمات", icon: Settings, href: "/dashboard/settings", active: true },
]

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Form states
  const [profileForm, setProfileForm] = useState({
    firstName: "مدیر",
    lastName: "سیستم",
    email: "admin@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۹"
  })
  
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    orderUpdates: true,
    promotions: false,
    newsletter: true
  })

  useEffect(() => { setMounted(true) }, [])

  const handleSave = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1000)
  }

  if (!mounted) return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-40 bg-background border-b p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">تنظیمات</h1>
        <ThemeSwitcher />
      </header>

      <div className="flex">
        <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:w-64 lg:border-l lg:bg-background">
          <div className="flex items-center gap-2 p-6 border-b">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-lg font-semibold">پنل مدیریت</span>
          </div>
          <ScrollArea className="flex-1 p-4">
            <nav className="space-y-2">
              {navItems.map(item => (
                <Link key={item.id} href={item.href} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg", item.active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  <item.icon className="h-5 w-5" />{item.label}
                </Link>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        <main className="flex-1 lg:pr-64 p-4 lg:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold">تنظیمات</h2>
              <p className="text-muted-foreground">مدیریت تنظیمات حساب کاربری</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">پروفایل</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span className="hidden sm:inline">امنیت</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <BellIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">اعلان‌ها</span>
                </TabsTrigger>
                <TabsTrigger value="appearance" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span className="hidden sm:inline">ظاهر</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle>اطلاعات پروفایل</CardTitle>
                    <CardDescription>اطلاعات شخصی خود را ویرایش کنید</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">نام</Label>
                        <Input id="firstName" value={profileForm.firstName} onChange={e => setProfileForm(p => ({...p, firstName: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">نام خانوادگی</Label>
                        <Input id="lastName" value={profileForm.lastName} onChange={e => setProfileForm(p => ({...p, lastName: e.target.value}))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">ایمیل</Label>
                      <Input id="email" type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({...p, email: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">تلفن همراه</Label>
                      <Input id="phone" value={profileForm.phone} onChange={e => setProfileForm(p => ({...p, phone: e.target.value}))} />
                    </div>
                    <Button onClick={handleSave} disabled={isLoading}>
                      {isLoading ? "در حال ذخیره..." : <><Save className="ml-2 h-4 w-4" />ذخیره تغییرات</>}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle>تنظیمات امنیتی</CardTitle>
                    <CardDescription>مدیریت رمز عبور و امنیت حساب</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
                      <Input id="currentPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">رمز عبور جدید</Label>
                      <Input id="newPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">تأیید رمز عبور جدید</Label>
                      <Input id="confirmPassword" type="password" />
                    </div>
                    <Button><Save className="ml-2 h-4 w-4" />تغییر رمز عبور</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle>تنظیمات اعلان‌ها</CardTitle>
                    <CardDescription>انتخاب نوع اعلان‌های دریافتی</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>اعلان‌های ایمیلی</Label>
                          <p className="text-sm text-muted-foreground">دریافت اعلان‌ها از طریق ایمیل</p>
                        </div>
                        <Switch checked={notifications.email} onCheckedChange={v => setNotifications(n => ({...n, email: v}))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>اعلان‌های پیامکی</Label>
                          <p className="text-sm text-muted-foreground">دریافت اعلان‌ها از طریق پیامک</p>
                        </div>
                        <Switch checked={notifications.sms} onCheckedChange={v => setNotifications(n => ({...n, sms: v}))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>اعلان‌های Push</Label>
                          <p className="text-sm text-muted-foreground">دریافت اعلان‌های Push در مرورگر</p>
                        </div>
                        <Switch checked={notifications.push} onCheckedChange={v => setNotifications(n => ({...n, push: v}))} />
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-4">نوع اعلان‌ها</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>به‌روزرسانی سفارشات</Label>
                            <p className="text-sm text-muted-foreground">اطلاع از وضعیت سفارشات</p>
                          </div>
                          <Switch checked={notifications.orderUpdates} onCheckedChange={v => setNotifications(n => ({...n, orderUpdates: v}))} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>پیشنهادات ویژه</Label>
                            <p className="text-sm text-muted-foreground">دریافت پیشنهادات فروشگاه</p>
                          </div>
                          <Switch checked={notifications.promotions} onCheckedChange={v => setNotifications(n => ({...n, promotions: v}))} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>خبرنامه</Label>
                            <p className="text-sm text-muted-foreground">دریافت آخرین اخبار</p>
                          </div>
                          <Switch checked={notifications.newsletter} onCheckedChange={v => setNotifications(n => ({...n, newsletter: v}))} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appearance">
                <Card>
                  <CardHeader>
                    <CardTitle>تنظیمات ظاهر</CardTitle>
                    <CardDescription>شخصی‌سازی ظاهر برنامه</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>انتخاب تم</Label>
                      <ThemeSelector value="dark" onValueChange={() => {}} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
