"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  BarChart3,
  Bell,
  Building2,
  Download,
  Globe2,
  Import,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Menu,
  Package,
  QrCode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  UserRoundCheck,
  Users,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { SupportedLocale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  DASHBOARD_NAVIGATION_GROUPS,
  DASHBOARD_NAVIGATION_ITEMS,
  ROLE_NAVIGATION_POLICY,
  getDashboardHref,
  getDashboardRoleFromUser,
  isDashboardNavigationItemVisible,
  type DashboardNavigationGroupKey,
  type DashboardNavigationKey,
  type DashboardRole,
} from "@/lib/dashboard/navigation-policy"

type DashboardIcon = typeof LayoutDashboard

type NavigationItem = {
  key: DashboardNavigationKey
  href: string
  icon: DashboardIcon
}

type NavigationGroup = {
  key: DashboardNavigationGroupKey
  items: NavigationItem[]
}

interface DashboardSidebarWithDictProps {
  locale: SupportedLocale
  isMobile?: boolean
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const NAVIGATION_ICONS = {
  overview: LayoutDashboard,
  notifications: Bell,
  appointments: ClipboardList,
  calendar: CalendarDays,
  orders: ShoppingCart,
  driverOrders: MapPinned,
  products: Package,
  productCategories: Tags,
  services: Wrench,
  serviceCategories: Tags,
  members: Users,
  customerClub: UserRoundCheck,
  imports: Import,
  exports: Download,
  settings: Settings,
  organizationSettings: Building2,
  qrcode: QrCode,
  organizations: Building2,
  shopDomains: Globe2,
  users: ShieldCheck,
} satisfies Record<DashboardNavigationKey, DashboardIcon>

const NAVIGATION_GROUPS: NavigationGroup[] = DASHBOARD_NAVIGATION_GROUPS.map((group) => ({
  key: group.key,
  items: group.items.map((key) => ({
    key,
    href: DASHBOARD_NAVIGATION_ITEMS[key],
    icon: NAVIGATION_ICONS[key],
  })),
}))

const roleAwareNavigationCopy = {
  fa: {
    appName: "بازار باز",
    sectionLabel: "ناوبری داشبورد",
    openMenu: "باز کردن منوی داشبورد",
    closeMenu: "بستن منوی داشبورد",
    signedInAs: "سطح دسترسی",
    groups: {
      operations: "عملیات",
      catalog: "کاتالوگ",
      teamAndSettings: "تیم و تنظیمات",
      platformAdmin: "مدیریت پلتفرم",
    },
    items: {
      overview: "نمای کلی",
      notifications: "اعلان‌ها",
      appointments: "نوبت‌ها",
      calendar: "تقویم",
      orders: "سفارش‌ها",
      driverOrders: "رانندگی و تحویل",
      products: "محصولات",
      productCategories: "دسته‌های محصول",
      services: "خدمات",
      serviceCategories: "دسته‌های خدمت",
      members: "اعضا",
      customerClub: "باشگاه مشتریان",
      imports: "مرکز واردسازی",
      exports: "مرکز خروجی",
      settings: "تنظیمات",
      organizationSettings: "تنظیمات سازمان",
      qrcode: "کد QR",
      organizations: "سازمان‌ها",
      shopDomains: "دامنه‌های فروشگاه",
      users: "کاربران",
    },
    roles: {
      SUPER_ADMIN: "مدیر کل",
      ADMIN: "مدیر",
      MANAGER: "مدیر داخلی",
      STAFF: "کارمند",
      DRIVER: "راننده",
      USER: "کاربر",
    },
  },
  en: {
    appName: "Bazar Baz",
    sectionLabel: "Dashboard navigation",
    openMenu: "Open dashboard menu",
    closeMenu: "Close dashboard menu",
    signedInAs: "Access level",
    groups: {
      operations: "Operations",
      catalog: "Catalog",
      teamAndSettings: "Team & settings",
      platformAdmin: "Platform admin",
    },
    items: {
      overview: "Overview",
      notifications: "Notifications",
      appointments: "Appointments",
      calendar: "Calendar",
      orders: "Orders",
      driverOrders: "Driving & delivery",
      products: "Products",
      productCategories: "Product categories",
      services: "Services",
      serviceCategories: "Service categories",
      members: "Members",
      customerClub: "Customer Club",
      imports: "Import Hub",
      exports: "Export Hub",
      settings: "Settings",
      organizationSettings: "Organization settings",
      qrcode: "QR code",
      organizations: "Organizations",
      shopDomains: "Shop domains",
      users: "Users",
    },
    roles: {
      SUPER_ADMIN: "Super admin",
      ADMIN: "Admin",
      MANAGER: "Manager",
      STAFF: "Staff",
      DRIVER: "Driver",
      USER: "User",
    },
  },
  ar: {
    appName: "بازار باز",
    sectionLabel: "تنقل لوحة التحكم",
    openMenu: "فتح قائمة لوحة التحكم",
    closeMenu: "إغلاق قائمة لوحة التحكم",
    signedInAs: "مستوى الوصول",
    groups: {
      operations: "العمليات",
      catalog: "الفهرس",
      teamAndSettings: "الفريق والإعدادات",
      platformAdmin: "إدارة المنصة",
    },
    items: {
      overview: "نظرة عامة",
      notifications: "الإشعارات",
      appointments: "المواعيد",
      calendar: "التقويم",
      orders: "الطلبات",
      driverOrders: "القيادة والتوصيل",
      products: "المنتجات",
      productCategories: "فئات المنتجات",
      services: "الخدمات",
      serviceCategories: "فئات الخدمات",
      members: "الأعضاء",
      customerClub: "نادي العملاء",
      imports: "مركز الاستيراد",
      exports: "مركز التصدير",
      settings: "الإعدادات",
      organizationSettings: "إعدادات المؤسسة",
      qrcode: "رمز QR",
      organizations: "المؤسسات",
      shopDomains: "نطاقات المتاجر",
      users: "المستخدمون",
    },
    roles: {
      SUPER_ADMIN: "مدير عام",
      ADMIN: "مدير",
      MANAGER: "مدير",
      STAFF: "موظف",
      DRIVER: "سائق",
      USER: "مستخدم",
    },
  },
} satisfies Record<SupportedLocale, {
  appName: string
  sectionLabel: string
  openMenu: string
  closeMenu: string
  signedInAs: string
  groups: Record<"operations" | "catalog" | "teamAndSettings" | "platformAdmin", string>
  items: Record<DashboardNavigationKey, string>
  roles: Record<DashboardRole, string>
}>

function getNavigationCopy(locale: SupportedLocale) {
  return roleAwareNavigationCopy[locale] ?? roleAwareNavigationCopy.fa
}

function isVisibleForRole(item: NavigationItem, role: DashboardRole) {
  return isDashboardNavigationItemVisible(item.key, role)
}

function getVisibleNavGroups(role: DashboardRole) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isVisibleForRole(item, role)),
  })).filter((group) => group.items.length > 0)
}

