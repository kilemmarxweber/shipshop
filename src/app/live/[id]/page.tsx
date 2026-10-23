"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Camera,
  CameraOff,
  Clock,
  Gift,
  LogOut,
  Pause,
  Play,
  Plus,
  Radio,
  Send,
  Share2,
  ShoppingBag,
  Type,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import { cn, formatMoney } from "@/lib/utils";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";
import { ShareMenu } from "@/components/share-menu";
import { GIFT_CATALOG } from "@/lib/growth/constants";
import {
  LIVE_END_ALERT_BEFORE_MS,
  LIVE_HEARTBEAT_HIDDEN_MS,
  LIVE_HEARTBEAT_MS,
  LIVE_PAUSE_TIMEOUT_MS,
  LIVE_POLL_HIDDEN_MS,
  LIVE_POLL_MS,
  formatLiveClock,
  liveEndMessage,
  livePauseMessage,
} from "@/lib/growth/live-session";
import {
  newOverlayId,
  type LiveOverlay,
} from "@/lib/growth/live-overlays";
import { LiveStageOverlays } from "@/components/live/live-stage-overlays";
import {
  LiveProductPicker,
  type LiveCatalogProduct,
} from "@/components/live/live-product-picker";
import {
  LiveGuestRequestQueue,
  LiveGuestStageGrid,
  type LiveGuestCard,
} from "@/components/live/live-guest-stage";

type LiveDetail = {
  id: string;
  title: string;
  status: "LIVE" | "PAUSED" | "ENDED" | string;
  giftCents: number;
  startedAt: string;
  pausedAt?: string | null;
  pauseReason?: string | null;
  endReason?: string | null;
  statusMessage?: string | null;
  plannedMinutes?: number;
  cameraOn?: boolean;
  viewerPeak?: number;
  pauseTimeoutMs?: number;
  overlays?: LiveOverlay[];
  guests?: LiveGuestCard[];
  myGuest?: LiveGuestCard | null;
  user?: { id: string; name: string; image?: string | null };
  product?: {
    id: string;
    title: string;
    images: string[];
    priceCents: number;
    shop: { name: string };
  } | null;
  chats?: { id: string; body: string; user: { name: string } }[];
};

