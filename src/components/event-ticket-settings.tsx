"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { DEFAULT_FX, formatMoney } from "@/lib/money";
import { EVENT_POSTERS, eventPosterUrl } from "@/lib/tickets/posters";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type TicketType = {
  id?: string;
  name: string;
  description: string;
  priceCents: number;
  quota: number;
  remaining?: number;
  soldCount?: number;
};

type EventRow = {
  id: string;
  title: string;
  status: string;
  organizerKind: string;
  organizerName: string;
  organizerUserId: string;
  platformFeeMode: string;
  platformFeeBps: number;
  platformFeeCents: number;
  currency: string;
  fxCdfPerUsd?: number;
  fxKwPerUsd?: number;
  venue: string;
  city: string;
  description: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  ticketTypes: TicketType[];
};

type Sales = {
  gmv: number;
  platformRevenue: number;
  organizerDue: number;
  organizerPaid: number;
  sold: number;
  checkedIn: number;
  pendingRefunds: number;
};

type RefundRow = {
  id: string;
  status: string;
  reason: string;
  eventTitle: string;
  typeName: string;
  purchaseCents: number;
  currency: string;
  buyer: { name: string };
};

type UserHit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  kind?: "ARTIST" | "ORGANIZATION";
  orgName?: string;
  shopName?: string;
};

function hitLabel(hit: UserHit) {
  if (hit.orgName && hit.shopName && hit.orgName !== hit.shopName) {
    return `${hit.orgName} · ${hit.shopName}`;
  }
  return hit.orgName || hit.shopName || hit.name;
}

function matchHit(
  query: string,
  hits: UserHit[],
  loose = false,
): UserHit | null {
  const needle = query.trim().toLowerCase();
  if (!needle || hits.length === 0) return null;
  const exact = hits.filter((hit) => {
    const label = hitLabel(hit).toLowerCase();
    return (
      hit.name.toLowerCase() === needle ||
      label === needle ||
      (hit.email && hit.email.toLowerCase() === needle)
    );
  });
  if (exact.length === 1) return exact[0] ?? null;
  if (!loose) return null;
  if (hits.length === 1) return hits[0] ?? null;
  const starts = hits.filter(
    (hit) =>
      hit.name.toLowerCase().startsWith(needle) ||
      hitLabel(hit).toLowerCase().startsWith(needle),
  );
  if (starts.length === 1) return starts[0] ?? null;
  return null;
}

function toLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyType = (): TicketType => ({
  name: "Standard",
  description: "",
  priceCents: 1000,
  quota: 100,
});

