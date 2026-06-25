import { redirect } from "next/navigation"

export default async function CustomerClubPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale || "fa"}/dashboard/customer-club/members`)
}
