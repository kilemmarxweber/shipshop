"use client";

import { useEffect, useState } from "react";
import { Bike, MapPin } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { composeAddress } from "@/lib/address";
import { formatMoney, cn } from "@/lib/utils";
import { PhoneField } from "@/components/phone-field";
import {
  KinshasaAddressForm,
  type AddressState,
} from "@/components/kinshasa-address-form";

export type FulfillmentState = {
  fulfillmentType: "DELIVERY" | "PICKUP";
  deliveryCity: string;
  deliveryCommune: string;
  deliveryQuartier: string;
  deliveryAvenue: string;
  deliveryParcelle: string;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  contactPhone: string;
  shippingCents: number;
  distanceKm: number | null;
};

type CourierPreview = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
  etaMinutes: number;
  etaText: string;
};

type Props = {
  shopId: string;
  productCents: number;
  currency?: string;
  defaultPhone?: string;
  value: FulfillmentState;
  onChange: (v: FulfillmentState) => void;
  compact?: boolean;
};

export function FulfillmentForm({
  shopId,
  productCents,
  currency,
  defaultPhone = "",
  value,
  onChange,
  compact = false,
}: Props) {
  const [quoting, setQuoting] = useState(false);
  const [courier, setCourier] = useState<CourierPreview | null>(null);

  useEffect(() => {
    if (!value.contactPhone && defaultPhone) {
      onChange({ ...value, contactPhone: defaultPhone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPhone]);

  useEffect(() => {
    if (value.fulfillmentType !== "DELIVERY" || !value.deliveryCity || !shopId) {
      if (value.shippingCents !== 0) {
        onChange({ ...value, shippingCents: 0, distanceKm: null });
      }
      setCourier(null);
      return;
    }
    const t = setTimeout(async () => {
      setQuoting(true);
      const { res, data } = await fetchJson<{
        quote?: { shippingCents: number; distanceKm: number };
        courier?: CourierPreview | null;
        error?: string;
      }>("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          city: value.deliveryCity,
          commune: value.deliveryCommune || null,
          lat: value.deliveryLat,
          lng: value.deliveryLng,
        }),
      });
      setQuoting(false);
      if (res.ok && data?.quote) {
        const address = composeAddress({
          city: value.deliveryCity,
          commune: value.deliveryCommune,
          quartier: value.deliveryQuartier,
          avenue: value.deliveryAvenue,
          parcelle: value.deliveryParcelle,
        });
        onChange({
          ...value,
          deliveryAddress: address,
          shippingCents: data.quote.shippingCents,
          distanceKm: data.quote.distanceKm,
        });
        setCourier(
          value.deliveryLat != null && value.deliveryLng != null
            ? (data.courier ?? null)
            : null,
        );
      } else {
        setCourier(null);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    value.fulfillmentType,
    value.deliveryCity,
    value.deliveryCommune,
    value.deliveryQuartier,
    value.deliveryAvenue,
    value.deliveryParcelle,
    value.deliveryLat,
    value.deliveryLng,
    shopId,
  ]);

  const total = productCents + value.shippingCents;
  const hasPosition = value.deliveryLat != null && value.deliveryLng != null;

  const addressValue: AddressState = {
    city: value.deliveryCity || "Kinshasa",
    commune: value.deliveryCommune,
    quartier: value.deliveryQuartier,
    avenue: value.deliveryAvenue,
    parcelle: value.deliveryParcelle,
    lat: value.deliveryLat,
    lng: value.deliveryLng,
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] leading-relaxed text-trust">
        Tu paies. On bloque. Le vendeur est payé quand tu reçois.
      </p>
      <p className="font-heading text-sm font-bold">Livraison ou retrait</p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["PICKUP", compact ? "Retirer" : "Retrait boutique"],
            ["DELIVERY", compact ? "Livrer ici" : "Livraison"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() =>
              onChange({
                ...value,
                fulfillmentType: key,
                shippingCents: key === "PICKUP" ? 0 : value.shippingCents,
                deliveryCity:
                  key === "DELIVERY"
                    ? value.deliveryCity || "Kinshasa"
                    : value.deliveryCity,
              })
            }
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-semibold",
              value.fulfillmentType === key
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <PhoneField
        value={value.contactPhone}
        onChange={(contactPhone) => onChange({ ...value, contactPhone })}
      />

      {value.fulfillmentType === "DELIVERY" && (
        <>
          <KinshasaAddressForm
            enableMap
            compact={compact}
            autoLocate
            value={addressValue}
            onChange={(addr) =>
              onChange({
                ...value,
                deliveryCity: addr.city || "Kinshasa",
                deliveryCommune: addr.commune,
                deliveryQuartier: addr.quartier,
                deliveryAvenue: addr.avenue,
                deliveryParcelle: addr.parcelle,
                deliveryAddress: composeAddress(addr),
                deliveryLat: addr.lat ?? null,
                deliveryLng: addr.lng ?? null,
              })
            }
          />
          {value.deliveryCity && (
            <p className="text-xs text-muted-foreground">
              {quoting
                ? "Calcul du transport…"
                : `Transport ≈ ${formatMoney(value.shippingCents, currency)}${
                    value.distanceKm != null
                      ? ` · ${value.distanceKm} km`
                      : ""
                  }`}
            </p>
          )}
        </>
      )}

      {value.fulfillmentType === "PICKUP" && (
        <p className="text-xs text-trust">
          Transport 0$ — un reçu virtuel sera généré pour retirer le colis en
          boutique.
        </p>
      )}

      <div className="rounded-xl border border-border bg-black/30 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Produit</span>
          <span>{formatMoney(productCents, currency)}</span>
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">Transport</span>
          <div className="min-w-0 text-right">
            <p className="font-medium">
              {formatMoney(value.shippingCents, currency)}
            </p>
            {value.fulfillmentType === "DELIVERY" && hasPosition && (
              <div className="mt-1.5 space-y-0.5 text-left sm:text-right">
                {quoting && !courier ? (
                  <p className="text-[11px] text-muted-foreground">
                    Recherche livreur…
                  </p>
                ) : courier ? (
                  <>
                    <p className="flex items-center justify-end gap-1 text-[11px] font-semibold text-trust">
                      <Bike className="size-3 shrink-0" />
                      <span className="truncate">{courier.name}</span>
                    </p>
                    <p className="flex items-start justify-end gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="mt-0.5 size-3 shrink-0" />
                      <span className="line-clamp-2">
                        {courier.address?.trim() ||
                          `${courier.lat.toFixed(4)}, ${courier.lng.toFixed(4)}`}
                        {` · ${courier.distanceKm} km · ETA ${courier.etaText}`}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-amber-500/90">
                    Aucun livreur dispo à proximité
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-between font-heading text-base font-bold text-trust">
          <span>{compact ? "À payer" : "Total à débiter"}</span>
          <span>{formatMoney(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