export function EventTicketSettings() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [sales, setSales] = useState<Sales | null>(null);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [fxCdf, setFxCdf] = useState(String(DEFAULT_FX.cdfPerUsd));
  const [fxConfirmed, setFxConfirmed] = useState(false);
  const [organizerKind, setOrganizerKind] = useState<"ARTIST" | "ORGANIZATION">(
    "ARTIST",
  );
  const [organizerName, setOrganizerName] = useState("");
  const [organizerUserId, setOrganizerUserId] = useState("");
  const [pickedLabel, setPickedLabel] = useState("");
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const pickedIdRef = useRef("");
  const [feeMode, setFeeMode] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [feePct, setFeePct] = useState("10");
  const [feeFlat, setFeeFlat] = useState("2");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [types, setTypes] = useState<TicketType[]>([emptyType()]);

  const load = useCallback(async () => {
    const [{ data: ev }, { data: rf }] = await Promise.all([
      fetchJson<{ events?: EventRow[] }>("/api/admin/events"),
      fetchJson<{ refunds?: RefundRow[] }>("/api/admin/ticket-refunds"),
    ]);
    setEvents(ev?.events ?? []);
    setRefunds(rf?.refunds ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId || selectedId === "new") {
      setSales(null);
      return;
    }
    void fetchJson<{ sales?: Sales }>(
      `/api/admin/events/${selectedId}/sales`,
    ).then(({ data }) => setSales(data?.sales ?? null));
  }, [selectedId]);

  async function searchHits(query: string) {
    const q = query.trim();
    if (q.length < 2) return [] as UserHit[];
    const { data } = await fetchJson<{ users?: UserHit[] }>(
      `/api/admin/events/users?kind=${organizerKind}&q=${encodeURIComponent(q)}`,
    );
    return data?.users ?? [];
  }

  function pickHit(hit: UserHit, closeList = true) {
    const label = hitLabel(hit);
    pickedIdRef.current = hit.id;
    setOrganizerUserId(hit.id);
    setPickedLabel(label);
    setOrganizerName((current) => current.trim() || label);
    if (closeList) setUserHits([]);
  }

  useEffect(() => {
    const q = organizerName.trim();
    if (q.length < 2) {
      setUserHits([]);
      return;
    }
    if (pickedIdRef.current && q === pickedLabel.trim()) {
      setUserHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchHits(q).then((hits) => {
        setUserHits(hits);
        const auto = matchHit(q, hits);
        if (auto && !pickedIdRef.current) pickHit(auto, true);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [organizerName, organizerKind, pickedLabel]);

  function fill(event: EventRow) {
    setSelectedId(event.id);
    setTitle(event.title);
    setDescription(event.description);
    setImageUrl(event.imageUrl ?? "");
    setVenue(event.venue);
    setCity(event.city);
    setCurrency(event.currency);
    setFxCdf(String(event.fxCdfPerUsd ?? DEFAULT_FX.cdfPerUsd));
    setFxConfirmed(true);
    setOrganizerKind(event.organizerKind as "ARTIST" | "ORGANIZATION");
    setOrganizerName(event.organizerName);
    setOrganizerUserId(event.organizerUserId);
    pickedIdRef.current = event.organizerUserId;
    setPickedLabel(event.organizerName);
    setUserHits([]);
    setFeeMode(event.platformFeeMode as "PERCENT" | "FLAT");
    setFeePct(String((event.platformFeeBps ?? 0) / 100));
    setFeeFlat(String((event.platformFeeCents ?? 0) / 100));
    setStartsAt(toLocal(event.startsAt));
    setEndsAt(toLocal(event.endsAt));
    setTypes(event.ticketTypes.length ? event.ticketTypes : [emptyType()]);
  }

  function resetNew() {
    setSelectedId("new");
    setTitle("");
    setDescription("");
    setImageUrl("");
    setVenue("");
    setCity("");
    setCurrency("USD");
    setFxCdf(String(DEFAULT_FX.cdfPerUsd));
    setFxConfirmed(false);
    setOrganizerKind("ARTIST");
    setOrganizerName("");
    setOrganizerUserId("");
    pickedIdRef.current = "";
    setPickedLabel("");
    setUserHits([]);
    setFeeMode("PERCENT");
    setFeePct("10");
    setFeeFlat("2");
    setStartsAt("");
    setEndsAt("");
    setTypes([emptyType()]);
    setSales(null);
  }

  async function save() {
    const typed = organizerName.trim() || pickedLabel.trim();
    if (typed.length < 2) {
      toast.error(
        organizerKind === "ORGANIZATION"
          ? "Indique le nom de l’organisation"
          : "Indique le nom de l’artiste",
      );
      return;
    }
    if (selectedId === "new" && !fxConfirmed) {
      toast.error("Valide le taux de change du jour");
      return;
    }
    setBusy(true);
    const userId = pickedIdRef.current || organizerUserId || undefined;
    const payload = {
      title,
      description,
      imageUrl:
        imageUrl.trim() ||
        eventPosterUrl(null, `${title}|${organizerName}|${Date.now()}`),
      venue,
      city,
      currency,
      fxCdfPerUsd: Number.parseInt(fxCdf, 10) || DEFAULT_FX.cdfPerUsd,
      organizerKind,
      organizerName: typed,
      ...(userId ? { organizerUserId: userId } : {}),
      platformFeeMode: feeMode,
      platformFeeBps: Math.round(Number(feePct) * 100),
      platformFeeCents: Math.round(Number(feeFlat) * 100),
      startsAt: startsAt ? new Date(startsAt).toISOString() : "",
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      ticketTypes: types.map((type) => ({
        name: type.name,
        description: type.description,
        priceCents: type.priceCents,
        quota: type.quota,
      })),
    };
    const { res, data } = await fetchJson<{ event?: EventRow; error?: string }>(
      "/api/admin/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok || !data?.event) {
      toast.error(data?.error ?? "Création impossible");
      return;
    }
    toast.success("Événement enregistré");
    fill(data.event);
    await load();
  }

  async function act(action: string) {
    if (!selectedId || selectedId === "new") return;
    setBusy(true);
    const path =
      action === "promote"
        ? `/api/admin/events/${selectedId}/promote`
        : `/api/admin/events/${selectedId}`;
    const { res, data } = await fetchJson<{ error?: string }>(path, {
      method: action === "promote" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "promote" ? {} : { action }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    toast.success("OK");
    await load();
  }

  async function reviewRefund(id: string, action: "APPROVE" | "REJECT") {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/admin/ticket-refunds",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible");
      return;
    }
    toast.success(action === "APPROVE" ? "Remboursé" : "Refusé");
    await load();
  }

  async function scanPayload(payload: string) {
    const { res, data } = await fetchJson<{
      error?: string;
      ticket?: { buyerName: string; type: string; eventTitle: string };
    }>("/api/admin/tickets/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) {
      setScanMsg(data?.error ?? "Scan refusé");
      toast.error(data?.error ?? "Scan refusé");
      return;
    }
    const ok = `${data?.ticket?.buyerName} · ${data?.ticket?.type}`;
    setScanMsg(ok);
    toast.success(ok);
  }

  useEffect(() => {
    if (!scanOpen) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    let stop = false;
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stop) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!Detector) {
          setScanMsg(
            "Caméra OK — colle le payload si le scan auto n’est pas dispo",
          );
          return;
        }
        const detector = new Detector({ formats: ["qr_code"] });
        const loop = async () => {
          if (stop || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) await scanPayload(raw);
          } catch {
            /* ignore */
          }
          window.setTimeout(() => void loop(), 700);
        };
        void loop();
      } catch {
        setScanMsg("Caméra refusée");
      }
    })();
    return () => {
      stop = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [scanOpen]);

  const selected = events.find((row) => row.id === selectedId);

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          Vente de billets
        </h2>
        <p className="text-sm text-muted-foreground">
          Sur demande d’un artiste ou d’une organisation. Commission ShipShop (%
          ou montant) → compte de revenu plateforme.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={resetNew}>
          Nouvel event
        </Button>
        {events.map((event) => (
          <Button
            key={event.id}
            type="button"
            variant={selectedId === event.id ? "default" : "outline"}
            onClick={() => fill(event)}
          >
            {event.title} · {event.status}
          </Button>
        ))}
      </div>

      {selectedId ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Bénéficiaire</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["ARTIST", "Artiste", "Compte perso"],
                ["ORGANIZATION", "Organisation", "Boutique ou org"],
              ] as const
            ).map(([key, label, hint]) => {
              const on = organizerKind === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === organizerKind) return;
                    setOrganizerKind(key);
                    setOrganizerUserId("");
                    pickedIdRef.current = "";
                    setPickedLabel("");
                    setUserHits([]);
                  }}
                  className={
                    on
                      ? "rounded-2xl border-2 border-primary bg-primary/10 px-3 py-3 text-left"
                      : "rounded-2xl border-2 border-border bg-background px-3 py-3 text-left"
                  }
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {hint}
                  </span>
                </button>
              );
            })}
          </div>
          {organizerName.trim().length >= 2 ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 font-semibold">
                {organizerName.trim()}
              </span>
              <span className="text-[11px] font-bold text-trust">
                {organizerKind === "ORGANIZATION" ? "Organisation" : "Artiste"}
              </span>
            </div>
          ) : null}
          <Input
            placeholder={
              organizerKind === "ORGANIZATION"
                ? "Nom de l’organisation"
                : "Nom de l’artiste"
            }
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
          />
          {userHits.map((user) => (
            <button
              key={user.id}
              type="button"
              className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm"
              onClick={() => pickHit(user)}
            >
              <span className="block font-semibold">{hitLabel(user)}</span>
              <span className="text-xs text-muted-foreground">
                {user.name}
                {user.email ? ` · ${user.email}` : ""}
              </span>
            </button>
          ))}
          <Input
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Affiche</p>
            <div
              className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-cover bg-center"
              style={{
                backgroundImage: `url(${eventPosterUrl(imageUrl || null, selectedId === "new" ? title || "new" : (selectedId ?? "new"))})`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-sm font-extrabold text-white">
                  {title || "Aperçu"}
                </p>
                <p className="text-[11px] text-white/70">
                  {organizerName || "—"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {EVENT_POSTERS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setImageUrl(url)}
                  className={`h-20 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                    imageUrl === url ? "border-primary" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
            <Input
              placeholder="Ou colle une URL d’affiche"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              placeholder="Lieu"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
            <Input
              placeholder="Ville"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">USD</option>
              <option value="CDF">CDF</option>
              <option value="KW">KW</option>
            </select>
            <Input
              className="w-36"
              type="number"
              min={1}
              value={fxCdf}
              disabled={selectedId !== "new"}
              onChange={(e) => {
                setFxCdf(e.target.value);
                setFxConfirmed(false);
              }}
              placeholder="Taux CDF / $US"
            />
            {selectedId === "new" ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={fxConfirmed}
                  onChange={(e) => setFxConfirmed(e.target.checked)}
                />
                Je valide le taux du jour
              </label>
            ) : (
              <span className="text-xs text-muted-foreground">
                Taux figé · 1 $US = {fxCdf} CDF
              </span>
            )}
            <Button
              type="button"
              variant={feeMode === "PERCENT" ? "default" : "outline"}
              onClick={() => setFeeMode("PERCENT")}
            >
              %
            </Button>
            <Button
              type="button"
              variant={feeMode === "FLAT" ? "default" : "outline"}
              onClick={() => setFeeMode("FLAT")}
            >
              Chiffre
            </Button>
            {feeMode === "PERCENT" ? (
              <Input
                className="w-24"
                value={feePct}
                onChange={(e) => setFeePct(e.target.value)}
              />
            ) : (
              <Input
                className="w-24"
                value={feeFlat}
                onChange={(e) => setFeeFlat(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-2">
            {types.map((type, index) => (
              <div
                key={index}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                <Input
                  placeholder="Type"
                  value={type.name}
                  onChange={(e) =>
                    setTypes((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, name: e.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="Prix"
                  type="number"
                  value={type.priceCents / 100}
                  onChange={(e) =>
                    setTypes((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              priceCents: Math.round(
                                Number(e.target.value) * 100,
                              ),
                            }
                          : row,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="Quota"
                  type="number"
                  value={type.quota}
                  onChange={(e) =>
                    setTypes((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? { ...row, quota: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
                <p className="self-center text-xs text-muted-foreground">
                  {type.soldCount ?? 0} vendus
                </p>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setTypes((prev) => [...prev, emptyType()])}
            >
              Ajouter un type
            </Button>
          </div>
          {selectedId === "new" ? (
            <Button type="button" disabled={busy} onClick={() => void save()}>
              Enregistrer le brouillon
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void act("publish")}
              >
                Publier
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void act("promote")}
              >
                Lancer les pubs
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void act("close")}
              >
                Clôturer
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void act("settle")}
              >
                Verser organisateur
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void act("cancel")}
              >
                Annuler + rembourser
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScanOpen((v) => !v)}
              >
                Scanner
              </Button>
            </div>
          )}
          {sales ? (
            <p className="text-sm text-muted-foreground">
              GMV {formatMoney(sales.gmv, selected?.currency)} · ShipShop{" "}
              {formatMoney(sales.platformRevenue, selected?.currency)} · dû org{" "}
              {formatMoney(sales.organizerDue, selected?.currency)} · versé{" "}
              {formatMoney(sales.organizerPaid, selected?.currency)} ·{" "}
              {sales.sold} billets · {sales.checkedIn} scannés
            </p>
          ) : null}
        </div>
      ) : null}

      {scanOpen ? (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <video
            ref={videoRef}
            className="max-h-64 w-full rounded-lg bg-black"
            muted
            playsInline
          />
          <Input
            placeholder="Ou colle le payload SHIPSHOP-TIX|…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void scanPayload((e.target as HTMLInputElement).value);
              }
            }}
          />
          {scanMsg ? <p className="text-sm">{scanMsg}</p> : null}
        </div>
      ) : null}

      {refunds.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Demandes de remboursement</h3>
          {refunds.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <p>
                {row.eventTitle} · {row.buyer.name} · {row.status}
                <span className="block text-xs text-muted-foreground">
                  {row.reason}
                </span>
              </p>
              {row.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => void reviewRefund(row.id, "APPROVE")}
                  >
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => void reviewRefund(row.id, "REJECT")}
                  >
                    Refuser
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