export default function LiveRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = authClient.useSession();
  usePageBack({ fallbackHref: "/live" });
  const [live, setLive] = useState<LiveDetail | null>(null);
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [localCameraOn, setLocalCameraOn] = useState(true);
  const [guestCameraOn, setGuestCameraOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [durationAlerted, setDurationAlerted] = useState(false);
  const [overlays, setOverlays] = useState<LiveOverlay[]>([]);
  const [guests, setGuests] = useState<LiveGuestCard[]>([]);
  const [myGuest, setMyGuest] = useState<LiveGuestCard | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [textComposer, setTextComposer] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const [guestStream, setGuestStream] = useState<MediaStream | null>(null);
  const prevStatus = useRef<string | null>(null);
  const prevGuestStatus = useRef<string | null>(null);
  const overlaySyncTimer = useRef<number | null>(null);
  const skipRemoteOverlays = useRef(false);
  const overlaysSeeded = useRef(false);
  const isHostRef = useRef(false);
  const liveIdRef = useRef(id);
  const countedViewRef = useRef(false);
  const endedRef = useRef(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const pageVisibleRef = useRef(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const localCameraOnRef = useRef(true);
  const guestCameraOnRef = useRef(false);
  liveIdRef.current = id;
  endedRef.current = live?.status === "ENDED";

  const isHost = Boolean(
    session?.user?.id && live?.user?.id === session.user.id,
  );
  isHostRef.current = isHost;

  function stopStream(stream: MediaStream | null | undefined) {
    stream?.getTracks().forEach((t) => t.stop());
  }

  function setTracksEnabled(stream: MediaStream | null | undefined, on: boolean) {
    stream?.getTracks().forEach((t) => {
      t.enabled = on;
    });
  }

  const applyLive = useCallback((next: LiveDetail) => {
    endedRef.current = next.status === "ENDED";
    setLive((prev) => {
      if (!prev) return next;
      const chats = Array.isArray(next.chats) ? next.chats : prev.chats;
      const guests = Array.isArray(next.guests) ? next.guests : prev.guests;
      const overlays = Array.isArray(next.overlays)
        ? next.overlays
        : prev.overlays;
      const user = next.user ?? prev.user;
      const product =
        next.product !== undefined ? next.product : prev.product;
      // Évite re-render / effets caméra si le poll n’a rien changé d’utile
      if (
        prev.status === next.status &&
        prev.giftCents === next.giftCents &&
        prev.cameraOn === next.cameraOn &&
        prev.plannedMinutes === next.plannedMinutes &&
        prev.pausedAt === next.pausedAt &&
        prev.viewerPeak === next.viewerPeak &&
        prev.statusMessage === next.statusMessage &&
        prev.user?.id === user?.id &&
        prev.product?.id === product?.id &&
        (prev.chats?.length ?? 0) === (chats?.length ?? 0) &&
        prev.chats?.[(prev.chats?.length ?? 1) - 1]?.id ===
          chats?.[(chats?.length ?? 1) - 1]?.id &&
        (prev.guests?.length ?? 0) === (guests?.length ?? 0) &&
        JSON.stringify(prev.guests) === JSON.stringify(guests) &&
        (prev.myGuest?.id ?? null) === (next.myGuest?.id ?? null) &&
        (prev.myGuest?.status ?? null) === (next.myGuest?.status ?? null) &&
        (prev.myGuest?.cameraOn ?? null) ===
          (next.myGuest?.cameraOn ?? null) &&
        (isHostRef.current ||
          JSON.stringify(prev.overlays) === JSON.stringify(overlays))
      ) {
        return prev;
      }
      return {
        ...prev,
        ...next,
        user,
        product,
        chats,
        overlays,
        guests,
      };
    });
    if (Array.isArray(next.guests)) {
      setGuests((prev) =>
        JSON.stringify(prev) === JSON.stringify(next.guests)
          ? prev
          : next.guests!,
      );
    }
    if (next.myGuest !== undefined) {
      const g = next.myGuest ?? null;
      setMyGuest((prev) =>
        prev?.id === g?.id &&
        prev?.status === g?.status &&
        prev?.cameraOn === g?.cameraOn
          ? prev
          : g,
      );
    }
    if (typeof next.cameraOn === "boolean") {
      setLocalCameraOn((prev) =>
        prev === next.cameraOn ? prev : next.cameraOn!,
      );
    }
    if (!Array.isArray(next.overlays) || skipRemoteOverlays.current) return;
    // Host : seed une fois puis garde le local (drag). Viewers : suivent le poll.
    if (isHostRef.current) {
      if (!overlaysSeeded.current) {
        setOverlays(next.overlays);
        overlaysSeeded.current = true;
      }
      return;
    }
    setOverlays((prev) =>
      JSON.stringify(prev) === JSON.stringify(next.overlays)
        ? prev
        : next.overlays!,
    );
  }, []);

  async function load(opts?: { countView?: boolean }) {
    const roomId = liveIdRef.current;
    const wantCount = Boolean(opts?.countView && !countedViewRef.current);
    // Une seule requête à la fois (poll + visibilité ne s’empilent pas)
    if (loadInFlightRef.current) {
      await loadInFlightRef.current;
      if (roomId !== liveIdRef.current) return;
      if (!wantCount || countedViewRef.current) return;
    }
    const p = (async () => {
      const q = wantCount ? "?countView=1" : "";
      const { data } = await fetchJson<{ live?: LiveDetail }>(
        `/api/growth/lives/${roomId}${q}`,
      );
      if (roomId !== liveIdRef.current) return;
      if (wantCount) countedViewRef.current = true;
      if (data?.live) applyLive(data.live);
    })().finally(() => {
      if (loadInFlightRef.current === p) loadInFlightRef.current = null;
    });
    loadInFlightRef.current = p;
    await p;
  }

  // Poll room : uniquement quand l’id change — pas à chaque status (sinon boucle)
  useEffect(() => {
    countedViewRef.current = false;
    overlaysSeeded.current = false;
    endedRef.current = false;
    let pollTimer: number | null = null;
    let tickTimer: number | null = null;

    const clearTimers = () => {
      if (pollTimer != null) window.clearInterval(pollTimer);
      if (tickTimer != null) window.clearInterval(tickTimer);
      pollTimer = null;
      tickTimer = null;
    };

    const schedule = () => {
      clearTimers();
      if (endedRef.current) return;
      const hidden = document.visibilityState === "hidden";
      pageVisibleRef.current = !hidden;
      const pollMs = hidden ? LIVE_POLL_HIDDEN_MS : LIVE_POLL_MS;
      pollTimer = window.setInterval(() => {
        if (endedRef.current) {
          clearTimers();
          return;
        }
        void load();
      }, pollMs);
      if (!hidden) {
        tickTimer = window.setInterval(() => setNow(Date.now()), 1000);
      }
    };

    void load({ countView: true });
    schedule();

    const onVis = () => {
      const hidden = document.visibilityState === "hidden";
      pageVisibleRef.current = !hidden;
      setTracksEnabled(
        streamRef.current,
        !hidden && localCameraOnRef.current,
      );
      setTracksEnabled(
        guestStreamRef.current,
        !hidden && guestCameraOnRef.current,
      );
      schedule();
      if (!hidden && !endedRef.current) {
        setNow(Date.now());
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimers();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- room id only
  }, [id]);

  useEffect(() => {
    if (!live) return;
    const prev = prevStatus.current;
    prevStatus.current = live.status;
    if (prev && prev !== live.status) {
      if (live.status === "PAUSED") {
        toast.message(live.statusMessage ?? livePauseMessage(live.pauseReason));
      }
      if (live.status === "ENDED") {
        toast.error(live.statusMessage ?? liveEndMessage(live.endReason));
      }
    }
  }, [live?.status, live?.statusMessage, live?.pauseReason, live?.endReason]);

  async function hostAction(
    action: string,
    extra?: Record<string, unknown>,
  ) {
    const { res, data } = await fetchJson<{
      live?: LiveDetail;
      guests?: LiveGuestCard[];
      error?: string;
    }>(`/api/growth/lives/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return false;
    }
    if (Array.isArray(data?.guests)) setGuests(data.guests);
    if (data?.live) applyLive(data.live);
    else if (!Array.isArray(data?.guests)) await load();
    return true;
  }

  async function guestAction(
    action: string,
    extra?: Record<string, unknown>,
  ) {
    const { res, data } = await fetchJson<{
      guests?: LiveGuestCard[];
      guest?: LiveGuestCard;
      live?: LiveDetail;
      error?: string;
    }>(`/api/growth/lives/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return false;
    }
    if (Array.isArray(data?.guests)) setGuests(data.guests);
    if (data?.guest) setMyGuest(data.guest);
    if (data?.live) applyLive(data.live);
    return true;
  }

  /** Drag local : pas de réseau. */
  const patchOverlaysLocal = useCallback((next: LiveOverlay[]) => {
    setOverlays(next);
    skipRemoteOverlays.current = true;
  }, []);

  /** Ajout / edit / fin de drag → 1 POST (debounce léger). */
  const commitOverlays = useCallback(
    (next: LiveOverlay[]) => {
      setOverlays(next);
      skipRemoteOverlays.current = true;
      if (overlaySyncTimer.current) {
        window.clearTimeout(overlaySyncTimer.current);
      }
      overlaySyncTimer.current = window.setTimeout(() => {
        void (async () => {
          const roomId = liveIdRef.current;
          const { res, data } = await fetchJson<{
            live?: LiveDetail;
            error?: string;
          }>(`/api/growth/lives/${roomId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "overlays", overlays: next }),
          });
          if (roomId !== liveIdRef.current) return;
          skipRemoteOverlays.current = false;
          if (!res.ok) {
            toast.error(data?.error ?? "Sync overlays impossible");
            return;
          }
          if (data?.live) applyLive(data.live);
        })();
      }, 120);
    },
    [applyLive],
  );
  const pushOverlays = commitOverlays;

  useEffect(() => {
    if (!isHost || !live || live.status === "ENDED") return;

    let timer: number | null = null;
    const beat = () => {
      void hostAction("heartbeat");
    };

    const scheduleBeat = () => {
      if (timer != null) window.clearInterval(timer);
      const hidden = document.visibilityState === "hidden";
      // Hors écran : heartbeat moins fréquent mais sous LIVE_HEARTBEAT_STALE_MS
      const ms = hidden ? LIVE_HEARTBEAT_HIDDEN_MS : LIVE_HEARTBEAT_MS;
      beat();
      timer = window.setInterval(beat, ms);
    };

    scheduleBeat();
    const onVis = () => scheduleBeat();

    const onOffline = () => {
      void hostAction("pause", { reason: "connection" });
      toast.error("Connexion perdue — live en pause");
    };
    const onOnline = () => {
      toast.message("Connexion rétablie — reprenez le live");
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [isHost, live?.id, live?.status]);

  useEffect(() => {
    localCameraOnRef.current = localCameraOn;
  }, [localCameraOn]);

  useEffect(() => {
    guestCameraOnRef.current = guestCameraOn;
  }, [guestCameraOn]);

  useEffect(() => {
    // Caméra host : stop si fin / pause (pas d’encode inutile)
    if (!isHost || live?.status === "ENDED" || live?.status === "PAUSED") {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    if (!localCameraOn) {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamError(null);
      return;
    }
    // Déjà un flux actif → ne pas relancer getUserMedia (évite boucle LED/CPU)
    if (streamRef.current?.active) {
      setTracksEnabled(streamRef.current, pageVisibleRef.current);
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        void videoRef.current.play().catch(() => undefined);
      }
      return;
    }
    let cancelled = false;
    async function syncCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            // Preview mobile : 480p suffit (moins CPU / batterie)
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: false,
        });
        if (cancelled || liveIdRef.current !== id) {
          stopStream(stream);
          return;
        }
        stopStream(streamRef.current);
        streamRef.current = stream;
        setTracksEnabled(stream, pageVisibleRef.current);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setCamError(null);
      } catch {
        setCamError("Caméra indisponible");
        setLocalCameraOn(false);
        void hostAction("camera", { cameraOn: false });
      }
    }
    void syncCam();
    return () => {
      cancelled = true;
      // Ne stoppe pas ici : l’effet suivant réutilise le stream si toujours host+cam
    };
  }, [isHost, localCameraOn, live?.status, id]);

  const myGuestRow =
    myGuest ??
    guests.find((g) => g.user.id === session?.user?.id) ??
    null;
  const myGuestStatus = myGuestRow?.status ?? null;
  const onStageAsGuest = !isHost && myGuestStatus === "ON_STAGE";
  const pendingAsGuest = !isHost && myGuestStatus === "PENDING";
  const pendingGuests = guests.filter((g) => g.status === "PENDING");
  const stageGuests = guests.filter((g) => g.status === "ON_STAGE");

  useEffect(() => {
    const prev = prevGuestStatus.current;
    prevGuestStatus.current = myGuestStatus;
    if (!session?.user?.id || isHost) return;
    if (prev === "PENDING" && myGuestStatus === "ON_STAGE") {
      toast.success("Vous êtes sur scène");
      setGuestCameraOn(true);
    }
    if (prev === "PENDING" && myGuestStatus === "REFUSED") {
      toast.message("Demande refusée par le diffuseur");
    }
    if (
      (prev === "ON_STAGE" || prev === "PENDING") &&
      (myGuestStatus === "LEFT" || myGuestStatus == null)
    ) {
      if (prev === "ON_STAGE") toast.message("Hors scène");
      setGuestCameraOn(false);
    }
  }, [myGuestStatus, isHost, session?.user?.id]);

  // Caméra locale invité (preview dans la carte)
  useEffect(() => {
    if (
      !onStageAsGuest ||
      live?.status === "ENDED" ||
      live?.status === "PAUSED"
    ) {
      stopStream(guestStreamRef.current);
      guestStreamRef.current = null;
      setGuestStream(null);
      return;
    }
    if (!guestCameraOn) {
      stopStream(guestStreamRef.current);
      guestStreamRef.current = null;
      setGuestStream(null);
      return;
    }
    if (guestStreamRef.current?.active) {
      setTracksEnabled(guestStreamRef.current, pageVisibleRef.current);
      setGuestStream((prev) =>
        prev === guestStreamRef.current ? prev : guestStreamRef.current,
      );
      return;
    }
    let cancelled = false;
    async function syncGuestCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 480 },
            height: { ideal: 360 },
            frameRate: { ideal: 20, max: 24 },
          },
          audio: false,
        });
        if (cancelled || liveIdRef.current !== id) {
          stopStream(stream);
          return;
        }
        stopStream(guestStreamRef.current);
        guestStreamRef.current = stream;
        setTracksEnabled(stream, pageVisibleRef.current);
        setGuestStream(stream);
      } catch {
        setGuestCameraOn(false);
        toast.error("Caméra indisponible");
        void guestAction("guest_camera", { cameraOn: false });
      }
    }
    void syncGuestCam();
    return () => {
      cancelled = true;
    };
  }, [onStageAsGuest, guestCameraOn, live?.status, id]);

  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      stopStream(guestStreamRef.current);
      streamRef.current = null;
      guestStreamRef.current = null;
      if (overlaySyncTimer.current) {
        window.clearTimeout(overlaySyncTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHost || !live || live.status === "ENDED" || durationAlerted) return;
    const started = new Date(live.startedAt).getTime();
    const plannedMs = (live.plannedMinutes ?? 60) * 60_000;
    const remaining = started + plannedMs - now;
    if (remaining > 0 && remaining <= LIVE_END_ALERT_BEFORE_MS) {
      setDurationAlerted(true);
      toast.message("Durée prévue bientôt atteinte — terminez ou prolongez.", {
        duration: 8000,
      });
    }
  }, [isHost, live, now, durationAlerted]);

  useEffect(() => {
    const sel = overlays.find((o) => o.id === selectedOverlayId);
    if (sel?.kind === "product") setNoteDraft(sel.note);
    else if (sel?.kind === "text") setTextDraft(sel.text);
  }, [selectedOverlayId, overlays]);

  async function send(action: "chat" | "gift" | "end", extra?: object) {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/growth/lives/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    if (action === "gift") {
      notifyWalletUpdated();
      toast.success("Cadeau envoyé");
      setGiftOpen(false);
    }
    if (action === "chat") setChat("");
    if (action === "end") toast.success("Live terminé");
    await load();
  }

  async function toggleCamera() {
    if (!isHost || busy) return;
    const next = !localCameraOn;
    setLocalCameraOn(next);
    setBusy(true);
    await hostAction("camera", { cameraOn: next });
    setBusy(false);
  }

  async function toggleGuestCamera() {
    if (!onStageAsGuest || busy) return;
    const next = !guestCameraOn;
    setGuestCameraOn(next);
    setBusy(true);
    await guestAction("guest_camera", { cameraOn: next });
    setBusy(false);
  }

  function addTextOverlay() {
    const text = textDraft.trim();
    if (!text) return;
    const existing = overlays.find((o) => o.id === selectedOverlayId);
    if (existing?.kind === "text") {
      pushOverlays(
        overlays.map((o) =>
          o.id === existing.id ? { ...o, text } : o,
        ),
      );
    } else {
      const ov: LiveOverlay = {
        id: newOverlayId(),
        kind: "text",
        text,
        x: 50,
        y: 28,
        scale: 1,
        color: "#ffffff",
      };
      pushOverlays([...overlays, ov]);
      setSelectedOverlayId(ov.id);
    }
    setTextComposer(false);
    setTextDraft("");
  }

  function pickProduct(p: LiveCatalogProduct) {
    const note =
      (p.description ?? "").trim().slice(0, 220) ||
      "Mode d’emploi — à préciser";
    const ov: LiveOverlay = {
      id: newOverlayId(),
      kind: "product",
      productId: p.id,
      title: p.title,
      image: p.images[0] ?? null,
      priceCents: p.priceCents,
      currency: p.currency,
      note,
      x: 72,
      y: 58,
      scale: 1,
    };
    // Un seul produit épinglé à la fois (style TikTok shopping)
    const withoutProducts = overlays.filter((o) => o.kind !== "product");
    pushOverlays([...withoutProducts, ov]);
    setSelectedOverlayId(ov.id);
    setProductPickerOpen(false);
    toast.success("Produit à l’écran — déplacez / redimensionnez");
  }

  function saveProductNote() {
    if (!selectedOverlayId) return;
    pushOverlays(
      overlays.map((o) =>
        o.id === selectedOverlayId && o.kind === "product"
          ? { ...o, note: noteDraft.trim().slice(0, 220) }
          : o,
      ),
    );
    toast.success("Mode d’emploi mis à jour");
  }

  if (!live) return <PageLoader />;

  const startedAt = new Date(live.startedAt).getTime();
  const elapsedSec = Math.floor((now - startedAt) / 1000);
  const plannedMs = (live.plannedMinutes ?? 60) * 60_000;
  const remainingMs = startedAt + plannedMs - now;
  const pauseLeftMs =
    live.status === "PAUSED" && live.pausedAt
      ? Math.max(
          0,
          (live.pauseTimeoutMs ?? LIVE_PAUSE_TIMEOUT_MS) -
            (now - new Date(live.pausedAt).getTime()),
        )
      : 0;
  const ended = live.status === "ENDED";
  const paused = live.status === "PAUSED";
  const cover =
    live.product?.images[0] ??
    overlays.find((o) => o.kind === "product")?.image ??
    null;
  const showHostVideo = isHost && localCameraOn && !ended;
  const selected = overlays.find((o) => o.id === selectedOverlayId);
  const chats = live.chats ?? [];

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden bg-[#050508] text-white sm:max-w-xl md:max-w-2xl">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {showHostVideo ? (
          <video
            ref={videoRef}
            muted
            autoPlay
            {...iosInlineVideo}
            disablePictureInPicture
            className="absolute inset-0 size-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
          />
        ) : cover && (live.cameraOn !== false || isHost) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-90"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a24] to-[#050508]" />
        )}

        <LiveStageOverlays
          overlays={overlays}
          editable={isHost && !ended && !paused}
          selectedId={selectedOverlayId}
          onSelect={setSelectedOverlayId}
          onChange={patchOverlaysLocal}
          onCommit={commitOverlays}
        />

        {!ended && isHost ? (
          <LiveGuestRequestQueue
            pending={pendingGuests}
            busy={busy}
            onAccept={(guestId) => {
              void (async () => {
                setBusy(true);
                const ok = await hostAction("guest_accept", { guestId });
                setBusy(false);
                if (ok) toast.success("Invité sur scène");
              })();
            }}
            onRefuse={(guestId) => {
              void (async () => {
                setBusy(true);
                await hostAction("guest_refuse", { guestId });
                setBusy(false);
              })();
            }}
          />
        ) : null}

        {!ended && stageGuests.length > 0 ? (
          <LiveGuestStageGrid
            guests={stageGuests}
            selfUserId={session?.user?.id}
            selfStream={onStageAsGuest ? guestStream : null}
            isHost={isHost}
            onKick={
              isHost
                ? (guestId) => {
                    void (async () => {
                      setBusy(true);
                      await hostAction("guest_kick", { guestId });
                      setBusy(false);
                      toast.message("Invité retiré");
                    })();
                  }
                : undefined
            }
          />
        ) : null}

        {!isHost && live.cameraOn === false && !ended ? (
          <div className="absolute inset-0 z-[12] flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-sm">
            <CameraOff className="size-10 text-white/80" />
            <p className="text-sm font-semibold">Caméra du diffuseur coupée</p>
            <p className="text-xs text-white/60">Le live continue</p>
          </div>
        ) : null}

        {paused && !ended ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-md">
            <span className="grid size-14 place-items-center rounded-full bg-amber-500/20 text-amber-300">
              {live.pauseReason === "connection" ? (
                <WifiOff className="size-7" />
              ) : (
                <Pause className="size-7" />
              )}
            </span>
            <p className="max-w-sm text-base font-bold">
              {live.statusMessage ?? livePauseMessage(live.pauseReason)}
            </p>
            <p className="text-xs text-white/65">
              Fin auto dans {formatLiveClock(Math.floor(pauseLeftMs / 1000))} si
              aucune reprise
            </p>
            {isHost ? (
              <Button
                className="mt-2 rounded-full bg-trust px-5 font-bold text-black"
                disabled={busy}
                onClick={() => void hostAction("resume")}
              >
                <Play className="mr-1.5 size-4" />
                Reprendre le live
              </Button>
            ) : null}
          </div>
        ) : null}

        {ended ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
            <Radio className="size-10 text-white/50" />
            <p className="max-w-md text-base font-bold">
              {live.statusMessage ?? liveEndMessage(live.endReason)}
            </p>
            <Link
              href="/live"
              className="mt-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold"
            >
              Retour aux lives
            </Link>
          </div>
        ) : null}

        {/* Top — style TikTok */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/25 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide",
                ended
                  ? "bg-white/20"
                  : paused
                    ? "bg-amber-500 text-black"
                    : "bg-destructive text-white",
              )}
            >
              <Radio className="size-3" />
              {ended ? "FINI" : paused ? "PAUSE" : "LIVE"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              <Clock className="size-3" />
              {formatLiveClock(elapsedSec)}
            </span>
            <span className="max-w-[9rem] truncate rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              {live.user?.name ?? "…"}
            </span>
            {typeof live.viewerPeak === "number" ? (
              <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/70">
                pic {live.viewerPeak}
              </span>
            ) : null}
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-[#7dffb3] backdrop-blur">
              {formatMoney(live.giftCents)}
            </span>
            {!ended && remainingMs > 0 ? (
              <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/75">
                fin {formatLiveClock(Math.floor(remainingMs / 1000))}
              </span>
            ) : null}
          </div>
        </div>

        {/* Commentaires flottants (gauche) */}
        {!ended ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[5.5rem] z-[16] flex max-h-[38%] flex-col justify-end gap-1.5 px-3 pr-16 sm:bottom-24">
            <p className="mb-0.5 truncate text-[13px] font-bold drop-shadow">
              {live.title}
            </p>
            <div className="space-y-1 overflow-hidden">
              {chats.slice(-8).map((m) => (
                <p
                  key={m.id}
                  className="max-w-[85%] rounded-2xl bg-black/35 px-2.5 py-1 text-[12px] leading-snug backdrop-blur-sm"
                >
                  <span className="font-bold text-[#7dffb3]">{m.user.name}</span>{" "}
                  <span className="text-white/90">{m.body}</span>
                </p>
              ))}
              {chats.length === 0 ? (
                <p className="text-[11px] text-white/45">
                  Les commentaires apparaissent ici pour tout le monde.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Rail droit (TikTok) */}
        {!ended ? (
          <div className="absolute right-2.5 bottom-24 z-30 flex flex-col items-center gap-3 sm:right-3 sm:bottom-28">
            {isHost ? (
              <>
                <RailBtn
                  label="Texte"
                  onClick={() => {
                    setTextComposer(true);
                    setTextDraft("");
                    setSelectedOverlayId(null);
                  }}
                >
                  <Type className="size-5" />
                </RailBtn>
                <RailBtn
                  label="Shop"
                  onClick={() => setProductPickerOpen(true)}
                >
                  <ShoppingBag className="size-5" />
                </RailBtn>
                <RailBtn
                  label={localCameraOn ? "Cam" : "Off"}
                  onClick={() => void toggleCamera()}
                >
                  {localCameraOn ? (
                    <Camera className="size-5" />
                  ) : (
                    <CameraOff className="size-5 text-amber-300" />
                  )}
                </RailBtn>
                {!paused ? (
                  <RailBtn
                    label="Pause"
                    onClick={() =>
                      void hostAction("pause", { reason: "host" })
                    }
                  >
                    <Pause className="size-5" />
                  </RailBtn>
                ) : null}
              </>
            ) : (
              <>
                {!session?.user ? null : pendingAsGuest ? (
                  <RailBtn
                    label="Attente"
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        await guestAction("guest_cancel");
                        setBusy(false);
                        toast.message("Demande annulée");
                      })();
                    }}
                  >
                    <Clock className="size-5 text-amber-300" />
                  </RailBtn>
                ) : onStageAsGuest ? (
                  <>
                    <RailBtn
                      label={guestCameraOn ? "Cam" : "Off"}
                      onClick={() => void toggleGuestCamera()}
                    >
                      {guestCameraOn ? (
                        <Camera className="size-5" />
                      ) : (
                        <CameraOff className="size-5 text-amber-300" />
                      )}
                    </RailBtn>
                    <RailBtn
                      label="Quitter"
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          setGuestCameraOn(false);
                          await guestAction("guest_leave");
                          setBusy(false);
                        })();
                      }}
                    >
                      <LogOut className="size-5 text-amber-200" />
                    </RailBtn>
                  </>
                ) : (
                  <RailBtn
                    label="Monter"
                    onClick={() => {
                      if (!session?.user) {
                        toast.message("Connectez-vous pour monter au live");
                        return;
                      }
                      void (async () => {
                        setBusy(true);
                        const ok = await guestAction("guest_request");
                        setBusy(false);
                        if (ok) {
                          toast.message("Demande envoyée au diffuseur");
                        }
                      })();
                    }}
                  >
                    <UserPlus className="size-5 text-[#7dffb3]" />
                  </RailBtn>
                )}
                <RailBtn label="Cadeau" onClick={() => setGiftOpen((v) => !v)}>
                  <Gift className="size-5 text-pink-300" />
                </RailBtn>
              </>
            )}
            <ShareMenu
              title={live.title || "Live ShipShop"}
              text={`${live.user?.name ?? "Créateur"} est en live — ${live.title || "rejoins maintenant"}`}
              url={
                typeof window !== "undefined"
                  ? `${window.location.origin}/live/${id}`
                  : `/live/${id}`
              }
              side="left"
              align="end"
              triggerClassName="flex flex-col items-center gap-0.5 outline-none"
            >
              <span className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/50 shadow-lg backdrop-blur transition active:scale-95">
                <Share2 className="size-5" />
              </span>
              <span className="text-[9px] font-semibold text-white/80 drop-shadow">
                Partager
              </span>
            </ShareMenu>
          </div>
        ) : null}

        {camError && isHost ? (
          <p className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[10px] text-amber-200">
            {camError}
          </p>
        ) : null}

        {/* Éditeur overlay sélectionné */}
        {isHost && selected && !ended && !paused ? (
          <div className="absolute inset-x-3 bottom-[5.25rem] z-[35] rounded-2xl border border-white/15 bg-black/75 p-2.5 backdrop-blur-md sm:bottom-24">
            {selected.kind === "text" ? (
              <div className="flex gap-2">
                <Input
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  maxLength={120}
                  className="h-9 border-white/15 bg-white/10 text-white"
                  placeholder="Texte visible par les followers"
                />
                <Button
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    pushOverlays(
                      overlays.map((o) =>
                        o.id === selected.id && o.kind === "text"
                          ? { ...o, text: textDraft.trim() || o.text }
                          : o,
                      ),
                    );
                  }}
                >
                  OK
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-white/55">
                  Mode d’emploi / conseil (visible viewers)
                </p>
                <div className="flex gap-2">
                  <Input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    maxLength={220}
                    className="h-9 border-white/15 bg-white/10 text-white"
                    placeholder="Ex. taille, usage, conseils…"
                  />
                  <Button
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={saveProductNote}
                  >
                    OK
                  </Button>
                </div>
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-white/45">
              Glissez pour déplacer · poignée verte pour redimensionner
            </p>
          </div>
        ) : null}

        {textComposer && isHost && !ended ? (
          <div className="absolute inset-x-3 bottom-[5.25rem] z-40 flex gap-2 rounded-2xl border border-white/15 bg-black/80 p-2.5 backdrop-blur-md">
            <Input
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              maxLength={120}
              placeholder="Promo, conseil, titre…"
              className="h-9 border-white/15 bg-white/10 text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTextOverlay();
              }}
            />
            <Button
              size="sm"
              className="shrink-0 rounded-full"
              onClick={addTextOverlay}
            >
              <Plus className="mr-1 size-3.5" />
              Placer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-white/70"
              onClick={() => setTextComposer(false)}
            >
              ×
            </Button>
          </div>
        ) : null}

        {giftOpen && !isHost && !ended ? (
          <div className="absolute inset-x-3 bottom-[5.25rem] z-40 flex gap-2 rounded-2xl border border-white/15 bg-black/80 p-2 backdrop-blur-md">
            {GIFT_CATALOG.map((g) => (
              <button
                key={g.kind}
                type="button"
                disabled={busy || paused}
                onClick={() => void send("gift", { kind: g.kind })}
                className="flex-1 rounded-xl border border-white/15 bg-white/8 py-2 text-[10px] font-bold disabled:opacity-40"
              >
                {g.label}
                <span className="mt-0.5 block text-[#7dffb3]">
                  {formatMoney(g.amountCents)}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <LiveProductPicker
          liveId={id}
          open={productPickerOpen && isHost && !ended}
          onClose={() => setProductPickerOpen(false)}
          onPick={pickProduct}
        />
      </div>

      {/* Barre chat bas */}
      <div className="shrink-0 border-t border-white/10 bg-[#0c0c12]/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
        {!ended ? (
          <div className="flex gap-2">
            <Input
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              placeholder="Commenter…"
              className="h-10 rounded-full border-white/15 bg-white/10 text-white placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && chat.trim()) {
                  void send("chat", { body: chat.trim() });
                }
              }}
            />
            <Button
              size="icon"
              disabled={busy || !chat.trim()}
              className="size-10 shrink-0 rounded-full"
              onClick={() => void send("chat", { body: chat.trim() })}
            >
              <Send className="size-4" />
            </Button>
          </div>
        ) : null}

        {isHost && !ended ? (
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 rounded-full bg-white/10 text-white hover:bg-white/15"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await hostAction("prolong");
                setBusy(false);
                if (ok) {
                  setDurationAlerted(false);
                  toast.success("Live prolongé de 15 min");
                }
              }}
            >
              +15 min
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full border-destructive/50 text-destructive"
              disabled={busy}
              onClick={() => void send("end")}
            >
              Terminer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RailBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5"
    >
      <span className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/50 shadow-lg backdrop-blur transition active:scale-95">
        {children}
      </span>
      <span className="text-[9px] font-semibold text-white/80 drop-shadow">
        {label}
      </span>
    </button>
  );
}
