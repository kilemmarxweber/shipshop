"use client";

import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in bundlers
const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Props = {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  zoom?: number;
};

function ClickHandler({ onChange }: { onChange: Props["onChange"] }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({
  latitude,
  longitude,
  zoom,
}: {
  latitude: number;
  longitude: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [latitude, longitude, map, zoom]);
  return null;
}

/** Carte OSM cliquable — pattern Eteyelo BranchMapPicker. */
export default function AddressMapPicker({
  latitude,
  longitude,
  onChange,
  className,
  zoom = 16,
}: Props) {
  return (
    <div
      className={cn(
        "h-[240px] overflow-hidden rounded-2xl border border-border",
        className,
      )}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={pinIcon} />
        <ClickHandler onChange={onChange} />
        <RecenterMap latitude={latitude} longitude={longitude} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
