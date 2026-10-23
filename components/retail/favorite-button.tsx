"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { appPath } from "@/lib/app-base-path";

type Props = {
  organization: string;
  productId: string;
  initialSaved?: boolean;
  favoritesAvailable?: boolean;
  onChange?: (saved: boolean) => void;
};

export function FavoriteButton({ organization, productId, initialSaved, favoritesAvailable = true, onChange }: Props) {
  const [localSaved, setLocalSaved] = useState(initialSaved ?? false);
  const saved = initialSaved ?? localSaved;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (initialSaved !== undefined) return;
    const controller = new AbortController();
    fetch(appPath(`/api/retail/v1/favorites?organization=${encodeURIComponent(organization)}`), { signal: controller.signal, credentials: "same-origin" })
      .then(async response => {
        if (response.status === 401) return;
        if (!response.ok) return;
        const data = await response.json();
        setConfigured(data.favoritesAvailable !== false);
        if (Array.isArray(data.productIds)) setLocalSaved(data.productIds.includes(productId));
      }).catch(() => undefined);
    return () => controller.abort();
  }, [initialSaved, organization, productId]);

  async function toggle() {
    if (!favoritesAvailable || !configured || pending) return;
    setPending(true);
    setError("");
    try {
      const url = appPath(`/api/retail/v1/favorites?organization=${encodeURIComponent(organization)}`);
      const headers = { accept: "application/json", "content-type": "application/json" };
      let current = saved;
      if (initialSaved === undefined) {
        const currentResponse = await fetch(url, { credentials: "same-origin", headers: { accept: "application/json" } });
        if (currentResponse.status === 401) {
          const callback = window.location.pathname + window.location.search;
          window.location.assign(appPath(`/fa/login?callbackUrl=${encodeURIComponent(callback)}`));
          return;
        }
        if (!currentResponse.ok) throw new Error("علاقه‌مندی‌ها در دسترس نیست.");
        const payload = await currentResponse.json();
        const data = payload.data ?? payload;
        current = Array.isArray(data.productIds) && data.productIds.includes(productId);
      }
      const response = await fetch(url, {
        method: current ? "DELETE" : "POST", credentials: "same-origin", headers,
        body: JSON.stringify({ organization, productId }),
      });
      if (response.status === 401) {
        const callback = window.location.pathname + window.location.search;
        window.location.assign(appPath(`/fa/login?callbackUrl=${encodeURIComponent(callback)}`));
        return;
      }
      if (!response.ok) throw new Error("ذخیره علاقه‌مندی انجام نشد.");
      setLocalSaved(!current);
      onChange?.(!current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ذخیره علاقه‌مندی انجام نشد.");
    } finally {
      setPending(false);
    }
  }

  return <span className="relative inline-flex"><button type="button" onClick={() => void toggle()} disabled={!favoritesAvailable || !configured || pending}
    aria-label={saved ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"} aria-pressed={saved}
    title={favoritesAvailable ? undefined : "علاقه‌مندی‌ها در دسترس نیست"}
    className="grid size-10 shrink-0 place-items-center rounded-full border border-stone-200/80 bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:border-rose-200 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
    {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Heart aria-hidden="true" className={`size-[18px] ${saved ? "fill-rose-600 text-rose-600" : ""}`} />}
  </button>{error && <span role="alert" className="absolute end-0 top-full z-20 mt-2 w-56 rounded-lg border bg-white p-2 text-xs text-red-700 shadow">{error}</span>}</span>;
}
