"use client";

import { useEffect, useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/lib/types";

type OrganizationChoice = { id: string; name: string; slug: string };

export function OrganizationAccountProvisioner(props: {
  userRole: UserRole;
  membershipRole?: UserRole | null;
  organizationId?: string | null;
}) {
  const canProvision = props.userRole === "SUPER_ADMIN" || props.membershipRole === "ADMIN";
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationChoice[]>([]);
  const [organizationId, setOrganizationId] = useState(props.userRole === "SUPER_ADMIN" ? "" : props.organizationId ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(props.userRole === "SUPER_ADMIN" ? "ADMIN" : "MANAGER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!open || props.userRole !== "SUPER_ADMIN") return;
    let active = true;
    void appFetch("/api/organizations?page=1&pageSize=100")
      .then(async (response) => {
        if (!response.ok) throw new Error("سازمان‌ها بارگذاری نشدند");
        const data = await response.json();
        if (active) setOrganizations(data.data ?? []);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "خطا در دریافت سازمان‌ها"); });
    return () => { active = false; };
  }, [open, props.userRole]);

  if (!canProvision) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult("");
    if (!organizationId) { setError("ابتدا سازمان را انتخاب کنید"); return; }
    if (password !== (event.currentTarget.elements.namedItem("confirmPassword") as HTMLInputElement | null)?.value) {
      setError("رمزهای عبور یکسان نیستند");
      return;
    }
    setBusy(true);
    try {
      const response = await appFetch(`/api/organizations/${encodeURIComponent(organizationId)}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role, ...(email.trim() ? { email: email.trim() } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "ساخت حساب انجام نشد");
      setResult(body.created ? `حساب ${body.username} با نقش ${body.role} ساخته شد.` : `حساب ${body.username} از قبل با همین دسترسی وجود دارد؛ رمز تغییر نکرد.`);
      setUsername(""); setPassword(""); setEmail("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ساخت حساب انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setError(""); setResult(""); } }}>
      <DialogTrigger asChild>
        <Button type="button"><Plus className="ml-2 h-4 w-4" />ایجاد حساب کاربری</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />ایجاد حساب با نام کاربری</DialogTitle>
          <DialogDescription>ایمیل اختیاری است. نقش دسترسی در محدوده سازمان اعمال می‌شود و سطح SUPER_ADMIN قابل اعطا نیست.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {props.userRole === "SUPER_ADMIN" ? <div className="space-y-2">
            <Label>سازمان</Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger><SelectValue placeholder="انتخاب سازمان" /></SelectTrigger>
              <SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name} ({organization.slug})</SelectItem>)}</SelectContent>
            </Select>
          </div> : null}
          <div className="space-y-2"><Label htmlFor="provision-username">نام کاربری</Label><Input id="provision-username" autoComplete="username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={username} onChange={(event) => setUsername(event.target.value)} dir="ltr" /></div>
          <div className="space-y-2"><Label htmlFor="provision-password">رمز عبور</Label><Input id="provision-password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" /></div>
          <div className="space-y-2"><Label htmlFor="provision-confirm-password">تکرار رمز عبور</Label><Input id="provision-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} maxLength={128} dir="ltr" /></div>
          <div className="space-y-2"><Label htmlFor="provision-email">ایمیل (اختیاری)</Label><Input id="provision-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} dir="ltr" /></div>
          <div className="space-y-2"><Label>نقش در سازمان</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(props.userRole === "SUPER_ADMIN" ? ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"] : ["MANAGER", "STAFF", "CUSTOMER"]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {result ? <p role="status" className="text-sm text-green-700">{result}</p> : null}
          <Button type="submit" disabled={busy || (props.userRole === "SUPER_ADMIN" && organizations.length === 0)}>{busy ? "در حال ذخیره..." : "ایجاد حساب"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
