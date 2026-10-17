"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { Phone } from "lucide-react";
import { formatMoney, cn } from "@/lib/utils";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { PhoneField } from "@/components/phone-field";
import { useI18n } from "@/components/i18n-provider";
import { usePageBack } from "@/components/back-nav-context";
import { PageLoader } from "@/components/page-loader";
import { MediaUploader } from "@/components/media-uploader";
import { MediaThumb } from "@/components/media-thumb";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import {
  KinshasaAddressForm,
  type AddressState,
} from "@/components/kinshasa-address-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Offer = {
  id: string;
  priceCents: number;
  message: string | null;
  images: string[];
  condition: string;
  status: string;
  overBudget: boolean;
  sellerCommune: string | null;
  sellerQuartier: string | null;
  sellerAddress: string | null;
  sellerPhone: string | null;
  mine: boolean;
  seller: { id: string; name: string };
  shop: {
    id: string;
    name: string;
    slug: string;
    isOccasionStall: boolean;
  };
};

type RequestDetail = {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  category: string;
  budgetCents: number;
  currency: string;
  condition: "NEW_SHOP" | "USED";
  commune: string | null;
  status: string;
  isOwner: boolean;
  buyer: { id: string; name: string };
  offers: Offer[];
};

type CatalogHit = {
  id: string;
  title: string;
  priceCents: number;
  images: string[];
  shop: { name: string };
};

