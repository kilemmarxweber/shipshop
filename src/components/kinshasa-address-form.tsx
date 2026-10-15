"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Loader2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { composeAddress } from "@/lib/address";
import {
  getCurrentGeoCoords,
  reverseGeocode,
} from "@/lib/browser-geolocation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const AddressMapPicker = dynamic(() => import("@/components/address-map-picker"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[240px] place-items-center rounded-2xl border border-white/10 bg-[#1c1c26]">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  ),
});

export type AddressState = {
  city: string;
  commune: string;
  quartier: string;
  avenue: string;
  parcelle: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
};

type Commune = {
  name: string;
  quartiers: string[];
  avenues: string[];
};

type Props = {
  value: AddressState;
  onChange: (v: AddressState) => void;
  showPreview?: boolean;
  /** Affiche carte + GPS (livraison) */
  enableMap?: boolean;
};

const KINSHASA_DEFAULT = { lat: -4.325, lng: 15.322 };

function matchCommune(name: string, communes: Commune[]) {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return communes.find((c) => {
    const cn = c.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return cn === n || cn.includes(n) || n.includes(cn);
  });
}

export function KinshasaAddressForm({
  value,
  onChange,
  showPreview = true,
  enableMap = true,
}: Props) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [cityName, setCityName] = useState("Kinshasa");
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    fetchJson<{ city?: string; communes?: Commune[] }>("/api/geo/kinshasa")
      .then(({ data }) => {
        setCommunes(data?.communes ?? []);
        if (data?.city) {
          setCityName(data.city);
          if (!value.city) onChange({ ...value, city: data.city });
        }
      })
      .catch(() => setCommunes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => communes.find((c) => c.name === value.commune),
    [communes, value.commune],
  );

  const preview = composeAddress({
    city: value.city || cityName,
    commune: value.commune,
    quartier: value.quartier,
    avenue: value.avenue,
    parcelle: value.parcelle,
  });

  const mapLat = value.lat ?? KINSHASA_DEFAULT.lat;
  const mapLng = value.lng ?? KINSHASA_DEFAULT.lng;

  async function applyCoords(lat: number, lng: number, accuracy?: number) {
    try {
      const geo = await reverseGeocode(lat, lng);
      const matched = matchCommune(geo.commune || geo.quartier, communes);
      const communeName = matched?.name ?? "";
      const quartier =
        matched?.quartiers.find(
          (q) =>
            q.toLowerCase() === geo.quartier.toLowerCase() ||
            geo.quartier.toLowerCase().includes(q.toLowerCase()),
        ) ??
        (matched ? "" : geo.quartier);
      const avenue =
        matched?.avenues.find(
          (a) =>
            a.toLowerCase() === geo.avenue.toLowerCase() ||
            geo.avenue.toLowerCase().includes(a.toLowerCase()),
        ) ?? geo.avenue;

      onChange({
        ...value,
        city: "Kinshasa",
        commune: communeName || value.commune,
        quartier: quartier || value.quartier,
        avenue: avenue || value.avenue,
        lat,
        lng,
        accuracyM: accuracy ?? null,
      });
      setShowMap(true);
    } catch {
      onChange({ ...value, lat, lng, accuracyM: accuracy ?? null });
      toast.error("Position enregistrée — adresse textuelle non résolue");
    }
  }

  async function captureGps() {
    setLocating(true);
    try {
      const coords = await getCurrentGeoCoords();
      await applyCoords(coords.latitude, coords.longitude, coords.accuracy);
      toast.success(
        coords.accuracy
          ? `Position précise (~${Math.round(coords.accuracy)} m)`
          : "Position enregistrée",
      );
    } catch {
      toast.error("Impossible d'obtenir le GPS — activez la localisation");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>
          Ville <span className="text-destructive">*</span>
        </Label>
        <Input
          value={value.city || cityName}
          readOnly
          className="bg-[#1c1c26] opacity-90"
        />
      </div>

      {enableMap && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={locating}
              onClick={captureGps}
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Crosshair className="size-3.5" />
              )}
              {locating ? "GPS…" : "Ma position précise"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowMap((s) => !s)}
            >
              <MapPinned className="size-3.5" />
              {showMap ? "Masquer carte" : "Choisir sur la carte"}
            </Button>
          </div>
          {value.accuracyM != null && (
            <p className="text-[10px] text-trust">
              Précision GPS ~{Math.round(value.accuracyM)} m
            </p>
          )}
          {showMap && (
            <AddressMapPicker
              latitude={mapLat}
              longitude={mapLng}
              onChange={(lat, lng) => applyCoords(lat, lng)}
            />
          )}
          <p className="text-[10px] text-muted-foreground">
            Cliquez sur la carte ou utilisez le GPS (multi-mesures, style
            Eteyelo) pour une adresse précise.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Commune (optionnel)</Label>
        <select
          value={value.commune}
          onChange={(e) =>
            onChange({
              ...value,
              city: value.city || cityName,
              commune: e.target.value,
              quartier: "",
              avenue: "",
            })
          }
          className="h-10 w-full rounded-lg border border-white/10 bg-[#1c1c26] px-3 text-sm"
        >
          <option value="">—</option>
          {communes.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Quartier (optionnel)</Label>
        <select
          value={value.quartier}
          onChange={(e) => onChange({ ...value, quartier: e.target.value })}
          disabled={!selected}
          className="h-10 w-full rounded-lg border border-white/10 bg-[#1c1c26] px-3 text-sm disabled:opacity-40"
        >
          <option value="">—</option>
          {(selected?.quartiers ?? []).map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Avenue (optionnel)</Label>
        <select
          value={value.avenue}
          onChange={(e) => onChange({ ...value, avenue: e.target.value })}
          disabled={!selected}
          className="h-10 w-full rounded-lg border border-white/10 bg-[#1c1c26] px-3 text-sm disabled:opacity-40"
        >
          <option value="">—</option>
          {(selected?.avenues ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>N° parcelle (optionnel)</Label>
        <Input
          value={value.parcelle}
          onChange={(e) => onChange({ ...value, parcelle: e.target.value })}
          placeholder="ex. 45"
          className="bg-[#1c1c26]"
        />
      </div>

      {showPreview && (
        <p className="rounded-lg bg-black/30 px-3 py-2 text-[11px] text-muted-foreground">
          {preview}
          {value.lat != null && value.lng != null && (
            <span className="mt-1 block text-[10px] text-primary">
              GPS {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
