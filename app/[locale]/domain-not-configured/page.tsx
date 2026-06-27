import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DomainNotConfiguredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-xl border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle>دامنه هنوز به فروشگاه متصل نشده است</CardTitle>
          <CardDescription>
            این دامنه به بازارباز رسیده، اما هنوز برای یک فروشگاه فعال تأیید یا فعال نشده است.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>
            اگر صاحب این فروشگاه هستید، دامنه را در جدول OrganizationDomain با وضعیت ACTIVE ثبت کنید و DNS آن را به پروژه Vercel بازارباز متصل کنید.
          </p>
          <Link
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            href="/"
          >
            بازگشت به بازارباز
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
