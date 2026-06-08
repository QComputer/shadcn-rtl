"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Button } from "./button";
import { Input } from "./input";
import { MapPin, Search, Navigation2 } from "lucide-react";

interface MapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  defaultAddress?: string;
  defaultLat?: number;
  defaultLng?: number;
}

export default function MapLocationPicker({
  onLocationSelect,
  defaultAddress = "",
  defaultLat,
  defaultLng,
}: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const [address, setAddress] = useState(defaultAddress);
  const [markerLat, setMarkerLat] = useState<number | undefined>(defaultLat);
  const [markerLng, setMarkerLng] = useState<number | undefined>(defaultLng);

  const tryReverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fa`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (response.ok) {
        const data = await response.json();
        const displayAddress = data.display_name || `${lat}, ${lng}`;
        setAddress(displayAddress);
        onLocationSelect(lat, lng, displayAddress);
      }
    } catch {
      setAddress(`${lat}, ${lng}`);
      onLocationSelect(lat, lng, `${lat}, ${lng}`);
    }
  };

  const updateMarker = (lat: number, lng: number) => {
    if (!mapInstance.current) return;
    
    setMarkerLat(lat);
    setMarkerLng(lng);
    
    const L = (window as any).L;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else if (L) {
      // Use defaultIcon if available, otherwise create a custom one
      const markerIcon = (L as any).Marker?.prototype?.options?.icon || (L as any).divIcon({
        className: "",
        html: `<div style="background:#3b82f6;width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      markerRef.current = (L as any).marker([lat, lng], { icon: markerIcon }).addTo(mapInstance.current);
    }
    mapInstance.current.setView([lat, lng], 15);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      alert("مرورگر شما از موقعیت‌یابی پشتیبانی نمی‌کند");
      return;
    }

    // Check for HTTPS requirement (geolocation only works on HTTPS or localhost)
    const isSecureContext = window.isSecureContext;
    if (!isSecureContext && window.location.hostname !== 'localhost') {
      alert("موقعیت‌یابی مرورگرها در این مرورگر یا چارچوب امنیتی محدود شده است. می‌توانید آدرس را جستجو کنید یا روی نقشه کلیک کنید تا موقعیت را انتخاب کنید.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateMarker(latitude, longitude);
        tryReverseGeocode(latitude, longitude);
      },
      (error) => {
        const errorMessages: Record<string, string> = {
          PERMISSION_DENIED: "دسترسی به موقعیت مکانی رد شده است. لطفاً اجازه دسترسی به موقعیت را در تنظیمات مرورگر بدهید",
          POSITION_UNAVAILABLE: "موقعیت مکانی در دسترس نیست",
          TIMEOUT: "دریافت موقعیت با تایم‌اوت مواجه شد، لطفاً دوباره سعی کنید",
        };
        alert(errorMessages[error.code] || "دریافت موقعیت فعلی با خطا مواجه شد");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async () => {
    if (!address.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&accept-language=fa&limit=1`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (response.ok) {
        const data = await response.json();
        if (data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          updateMarker(lat, lng);
          onLocationSelect(lat, lng, data[0].display_name);
        }
      }
    } catch {
      // User will manually select on map
    }
  };

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

      const map = (L as any).map(mapRef.current!).setView([35.6892, 51.389], 13);
      mapInstance.current = map;
      (window as any).L = L;

      (L as any).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        maxNativeZoom: 19,
      }).addTo(map);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        setMarkerLat(lat);
        setMarkerLng(lng);
        updateMarker(lat, lng);
        tryReverseGeocode(lat, lng);
      });

      // Set initial marker if coordinates provided
      if (markerLat != null && markerLng != null) {
        markerRef.current = (L as any).marker([markerLat, markerLng], { icon: defaultIcon }).addTo(map);
        map.setView([markerLat, markerLng], 15);
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, []);

  return (
    <div className="space-y-3 w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="آدرس تحویل را وارد کنید یا روی نقشه کلیک کنید"
            className="pl-10"
          />
        </div>
        <Button type="button" variant="outline" onClick={handleSearch} title="جستجو">
          <Search className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" onClick={handleMyLocation} title="موقعیت من">
          <Navigation2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={mapRef}
        className="h-[300px] w-full rounded-md border bg-muted/20 relative"
        style={{ minHeight: "300px", maxWidth: "100%" }}
      />

      {markerLat != null && markerLng != null && (
        <p className="text-xs text-muted-foreground">
          موقعیت انتخابی: {markerLat.toFixed(6)}, {markerLng.toFixed(6)}
        </p>
      )}
    </div>
  );
}