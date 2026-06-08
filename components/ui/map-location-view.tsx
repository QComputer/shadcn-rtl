"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapLocationViewProps {
  lat: number;
  lng: number;
  label?: string;
}

export default function MapLocationView({ 
  lat, 
  lng, 
  label = "موقعیت" 
}: MapLocationViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  useEffect(() => {
    if (!mapRef.current || mapInitialized.current) return;
    mapInitialized.current = true;

    import("leaflet").then((L) => {
      // Fix default icon path issue in Next.js bundled environments
      const iconRetinaUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png";
      const iconUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png";
      const shadowUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png";
      const defaultIcon = (L as any).icon({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
      });
      (L as any).Marker.prototype.options.icon = defaultIcon;

      const map = (L as any).map(mapRef.current!).setView([lat, lng], 15);

      (L as any).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      (L as any).marker([lat, lng], { icon: defaultIcon })
        .addTo(map)
        .bindPopup(label)
        .openPopup();
    });

    return () => {
      // Cleanup handled by Leaflet's map.remove() on component unmount
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={mapRef}
      className="h-full w-full rounded-md border"
    />
  );
}