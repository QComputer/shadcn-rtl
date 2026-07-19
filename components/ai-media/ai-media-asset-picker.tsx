"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AiMediaAsset = {
  id: string;
  previewUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  storageProvider: string | null;
  sourceType: string | null;
};

type Props = {
  entityLabel: string;
  attachUrl: string;
  initialAssetId?: string | null;
  locale?: string;
  onAttached?: (publicMediaUrl: string | null, assetId: string | null) => void;
};

const COPY = {
  fa: {
    trigger: "انتخاب رسانه AI",
    title: "رسانه‌های آماده",
    description: "فقط خروجی‌های واردشده و متعلق به همین کسب‌وکار نمایش داده می‌شوند.",
    empty: "هنوز رسانه آماده‌ای وجود ندارد.",
    attach: "استفاده",
    selected: "فعلی",
    detach: "حذف اتصال",
    loading: "در حال بارگذاری...",
    mock: "MOCK",
  },
  en: {
    trigger: "Choose AI media",
    title: "Ready media",
    description: "Only imported assets owned by this business are available.",
    empty: "No ready media yet.",
    attach: "Use",
    selected: "Current",
    detach: "Detach",
    loading: "Loading...",
    mock: "MOCK",
  },
  ar: {
    trigger: "اختيار وسائط AI",
    title: "وسائط جاهزة",
    description: "تظهر فقط الأصول المستوردة التابعة لهذا النشاط.",
    empty: "لا توجد وسائط جاهزة بعد.",
    attach: "استخدام",
    selected: "الحالي",
    detach: "إزالة الربط",
    loading: "جار التحميل...",
    mock: "MOCK",
  },
};

export function AiMediaAssetPicker({
  entityLabel,
  attachUrl,
  initialAssetId,
  locale = "fa",
  onAttached,
}: Props) {
  const text = COPY[(locale as keyof typeof COPY) || "fa"] ?? COPY.fa;
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<AiMediaAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialAssetId ?? null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAssetId(initialAssetId ?? null);
  }, [initialAssetId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch("/api/dashboard/ai-media/assets?pageSize=24")
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Failed to load AI media assets");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setAssets(Array.isArray(data.items) ? data.items : []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load AI media assets");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  async function attach(assetId: string) {
    setSavingId(assetId);
    setError(null);
    try {
      const response = await fetch(attachUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiMediaAssetId: assetId, idempotencyKey: `attach-${assetId}` }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to attach AI media asset");
      setSelectedAssetId(assetId);
      onAttached?.(data.publicMediaUrl ?? null, assetId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach AI media asset");
    } finally {
      setSavingId(null);
    }
  }

  async function detach() {
    setSavingId("detach");
    setError(null);
    try {
      const response = await fetch(attachUrl, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to detach AI media asset");
      setSelectedAssetId(null);
      onAttached?.(data.manualImageUrl ?? null, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detach AI media asset");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-sm font-medium">{entityLabel}</div>
          {selectedAssetId && <Badge variant="secondary">{text.selected}</Badge>}
        </div>
        <div className="flex gap-2">
          {selectedAssetId && (
            <Button type="button" variant="outline" size="sm" onClick={detach} disabled={Boolean(savingId)}>
              {savingId === "detach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              <span className="sr-only">{text.detach}</span>
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Sparkles className="h-4 w-4" />
                {text.trigger}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{text.title}</DialogTitle>
                <DialogDescription>{text.description}</DialogDescription>
              </DialogHeader>
              {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              {loading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {text.loading}
                </div>
              ) : assets.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{text.empty}</div>
              ) : (
                <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                  {assets.map((asset) => (
                    <div key={asset.id} className="rounded-md border p-2">
                      <div className="aspect-square overflow-hidden rounded bg-muted">
                        {asset.previewUrl ? (
                          <img src={asset.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge variant="outline">{asset.storageProvider === "local-test" ? text.mock : asset.sourceType || asset.mimeType}</Badge>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => attach(asset.id)}
                          disabled={savingId === asset.id || selectedAssetId === asset.id}
                        >
                          {savingId === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : text.attach}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
