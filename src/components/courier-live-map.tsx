"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { bearingDeg } from "@/lib/browser-geolocation";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

const destIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function motoIcon(heading: number) {
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div style="
      width:40px;height:40px;display:grid;place-items:center;
      transform:rotate(${heading}deg);
      filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));
      font-size:28px;line-height:1;
      transition:transform .4s ease;
    ">🛵</div>`,
  });
}

type Point = { lat: number; lng: number };

type Props = {
  courier: Point | null;
  destination: Point | null;
  etaText?: string | null;
  distanceKm?: number | null;
  className?: string;
};

function FitBounds({ a, b }: { a: Point; b: Point }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([
      [a.lat, a.lng],
      [b.lat, b.lng],
    ]);
    map.fitBounds(bounds.pad(0.25));
  }, [a.lat, a.lng, b.lat, b.lng, map]);
  return null;
}

function FollowCourier({ point }: { point: Point }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([point.lat, point.lng], { animate: true, duration: 0.8 });
  }, [point.lat, point.lng, map]);
  return null;
}

/** Carte live : moto livreur + destination client + tracé. */
export default function CourierLiveMap({
  courier,
  destination,
  etaText,
  distanceKm,
  className,
}: Props) {
  const prev = useRef<Point | null>(null);
  const [heading, setHeading] = useState(0);
  const [display, setDisplay] = useState<Point | null>(courier);

  // Interpolation douce entre positions GPS
  useEffect(() => {
    if (!courier) return;
    const from = display ?? courier;
    const to = courier;
    if (
      prev.current &&
      (Math.abs(prev.current.lat - to.lat) > 0.00001 ||
        Math.abs(prev.current.lng - to.lng) > 0.00001)
    ) {
      setHeading(bearingDeg(from.lat, from.lng, to.lat, to.lng));
    }
    prev.current = to;

    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      setDisplay({
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courier?.lat, courier?.lng]);

  const center = useMemo(() => {
    if (display) return display;
    if (destination) return destination;
    return { lat: -4.325, lng: 15.322 };
  }, [display, destination]);

  const icon = useMemo(() => motoIcon(heading), [heading]);

  if (!courier && !destination) {
    return (
      <div
        className={cn(
          "grid h-[260px] place-items-center rounded-2xl border border-border bg-surface-2 text-sm text-muted-foreground",
          className,
        )}
      >
        Position livreur en attente…
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border", className)}>
      <div className="h-[280px]">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          scrollWheelZoom
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {destination && (
            <Marker
              position={[destination.lat, destination.lng]}
              icon={destIcon}
            />
          )}
          {display && (
            <Marker position={[display.lat, display.lng]} icon={icon} />
          )}
          {display && destination && (
            <>
              <Polyline
                positions={[
                  [display.lat, display.lng],
                  [destination.lat, destination.lng],
                ]}
                pathOptions={{
                  color: "#ff5722",
                  weight: 3,
                  dashArray: "8 10",
                  opacity: 0.85,
                }}
              />
              <FitBounds a={display} b={destination} />
              <FollowCourier point={display} />
            </>
          )}
        </MapContainer>
      </div>
      <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap gap-2 rounded-xl bg-black/70 px-3 py-2 text-[11px] backdrop-blur">
        <span className="font-semibold text-primary">🛵 En route</span>
        {distanceKm != null && (
          <span className="text-white/80">{distanceKm} km</span>
        )}
        {etaText && <span className="text-trust">ETA {etaText}</span>}
      </div>
    </div>
  );
}
