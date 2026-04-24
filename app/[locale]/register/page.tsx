"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, UserPlus, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { getDictionary, getDictValue } from "@/lib/dictionary"

function RegisterForm({ locale }: { locale: string }) {
  const router = useRouter()
  
  const [username, setUsername] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validation
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch") || "رمزهای عبور مطابقت ندارند")
      return
    }

    if (password.length < 6) {
      setError(t("auth.passwordTooShort") || "رمز عبور باید حداقل ۶ کاراکتر باشد")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          orgSlug,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || t("auth.registrationFailed") || "ثبت نام ناموفق بود")
        return
      }

      setSuccess(true)
      
      // If auto-login was successful, redirect to home/dashboard
      // Otherwise redirect to login page
      if (data.autoLogin) {
        setTimeout(() => {
          router.push(`/${locale}/dashboard`)
        }, 1500)
      } else {
        setTimeout(() => {
          router.push(`/${locale}/login?registered=true`)
        }, 1500)
      }
    } catch (err) {
      setError(t("auth.error") || "خطایی رخ داد. لطفاً دوباره تلاش کنید")
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div key={locale+"register-mounted"} className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-8 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div key={locale+"register"} className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-8 h-8 text-green-600" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">
                {t("auth.registrationSuccess") || "ثبت نام موفق"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t("auth.registrationSuccessDesc") || "حساب کاربری شما با موفقیت ایجاد شد"}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("auth.redirectingHome") || "در حال انتقال به صفحه اصلی..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 border-primary/10 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              {t("auth.register") || "ثبت نام"}
            </CardTitle>
            <CardDescription>
              {t("auth.registerDesc") || "ایجاد حساب کاربری جدید"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">
                  {t("auth.username") || "نام کاربری"}
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("auth.username_placeholder") || "نام کاربری خود را وارد کنید"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  className="h-10"
                  dir="ltr"
                />
              </div>
   <div className="space-y-2">
                <Label htmlFor="orgSlug">
                  {t("auth.orgSlug") || "اسلاگ سازمان (اختیاری)"}
                </Label>
              <Input
                  id="orgSlug"
                  type="text"
                  placeholder={t("auth.orgSlug_placeHolder") || "اسلاگ سازمان مورد نظر خودرا وارد کنید"}
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  minLength={3}
                  className="h-10"
                  dir="ltr"
                />
              </div>


              <div className="space-y-2">
                <Label htmlFor="password">
                  {t("auth.password") || "رمز عبور"}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.passwordPlaceholder") || "رمز عبور را وارد کنید"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-10 pr-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {t("auth.confirmPassword") || "تکرار رمز عبور"}
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.confirmPasswordPlaceholder") || "رمز عبور را دوباره وارد کنید"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-10"
                  dir="ltr"
                />
              </div>

              

              <Button
                type="submit"
                className="w-full h-10"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    {t("common.loading") || "در حال بارگذاری..."}
                  </>
                ) : (
                  <>
                    <UserPlus className="ml-2 h-4 w-4" />
                    {t("auth.register") || "ثبت نام"}
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">
                {t("auth.alreadyHaveAccount") || "حساب کاربری دارید؟"}{" "}
              </span>
              <Link
                href={`/${locale}/login`}
                className="text-primary hover:underline font-medium"
              >
                {t("auth.login") || "ورود"}
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-center">
          <ThemeSwitcher />
        </div>
      </motion.div>
    </div>
  )
}

export default function RegisterPage() {
  const params = useParams()
  const locale = params.locale as string

  return <RegisterForm locale={locale} />
}