export default function WantedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [catalog, setCatalog] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<
    { id: string; name: string; isOccasionStall?: boolean }[]
  >([]);
  const [shopId, setShopId] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [address, setAddress] = useState<AddressState>({
    city: "Kinshasa",
    commune: "",
    quartier: "",
    avenue: "",
    parcelle: "",
  });
  const [busy, setBusy] = useState(false);

  usePageBack({ fallbackHref: "/wanted" });

  async function load() {
    const { res, data } = await fetchJson<{
      request?: RequestDetail;
      catalog?: CatalogHit[];
      error?: string;
    }>(`/api/wanted/${id}`);
    if (!res.ok || !data?.request) {
      toast.error(data?.error ?? "Demande introuvable");
      setRequest(null);
      return;
    }
    setRequest(data.request);
    setCatalog(data.catalog ?? []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!session) return;
    fetchJson<{
      shops?: { id: string; name: string; isOccasionStall?: boolean }[];
    }>("/api/shops?mine=1").then(({ data }) => {
      const list = (data?.shops ?? []).filter((s) => !s.isOccasionStall);
      setShops(list);
      if (list[0]) setShopId(list[0].id);
    });
  }, [session]);

  async function submitOffer() {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    const priceCents = Math.round(parseFloat(price || "0") * 100);
    if (!priceCents || priceCents < 100) {
      toast.error("Prix minimum 1$");
      return;
    }
    const contactPhone = (() => {
      const parts = splitPhone(phone);
      return composePhone(parts.dial, parts.national);
    })();
    if (!isValidContactPhone(contactPhone)) {
      toast.error("Indiquez un téléphone de contact avec l’indicatif pays");
      return;
    }
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string; code?: string }>(
      `/api/wanted/${id}/offers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceCents,
          phone: contactPhone,
          message: message.trim() || null,
          images,
          shopId: request?.condition === "NEW_SHOP" ? shopId : null,
          commune: address.commune || null,
          quartier: address.quartier || null,
          avenue: address.avenue || null,
          parcelle: address.parcelle || null,
          lat: address.lat,
          lng: address.lng,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      if (data?.code === "KYC_REQUIRED") {
        toast.error(data.error ?? "KYC requis");
        router.push("/kyc");
        return;
      }
      toast.error(data?.error ?? "Offre impossible");
      return;
    }
    toast.success("Offre envoyée");
    setMessage("");
    await load();
  }

  async function contact(shopIdTo: string) {
    if (!session || !request) {
      router.push("/auth/login");
      return;
    }
    const { res, data } = await fetchJson<{
      conversation?: { id: string };
      error?: string;
    }>("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: shopIdTo,
        wantedRequestId: request.id,
        message: `À propos de « ${request.title} »`,
      }),
    });
    if (!res.ok || !data?.conversation) {
      toast.error(data?.error ?? t("feed.conversationFailed"));
      return;
    }
    router.push(`/messages/${data.conversation.id}`);
  }

  async function accept(offerId: string) {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/wanted/${id}/offers/${offerId}/accept`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Acceptation impossible");
      return;
    }
    toast.success(t("wanted.accepted"));
    router.push("/cart");
  }

  if (loading) return <PageLoader />;
  if (!request) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Demande introuvable
      </p>
    );
  }

  const isSeeker = session?.user.id === request.buyer.id;
  const canOffer = Boolean(session) && !isSeeker && request.status === "OPEN";

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-10 pt-2">
      {request.images.length > 0 && (
        <div className="overflow-hidden rounded-2xl">
          <ProductImageCarousel images={request.images} />
        </div>
      )}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {request.condition === "USED" ? t("wanted.used") : t("wanted.newShop")}
          {request.commune ? ` · ${request.commune}` : ""}
        </p>
        <h1 className="font-heading text-xl font-bold">{request.title}</h1>
        <p className="mt-1 text-sm text-trust">
          {t("wanted.budget")} {formatMoney(request.budgetCents, request.currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {request.buyer.name} · {request.status}
        </p>
        {request.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm">{request.description}</p>
        )}
      </div>

      {catalog.length > 0 && (
        <div>
          <h2 className="mb-2 font-heading text-sm font-bold">
            {t("wanted.alreadyInShop")}
          </h2>
          <div className="space-y-2">
            {catalog.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="flex gap-2 rounded-xl border border-border p-2"
              >
                <div className="size-12 overflow-hidden rounded-lg bg-muted">
                  <MediaThumb src={p.images[0]} className="size-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.shop.name} · {formatMoney(p.priceCents)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-heading text-sm font-bold">Offres</h2>
        {request.offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore d’offre.</p>
        ) : (
          <ul className="space-y-2">
            {request.offers.map((o) => (
              <li
                key={o.id}
                className="rounded-2xl border border-border bg-surface-2 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{o.seller.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.shop.name}
                      {o.shop.isOccasionStall ? " · occasion" : ""}
                      {o.sellerCommune ? ` · ${o.sellerCommune}` : ""}
                    </p>
                    {o.sellerPhone && (
                      <a
                        href={`tel:${o.sellerPhone}`}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary"
                      >
                        <Phone className="size-3.5" />
                        {o.sellerPhone}
                      </a>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-sm font-bold",
                      o.overBudget && "text-amber-400",
                    )}
                  >
                    {formatMoney(o.priceCents)}
                  </p>
                </div>
                {o.overBudget && (
                  <p className="mt-1 text-[10px] text-amber-400">
                    {t("wanted.overBudget")}
                  </p>
                )}
                {o.message && (
                  <p className="mt-2 text-xs text-muted-foreground">{o.message}</p>
                )}
                {o.sellerAddress && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {o.sellerAddress}
                  </p>
                )}
                <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                  {o.status}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => contact(o.shop.id)}
                  >
                    {t("wanted.contact")}
                  </Button>
                  {isSeeker && o.status === "PENDING" && request.status === "OPEN" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => accept(o.id)}
                    >
                      {t("wanted.accept")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canOffer && (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <h2 className="font-heading text-sm font-bold">{t("wanted.iHaveIt")}</h2>
          {request.condition === "NEW_SHOP" && (
            <div className="space-y-1">
              <Label>Boutique</Label>
              {shops.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Créez une boutique magasin pour proposer du neuf.{" "}
                  <Link href="/onboarding" className="text-primary">
                    Devenir vendeur
                  </Link>
                </p>
              ) : (
                <Select value={shopId} onValueChange={(v) => v && setShopId(v)}>
                  <SelectTrigger className="bg-surface-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>Votre prix (USD)</Label>
            <Input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-surface-2"
            />
          </div>
          <PhoneField
            id="wanted-offer-phone"
            label="Téléphone de contact"
            value={phone}
            onChange={setPhone}
          />
          <MediaUploader urls={images} onChange={setImages} max={6} />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="État, délai, précisions…"
            className="bg-surface-2"
            rows={3}
          />
          <KinshasaAddressForm value={address} onChange={setAddress} />
          <Button
            className="w-full"
            disabled={busy || (request.condition === "NEW_SHOP" && !shopId)}
            onClick={submitOffer}
          >
            {t("wanted.iHaveIt")}
          </Button>
        </div>
      )}
    </div>
  );
}