function isActivePath(pathname: string | null, locale: SupportedLocale, itemHref: string) {
  const href = getDashboardHref(locale, itemHref)
  if (!pathname) return false
  if (itemHref === "") {
    return pathname === href || pathname === `${href}/`
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarContent({
  locale,
  role,
  onNavigate,
}: {
  locale: SupportedLocale
  role: DashboardRole
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const copy = getNavigationCopy(locale)
  const visibleGroups = getVisibleNavGroups(role)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{copy.appName}</p>
            <p className="truncate text-xs text-muted-foreground">{copy.signedInAs}: {copy.roles[role]}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <nav aria-label={copy.sectionLabel} className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.key} className="space-y-2">
              <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {copy.groups[group.key]}
              </h2>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const href = getDashboardHref(locale, item.href)
                  const isActive = isActivePath(pathname, locale, item.href)

                  return (
                    <Link
                      key={item.key}
                      href={href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{copy.items[item.key]}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}

export function DashboardSidebarWithDict({
  locale,
  isMobile = false,
  isOpen,
  onOpenChange,
}: DashboardSidebarWithDictProps) {
  const { data: session } = useSession()
  const copy = getNavigationCopy(locale)
  const role = getDashboardRoleFromUser(session?.user)
  const isRtl = locale === "fa" || locale === "ar"

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label={copy.openMenu}>
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side={isRtl ? "right" : "left"} className="w-80 max-w-[85vw] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{copy.sectionLabel}</SheetTitle>
          </SheetHeader>
          <SidebarContent locale={locale} role={role} onNavigate={() => onOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside className="sticky top-0 h-screen w-72 border-e" aria-label={copy.sectionLabel}>
      <SidebarContent locale={locale} role={role} />
      <Separator className="sr-only" />
    </aside>
  )
}

export { ROLE_NAVIGATION_POLICY }
