"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, LogIn, Loader2, AlertCircle } from "lucide-react"
import { signIn } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { appPath } from "@/lib/app-base-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { BazarbaazLogo } from "@/components/brand/BazarbaazLogo"

function LoginForm({ locale }: { locale: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || appPath(`/${locale}/dashboard`)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    // Load dictionary client-side
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
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        username: username.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t("auth.invalidCredentials") || "ایمیل یا رمز عبور اشتباه است")
      } else {
        router.push(callbackUrl)
      }
    } catch (err) {
      setError(t("auth.error") || "خطایی رخ داد. لطفاً دوباره تلاش کنید")
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4 inline-flex items-center justify-center"
          >
            <BazarbaazLogo language={locale === "fa" ? "fa" : "en"} className="h-14 w-auto" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t("auth.welcomeBack") || "خوش آمدید"}</h1>
          <p className="text-muted-foreground mt-2">{t("auth.signInToContinue") || "برای ورود به پنل مدیریت وارد شوید"}</p>
        </div>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">{t("auth.login") || "ورود به حساب کاربری"}</CardTitle>
            <CardDescription className="text-center">
              {t("auth.enterCredentials") || "ایمیل و رمز عبور خود را وارد کنید"}
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
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username") || "نام کاربری"}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="name@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="text-left"
                  dir="ltr"
                  autoComplete="username"
                  aria-describedby="username-error"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password") || "رمز عبور"}</Label>
                  <Link
                    href={`/${locale}/forgot-password`}
                    prefetch={false}
                    className="text-sm text-primary hover:underline"
                  >
                    {t("auth.forgotPassword") || "فراموشی رمز عبور؟"}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-left pl-10"
                    dir="ltr"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  {t("auth.rememberMe") || "مرا به خاطر بسپار"}
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    {t("common.loading") || "در حال ورود..."}
                  </>
                ) : (
                  <>
                    <LogIn className="ml-2 h-4 w-4" />
                    {t("auth.login") || "ورود"}
                  </>
                )}
              </Button>

              {/* Demo Credentials */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t("auth.orUseDemo") || "پر کردن اطلاعات از حساب دمو"}
                  </span>
                </div>
              </div>

               <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setUsername("shop-admin")
                  setPassword("123456")
                }}
              >
                { " ادمین فروشگاه سلامت"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("auth.noAccount") || "حساب کاربری ندارید؟"}
            <Link href={`/${locale}/register`} className="text-primary hover:underline font-medium p-1">
              {t("auth.register") || "ثبت نام کاربر"}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <Link href={`/${locale}/register/organization`} className="text-primary hover:underline font-medium">
              { "ثبت نام کاربر و فروشگاه"}
            </Link>
          </p>
        </div>

        {/* Theme Switcher */}
        <div className="mt-6 flex justify-center">
          <ThemeSwitcher />
        </div>
      </motion.div>
    </div>
  )
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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

export default function LoginPage() {
  const params = useParams()
  const locale = params.locale as string || "fa"

  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm locale={locale} />
    </Suspense>
  )
}
