"use client";
import { appFetch } from "@/lib/app-base-path";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Eye,
  RefreshCcw,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";

type LeadStatus = "NEW" | "REVIEWED" | "CONTACTED" | "QUALIFIED" | "REJECTED" | "ARCHIVED";

type Lead = {
  id: string;
  status: LeadStatus;
  source: string;
  locale: string;
  fullName: string;
  businessName: string;
  businessType: string;
  phone: string;
  city: string;
  preferredContactTime: string;
  needSummary: string;
  consentAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string;
  adminNote: string;
  reviewedBy?: {
    id: string;
    name: string;
    role: string;
  };
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "جدید",
  REVIEWED: "بررسی شده",
  CONTACTED: "تماس گرفته شده",
  QUALIFIED: "واجد شرایط",
  REJECTED: "رد شده",
  ARCHIVED: "بایگانی شده",
};

const STATUS_VARIANTS: Record<LeadStatus, "default" | "secondary" | "outline" | "destructive"> = {
  NEW: "default",
  REVIEWED: "secondary",
  CONTACTED: "outline",
  QUALIFIED: "default",
  REJECTED: "destructive",
  ARCHIVED: "secondary",
};

export function RequestDemoLeadsClient() {
  const { user } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<LeadStatus | "">("");
  const [updateNote, setUpdateNote] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (statusFilter) params.set("status", statusFilter);

      const response = await appFetch(`/api/dashboard/request-demo-leads?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch leads");
      }
      const data = await response.json();
      setLeads(data.items);
      setPagination(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در بارگذاری داده‌ها");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (hasAccess) {
      fetchLeads();
    }
  }, [hasAccess, fetchLeads]);

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setUpdateStatus(lead.status);
    setUpdateNote(lead.adminNote || "");
  };

  const handleUpdate = async () => {
    if (!selectedLead) return;
    setUpdating(true);
    try {
      const body: Record<string, unknown> = {};
      if (updateStatus && updateStatus !== selectedLead.status) {
        body.status = updateStatus;
      }
      if (updateNote !== (selectedLead.adminNote || "")) {
        body.adminNote = updateNote;
      }

      if (Object.keys(body).length === 0) {
        setUpdating(false);
        return;
      }

      const response = await appFetch(`/api/dashboard/request-demo-leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update lead");
      }

      const updated = await response.json();
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setSelectedLead(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در به‌روزرسانی");
    } finally {
      setUpdating(false);
    }
  };

  if (accessLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center px-4 text-center">
        <div className="rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <div className="mx-auto mb-3 h-2 w-16 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm font-medium text-card-foreground">در حال بررسی دسترسی…</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-3 py-8 text-center">
        <div className="w-full rounded-3xl border bg-card/95 p-5 shadow-sm ring-1 ring-border/60 sm:p-7">
          <p className="mx-auto inline-flex rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            محدودیت دسترسی
          </p>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
            این بخش برای نقش فعلی شما فعال نیست
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            فقط مدیر کل می‌تواند درخواست‌های دمو پلتفرم را مشاهده کند.
          </p>
          <Link href={`/${user?.locale || "fa"}/dashboard`}>
            <Button className="mt-6">بازگشت به داشبورد</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">درخواست‌های دمو</h1>
          <p className="text-sm text-muted-foreground">
            فقط مدیر کل می‌تواند این صفحه را ببیند.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="همه وضعیت‌ها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">همه وضعیت‌ها</SelectItem>
              <SelectItem value="NEW">جدید</SelectItem>
              <SelectItem value="REVIEWED">بررسی شده</SelectItem>
              <SelectItem value="CONTACTED">تماس گرفته شده</SelectItem>
              <SelectItem value="QUALIFIED">واجد شرایط</SelectItem>
              <SelectItem value="REJECTED">رد شده</SelectItem>
              <SelectItem value="ARCHIVED">بایگانی شده</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchLeads}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Link href={`/${user?.locale || "fa"}/dashboard`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست درخواست‌ها</CardTitle>
          <CardDescription>
            {pagination ? `مجموع ${toPersianDigits(pagination.total)} درخواست` : "در حال بارگذاری…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-2 w-16 animate-pulse rounded-full bg-primary" />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              درخواستی یافت نشد.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>تاریخ</TableHead>
                    <TableHead>نام کسب‌وکار</TableHead>
                    <TableHead>نام و نام خانوادگی</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>شهر</TableHead>
                    <TableHead>شماره تماس</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="text-left">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatPersianDate(lead.createdAt, "short")}
                      </TableCell>
                      <TableCell className="font-medium">{lead.businessName}</TableCell>
                      <TableCell>{lead.fullName}</TableCell>
                      <TableCell>{lead.businessType}</TableCell>
                      <TableCell>{lead.city || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{lead.phone}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[lead.status]}>
                          {STATUS_LABELS[lead.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(lead)}
                          title="جزئیات و به‌روزرسانی"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    قبلی
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    صفحه {toPersianDigits(page)} از {toPersianDigits(pagination.totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>جزئیات درخواست دمو</DialogTitle>
            <DialogDescription>
              {selectedLead?.businessName} — {selectedLead && STATUS_LABELS[selectedLead.status]}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">نام و نام خانوادگی</Label>
                  <p className="text-sm font-medium">{selectedLead.fullName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">نام کسب‌وکار</Label>
                  <p className="text-sm font-medium">{selectedLead.businessName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">نوع کسب‌وکار</Label>
                  <p className="text-sm font-medium">{selectedLead.businessType}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">شهر</Label>
                  <p className="text-sm font-medium">{selectedLead.city || "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">شماره تماس</Label>
                  <p className="text-sm font-mono" dir="ltr">{selectedLead.phone}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ترجیح زمان تماس</Label>
                  <p className="text-sm font-medium">{selectedLead.preferredContactTime || "—"}</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">نیاز کسب‌وکار</Label>
                <p className="text-sm text-muted-foreground">{selectedLead.needSummary || "—"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">وضعیت</Label>
                <Select value={updateStatus} onValueChange={(val) => setUpdateStatus(val as LeadStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNote">یادداشت ادمین</Label>
                <Textarea
                  id="adminNote"
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder="یادداشت داخلی (فقط برای تیم بازارباز)..."
                  rows={3}
                />
              </div>

              {selectedLead.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  بررسی شده در {formatPersianDate(selectedLead.reviewedAt, "datetime")}
                  {selectedLead.reviewedBy?.name && ` توسط ${selectedLead.reviewedBy.name}`}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedLead(null)} disabled={updating}>
                  بستن
                </Button>
                <Button onClick={handleUpdate} disabled={updating}>
                  {updating ? "در حال ذخیره…" : "ذخیره تغییرات"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
