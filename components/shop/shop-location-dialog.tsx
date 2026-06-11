"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { getDictionary, getDictValue } from "@/lib/dictionary";

const MapLocationView = dynamic(() => import("@/components/ui/map-location-view"), { ssr: false });

interface ShopLocationDialogProps {
  lat: number;
  lng: number;
  name?: string | null;
  locale: string;
}

export function ShopLocationDialog({ lat, lng, name, locale }: ShopLocationDialogProps) {
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("organization.location") || "موقعیت"}>
          <MapPin className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("organization.location") || "موقعیت فروشگاه"}</DialogTitle>
        </DialogHeader>
        <div className="h-[400px] w-full mt-4">
          <MapLocationView lat={lat} lng={lng} label={name || "فروشگاه"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}