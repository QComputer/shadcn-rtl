"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, Globe, Loader2, Lock, Palette, Save, User } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { DashboardPushOptIn } from "@/components/dashboard/dashboard-push-opt-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { useTheme } from "@/hooks/use-theme";

type Membership = {
  id: string;
  role: string;
  organizationId: string;
  organizationSlug: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    type: string;
    isOpen?: boolean;
  };
};

type UserProfile = {
  id: string;
  name: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  role: string;
  locale: "fa" | "en" | "ar";
  theme: "light" | "dark" | "system";
  memberOf: Membership | null;
  memberships?: Membership[];
};

type BusinessHour = {
  id?: string;
  day: DayKey;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
};

type DayKey = "SATURDAY" | "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";

const defaultBusinessHours: BusinessHour[] = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
].map((day) => ({ day: day as DayKey, openTime: "09:00", closeTime: "17:00", isOpen: !["FRIDAY"].includes(day) }));

const dayLabels: Record<DayKey, string> = {
  SATURDAY: "شنبه",
  SUNDAY: "یکشنبه",
  MONDAY: "دوشنبه",
  TUESDAY: "سه‌شنبه",
  WEDNESDAY: "چهارشنبه",
  THURSDAY: "پنجشنبه",
  FRIDAY: "جمعه",
};

const notificationPolicyHighlights = [
  {
    title: "اصل حاکم",
    description: "اعلان‌های تراکنشی برای سفارش، پرداخت و نوبت به صورت پیش‌فرض فعال‌اند؛ پیام‌های بازاریابی فقط از مسیرهای مجاز و ترجیح‌های ثبت‌شده ارسال می‌شوند.",
  },
  {
    title: "کانال‌های مجاز",
    description: "مسیرهای رسمی پروژه شامل اعلان داخل برنامه، Web Push و SMS است. ایمیل در سیاست فعلی کانال فعال ارسال نیست.",
  },
  {
    title: "ارسال واقعی",
    description: "Web Push و SMS واقعی پشت پرچم‌های محیطی و تأیید عملیاتی هستند. حالت پیش‌فرض امن، dry-run یا ارسال کنترل‌شده است.",
  },
  {
    title: "سیاست تلاش مجدد",
    description: "تلاش مجدد فقط برای Web Push و SMS واجد شرایط است؛ اعلان داخل برنامه، dry-run و مسیر مهمان retry واقعی ندارند.",
  },
];

const notificationChannelPolicyRows = [
  {
    channel: "داخل برنامه",
    transactional: "فعال",
    marketing: "فعال به صورت پیش‌فرض",
    note: "مسیر اصلی اعلان‌های داشبورد، سفارش و پیام‌های عملیاتی.",
  },
  {
    channel: "Web Push",
    transactional: "فعال پس از اجازه مرورگر",
    marketing: "نیازمند opt-in",
    note: "برای داشبورد از کنترل پایین همین صفحه و برای مشتری از تنظیمات عمومی فروشگاه استفاده می‌شود.",
  },
  {
    channel: "SMS",
    transactional: "فعال از نظر سیاست، وابسته به درگاه",
    marketing: "نیازمند opt-in",
    note: "ارسال واقعی فقط با SMS.ir، کلید معتبر، تأیید اپراتور و خروج از dry-run انجام می‌شود.",
  },
  {
    channel: "Email",
    transactional: "غیرفعال",
    marketing: "غیرفعال",
    note: "در سیاست فعلی پروژه کانال ارسال ایمیل فعال نشده است.",
  },
];

