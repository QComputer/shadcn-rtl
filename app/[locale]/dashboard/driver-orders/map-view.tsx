"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  shopLat?: number;
  shopLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
}

export default function MapView({ shopLat, shopLng, deliveryLat, deliveryLng }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let map: unknown = null;
    let L: unknown = null;

    import("leaflet").then((leaflet) => {
      L = leaflet as any;
      map = (L as any).map(mapRef.current!).setView([35.6892, 51.389], 12);

      (L as any).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map as any);

      return map;
    }).then((mapInstance) => {
      if (!mapInstance || !L) return;

      if (deliveryLat != null && deliveryLng != null) {
        const deliveryIcon = (L as any).divIcon({
          className: "",
          html: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        (L as any).marker([deliveryLat, deliveryLng], { icon: deliveryIcon })
          .addTo(mapInstance as any)
          .bindPopup("تحویل");
      }

      if (shopLat != null && shopLng != null) {
        const shopIcon = (L as any).divIcon({
          className: "",
          html: `<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        (L as any).marker([shopLat, shopLng], { icon: shopIcon })
          .addTo(mapInstance as any)
          .bindPopup("فروشگاه");
      }

      const bounds: [number, number][] = [];
      if (deliveryLat != null && deliveryLng != null) bounds.push([deliveryLat, deliveryLng]);
      if (shopLat != null && shopLng != null) bounds.push([shopLat, shopLng]);

      if (bounds.length > 0) {
        (mapInstance as any).fitBounds(bounds, { padding: [50, 50] });
      }
    });

    return () => {
      if (map) (map as any).remove();
    };
  }, [shopLat, shopLng, deliveryLat, deliveryLng]);

  return (
    <div
      ref={mapRef}
      className="h-[300px] w-full rounded-md border bg-muted/20 relative"
      style={{ minHeight: "300px", maxWidth: "100%" }}
    />
  );
}
