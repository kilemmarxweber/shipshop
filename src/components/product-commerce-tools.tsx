"use client";

import { Check, ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getCurrentGeoCoords, reverseGeocode } from "@/lib/browser-geolocation";
import { fetchJson } from "@/lib/fetch-json";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  KinshasaAddressForm,
  type AddressState,
} from "@/components/kinshasa-address-form";
import { cn } from "@/lib/utils";
import { BOOST_PACKS } from "@/lib/shop-boost";

type BoostDays = (typeof BOOST_PACKS)[number]["days"];
type BoostZone = {
  country: string;
  city: string;
  commune: string;
  quartier: string;
  avenue: string;
};
type GeoCommune = {
  name: string;
  quartiers: string[];
};
type GeoCatalogResponse = {
  city?: string;
  communes?: GeoCommune[];
  error?: string;
};
type ZoneMode = "guided" | "map";
type CountryGeoCatalog = {
  cities: Array<{ name: string; communes: string[] }>;
};

const AddressMapPicker = dynamic(() => import("@/components/address-map-picker"), {
  ssr: false,
});

const COUNTRY_GEO: Record<string, CountryGeoCatalog> = {
  RDC: {
    cities: [
      { name: "Kinshasa", communes: [] },
      { name: "Lubumbashi", communes: ["Lubumbashi", "Kampemba", "Kenya", "Katuba", "Annexe", "Ruashi", "Kamalondo"] },
      { name: "Goma", communes: ["Goma", "Karisimbi"] },
      { name: "Bukavu", communes: ["Ibanda", "Kadutu", "Bagira"] },
      { name: "Kisangani", communes: ["Makiso", "Mangobo", "Kisangani", "Tshopo", "Kabondo"] },
    ],
  },
  "Congo Brazzaville": {
    cities: [
      { name: "Brazzaville", communes: ["Makelekele", "Bacongo", "Poto-Poto", "Moungali", "Ouenzé", "Talangai", "Mfilou", "Madibou", "Djiri"] },
      { name: "Pointe-Noire", communes: ["Lumumba", "Mvoumvou", "Tié-Tié", "Loandjili", "Mongo-Mpoukou", "Ngoyo"] },
    ],
  },
  Angola: {
    cities: [
      { name: "Cabinda", communes: ["Cabinda"] },
      { name: "Luanda", communes: ["Ingombota", "Maianga", "Rangel", "Samba", "Sambizanga", "Cazenga", "Viana", "Talatona"] },
      { name: "Benguela", communes: ["Benguela", "Lobito", "Catumbela"] },
      { name: "Huambo", communes: ["Huambo", "Tchicala-Tcholohanga"] },
    ],
  },
  Rwanda: {
    cities: [
      { name: "Kigali", communes: ["Gasabo", "Kicukiro", "Nyarugenge"] },
      { name: "Butare", communes: ["Ngoma", "Huye", "Mbazi"] },
    ],
  },
  Uganda: {
    cities: [
      { name: "Kampala", communes: ["Central", "Kawempe", "Makindye", "Nakawa", "Rubaga"] },
      { name: "Entebbe", communes: ["Division A", "Division B"] },
    ],
  },
};

const COUNTRY_CENTER: Record<string, { lat: number; lng: number; zoom: number }> = {
  RDC: { lat: -4.325, lng: 15.322, zoom: 11 },
  "Congo Brazzaville": { lat: -4.263, lng: 15.242, zoom: 11 },
  Angola: { lat: -8.8383, lng: 13.2344, zoom: 10 },
  Rwanda: { lat: -1.95, lng: 30.0588, zoom: 11 },
  Uganda: { lat: 0.3476, lng: 32.5825, zoom: 10 },
};

function packLabel(days: number) {
  if (days === 30) return "1 mois";
  if (days === 180) return "6 mois";
  if (days === 365) return "1 an";
  return `${days} j`;
}

function mergeUniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function hasValue(values: string[], value: string) {
  const key = value.trim().toLowerCase();
  return values.some((item) => item.trim().toLowerCase() === key);
}

