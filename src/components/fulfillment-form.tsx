"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { composeAddress } from "@/lib/address";
import { formatMoney, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Props = {
  shopId: string;
  productCents: number;
  defaultPhone?: string;
  value: FulfillmentState;
  onChange: (v: FulfillmentState) => void;
};

export function FulfillmentForm({
  shopId,
  productCents,
  defaultPhone = "",
  value,
  onChange,
}: Props) {
  const [quoting, setQuoting] = useState(false);

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
      return;
    }
    const t = setTimeout(async () => {
      setQuoting(true);
      const { res, data } = await fetchJson<{
        quote?: { shippingCents: number; distanceKm: number };
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
      <p className="font-heading text-sm font-bold">Livraison ou retrait</p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["PICKUP", "Retrait boutique"],
            ["DELIVERY", "Livraison"],
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

      <div className="space-y-2">
        <Label>Téléphone de contact</Label>
        <Input
          value={value.contactPhone}
          onChange={(e) => onChange({ ...value, contactPhone: e.target.value })}
          placeholder="+243 8XX XXX XXX"
          className="bg-surface-2"
        />
      </div>

      {value.fulfillmentType === "DELIVERY" && (
        <>
          <KinshasaAddressForm
            enableMap
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
                : `Transport ≈ ${formatMoney(value.shippingCents)}${
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
          <span>{formatMoney(productCents)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Transport</span>
          <span>{formatMoney(value.shippingCents)}</span>
        </div>
        <div className="mt-2 flex justify-between font-heading text-base font-bold text-trust">
          <span>Total à débiter</span>
          <span>{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}
