"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Loader2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import {
  composeAddress,
  composeAddressLine,
  parseAddressLine,
} from "@/lib/address";
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
    <div className="grid h-[240px] place-items-center rounded-2xl border border-border bg-surface-2">
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
  /** GPS + quartier + point de repère */
  compact?: boolean;
  /** Lance le GPS à l’affichage (Livrer ici) */
  autoLocate?: boolean;
};

const KINSHASA_DEFAULT = { lat: -4.325, lng: 15.322 };

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function placeKey(s: string) {
  return fold(s)
    .replace(/^(la|le|les)\s+/, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCommune(name: string, communes: Commune[]) {
  const n = placeKey(name);
  if (!n) return undefined;
  return communes.find((c) => placeKey(c.name) === n);
}

function matchInList(needle: string, list: string[]) {
  const n = fold(needle);
  if (!n) return "";
  return (
    list.find((item) => fold(item) === n) ??
    list.find((item) => fold(item).includes(n) || n.includes(fold(item))) ??
    needle
  );
}

export function KinshasaAddressForm({
  value,
  onChange,
  showPreview = true,
  enableMap = true,
  compact = false,
  autoLocate = false,
}: Props) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [cityName, setCityName] = useState("Kinshasa");
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [lineFocused, setLineFocused] = useState(false);
  const [addressLine, setAddressLine] = useState(() =>
    composeAddressLine(value),
  );

  useEffect(() => {
    if (lineFocused) return;
    setAddressLine(composeAddressLine(value));
  }, [
    lineFocused,
    value.city,
    value.commune,
    value.quartier,
    value.avenue,
    value.parcelle,
  ]);

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

  function inCatalog(list: string[], name: string) {
    const n = fold(name);
    return Boolean(n) && list.some((item) => fold(item) === n);
  }

  async function saveIfNew(next: AddressState, notify = false) {
    const commune = next.commune.trim();
    if (commune.length < 2) return;
    const known = communes.find((c) => fold(c.name) === fold(commune));
    const quartier = next.quartier.trim();
    const avenue = next.avenue.trim();
    const isNewCommune = !known;
    const isNewQuartier = Boolean(
      quartier && !inCatalog(known?.quartiers ?? [], quartier),
    );
    const isNewAvenue = Boolean(
      avenue && !inCatalog(known?.avenues ?? [], avenue),
    );
    if (!isNewCommune && !isNewQuartier && !isNewAvenue) return;

    const { res, data } = await fetchJson<{
      communes?: Commune[];
      error?: string;
    }>("/api/geo/kinshasa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commune,
        quartier: quartier || undefined,
        avenue: avenue || undefined,
        lat: next.lat,
        lng: next.lng,
      }),
    });
    if (!res.ok) return;
    if (data?.communes) setCommunes(data.communes);
    if (notify) {
      toast.success("Nouveau lieu enregistré — il sera proposé la prochaine fois");
    }
  }

  const communesForSelect = useMemo(() => {
    const extraCommune =
      value.commune && !communes.some((c) => c.name === value.commune)
        ? [
            {
              name: value.commune,
              quartiers: value.quartier ? [value.quartier] : [],
              avenues: value.avenue ? [value.avenue] : [],
            } satisfies Commune,
          ]
        : [];
    return [...extraCommune, ...communes].map((c) => {
      if (c.name !== value.commune) return c;
      const quartiers =
        value.quartier && !c.quartiers.includes(value.quartier)
          ? [value.quartier, ...c.quartiers]
          : c.quartiers;
      const avenues =
        value.avenue && !c.avenues.includes(value.avenue)
          ? [value.avenue, ...c.avenues]
          : c.avenues;
      return { ...c, quartiers, avenues };
    });
  }, [communes, value.commune, value.quartier, value.avenue]);

  const selected = useMemo(
    () => communesForSelect.find((c) => c.name === value.commune),
    [communesForSelect, value.commune],
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
      const city = geo.city?.trim() || value.city || cityName || "Kinshasa";
      const matched = matchCommune(geo.commune, communes);
      const communeName = matched?.name || geo.commune || value.commune;
      const quartier = geo.quartier
        ? matchInList(geo.quartier, matched?.quartiers ?? [])
        : value.quartier;
      const avenue = geo.avenue
        ? matchInList(geo.avenue, matched?.avenues ?? [])
        : value.avenue;
      const parcelle = geo.houseNumber || value.parcelle;

      const next: AddressState = {
        ...value,
        city,
        commune: communeName,
        quartier,
        avenue,
        parcelle,
        lat,
        lng,
        accuracyM: accuracy ?? null,
      };
      onChange(next);
      if (!compact) setShowMap(true);
      void saveIfNew(next);
      if (!compact && !geo.houseNumber) {
        toast.message("Numéro non trouvé — saisissez-le manuellement");
      }
    } catch {
      onChange({
        ...value,
        city: value.city || cityName || "Kinshasa",
        lat,
        lng,
        accuracyM: accuracy ?? null,
      });
      toast.error(
        "Position GPS OK — commune / quartier à compléter à la main",
      );
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

  useEffect(() => {
    if (!autoLocate) return;
    if (value.lat != null && value.lng != null) return;
    void captureGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocate]);

  function patch(partial: Partial<AddressState>) {
    onChange({
      ...value,
      city: (partial.city ?? value.city) || cityName,
      ...partial,
    });
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <Button
          type="button"
          className="h-11 w-full gap-2"
          variant="secondary"
          disabled={locating}
          onClick={() => void captureGps()}
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
          {locating ? "GPS…" : "Livrer ici (GPS)"}
        </Button>
        {value.lat != null && value.lng != null ? (
          <p className="text-[11px] text-trust">
            Position OK
            {value.accuracyM != null
              ? ` · ~${Math.round(value.accuracyM)} m`
              : ""}
            {value.city || value.commune
              ? ` · ${[value.city, value.commune].filter(Boolean).join(" · ")}`
              : ""}
          </p>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="addr-city-c">Ville</Label>
          <Input
            id="addr-city-c"
            list="addr-city-list-c"
            value={value.city || cityName}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="Ex. Kinshasa"
            className="h-11 bg-surface-2"
          />
          <datalist id="addr-city-list-c">
            <option value={cityName} />
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="addr-commune-c">Commune</Label>
          <Input
            id="addr-commune-c"
            list="addr-commune-list-c"
            value={value.commune}
            onChange={(e) => {
              const commune = e.target.value;
              const known = communes.some((c) => c.name === commune);
              patch(
                known && commune !== value.commune
                  ? { commune, quartier: "", avenue: "" }
                  : { commune },
              );
            }}
            placeholder="Ex. Gombe, Kalamu…"
            className="h-11 bg-surface-2"
            onBlur={() => void saveIfNew(value, true)}
          />
          <datalist id="addr-commune-list-c">
            {communesForSelect.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="addr-quartier-c">Quartier</Label>
          <Input
            id="addr-quartier-c"
            list="addr-quartier-list-c"
            value={value.quartier}
            onChange={(e) => patch({ quartier: e.target.value })}
            placeholder="Quartier"
            className="h-11 bg-surface-2"
            onBlur={() => void saveIfNew(value, true)}
          />
          <datalist id="addr-quartier-list-c">
            {(selected?.quartiers ?? []).map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="addr-repere-c">Point de repère</Label>
          <Input
            id="addr-repere-c"
            value={value.parcelle || value.avenue}
            onChange={(e) => patch({ parcelle: e.target.value })}
            placeholder="Église, arrêt, n° parcelle…"
            className="h-11 bg-surface-2"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="addr-city">
          Ville <span className="text-destructive">*</span>
        </Label>
        <Input
          id="addr-city"
          list="addr-city-list"
          value={value.city || cityName}
          onChange={(e) => patch({ city: e.target.value })}
          placeholder="Obligatoire"
          required
          className="bg-surface-2"
        />
        <datalist id="addr-city-list">
          <option value={cityName} />
        </datalist>
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
            <div className="relative">
              <AddressMapPicker
                latitude={mapLat}
                longitude={mapLng}
                onChange={(lat, lng) => {
                  void (async () => {
                    setLocating(true);
                    try {
                      await applyCoords(lat, lng);
                    } finally {
                      setLocating(false);
                    }
                  })();
                }}
              />
              {locating && (
                <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/50">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            GPS charge la ville, commune, quartier et avenue depuis le
            catalogue. Vous pouvez corriger ou ajouter un nom manquant — il
            est alors enregistré pour les prochaines fois.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="addr-commune">Commune</Label>
        <Input
          id="addr-commune"
          list="addr-commune-list"
          value={value.commune}
          onChange={(e) => {
            const commune = e.target.value;
            const known = communes.some((c) => c.name === commune);
            patch(
              known && commune !== value.commune
                ? { commune, quartier: "", avenue: "" }
                : { commune },
            );
          }}
          placeholder="Liste ou saisie libre"
          className="bg-surface-2"
          onBlur={() => void saveIfNew(value, true)}
        />
        <datalist id="addr-commune-list">
          {communesForSelect.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addr-quartier">Quartier</Label>
        <Input
          id="addr-quartier"
          list="addr-quartier-list"
          value={value.quartier}
          onChange={(e) => patch({ quartier: e.target.value })}
          placeholder="Liste ou saisie libre"
          className="bg-surface-2"
          onBlur={() => void saveIfNew(value, true)}
        />
        <datalist id="addr-quartier-list">
          {(selected?.quartiers ?? []).map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addr-avenue">Avenue</Label>
        <Input
          id="addr-avenue"
          list="addr-avenue-list"
          value={value.avenue}
          onChange={(e) => patch({ avenue: e.target.value })}
          placeholder="Liste ou saisie libre"
          className="bg-surface-2"
          onBlur={() => void saveIfNew(value, true)}
        />
        <datalist id="addr-avenue-list">
          {(selected?.avenues ?? []).map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addr-parcelle">N° parcelle / numéro</Label>
        <Input
          id="addr-parcelle"
          value={value.parcelle}
          onChange={(e) => patch({ parcelle: e.target.value })}
          placeholder="GPS ou saisie manuelle, ex. 45"
          className="bg-surface-2"
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
