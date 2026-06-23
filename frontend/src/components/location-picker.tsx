"use client";
import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Load Leaflet (CSS + JS) from CDN once — avoids an npm dependency.
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.async = true;
    js.onload = () => resolve((window as any).L);
    js.onerror = () => reject(new Error("Không tải được bản đồ"));
    document.head.appendChild(js);
  });
  return leafletPromise;
}

const HANOI = { lat: 21.0278, lng: 105.8342 };

/** Interactive map to pick a venue location (OpenStreetMap + Leaflet). */
export function LocationPicker({
  lat,
  lng,
  onChange,
  onAddress,
  className,
}: {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
  onAddress?: (address: string) => void;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const onAddrRef = useRef(onAddress);
  onChangeRef.current = onChange;
  onAddrRef.current = onAddress;

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null
  );
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const start = lat != null && lng != null ? { lat, lng } : HANOI;
        const map = L.map(elRef.current).setView([start.lat, start.lng], lat != null ? 15 : 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const place = (la: number, ln: number, fly = false) => {
          if (markerRef.current) {
            markerRef.current.setLatLng([la, ln]);
          } else {
            markerRef.current = L.marker([la, ln], { draggable: true }).addTo(map);
            markerRef.current.on("dragend", () => {
              const p = markerRef.current.getLatLng();
              setCoords({ lat: p.lat, lng: p.lng });
              onChangeRef.current(p.lat, p.lng);
            });
          }
          if (fly) map.setView([la, ln], 16);
          setCoords({ lat: la, lng: ln });
          onChangeRef.current(la, ln);
        };
        (map as any).__place = place;
        mapRef.current = map;

        if (lat != null && lng != null) place(lat, lng);
        map.on("click", (e: any) => place(e.latlng.lat, e.latlng.lng));
        setTimeout(() => map.invalidateSize(), 80);
      })
      .catch((e) => setErr((e as Error).message));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    if (!q.trim() || !mapRef.current) return;
    setErr(null);
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "vi" } }
      );
      const data = await r.json();
      if (data[0]) {
        const la = parseFloat(data[0].lat);
        const ln = parseFloat(data[0].lon);
        (mapRef.current as any).__place(la, ln, true);
        if (onAddrRef.current && data[0].display_name) onAddrRef.current(data[0].display_name);
      } else {
        setErr("Không tìm thấy địa chỉ này.");
      }
    } catch {
      setErr("Tìm kiếm thất bại.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
          <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
            placeholder="Tìm địa chỉ trên bản đồ…"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50 cursor-pointer"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" strokeWidth={2} />} Tìm
        </button>
      </div>

      <div ref={elRef} className="mt-2 h-64 w-full overflow-hidden rounded-xl border border-line isolate" />

      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
        <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
        {coords
          ? `Đã chọn: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — bấm bản đồ hoặc kéo ghim để chỉnh.`
          : "Bấm vào bản đồ hoặc tìm địa chỉ để đặt vị trí sự kiện."}
      </p>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