export default function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params);
  const locale = (resolvedParams.locale || "fa") as "fa" | "en" | "ar";
  const router = useRouter();
  const { setTheme } = useTheme();

  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<"fa" | "en" | "ar">(locale);
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">("system");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [businessHours, setBusinessHours] = useState<BusinessHour[]>(defaultBusinessHours);

  const memberships = useMemo(() => user?.memberships || (user?.memberOf ? [user.memberOf] : []), [user]);

  useEffect(() => {
    setDict(getDictionary(locale));

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/users/me", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch profile");
        const data = (await response.json()) as UserProfile;
        setUser(data);
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setPhone(data.phone || "");
        setSelectedLocale(data.locale || locale);
        setSelectedTheme(data.theme || "system");

        if (data.memberOf?.organizationId) {
          const hoursResponse = await fetch(`/api/users/me/business-hours?organizationId=${encodeURIComponent(data.memberOf.organizationId)}`, { cache: "no-store" });
          if (hoursResponse.ok) {
            const hoursData = await hoursResponse.json();
            if (Array.isArray(hoursData.hours) && hoursData.hours.length > 0) {
              setBusinessHours(hoursData.hours);
            }
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [locale]);

  const t = (key: string) => (dict ? getDictValue(dict, key) : key);

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName || null,
          lastName: lastName || null,
          phone: phone || null,
          locale: selectedLocale,
          theme: selectedTheme,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to save profile");

      setUser((prev) => (prev ? { ...prev, ...payload } : prev));
      setTheme(selectedTheme);
      setMessage("تغییرات پروفایل ذخیره شد");
      toast.success("تغییرات پروفایل ذخیره شد", { position: "top-center" });
      if (selectedLocale !== locale) router.push(`/${selectedLocale}/dashboard/settings`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to change password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("رمز عبور با موفقیت تغییر کرد");
      toast.success("رمز عبور با موفقیت تغییر کرد", { position: "top-center" });
    } catch (passwordChangeError) {
      setPasswordError(passwordChangeError instanceof Error ? passwordChangeError.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBusinessHours() {
    if (!user?.memberOf?.organizationId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/users/me/business-hours?organizationId=${encodeURIComponent(user.memberOf.organizationId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessHours.map(({ day, openTime, closeTime, isOpen }) => ({ day, openTime, closeTime, isOpen }))),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to save business hours");
      if (Array.isArray(payload.hours)) setBusinessHours(payload.hours);
      setMessage("ساعات کاری ذخیره شد");
      toast.success("ساعات کاری ذخیره شد", { position: "top-center" });
    } catch (hoursError) {
      setError(hoursError instanceof Error ? hoursError.message : "Failed to save business hours");
    } finally {
      setSaving(false);
    }
  }

  function updateBusinessHour(day: DayKey, patch: Partial<BusinessHour>) {
    setBusinessHours((current) =>
      current.map((item) => (item.day === day ? { ...item, ...patch } : item)),
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    );
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
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6" dir={locale === "en" ? "ltr" : "rtl"}>
      <div>
        <h2 className="text-2xl font-bold">{t("navigation.settings")}</h2>
        <p className="text-muted-foreground">مدیریت پروفایل، امنیت حساب و تنظیمات کاری</p>
      </div>

      {message && <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-500 text-green-700 dark:text-green-400 rounded-lg">{message}</div>}
      {error && <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">{error}</div>}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />پروفایل</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" />امنیت</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="h-4 w-4" />ظاهر</TabsTrigger>
          <TabsTrigger value="business-hours" className="gap-2"><Clock className="h-4 w-4" />ساعات کاری</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />اعلان‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>پروفایل کاربر</CardTitle>
              <CardDescription>اطلاعات قابل ویرایش حساب کاربری شما</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">نام کاربری</Label>
                  <Input id="username" value={user?.name || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input id="email" value={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">نام</Label>
                  <Input id="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">نام خانوادگی</Label>
                  <Input id="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">شماره تماس</Label>
                <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">عضویت‌های فعال</p>
                {memberships.length === 0 ? (
                  <p>عضویت سازمانی فعالی برای این حساب ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {memberships.map((membership) => (
                      <div key={membership.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2">
                        <span>{membership.organization.name}</span>
                        <span>{membership.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                ذخیره پروفایل
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>امنیت حساب</CardTitle>
              <CardDescription>رمز عبور جدید باید حداقل ۸ کاراکتر باشد.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-lg text-sm">{passwordError}</div>}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">رمز عبور جدید</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تأیید رمز عبور جدید</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </div>
              </div>
              <Button onClick={handleChangePassword} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                تغییر رمز عبور
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>ظاهر و زبان</CardTitle>
              <CardDescription>انتخاب زبان رابط کاربری و تم شخصی حساب</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>زبان رابط کاربری</Label>
                <div className="flex flex-wrap gap-2">
                  {(["fa", "en", "ar"] as const).map((item) => (
                    <Button key={item} variant={selectedLocale === item ? "default" : "outline"} size="sm" onClick={() => setSelectedLocale(item)}>
                      <Globe className="h-4 w-4 ml-1" />{item === "fa" ? "فارسی" : item === "en" ? "English" : "العربية"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>تم</Label>
                <div className="flex flex-wrap gap-2">
                  {(["light", "dark", "system"] as const).map((item) => (
                    <Button key={item} variant={selectedTheme === item ? "default" : "outline"} size="sm" onClick={() => { setSelectedTheme(item); setTheme(item); }}>
                      <Palette className="h-4 w-4 ml-1" />{item}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                ذخیره ظاهر و زبان
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business-hours">
          <Card>
            <CardHeader>
              <CardTitle>ساعات کاری من</CardTitle>
              <CardDescription>این تنظیمات فقط برای عضویت فعال فعلی شما در سازمان اعمال می‌شود.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user?.memberOf ? (
                <p className="text-sm text-muted-foreground">برای تنظیم ساعات کاری باید عضو فعال یک سازمان باشید.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {businessHours.map((item) => (
                      <div key={item.day} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                        <div className="font-medium">{dayLabels[item.day]}</div>
                        <Input type="time" value={item.openTime} disabled={!item.isOpen} onChange={(event) => updateBusinessHour(item.day, { openTime: event.target.value })} />
                        <Input type="time" value={item.closeTime} disabled={!item.isOpen} onChange={(event) => updateBusinessHour(item.day, { closeTime: event.target.value })} />
                        <div className="flex items-center gap-2">
                          <Switch checked={item.isOpen} onCheckedChange={(checked) => updateBusinessHour(item.day, { isOpen: checked })} />
                          <span className="text-sm text-muted-foreground">باز</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleSaveBusinessHours} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                    ذخیره ساعات کاری
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>سیاست اعلان‌های پروژه</CardTitle>
              <CardDescription>خلاصه سیاست فعلی Bazar Baz برای اعلان داخل برنامه، Web Push و SMS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {notificationPolicyHighlights.map((item) => (
                  <div key={item.title} className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">کانال</th>
                      <th className="px-3 py-2 text-start font-medium">تراکنشی</th>
                      <th className="px-3 py-2 text-start font-medium">بازاریابی</th>
                      <th className="px-3 py-2 text-start font-medium">یادداشت اجرایی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationChannelPolicyRows.map((row) => (
                      <tr key={row.channel} className="border-t">
                        <td className="px-3 py-3 font-medium">{row.channel}</td>
                        <td className="px-3 py-3 text-muted-foreground">{row.transactional}</td>
                        <td className="px-3 py-3 text-muted-foreground">{row.marketing}</td>
                        <td className="px-3 py-3 text-muted-foreground">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs leading-6 text-muted-foreground">
                سیاست فنی فعلی: پیام‌های تراکنشی پیش‌فرض مجاز هستند، پیام‌های بازاریابی Web Push و SMS به opt-in نیاز دارند، retry واقعی حداکثر سه بار با فاصله‌های ۵ دقیقه، ۳۰ دقیقه و ۲ ساعت انجام می‌شود و ارسال واقعی SMS/Web Push بدون پرچم‌های عملیاتی فعال نمی‌شود.
              </p>
            </CardContent>
          </Card>

          {user?.memberOf ? (
            <DashboardPushOptIn />
          ) : (
            <Card>
              <CardContent className="py-5 text-sm text-muted-foreground">
                برای مدیریت اعلان مرورگر داشبورد باید عضو فعال یک سازمان باشید.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
