"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Save, User, Bell, Lock, Palette, Globe, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useTheme } from "@/hooks/use-theme"
import { toast } from 'react-toastify';

interface UserProfile {
  id: string
  name: string
  email: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  avatar: string | null
  role: string
  locale: string
  theme: string
  memberOf: {
    id: string
    role: string
    organization: {
      id: string
      name: string
      slug: string
      type: string
    }
  } | null
}

export default function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  const { theme: currentTheme, setTheme } = useTheme()
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [firstName, setFirstName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedLocale, setSelectedLocale] = useState(locale)
  const [selectedTheme, setSelectedTheme] = useState("system")
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch user profile
    fetch("/api/users/me")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch profile")
        return res.json()
      })
      .then(data => {
        setUser(data)
        setFirstName(data.firstName || "")
        setLastName(data.lastName || "")
        setPhone(data.phone || "")
        setSelectedLocale(data.locale || locale)
        setSelectedTheme(data.theme || "system")
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [locale])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleCreateOrg = async () => {
        setSaving(true)
    setError(null)
    setSuccess(null)
    try{
      const response = await fetch(`/api/organizations/`,{
      method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          slug: orgSlug,
          type: "SHOP"
        }),
    })
    if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedUser = await response.json()
      setUser(prev => prev ? { ...prev, ...updatedUser } : null)
       toast.success('فروشگاه شما با موفقیت ثبت شد!', {
            position: 'top-center', // Position of the toast
            autoClose: 5000, // Close after 5 seconds
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
          });
      setSuccess('فروشگاه شما با موفقیت ثبت شد! لطفا خارج شده و دوباره وارد پنل مدیریت شوید')
      
      // If locale changed, redirect to new locale
      if (selectedLocale !== locale) {
        router.push(`/${selectedLocale}/dashboard/settings`)
      }
  } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }
  const handleSaveProfile = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || null,
          locale: selectedLocale,
          theme: selectedTheme,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedUser = await response.json()
      setUser(prev => prev ? { ...prev, ...updatedUser } : null)
       toast.success('تغییرات شما با موفقیت ثبت شد!', {
            position: 'top-center', // Position of the toast
            autoClose: 5000, // Close after 5 seconds
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            // You might need to handle custom sounds separately if the library doesn't directly support them
          });
      setSuccess(t("common.success"))
      
      // If locale changed, redirect to new locale
      if (selectedLocale !== locale) {
        router.push(`/${selectedLocale}/dashboard/settings`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    
    setSaving(true)
    
    try {
      const response = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to change password")
      }
      
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess("Password changed successfully")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setSelectedTheme(newTheme)
    setTheme(newTheme as "light" | "dark" | "system")
  }

  if (!mounted || loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={locale+i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              تلاش دوباره
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t("navigation.settings")}</h2>
        <p className="text-muted-foreground">
          {t("user.settings")}
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-500 text-green-700 dark:text-green-400 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
          {error}
        </div>
      )}
{!user?.memberOf && <div>
  <div className="p-2">فروشگاه خود را بسازید</div>
  <div className="flex gap-4">
  <Input
  value={orgName}
  onChange={(e) => setOrgName(e.target.value)}
  placeholder="نام"
  />
  <Input
  value={orgSlug}
  onChange={(e) => setOrgSlug(e.target.value)}
  placeholder="اسلاگ"
  />
  <Button onClick={handleCreateOrg}>
 سازمان خود را بسازید
  </Button>
  </div></div>}
      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("user.profile")}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t("user.notifications")}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">امنیت</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{t("theme.appearance")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="dir-rtl">
            <CardHeader>
              <CardTitle>{t("user.profile")}</CardTitle>
              <CardDescription>
                {t("user.settings")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">{t("auth.username")}</Label>
                  <Input id="username" value={user?.name || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t("user.title")} {t("service.category")}</Label>
                  <Input id="role" value={user?.role || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("user.firstName")}</Label>
                  <Input 
                    id="firstName" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("user.lastName")}</Label>
                  <Input 
                    id="lastName" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("user.phone")}</Label>
                <Input 
                  id="phone" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("user.notifications")}</CardTitle>
              <CardDescription>
                {t("user.preferences")}
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
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>امنیت</CardTitle>
              <CardDescription>
                تنظیمات امنیتی حساب کاربری
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-lg text-sm">
                  {passwordError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
                <Input 
                  id="currentPassword" 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">رمز عبور جدید</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">تأیید رمز عبور جدید</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                تغییر رمز عبور
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{t("theme.appearance")}</CardTitle>
              <CardDescription>
                شخصی‌سازی ظاهر برنامه
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>زبان رابط کاربری</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={selectedLocale === "fa" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setSelectedLocale("fa")}
                  >
                    <Globe className="h-4 w-4 ml-1" />
                    فارسی
                  </Button>
                  <Button 
                    variant={selectedLocale === "en" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setSelectedLocale("en")}
                  >
                    <Globe className="h-4 w-4 ml-1" />
                    English
                  </Button>
                  <Button 
                    variant={selectedLocale === "ar" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setSelectedLocale("ar")}
                  >
                    <Globe className="h-4 w-4 ml-1" />
                    العربية
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("theme.selectTheme")}</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={selectedTheme === "light" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleThemeChange("light")}
                  >
                    <Palette className="h-4 w-4 ml-1" />
                    {t("theme.light")}
                  </Button>
                  <Button 
                    variant={selectedTheme === "dark" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleThemeChange("dark")}
                  >
                    <Palette className="h-4 w-4 ml-1" />
                    {t("theme.dark")}
                  </Button>
                  <Button 
                    variant={selectedTheme === "system" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleThemeChange("system")}
                  >
                    <Palette className="h-4 w-4 ml-1" />
                    {t("theme.system")}
                  </Button>
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
