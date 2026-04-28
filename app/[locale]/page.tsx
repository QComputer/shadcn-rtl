import { prisma } from "@/lib/db"
import { getDictionary } from "@/lib/dictionary"
import { LocaleSwitcher } from "@/components/ui/locale-switcher"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Building2, ShoppingBag, Calendar, ArrowLeft, ArrowRight } from "lucide-react"

// Make this page dynamic to avoid build-time database calls
//export const dynamic = 'force-dynamic'

interface OrganizationWithDetails {
  id: string
  name: string
  slug: string
  type: "SHOP" | "APPOINTMENT"
  description: string | null
  logo: string | null
  coverImage: string | null
  address: string | null
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = resolvedParams.locale || "fa" as "fa" | "en" | "ar"
  const dict = getDictionary(locale)

  // Fetch organizations directly from Prisma
  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      logo: true,
      coverImage: true,
      address: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  })

  // Group organizations by type
  const shopOrganizations = organizations.filter(
    (org: { type: string }) => org.type === "SHOP"
  )
  const appointmentOrganizations = organizations.filter(
    (org: { type: string }) => org.type === "APPOINTMENT"
  )

  // Helper to get translations based on locale
  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = dict
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  }

  const isRTL = locale === "fa" || locale === "ar"

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                              <div
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                              >
        <a referrerPolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'>
        <img referrerPolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7' alt='' className='cursor:pointer' slot='PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'/>
        </a>
                              <Link
                href={`/${locale}`}
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"

              >
              <Building2 className="h-6 w-6 text-primary" />

                <span className="font-bold text-lg">{t("home.platformName") || "پلتفرم تجارت"}</span>
              </Link>
              
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LocaleSwitcher />
              <ThemeSwitcher />
              <Link href={`/${locale}`}>
                <Button variant="default" size="sm">
                  {t("auth.login") || "ورود"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl lg:text-5xl font-bold mb-6 pb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t("home.hero.title") || "بهترین پلتفرم تجارت الکترونیک"}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {t("home.hero.subtitle") || "خرید آنلاین و رزرو خدمات در یک پلتفرم مدرن"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${locale}/dashboard`}>
                <Button size="lg" className="w-full sm:w-auto">
                  {t("home.hero.dashboard") || "ورود به پنل مدیریت"}
                  {isRTL ? <ArrowLeft className="mr-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Shop Organizations */}
      {shopOrganizations.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <ShoppingBag className="h-8 w-8 text-primary" />
              <h2 className="text-3xl font-bold">
                {t("home.shops") || "فروشگاه‌ها"}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {shopOrganizations.map((org: OrganizationWithDetails) => (
                <Link
                  key={locale+org.id}
                  href={`/${locale}/shop/${org.slug}`}
                  className="group"
                >
                  <div className="bg-background rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      {org.coverImage ? (
                        <img
                          src={org.coverImage}
                          alt={org.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-16 w-16 text-primary/30" />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                        {org.name}
                      </h3>
                      {org.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {org.description}
                        </p>
                      )}
                      {org.address && (
                        <p className="text-xs text-muted-foreground mt-2">
                          📍 {org.address}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Appointment Organizations */}
      {appointmentOrganizations.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="h-8 w-8 text-primary" />
              <h2 className="text-3xl font-bold">
                {t("home.services") || "خدمات"}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {appointmentOrganizations.map((org: OrganizationWithDetails) => (
                  <Link
                  key={locale+org.id}
                  href={`/${locale}/organizations/${org.slug}`}
                  className="group"
                  >
                  <div className="bg-background rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      {org.coverImage ? (
                        <img
                          src={org.coverImage}
                          alt={org.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Calendar className="h-16 w-16 text-primary/30" />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                        {org.name}
                      </h3>
                      {org.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {org.description}
                        </p>
                      )}
                      {org.address && (
                        <p className="text-xs text-muted-foreground mt-2">
                          📍 {org.address}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
                

              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {organizations.length === 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <Building2 className="h-20 w-20 mx-auto text-muted-foreground/30 mb-6" />
            <h2 className="text-2xl font-bold mb-4">
              {t("home.noOrganizations") || "سازمانی یافت نشد"}
            </h2>
            <p className="text-muted-foreground mb-8">
              {t("home.noOrganizationsDesc") || "در حال حاضر هیچ سازمانی در پلتفرم فعال نیست"}
            </p>
            <Link href={`/${locale}/login`}>
              <Button>
                {t("home.createFirst") || "ایجاد اولین سازمان"}
              </Button>
            </Link>
          </div>
        </section>
      )}


    </div>
  )
}
