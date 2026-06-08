"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MapLocationView = dynamic(() => import("@/components/ui/map-location-view"), {
  ssr: false,
});

type ShopLocationDialogProps = {
  lat: number;
  lng: number;
  organizationName?: string | null;
};

export function ShopLocationDialog({
  lat,
  lng,
  organizationName,
}: ShopLocationDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="موقعیت فروشگاه">
          <MapPin className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            موقعیت فروشگاه{organizationName ? ` ${organizationName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="h-[400px] mt-4">
          <MapLocationView lat={lat} lng={lng} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