function appendIfMissing(values: string[], value: string) {
  const cleaned = value.trim();
  if (!cleaned) return values;
  if (hasValue(values, cleaned)) return values;
  return [...values, cleaned];
}

function hasCountryAndCity(zone: BoostZone) {
  return Boolean(zone.country.trim()) && Boolean(zone.city.trim());
}

type MultiSelectDropdownProps = {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onCreateOption?: (value: string) => void;
  disabled?: boolean;
};

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  onChange,
  onCreateOption,
  disabled = false,
}: MultiSelectDropdownProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((row) => row.toLowerCase().includes(q));
  }, [options, query]);
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} selectionnes`;
  const trimmedQuery = query.trim();
  const canCreate =
    Boolean(onCreateOption && trimmedQuery) &&
    !options.some((option) => option.toLowerCase() === trimmedQuery.toLowerCase());

  function toggle(value: string) {
    const hit = selected.includes(value);
    if (hit) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-9 w-full justify-between rounded-lg border-border bg-surface-2 px-2 text-left text-xs",
            selected.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[min(22rem,90vw)] p-2" align="start">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            className="mb-2 h-8 bg-surface-2 text-xs"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">Aucun resultat</p>
            ) : (
              filtered.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggle(option)}
                  onSelect={(event) => event.preventDefault()}
                  className="text-xs"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Check
                      className={cn(
                        "size-3",
                        selected.includes(option) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option}
                  </span>
                </DropdownMenuCheckboxItem>
              ))
            )}
            {canCreate ? (
              <button
                type="button"
                onClick={() => {
                  if (!onCreateOption) return;
                  onCreateOption(trimmedQuery);
                  setQuery("");
                }}
                className="mt-1 w-full rounded-md border border-dashed border-primary/40 px-2 py-1.5 text-left text-xs text-primary hover:bg-primary/5"
              >
                Ajouter "{trimmedQuery}"
              </button>
            ) : null}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ProductCommerceTools({
  productId,
  creatorCommissionBps,
  canManage,
  canClaimCreator,
}: {
  productId: string;
  creatorCommissionBps: number;
  canManage: boolean;
  canClaimCreator: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [bps, setBps] = useState(creatorCommissionBps);
  const [zoneMode, setZoneMode] = useState<ZoneMode>("guided");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["RDC"]);
  const [selectedCities, setSelectedCities] = useState<string[]>(["Kinshasa"]);
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
  const [selectedQuartiers, setSelectedQuartiers] = useState<string[]>([]);
  const [avenue, setAvenue] = useState("");
  const [mapAddress, setMapAddress] = useState<AddressState>({
    city: "Kinshasa",
    commune: "",
    quartier: "",
    avenue: "",
    parcelle: "",
  });
  const [zones, setZones] = useState<BoostZone[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>(["Kinshasa"]);
  const [communes, setCommunes] = useState<GeoCommune[]>([]);
  const [customCitiesByCountry, setCustomCitiesByCountry] = useState<Record<string, string[]>>({});
  const [customCommunesByCity, setCustomCommunesByCity] = useState<Record<string, string[]>>({});
  const [customQuartiersByCommune, setCustomQuartiersByCommune] = useState<Record<string, string[]>>({});
  const [mapPoint, setMapPoint] = useState(() => {
    const center = COUNTRY_CENTER.RDC;
    return { lat: center.lat, lng: center.lng };
  });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    void fetchJson<GeoCatalogResponse>("/api/geo/kinshasa").then(({ data }) => {
      const city = data?.city?.trim();
      if (city) {
        setCityOptions([city]);
        setMapAddress((prev) => ({ ...prev, city }));
      }
      setCommunes(data?.communes ?? []);
    });
  }, []);

  const countryNames = useMemo(() => Object.keys(COUNTRY_GEO), []);
  const mapCountry = selectedCountries[0] ?? "RDC";
  const mapCenter = COUNTRY_CENTER[mapCountry] ?? COUNTRY_CENTER.RDC;

  useEffect(() => {
    setMapPoint({ lat: mapCenter.lat, lng: mapCenter.lng });
  }, [mapCenter.lat, mapCenter.lng]);

  function upsertCity(country: string, value: string) {
    const cleaned = value.trim();
    if (!cleaned) return;
    setCustomCitiesByCountry((prev) => ({
      ...prev,
      [country]: appendIfMissing(prev[country] ?? [], cleaned),
    }));
    setSelectedCities((prev) => appendIfMissing(prev, cleaned));
  }

  function cityKey(country: string, city: string) {
    return `${country}::${city}`.toLowerCase();
  }

  function communeKey(country: string, city: string, commune: string) {
    return `${country}::${city}::${commune}`.toLowerCase();
  }

  function upsertCommune(country: string, city: string, value: string) {
    const cleaned = value.trim();
    if (!cleaned) return;
    const key = cityKey(country, city);
    setCustomCommunesByCity((prev) => ({
      ...prev,
      [key]: appendIfMissing(prev[key] ?? [], cleaned),
    }));
    setSelectedCommunes((prev) => appendIfMissing(prev, cleaned));
  }

  function upsertQuartier(country: string, city: string, commune: string, value: string) {
    const cleaned = value.trim();
    if (!cleaned) return;
    const key = communeKey(country, city, commune || "__none__");
    setCustomQuartiersByCommune((prev) => ({
      ...prev,
      [key]: appendIfMissing(prev[key] ?? [], cleaned),
    }));
    setSelectedQuartiers((prev) => appendIfMissing(prev, cleaned));
  }

  const selectedCountryCities = useMemo(() => {
    const out: string[] = [];
    for (const country of selectedCountries) {
      const row = COUNTRY_GEO[country]?.cities ?? [];
      for (const city of row) out.push(city.name);
      out.push(...(customCitiesByCountry[country] ?? []));
    }
    return mergeUniqueStrings(out);
  }, [selectedCountries, customCitiesByCountry]);
  const rdcCities = useMemo(
    () => mergeUniqueStrings([...selectedCountryCities, ...cityOptions]),
    [selectedCountryCities, cityOptions],
  );
  const communeOptions = useMemo(() => {
    const out: string[] = [];
    for (const country of selectedCountries) {
      for (const city of selectedCities) {
        if (country === "RDC" && city === "Kinshasa") {
          out.push(...communes.map((c) => c.name));
        }
        const match = (COUNTRY_GEO[country]?.cities ?? []).find((row) => row.name === city);
        if (match) out.push(...match.communes);
        out.push(...(customCommunesByCity[cityKey(country, city)] ?? []));
      }
    }
    return mergeUniqueStrings(out);
  }, [selectedCountries, selectedCities, communes, customCommunesByCity]);
  const quartierOptions = useMemo(() => {
    const out: string[] = [];
    for (const country of selectedCountries) {
      for (const city of selectedCities) {
        const isKinshasa = country === "RDC" && city === "Kinshasa";
        for (const communeName of selectedCommunes) {
          if (isKinshasa) {
            const current = communes.find((c) => c.name === communeName);
            if (current) out.push(...current.quartiers);
          }
          out.push(
            ...(customQuartiersByCommune[communeKey(country, city, communeName)] ?? []),
          );
        }
      }
    }
    return mergeUniqueStrings(out);
  }, [
    selectedCountries,
    selectedCities,
    selectedCommunes,
    communes,
    customQuartiersByCommune,
  ]);
  const canUseMap = selectedCountries.length > 0;

  async function applyReverseGeo(lat: number, lng: number) {
    setMapPoint({ lat, lng });
    try {
      const data = await reverseGeocode(lat, lng);
      const country = mapCountry;
      const cityValue = data.city.trim();
      const communeValue = data.commune.trim();
      const quartierValue = data.quartier.trim();
      const avenueValue = data.avenue.trim();

      if (cityValue) {
        upsertCity(country, cityValue);
      }
      if (communeValue && cityValue) {
        upsertCommune(country, cityValue, communeValue);
      }
      if (quartierValue && cityValue) {
        upsertQuartier(country, cityValue, communeValue, quartierValue);
      }
      if (avenueValue) {
        setAvenue(avenueValue);
      }
      setMapAddress((prev) => ({
        ...prev,
        city: cityValue || prev.city,
        commune: communeValue || prev.commune,
        quartier: quartierValue || prev.quartier,
        avenue: avenueValue || prev.avenue,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Adresse introuvable pour ce point";
      toast.error(message);
    }
  }

  async function locateCurrentPosition() {
    try {
      setLocating(true);
      const coords = await getCurrentGeoCoords();
      await applyReverseGeo(coords.latitude, coords.longitude);
      toast.success("Position GPS détectée");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de récupérer ta position";
      toast.error(message);
    } finally {
      setLocating(false);
    }
  }

  function cleanZone(zone: BoostZone): BoostZone {
    return {
      country: zone.country.trim(),
      city: zone.city.trim(),
      commune: zone.commune.trim(),
      quartier: zone.quartier.trim(),
      avenue: zone.avenue.trim(),
    };
  }

  function zoneLabel(zone: BoostZone) {
    return [zone.country, zone.city, zone.commune, zone.quartier, zone.avenue]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(" · ");
  }

  function addZone() {
    const newZones: BoostZone[] = [];
    if (zoneMode === "map" && canUseMap) {
      const activeCountry = mapCountry || "RDC";
      newZones.push({
        country: activeCountry,
        city: mapAddress.city || selectedCities[0] || "",
        commune: mapAddress.commune || "",
        quartier: mapAddress.quartier || "",
        avenue: (mapAddress.avenue || avenue).trim(),
      });
    } else {
      const countries = selectedCountries.length ? selectedCountries : [""];
      for (const country of countries) {
        const countryCities =
          country === "RDC"
            ? rdcCities
            : (COUNTRY_GEO[country]?.cities ?? []).map((c) => c.name);
        const cities = selectedCities.filter((city) => countryCities.includes(city));
        const cityList = cities.length ? cities : [];
        for (const city of cityList) {
          const currentCommunes = mergeUniqueStrings([
            ...(country === "RDC" && city === "Kinshasa"
              ? communes.map((c) => c.name)
              : []),
            ...((COUNTRY_GEO[country]?.cities ?? []).find((row) => row.name === city)
              ?.communes ?? []),
            ...(customCommunesByCity[cityKey(country, city)] ?? []),
          ]);
          const communesForZone = selectedCommunes.length
            ? selectedCommunes.filter((name) => currentCommunes.includes(name))
            : [""];
          const communeList = communesForZone.length ? communesForZone : [""];
          for (const commune of communeList) {
            const currentQuartiers = mergeUniqueStrings([
              ...(country === "RDC" && city === "Kinshasa" && commune
                ? communes.find((c) => c.name === commune)?.quartiers ?? []
                : []),
              ...(customQuartiersByCommune[communeKey(country, city, commune || "__none__")] ??
                []),
            ]);
            const quarterList = selectedQuartiers.length
              ? selectedQuartiers.filter(
                  (name) => currentQuartiers.length === 0 || currentQuartiers.includes(name),
                )
              : [""];
            const quarterRows = quarterList.length ? quarterList : [""];
            for (const quartier of quarterRows) {
              newZones.push({
                country,
                city,
                commune,
                quartier,
                avenue: avenue.trim(),
              });
            }
          }
        }
      }
    }

    const cleaned = newZones.map(cleanZone).filter(hasCountryAndCity);
    if (cleaned.length === 0) {
      toast.error("Pays et ville sont obligatoires (commune, quartier et avenue restent optionnels).");
      return;
    }
    const existing = new Set(zones.map((z) => zoneLabel(z).toLowerCase()));
    const toAppend = cleaned.filter(
      (zone) => !existing.has(zoneLabel(zone).toLowerCase()),
    );
    if (toAppend.length === 0) {
      toast.error("Ces zones sont deja ajoutees");
      return;
    }
    setZones((prev) => [...prev, ...toAppend]);
  }

  async function boost(days: BoostDays) {
    setBusy(true);
    const payloadZones = zones.map(cleanZone).filter(hasCountryAndCity);
    if (zones.length > 0 && payloadZones.length !== zones.length) {
      setBusy(false);
      toast.error("Chaque zone doit contenir au moins un pays et une ville.");
      return;
    }
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${productId}/boost`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, zones: payloadZones }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Boost impossible");
      return;
    }
    if (payloadZones.length === 0) {
      toast.success("ShipBoost active (toutes zones)");
      return;
    }
    toast.success(
      payloadZones.length === 1
        ? `ShipBoost active (${zoneLabel(payloadZones[0]!)})`
        : `ShipBoost active sur ${payloadZones.length} zones`,
    );
  }

  async function saveCreatorBps() {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${productId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorCommissionBps: bps }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Commission non enregistrée");
      return;
    }
    toast.success("Commission créateur enregistrée");
  }

  async function claim() {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string; via?: string }>(
      `/api/products/${productId}/creator`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Affiliation impossible");
      return;
    }
    toast.success("Produit ajouté à ShipCreator — partage le lien de la fiche");
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {canManage ? (
        <>
          <p className="text-[11px] font-semibold">ShipBoost</p>
          <p className="text-[11px] text-muted-foreground">
            Ciblage local: commence par le pays, puis ville, commune, quartier.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={zoneMode === "guided" ? "default" : "outline"}
              disabled={busy}
              onClick={() => setZoneMode("guided")}
            >
              Listes guidées
            </Button>
            <Button
              size="sm"
              variant={zoneMode === "map" ? "default" : "outline"}
              disabled={busy || !canUseMap}
              onClick={() => setZoneMode("map")}
              title={
                canUseMap
                  ? "Choisir la zone sur la carte"
                  : "Choisis d'abord au moins un pays"
              }
            >
              Voir sur la carte
            </Button>
          </div>
          {zoneMode === "map" && selectedCountries.length > 1 ? (
            <p className="text-[10px] text-muted-foreground">
              La carte cible le premier pays sélectionné: {mapCountry}.
            </p>
          ) : null}
          <div className="grid gap-1.5 sm:grid-cols-2">
            <MultiSelectDropdown
              label="Pays (1 ou plusieurs)"
              placeholder="Choisir pays"
              options={countryNames}
              selected={selectedCountries}
              onChange={(next) => {
                setSelectedCountries(next);
                const allowedCities = mergeUniqueStrings(
                  next.flatMap((country) => [
                    ...((COUNTRY_GEO[country]?.cities ?? []).map((row) => row.name)),
                    ...(customCitiesByCountry[country] ?? []),
                    ...(country === "RDC" ? cityOptions : []),
                  ]),
                );
                setSelectedCities((prev) =>
                  prev.filter((city) => allowedCities.includes(city)),
                );
              }}
              disabled={busy}
            />
            <MultiSelectDropdown
              label="Villes (1 ou plusieurs)"
              placeholder="Choisir villes"
              options={mergeUniqueStrings(
                selectedCountries.flatMap((country) =>
                  country === "RDC"
                    ? rdcCities
                    : [
                        ...(COUNTRY_GEO[country]?.cities ?? []).map((row) => row.name),
                        ...(customCitiesByCountry[country] ?? []),
                      ],
                ),
              )}
              selected={selectedCities}
              onChange={setSelectedCities}
              onCreateOption={(value) => {
                const country = selectedCountries[0];
                if (!country) return;
                upsertCity(country, value);
              }}
              disabled={busy || selectedCountries.length === 0}
            />
            <MultiSelectDropdown
              label="Communes (1 ou plusieurs)"
              placeholder="Choisir communes"
              options={communeOptions}
              selected={selectedCommunes}
              onChange={setSelectedCommunes}
              onCreateOption={(value) => {
                const country = selectedCountries[0];
                const city = selectedCities[0];
                if (!country || !city) return;
                upsertCommune(country, city, value);
              }}
              disabled={busy || selectedCities.length === 0}
            />
            <MultiSelectDropdown
              label="Quartiers (1 ou plusieurs)"
              placeholder="Choisir quartiers"
              options={quartierOptions}
              selected={selectedQuartiers}
              onChange={setSelectedQuartiers}
              onCreateOption={(value) => {
                const country = selectedCountries[0];
                const city = selectedCities[0];
                if (!country || !city) return;
                upsertQuartier(country, city, selectedCommunes[0] ?? "", value);
              }}
              disabled={busy || selectedCities.length === 0}
            />
            <input
              value={avenue}
              onChange={(e) => setAvenue(e.target.value)}
              placeholder="Avenue"
              className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
            />
          </div>
          {zoneMode === "map" && canUseMap ? (
            <div className="rounded-xl border border-border bg-surface/40 p-2">
              {mapCountry === "RDC" && selectedCities.includes("Kinshasa") ? (
                <KinshasaAddressForm
                  value={mapAddress}
                  onChange={(next) => {
                    setMapAddress(next);
                  }}
                  showPreview={false}
                  enableMap
                  compact={false}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy || locating}
                      onClick={() => void locateCurrentPosition()}
                    >
                      {locating ? "GPS..." : "Ma position GPS"}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">
                      Clique ou déplace le marqueur pour récupérer ville/commune/quartier/avenue.
                    </span>
                  </div>
                  <AddressMapPicker
                    latitude={mapPoint.lat}
                    longitude={mapPoint.lng}
                    zoom={mapCenter.zoom}
                    onChange={(lat, lng) => {
                      void applyReverseGeo(lat, lng);
                    }}
                  />
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <input
                      value={mapAddress.city}
                      onChange={(e) =>
                        setMapAddress((prev) => ({ ...prev, city: e.target.value }))
                      }
                      placeholder="Ville"
                      className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                    />
                    <input
                      value={mapAddress.commune}
                      onChange={(e) =>
                        setMapAddress((prev) => ({ ...prev, commune: e.target.value }))
                      }
                      placeholder="Commune"
                      className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                    />
                    <input
                      value={mapAddress.quartier}
                      onChange={(e) =>
                        setMapAddress((prev) => ({ ...prev, quartier: e.target.value }))
                      }
                      placeholder="Quartier"
                      className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                    />
                    <input
                      value={mapAddress.avenue}
                      onChange={(e) =>
                        setMapAddress((prev) => ({ ...prev, avenue: e.target.value }))
                      }
                      placeholder="Avenue"
                      className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={addZone}>
              Ajouter zone
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || zones.length === 0}
              onClick={() => setZones([])}
            >
              Vider zones
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {zones.length === 0 ? (
              <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                Aucune zone specifique (toutes zones)
              </span>
            ) : (
              zones.map((z, index) => (
                <button
                  key={`${zoneLabel(z)}:${index}`}
                  type="button"
                  onClick={() =>
                    setZones((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="rounded-full border border-border bg-surface-2 px-2 py-1 text-[10px] text-foreground hover:border-primary/50"
                  title="Retirer cette zone"
                >
                  {zoneLabel(z)} ×
                </button>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BOOST_PACKS.map((pack) => (
              <Button
                key={pack.days}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void boost(pack.days)}
              >
                {packLabel(pack.days)} · ${(pack.usdCents / 100).toFixed(0)}
              </Button>
            ))}
          </div>
          <p className="text-[11px] font-semibold">ShipCreator (bps, 1000 = 10 %)</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={5000}
              value={bps}
              onChange={(e) => setBps(Number(e.target.value) || 0)}
              className="h-8 w-24 rounded-lg border border-border bg-surface-2 px-2 text-xs"
            />
            <Button size="sm" disabled={busy} onClick={() => void saveCreatorBps()}>
              Ouvrir aux créateurs
            </Button>
          </div>
        </>
      ) : null}
      {canClaimCreator && creatorCommissionBps > 0 ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void claim()}>
          Recommander ce produit ({(creatorCommissionBps / 100).toFixed(1)} %)
        </Button>
      ) : null}
    </div>
  );
}
