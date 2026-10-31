"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Camera,
  CameraOff,
  Clock,
  Gift,
  Heart,
  LogOut,
  MessageCircle,
  MessageCircleOff,
  Mic,
  MicOff,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Share2,
  ShoppingBag,
  Aperture,
  LayoutGrid,
  Lock,
  LockOpen,
  Sparkles,
  Type,
  UserPlus,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearPaymentIdempotencyKey,
  fetchPaymentJson,
  paymentIdempotencyKey,
} from "@/lib/payments/idempotency-client";
import { iosInlineVideo } from "@/lib/ios-inline-video";
import { cn, formatMoney } from "@/lib/utils";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";
import { ShareMenu } from "@/components/share-menu";
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
  useRemoteLiveAudio,
  type LiveGuestCard,
} from "@/components/live/live-guest-stage";
import { LiveStageComposer } from "@/components/live/live-stage-composer";
import {
  LIVE_STAGE_LAYOUTS,
  normalizeStageLayout,
  type LiveStageLayoutId,
} from "@/lib/growth/live-stage-layout";
import { LiveBackdropLayer } from "@/components/live/live-backdrop-layer";
import { LiveBackdropPicker } from "@/components/live/live-backdrop-picker";
import {
  LiveVideoStudioGrade,
  liveVideoFilterStyle,
} from "@/components/live/live-video-studio-grade";
import { LiveVideoFilterPicker } from "@/components/live/live-video-filter-picker";
import { type LivePublisherPeer } from "@/lib/growth/live-rtc-shared";
import { useLiveRtc } from "@/lib/growth/use-live-rtc";
import { useLiveSfu } from "@/lib/growth/use-live-sfu";

type LiveDetail = {
  id: string;
  title: string;
  status: "LIVE" | "PAUSED" | "ENDED" | string;
  giftCents: number;
  likeCount?: number;
  startedAt: string;
  pausedAt?: string | null;
  pauseReason?: string | null;
  endReason?: string | null;
  statusMessage?: string | null;
  plannedMinutes?: number;
  cameraOn?: boolean;
  micOn?: boolean;
  viewerPeak?: number;
  pauseTimeoutMs?: number;
  /** Fond CSS temporaire (aurora, sunset, …) */
  backdropPreset?: string | null;
  /** Image de fond uploadée — purgée à la fin du live */
  backdropUrl?: string | null;
  /** Filtre vidéo (null / natural = aucun) */
  videoFilter?: string | null;
  /** rail | split | board */
  stageLayout?: LiveStageLayoutId | string | null;
  /** true = montées invités fermées */
  guestJoinLocked?: boolean;
  overlays?: LiveOverlay[];
  guests?: LiveGuestCard[];
  myGuest?: LiveGuestCard | null;
  publishers?: LivePublisherPeer[];
  engagement?: {
    ok: boolean;
    warn: boolean;
    likes: number;
    chats: number;
    giftCents: number;
    message: string | null;
  };
  /** true = LiveKit SFU (millions de viewers) ; false/absent = mesh */
  sfu?: boolean;
  user?: { id: string; name: string; image?: string | null };
  product?: {
    id: string;
    title: string;
    images: string[];
    priceCents: number;
    shop: { name: string };
  } | null;
  chats?: {
    id: string;
    body: string;
    user: { id: string; name: string; image?: string | null };
  }[];
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
  const [localMicOn, setLocalMicOn] = useState(true);
  const [guestCameraOn, setGuestCameraOn] = useState(false);
  const [guestMicOn, setGuestMicOn] = useState(false);
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [durationAlerted, setDurationAlerted] = useState(false);
  const [overlays, setOverlays] = useState<LiveOverlay[]>([]);
  const [guests, setGuests] = useState<LiveGuestCard[]>([]);
  const [myGuest, setMyGuest] = useState<LiveGuestCard | null>(null);
  const [publishers, setPublishers] = useState<LivePublisherPeer[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [backdropPickerOpen, setBackdropPickerOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [railMenuOpen, setRailMenuOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftCustomOpen, setGiftCustomOpen] = useState(false);
  const [giftCustomAmount, setGiftCustomAmount] = useState("150");
  const [chatSelectMode, setChatSelectMode] = useState(false);
  const [chatInviteIds, setChatInviteIds] = useState<string[]>([]);
  /** Afficher / masquer le fil de commentaires (local, bas-gauche) */
  const [chatVisible, setChatVisible] = useState(true);
  /** SFU down → bascule mesh (évite live muet / noir) */
  const [sfuGaveUp, setSfuGaveUp] = useState(false);
  /** Incrément → remonte SFU/mesh + recrée getUserMedia (sans reload page) */
  const [rtcNonce, setRtcNonce] = useState(0);
  const [mediaNonce, setMediaNonce] = useState(0);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const autoRefreshDoneRef = useRef<string | null>(null);
  const viewerMediaRetryRef = useRef(0);
  const [heartBursts, setHeartBursts] = useState<
    { id: string; x: number; y: number }[]
  >([]);
  const lastTapRef = useRef(0);
  const likeBusyRef = useRef(false);
  const engagementWarnedRef = useRef(false);
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
  const localMicOnRef = useRef(true);
  const guestCameraOnRef = useRef(false);
  const guestMicOnRef = useRef(false);
  const remoteHostVideoRef = useRef<HTMLVideoElement | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);
  liveIdRef.current = id;
  endedRef.current = live?.status === "ENDED";
  sessionUserIdRef.current = session?.user?.id ?? null;

  const isHost = Boolean(
    session?.user?.id && live?.user?.id === session.user.id,
  );
  isHostRef.current = isHost;

  function stopStream(stream: MediaStream | null | undefined) {
    stream?.getTracks().forEach((t) => t.stop());
  }

  function setAvTracksEnabled(
    stream: MediaStream | null | undefined,
    opts: { video?: boolean; audio?: boolean; pageVisible?: boolean },
  ) {
    if (!stream) return;
    // Ne plus couper les pistes quand l’onglet est caché : sinon les viewers
    // voient un live figé dès que le host change d’onglet Chrome.
    void opts.pageVisible;
    if (typeof opts.video === "boolean") {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = opts.video!;
      });
    }
    if (typeof opts.audio === "boolean") {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = opts.audio!;
      });
    }
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
        prev.likeCount === next.likeCount &&
        prev.cameraOn === next.cameraOn &&
        prev.micOn === next.micOn &&
        prev.backdropPreset === next.backdropPreset &&
        prev.backdropUrl === next.backdropUrl &&
        prev.videoFilter === next.videoFilter &&
        prev.stageLayout === next.stageLayout &&
        prev.guestJoinLocked === next.guestJoinLocked &&
        prev.engagement?.warn === next.engagement?.warn &&
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
    if (Array.isArray(next.publishers)) {
      setPublishers((prev) =>
        JSON.stringify(prev) === JSON.stringify(next.publishers)
          ? prev
          : next.publishers!,
      );
    }
    if (next.myGuest !== undefined) {
      const g = next.myGuest ?? null;
      setMyGuest((prev) =>
        prev?.id === g?.id &&
        prev?.status === g?.status &&
        prev?.cameraOn === g?.cameraOn &&
        prev?.micOn === g?.micOn &&
        prev?.handRaised === g?.handRaised &&
        prev?.hasFloor === g?.hasFloor
          ? prev
          : g,
      );
    }
    if (typeof next.cameraOn === "boolean") {
      setLocalCameraOn((prev) =>
        prev === next.cameraOn ? prev : next.cameraOn!,
      );
    }
    if (typeof next.micOn === "boolean") {
      setLocalMicOn((prev) => (prev === next.micOn ? prev : next.micOn!));
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
      const params = new URLSearchParams();
      if (wantCount) params.set("countView", "1");
      const peer = sessionUserIdRef.current;
      if (peer) params.set("peerId", peer);
      const q = params.toString() ? `?${params}` : "";
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
      // Ne coupe plus cam/mic : les viewers gardent le flux
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
      // Reprise LIVE → reconnect A/V côté viewers / host
      if (prev === "PAUSED" && live.status === "LIVE") {
        autoRefreshDoneRef.current = null;
        void softRefreshLive({ silent: true });
      }
    }
  }, [live?.status, live?.statusMessage, live?.pauseReason, live?.endReason]);

  // Auto soft-refresh une fois quand le live passe en pause (flux planté)
  useEffect(() => {
    if (!live || live.status !== "PAUSED" || endedRef.current) return;
    const key = `${live.id}:paused`;
    if (autoRefreshDoneRef.current === key) return;
    autoRefreshDoneRef.current = key;
    const t = window.setTimeout(() => {
      void softRefreshLive({ silent: true });
    }, 1_200);
    return () => window.clearTimeout(t);
  }, [live?.id, live?.status]);

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

  /** Reconnect A/V + RTC sans recharger toute la page. */
  async function softRefreshLive(opts?: { silent?: boolean }) {
    if (liveRefreshing) return;
    setLiveRefreshing(true);
    try {
      setSfuGaveUp(false);
      // Recrée getUserMedia host/guest
      stopStream(streamRef.current);
      streamRef.current = null;
      setHostStream(null);
      stopStream(guestStreamRef.current);
      guestStreamRef.current = null;
      setGuestStream(null);
      setMediaNonce((n) => n + 1);
      setRtcNonce((n) => n + 1);

      if (isHost && live?.status === "PAUSED") {
        // Auto : reprise seulement si pause « connexion » (pas pause volontaire)
        const shouldResume =
          !opts?.silent || live.pauseReason === "connection";
        if (shouldResume) {
          await hostAction("resume");
        }
      } else if (isHost && live?.status === "LIVE") {
        await hostAction("heartbeat", { reason: "auto_resume" });
      }

      await load();
      if (!opts?.silent) {
        toast.success("Live rafraîchi");
      }
    } finally {
      setLiveRefreshing(false);
    }
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
    let retryTimer: number | null = null;
    let retryCount = 0;
    const roomId = id;

    /**
     * Envoie un heartbeat avec 3 stratégies en cascade :
     *  1. sendBeacon (fonctionne même si l'onglet est en train de se fermer)
     *  2. fetch keepalive (résiste aux navigations)
     *  3. hostAction classique (avec retry exponentiel si ça échoue)
     *
     * Le retry exponentiel (1 s → 2 s → 4 s, max 3 tentatives) absorbe les
     * micro-coupures mobiles sans déclencher de pause côté serveur.
     */
    const sendBeat = async (body: string): Promise<boolean> => {
      const url = `/api/growth/lives/${roomId}`;
      // 1. sendBeacon : fire-and-forget, survit à la fermeture de l'onglet
      if (typeof navigator?.sendBeacon === "function") {
        try {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon(url, blob)) return true;
        } catch {
          /* navigateur ne supporte pas Blob dans sendBeacon → fallback */
        }
      }
      // 2. fetch keepalive
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          credentials: "include",
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const beat = (opts?: { autoResume?: boolean }) => {
      const body = JSON.stringify({
        action: "heartbeat",
        ...(opts?.autoResume ? { reason: "auto_resume" } : {}),
      });

      // Annule un éventuel retry en cours
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      retryCount = 0;

      const tryBeat = async (attempt: number) => {
        const ok = await sendBeat(body);
        if (ok) {
          retryCount = 0;
          return;
        }
        // Retry exponentiel : 1 s, 2 s, 4 s (3 essais max)
        if (attempt < 3) {
          const delay = Math.min(1_000 * 2 ** attempt, 8_000);
          retryTimer = window.setTimeout(
            () => void tryBeat(attempt + 1),
            delay,
          );
          retryCount = attempt + 1;
        }
        // Après 3 échecs : le serveur finira par passer en PAUSED via reconcileLive
        // (seuil 3 min) ; on laisse la reconnexion réseau déclencher auto_resume.
      };

      void tryBeat(0);
    };

    const scheduleBeat = () => {
      if (timer != null) window.clearInterval(timer);
      const hidden = document.visibilityState === "hidden";
      const ms = hidden ? LIVE_HEARTBEAT_HIDDEN_MS : LIVE_HEARTBEAT_MS;
      beat({ autoResume: !hidden && live.status === "PAUSED" });
      timer = window.setInterval(() => beat(), ms);
    };

    scheduleBeat();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        // Retour onglet : reprendre si pause « connexion »
        beat({ autoResume: true });
      } else {
        // Passage en arrière-plan : beat de sécurité immédiat via sendBeacon
        beat();
      }
      scheduleBeat();
    };

    // pagehide : dernier beat avant fermeture / navigation (sendBeacon prioritaire)
    const onPageHide = () => beat();

    const onOffline = () => {
      // Réseau coupé : on ne fait rien (les beats vont échouer, le retry
      // s'arrête proprement ; onOnline reprend dès que la connexion revient).
      toast.error("Connexion perdue — le live reprendra automatiquement");
    };
    const onOnline = () => {
      beat({ autoResume: true });
      toast.message("Connexion rétablie — reprise du live");
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      if (timer != null) window.clearInterval(timer);
      if (retryTimer != null) window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [isHost, live?.id, live?.status, id]);

  useEffect(() => {
    localCameraOnRef.current = localCameraOn;
  }, [localCameraOn]);
  useEffect(() => {
    localMicOnRef.current = localMicOn;
  }, [localMicOn]);
  useEffect(() => {
    guestCameraOnRef.current = guestCameraOn;
  }, [guestCameraOn]);
  useEffect(() => {
    guestMicOnRef.current = guestMicOn;
  }, [guestMicOn]);

  const myGuestRow =
    myGuest ??
    guests.find((g) => g.user.id === session?.user?.id) ??
    null;
  const myGuestStatus = myGuestRow?.status ?? null;
  const onStageAsGuest = !isHost && myGuestStatus === "ON_STAGE";
  const pendingAsGuest = !isHost && myGuestStatus === "PENDING";
  const pendingGuests = guests.filter((g) => g.status === "PENDING");
  const invitedGuests = guests.filter((g) => g.status === "INVITED");
  const stageGuests = guests.filter((g) => g.status === "ON_STAGE");
  const invitedAsGuest = !isHost && myGuestStatus === "INVITED";

  async function inviteViewers(userIds: string[]) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    setBusy(true);
    const ok = await hostAction("guest_invite", { userIds: ids });
    setBusy(false);
    if (ok) {
      toast.success(
        ids.length === 1
          ? "Invitation envoyée"
          : `${ids.length} invitations envoyées`,
      );
      setChatInviteIds([]);
      setChatSelectMode(false);
    }
  }
  const isPublisher = isHost || onStageAsGuest;
  const publishStream = isHost ? hostStream : onStageAsGuest ? guestStream : null;

  // SFU LiveKit si serveur configuré ; fallback mesh si SFU échoue
  // NEXT_PUBLIC_LIVE_SFU=0 force le mesh même avec LiveKit
  const sfuPreferred =
    Boolean(live?.sfu) &&
    process.env.NEXT_PUBLIC_LIVE_SFU !== "0" &&
    !sfuGaveUp;
  const rtcEnabled = Boolean(
    session?.user?.id &&
      live &&
      live.status !== "ENDED" &&
      live.status !== "PAUSED",
  );

  const sfu = useLiveSfu({
    liveId: id,
    peerId: session?.user?.id ?? null,
    isPublisher,
    localStream: publishStream,
    enabled: rtcEnabled && sfuPreferred,
    reconnectKey: rtcNonce,
  });
  useEffect(() => {
    if (sfu.failed) setSfuGaveUp(true);
  }, [sfu.failed]);
  const sfuEnabled = sfuPreferred && !sfu.failed;
  const mesh = useLiveRtc({
    liveId: id,
    peerId: session?.user?.id ?? null,
    isPublisher,
    localStream: publishStream,
    publishers,
    enabled: rtcEnabled && !sfuEnabled,
    reconnectKey: rtcNonce,
  });
  const remoteStreams = sfuEnabled ? sfu.remoteStreams : mesh.remoteStreams;
  const hostRemoteStream = live?.user?.id
    ? remoteStreams[live.user.id] ?? null
    : null;
  const hostRemoteTrackKey = hostRemoteStream
    ? hostRemoteStream
        .getTracks()
        .map((t) => `${t.kind}:${t.id}:${t.readyState}:${t.enabled}`)
        .join("|")
    : "";
  const hostRemoteAudioRef = useRemoteLiveAudio(
    hostRemoteStream,
    Boolean(!isHost && hostRemoteStream),
  );

  // Sync host remote video (toujours muted — le son passe par <audio>)
  useEffect(() => {
    if (isHost) return;
    const el = remoteHostVideoRef.current;
    if (!el) return;
    if (!hostRemoteStream) {
      el.srcObject = null;
      return;
    }
    el.muted = true;
    if (el.srcObject !== hostRemoteStream) el.srcObject = hostRemoteStream;
    void el.play().catch(() => undefined);
  }, [hostRemoteStream, hostRemoteTrackKey, isHost]);

  useEffect(() => {
    if (isHost || !live || live.status !== "LIVE") {
      viewerMediaRetryRef.current = 0;
      return;
    }
    if (hostRemoteStream) {
      viewerMediaRetryRef.current = 0;
      return;
    }
    if (viewerMediaRetryRef.current >= 2) return;
    const t = window.setTimeout(() => {
      viewerMediaRetryRef.current += 1;
      void softRefreshLive({ silent: true });
    }, 6_500);
    return () => window.clearTimeout(t);
  }, [isHost, live?.status, hostRemoteStream]);

  // Host preview : rattacher le stream dès que la <video> est montée
  useEffect(() => {
    if (!isHost || !hostStream) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== hostStream) el.srcObject = hostStream;
    void el.play().catch(() => undefined);
  }, [isHost, hostStream, localCameraOn]);

  useEffect(() => {
    // Host : un seul getUserMedia (cam+mic), toggles = track.enabled
    // Garde la cam pendant PAUSED (reprise rapide) — stop seulement si ENDED
    if (!isHost || live?.status === "ENDED") {
      stopStream(streamRef.current);
      streamRef.current = null;
      setHostStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    if (streamRef.current?.active) {
      setHostStream((prev) =>
        prev === streamRef.current ? prev : streamRef.current,
      );
      setAvTracksEnabled(streamRef.current, {
        video: localCameraOn,
        audio: localMicOn,
      });
      return;
    }
    let cancelled = false;
    async function syncHostAv() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled || liveIdRef.current !== id) {
          stopStream(stream);
          return;
        }
        stopStream(streamRef.current);
        streamRef.current = stream;
        setHostStream(stream);
        setAvTracksEnabled(stream, {
          video: localCameraOnRef.current,
          audio: localMicOnRef.current,
        });
        setCamError(null);
      } catch {
        setCamError("Caméra / micro indisponible");
        setLocalCameraOn(false);
        setLocalMicOn(false);
        void hostAction("camera", { cameraOn: false });
        void hostAction("mic", { micOn: false });
      }
    }
    void syncHostAv();
    return () => {
      cancelled = true;
    };
  }, [isHost, localCameraOn, localMicOn, live?.status, id, mediaNonce]);

  useEffect(() => {
    const prev = prevGuestStatus.current;
    prevGuestStatus.current = myGuestStatus;
    if (!session?.user?.id || isHost) return;
    if (
      (prev === "PENDING" || prev === "INVITED") &&
      myGuestStatus === "ON_STAGE"
    ) {
      toast.success("Vous êtes sur scène");
      setGuestCameraOn(true);
      setGuestMicOn(true);
    }
    if (prev === "PENDING" && myGuestStatus === "REFUSED") {
      toast.message("Demande refusée par le diffuseur");
    }
    if (prev === "INVITED" && myGuestStatus === "REFUSED") {
      toast.message("Invitation déclinée");
    }
    if (prev !== "INVITED" && myGuestStatus === "INVITED") {
      toast.message("Invitation à monter sur scène");
    }
    if (
      (prev === "ON_STAGE" || prev === "PENDING" || prev === "INVITED") &&
      (myGuestStatus === "LEFT" || myGuestStatus == null)
    ) {
      if (prev === "ON_STAGE") toast.message("Hors scène");
      setGuestCameraOn(false);
      setGuestMicOn(false);
    }
  }, [myGuestStatus, isHost, session?.user?.id]);

  // Toast quand la parole est accordée / retirée (multi-invités)
  const prevHasFloorRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!onStageAsGuest) {
      prevHasFloorRef.current = null;
      return;
    }
    const now = Boolean(myGuestRow?.hasFloor);
    const prev = prevHasFloorRef.current;
    prevHasFloorRef.current = now;
    if (prev === null) return;
    if (!prev && now) toast.success("Parole accordée — vous pouvez parler");
    if (prev && !now && stageGuests.length >= 2) {
      toast.message("Parole retirée — levez la main pour redemander");
    }
  }, [onStageAsGuest, myGuestRow?.hasFloor, stageGuests.length]);

  // Invité déjà sur scène → aligner cam/mic (+ parole accordée / retirée)
  useEffect(() => {
    if (!onStageAsGuest || !myGuestRow) return;
    setGuestCameraOn(myGuestRow.cameraOn !== false);
    const micAllowed =
      myGuestRow.micOn !== false &&
      (stageGuests.length < 2 || Boolean(myGuestRow.hasFloor));
    setGuestMicOn(micAllowed);
    if (guestStreamRef.current?.active) {
      setAvTracksEnabled(guestStreamRef.current, {
        video: myGuestRow.cameraOn !== false,
        audio: micAllowed,
      });
    }
  }, [
    onStageAsGuest,
    myGuestRow?.id,
    myGuestRow?.cameraOn,
    myGuestRow?.micOn,
    myGuestRow?.hasFloor,
    stageGuests.length,
  ]);

  // Invité : cam + mic locaux (gardés en PAUSED pour reprise rapide)
  useEffect(() => {
    if (!onStageAsGuest || live?.status === "ENDED") {
      stopStream(guestStreamRef.current);
      guestStreamRef.current = null;
      setGuestStream(null);
      return;
    }
    if (guestStreamRef.current?.active) {
      setAvTracksEnabled(guestStreamRef.current, {
        video: guestCameraOn,
        audio: guestMicOn,
      });
      setGuestStream((prev) =>
        prev === guestStreamRef.current ? prev : guestStreamRef.current,
      );
      return;
    }
    let cancelled = false;
    async function syncGuestAv() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 480 },
            height: { ideal: 360 },
            frameRate: { ideal: 20, max: 24 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled || liveIdRef.current !== id) {
          stopStream(stream);
          return;
        }
        stopStream(guestStreamRef.current);
        guestStreamRef.current = stream;
        setAvTracksEnabled(stream, {
          video: guestCameraOnRef.current,
          audio: guestMicOnRef.current,
        });
        setGuestStream(stream);
      } catch {
        setGuestCameraOn(false);
        setGuestMicOn(false);
        toast.error("Caméra / micro indisponible");
        void guestAction("guest_camera", { cameraOn: false });
        void guestAction("guest_mic", { micOn: false });
      }
    }
    void syncGuestAv();
    return () => {
      cancelled = true;
    };
  }, [onStageAsGuest, guestCameraOn, guestMicOn, live?.status, id, mediaNonce]);

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

  function spawnHeart(clientX?: number, clientY?: number) {
    const id = `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const stage = document.getElementById("live-stage");
    const rect = stage?.getBoundingClientRect();
    const x = rect
      ? (((clientX ?? rect.left + rect.width * 0.55) - rect.left) / rect.width) *
        100
      : 55 + Math.random() * 20;
    const y = rect
      ? (((clientY ?? rect.top + rect.height * 0.45) - rect.top) / rect.height) *
        100
      : 40 + Math.random() * 15;
    setHeartBursts((prev) => [...prev.slice(-18), { id, x, y }]);
    window.setTimeout(() => {
      setHeartBursts((prev) => prev.filter((h) => h.id !== id));
    }, 1100);
  }

  async function sendLike(clientX?: number, clientY?: number) {
    if (isHost || endedRef.current || !session?.user?.id) {
      if (!session?.user?.id) toast.message("Connectez-vous pour aimer");
      return;
    }
    spawnHeart(clientX, clientY);
    if (likeBusyRef.current) return;
    likeBusyRef.current = true;
    const { res, data } = await fetchJson<{
      likeCount?: number;
      engagement?: LiveDetail["engagement"];
      error?: string;
    }>(`/api/growth/lives/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" }),
    });
    likeBusyRef.current = false;
    if (!res.ok) {
      if (res.status !== 429) toast.error(data?.error ?? "J’aime impossible");
      return;
    }
    setLive((prev) =>
      prev
        ? {
            ...prev,
            likeCount: data?.likeCount ?? (prev.likeCount ?? 0) + 1,
            engagement: data?.engagement ?? prev.engagement,
          }
        : prev,
    );
  }

  function kickHostRemotePlayback() {
    const video = remoteHostVideoRef.current;
    if (video?.srcObject) {
      video.muted = true;
      void video.play().catch(() => undefined);
    }
    const audio = hostRemoteAudioRef.current;
    if (audio?.srcObject) {
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.muted = false;
        })
        .catch(() => undefined);
    }
  }

  function onStagePointer(e: React.PointerEvent) {
    if (isHost || endedRef.current) return;
    kickHostRemotePlayback();
    // Ne pas liker si on clique un contrôle (menu, overlays…)
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, [data-no-like]")) return;
    const nowTs = Date.now();
    if (nowTs - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      void sendLike(e.clientX, e.clientY);
      return;
    }
    lastTapRef.current = nowTs;
  }

  async function send(action: "chat" | "gift" | "end", extra?: object) {
    setBusy(true);
    const giftIntent = `gift:${id}`;
    const idempotencyKey =
      action === "gift" ? paymentIdempotencyKey(giftIntent) : undefined;
    try {
      const { res, data } =
        action === "gift" && idempotencyKey
          ? await fetchPaymentJson<{ error?: string }>(
              `/api/growth/lives/${id}`,
              {
                method: "POST",
                idempotencyKey,
                replayScope: "GIFT",
                body: JSON.stringify({ action, ...extra, idempotencyKey }),
              },
            )
          : await fetchJson<{ error?: string }>(`/api/growth/lives/${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, ...extra }),
            });
      if (!res.ok) {
        toast.error(data?.error ?? "Action impossible");
        return;
      }
      if (action === "gift") {
        clearPaymentIdempotencyKey(giftIntent);
        notifyWalletUpdated();
        toast.success("Cadeau envoyé");
        setGiftOpen(false);
        setGiftCustomOpen(false);
      }
      if (action === "chat") setChat("");
      if (action === "end") toast.success("Live terminé");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connexion interrompue",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleCamera() {
    if (!isHost || busy) return;
    const next = !localCameraOn;
    setLocalCameraOn(next);
    setAvTracksEnabled(streamRef.current, {
      video: next,
      pageVisible: pageVisibleRef.current,
    });
    setBusy(true);
    await hostAction("camera", { cameraOn: next });
    setBusy(false);
  }

  async function toggleMic() {
    if (!isHost || busy) return;
    const next = !localMicOn;
    setLocalMicOn(next);
    setAvTracksEnabled(streamRef.current, {
      audio: next,
      pageVisible: pageVisibleRef.current,
    });
    setBusy(true);
    await hostAction("mic", { micOn: next });
    setBusy(false);
  }

  async function toggleGuestCamera() {
    if (!onStageAsGuest || busy) return;
    const next = !guestCameraOn;
    setGuestCameraOn(next);
    setAvTracksEnabled(guestStreamRef.current, {
      video: next,
      pageVisible: pageVisibleRef.current,
    });
    setBusy(true);
    await guestAction("guest_camera", { cameraOn: next });
    setBusy(false);
  }

  async function toggleGuestMic() {
    if (!onStageAsGuest || busy) return;
    const next = !guestMicOn;
    if (next && stageGuests.length >= 2 && !myGuestRow?.hasFloor) {
      toast.message("Levez la main — attendez la parole du diffuseur");
      return;
    }
    setGuestMicOn(next);
    setAvTracksEnabled(guestStreamRef.current, {
      audio: next,
      pageVisible: pageVisibleRef.current,
    });
    setBusy(true);
    const ok = await guestAction("guest_mic", { micOn: next });
    setBusy(false);
    if (!ok && next) {
      setGuestMicOn(false);
      setAvTracksEnabled(guestStreamRef.current, { audio: false });
    }
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

  useEffect(() => {
    if (!isHost || !live?.engagement?.warn || !live.engagement.message) {
      if (!live?.engagement?.warn) engagementWarnedRef.current = false;
      return;
    }
    if (engagementWarnedRef.current) return;
    engagementWarnedRef.current = true;
    toast.warning(live.engagement.message, { duration: 8_000 });
  }, [isHost, live?.engagement?.warn, live?.engagement?.message]);

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
  const hasBackdrop = Boolean(
    live.backdropUrl?.trim() || live.backdropPreset,
  );
  const showHostLocalVideo =
    isHost && localCameraOn && !ended && Boolean(hostStream);
  const hostRemote = hostRemoteStream;
  // Viewer : plein écran dès qu’un flux distant existe et cam host ON
  const showHostRemoteVideo =
    !isHost && !ended && Boolean(hostRemote) && live.cameraOn !== false;
  const viewerWaitingForMedia =
    !isHost && !ended && !paused && !hostRemote;
  const selected = overlays.find((o) => o.id === selectedOverlayId);
  const chats = live.chats ?? [];
  const videoFilterStyle = liveVideoFilterStyle(live.videoFilter);
  const stageLayout = normalizeStageLayout(live.stageLayout);
  const guestJoinLocked = Boolean(live.guestJoinLocked);
  const showStageChrome =
    !ended &&
    (isHost ||
      stageGuests.length > 0 ||
      pendingAsGuest ||
      invitedAsGuest);
  const hostMediaFill =
    "absolute inset-0 size-full object-cover";

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden bg-[#050508] text-white sm:max-w-xl md:max-w-2xl">
      <div
        id="live-stage"
        className="relative min-h-0 flex-1 overflow-hidden"
        onPointerUp={onStagePointer}
      >
        <LiveBackdropLayer
          preset={live.backdropPreset}
          url={live.backdropUrl}
        />

        <LiveStageComposer
          layout={stageLayout}
          hostName={live.user?.name}
          showStageChrome={showStageChrome}
          guests={guests}
          selfUserId={session?.user?.id}
          selfStream={onStageAsGuest ? guestStream : null}
          remoteStreams={remoteStreams}
          isHost={isHost}
          joinLocked={guestJoinLocked}
          canRequestJoin={Boolean(
            session?.user &&
              !isHost &&
              !onStageAsGuest &&
              !pendingAsGuest &&
              !invitedAsGuest &&
              !guestJoinLocked,
          )}
          pendingSelf={pendingAsGuest}
          onRequestJoin={() => {
            void (async () => {
              setBusy(true);
              const ok = await guestAction("guest_request");
              setBusy(false);
              if (ok) toast.message("Demande envoyée");
            })();
          }}
          videoFilter={live.videoFilter}
          hostMicOn={isHost ? localMicOn : undefined}
          onToggleHostMic={
            isHost
              ? () => {
                  void toggleMic();
                }
              : undefined
          }
          onToggleSelfCam={
            onStageAsGuest
              ? () => {
                  void toggleGuestCamera();
                }
              : undefined
          }
          onToggleSelfMic={
            onStageAsGuest
              ? () => {
                  void toggleGuestMic();
                }
              : undefined
          }
          onRaiseHand={
            onStageAsGuest
              ? () => {
                  void (async () => {
                    setBusy(true);
                    const ok = await guestAction("guest_raise_hand");
                    setBusy(false);
                    if (ok) toast.message("Main levée — en attente");
                  })();
                }
              : undefined
          }
          onLowerHand={
            onStageAsGuest
              ? () => {
                  void (async () => {
                    setBusy(true);
                    await guestAction("guest_lower_hand");
                    setBusy(false);
                  })();
                }
              : undefined
          }
          onGrantFloor={
            isHost
              ? (guestId) => {
                  void (async () => {
                    setBusy(true);
                    const ok = await hostAction("guest_grant_floor", {
                      guestId,
                    });
                    setBusy(false);
                    if (ok) toast.success("Parole accordée");
                  })();
                }
              : undefined
          }
          onRevokeFloor={
            isHost
              ? (guestId) => {
                  void (async () => {
                    setBusy(true);
                    await hostAction("guest_revoke_floor", { guestId });
                    setBusy(false);
                    toast.message("Parole retirée");
                  })();
                }
              : undefined
          }
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
          hostNode={
            <>
              {showHostLocalVideo ? (
                <video
                  ref={videoRef}
                  muted
                  autoPlay
                  {...iosInlineVideo}
                  disablePictureInPicture
                  style={videoFilterStyle}
                  className={cn(
                    hostMediaFill,
                    "[-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]",
                  )}
                />
              ) : cover &&
                !hasBackdrop &&
                isHost &&
                !showHostLocalVideo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  style={videoFilterStyle}
                  className={cn(hostMediaFill, "opacity-80")}
                />
              ) : null}

              {!isHost && !ended ? (
                <video
                  ref={remoteHostVideoRef}
                  muted
                  autoPlay
                  {...iosInlineVideo}
                  disablePictureInPicture
                  style={showHostRemoteVideo ? videoFilterStyle : undefined}
                  className={
                    showHostRemoteVideo
                      ? hostMediaFill
                      : "pointer-events-none absolute h-px w-px opacity-0"
                  }
                />
              ) : null}

              {!isHost && !ended ? (
                <audio
                  ref={hostRemoteAudioRef}
                  autoPlay
                  playsInline
                  className="hidden"
                />
              ) : null}

              <LiveVideoStudioGrade
                filterId={
                  showHostLocalVideo || showHostRemoteVideo
                    ? live.videoFilter
                    : null
                }
              />
            </>
          }
        />

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
            invited={invitedGuests}
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
            onCancelInvite={(guestId) => {
              void (async () => {
                setBusy(true);
                await hostAction("guest_refuse", { guestId });
                setBusy(false);
                toast.message("Invitation annulée");
              })();
            }}
          />
        ) : null}

        {/* Viewer : invitation host → accepter / refuser */}
        {invitedAsGuest && !ended ? (
          <div className="pointer-events-auto absolute inset-x-3 top-[4.5rem] z-[29] rounded-2xl border border-[#7dffb3]/40 bg-black/80 p-3 shadow-xl backdrop-blur-md">
            <p className="text-sm font-bold text-white">Invitation sur scène</p>
            <p className="mt-0.5 text-[11px] text-white/65">
              Le diffuseur vous invite à monter au live (caméra + micro).
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                className="flex-1 rounded-full bg-[#7dffb3] font-bold text-black hover:bg-[#7dffb3]/90"
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    const ok = await guestAction("guest_invite_accept");
                    setBusy(false);
                    if (ok) {
                      setGuestCameraOn(true);
                      setGuestMicOn(true);
                      toast.success("Vous montez sur scène");
                    }
                  })();
                }}
              >
                Accepter
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                className="flex-1 rounded-full text-white/80"
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    await guestAction("guest_invite_refuse");
                    setBusy(false);
                  })();
                }}
              >
                Refuser
              </Button>
            </div>
          </div>
        ) : null}

        {viewerWaitingForMedia ? (
          <button
            type="button"
            data-no-like
            className="absolute inset-0 z-[12] flex flex-col items-center justify-center gap-2 bg-black/55 px-6 text-center backdrop-blur-sm"
            onClick={() => {
              kickHostRemotePlayback();
              void softRefreshLive({ silent: true });
            }}
          >
            <Radio className="size-9 animate-pulse text-white/80" />
            <p className="text-sm font-semibold">Connexion au live…</p>
            <p className="text-xs text-white/60">
              Touchez pour afficher la vidéo et le son
            </p>
          </button>
        ) : null}

        {!isHost && live.cameraOn === false && !ended && hostRemote ? (
          <div className="absolute inset-0 z-[12] flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-sm">
            <CameraOff className="size-10 text-white/80" />
            <p className="text-sm font-semibold">Caméra du diffuseur coupée</p>
            <p className="text-xs text-white/60">Le live continue — le son est actif</p>
          </div>
        ) : null}

        {paused && !ended ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center backdrop-blur-md sm:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <span className="grid size-14 place-items-center rounded-full bg-amber-500/20 text-amber-300">
              {live.pauseReason === "connection" ? (
                <WifiOff className="size-7" />
              ) : (
                <Pause className="size-7" />
              )}
            </span>
            <p className="max-w-sm text-base font-bold leading-snug">
              {live.statusMessage ?? livePauseMessage(live.pauseReason)}
            </p>
            <p className="text-xs text-white/65">
              Fin auto dans {formatLiveClock(Math.floor(pauseLeftMs / 1000))} si
              aucune reprise
            </p>
            <div className="mt-2 flex w-full max-w-sm flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              {isHost ? (
                <Button
                  className="min-h-11 touch-manipulation rounded-full bg-trust px-5 font-bold text-black"
                  disabled={busy || liveRefreshing}
                  onClick={() => void softRefreshLive()}
                >
                  <Play className="mr-1.5 size-4" />
                  Reprendre
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 touch-manipulation rounded-full border border-white/25 bg-white/10 px-4 font-semibold text-white hover:bg-white/20"
                disabled={liveRefreshing}
                onClick={() => void softRefreshLive()}
              >
                <RefreshCw
                  className={cn(
                    "mr-1.5 size-4",
                    liveRefreshing && "animate-spin",
                  )}
                />
                Rafraîchir le live
              </Button>
            </div>
          </div>
        ) : null}

        {ended ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center sm:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <Radio className="size-10 text-white/50" />
            <p className="max-w-md text-base font-bold leading-snug">
              {live.statusMessage ?? liveEndMessage(live.endReason)}
            </p>
            <div className="mt-2 flex w-full max-w-sm flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 touch-manipulation rounded-full border border-white/25 bg-white/10 px-4 font-semibold text-white hover:bg-white/20"
                disabled={liveRefreshing}
                onClick={() => void softRefreshLive()}
              >
                <RefreshCw
                  className={cn(
                    "mr-1.5 size-4",
                    liveRefreshing && "animate-spin",
                  )}
                />
                Réessayer
              </Button>
              <Link
                href="/live"
                className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full bg-white/15 px-4 text-sm font-semibold"
              >
                Retour aux lives
              </Link>
            </div>
          </div>
        ) : null}

        {/* Top — stats · pic/likes (tous) · solde cadeaux = host seul */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 via-black/30 to-transparent px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-start gap-2">
            <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
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
              <span className="max-w-[7.5rem] truncate rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                {live.user?.name ?? "…"}
              </span>
              {!ended && remainingMs > 0 ? (
                <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/75">
                  fin {formatLiveClock(Math.floor(remainingMs / 1000))}
                </span>
              ) : null}
            </div>

            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur">
                {typeof live.viewerPeak === "number" ? (
                  <span className="text-[11px] font-semibold text-white/80">
                    pic {live.viewerPeak}
                  </span>
                ) : null}
                {typeof live.viewerPeak === "number" ? (
                  <span className="text-white/25">·</span>
                ) : null}
                {/* Solde cadeaux du live : visible uniquement pour le diffuseur */}
                {isHost ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7dffb3]"
                      title="Vos cadeaux reçus (privé)"
                    >
                      <Gift className="size-3" />
                      {formatMoney(live.giftCents ?? 0)}
                    </span>
                    <span className="text-white/25">·</span>
                  </>
                ) : null}
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-300"
                  title="J’aime"
                >
                  <Heart className="size-3 fill-pink-300" />
                  {live.likeCount ?? 0}
                </span>
              </div>

              {!ended ? (
                <button
                  type="button"
                  aria-expanded={railMenuOpen}
                  aria-label={railMenuOpen ? "Fermer le menu" : "Actions live"}
                  onClick={() => setRailMenuOpen((v) => !v)}
                  className={cn(
                    "grid size-10 place-items-center rounded-full border shadow-lg backdrop-blur transition active:scale-95",
                    railMenuOpen
                      ? "border-white/40 bg-white text-black"
                      : "border-white/20 bg-black/55 text-white",
                  )}
                >
                  {railMenuOpen ? (
                    <X className="size-5" />
                  ) : (
                    <MoreVertical className="size-5" />
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Menu actions — panneau depuis le haut */}
        {railMenuOpen && !ended ? (
          <>
            <button
              type="button"
              aria-label="Fermer"
              className="absolute inset-0 z-[34] bg-black/50"
              onClick={() => setRailMenuOpen(false)}
            />
            <div className="absolute top-[max(3.75rem,calc(env(safe-area-inset-top)+3rem))] right-3 left-3 z-[35] origin-top-right animate-in fade-in zoom-in-95 duration-150 sm:left-auto sm:w-[17.5rem]">
              <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#121218]/95 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-bold text-white">Actions</p>
                  <p className="text-[11px] text-white/50">
                    {isHost
                      ? "Contrôles diffuseur"
                      : onStageAsGuest
                        ? "Vous êtes sur scène"
                        : "Regarder · interagir"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1 p-2">
                  {isHost ? (
                    <>
                      <MenuAction
                        label="Texte"
                        onClick={() => {
                          setRailMenuOpen(false);
                          setTextComposer(true);
                          setTextDraft("");
                          setSelectedOverlayId(null);
                        }}
                      >
                        <Type className="size-5" />
                      </MenuAction>
                      <MenuAction
                        label="Shop"
                        onClick={() => {
                          setRailMenuOpen(false);
                          setProductPickerOpen(true);
                        }}
                      >
                        <ShoppingBag className="size-5" />
                      </MenuAction>
                      <MenuAction
                        label="Fond"
                        onClick={() => {
                          setRailMenuOpen(false);
                          setBackdropPickerOpen(true);
                        }}
                      >
                        <Sparkles className="size-5" />
                      </MenuAction>
                      <MenuAction
                        label="Filtre"
                        onClick={() => {
                          setRailMenuOpen(false);
                          setFilterPickerOpen(true);
                        }}
                      >
                        <Aperture className="size-5" />
                      </MenuAction>
                      <MenuAction
                        label="Scène"
                        onClick={() => {
                          setRailMenuOpen(false);
                          setLayoutPickerOpen(true);
                        }}
                      >
                        <LayoutGrid className="size-5" />
                      </MenuAction>
                      <MenuAction
                        label={guestJoinLocked ? "Ouvert" : "Verrou"}
                        tone={guestJoinLocked ? "warn" : undefined}
                        onClick={() => {
                          setRailMenuOpen(false);
                          void (async () => {
                            setBusy(true);
                            const ok = await hostAction("guest_join_lock", {
                              locked: !guestJoinLocked,
                            });
                            setBusy(false);
                            if (ok) {
                              toast.message(
                                guestJoinLocked
                                  ? "Montées ouvertes"
                                  : "Montées fermées",
                              );
                            }
                          })();
                        }}
                      >
                        {guestJoinLocked ? (
                          <Lock className="size-5" />
                        ) : (
                          <LockOpen className="size-5" />
                        )}
                      </MenuAction>
                      <MenuAction
                        label={localCameraOn ? "Cam" : "Cam off"}
                        tone={!localCameraOn ? "warn" : undefined}
                        onClick={() => {
                          setRailMenuOpen(false);
                          void toggleCamera();
                        }}
                      >
                        {localCameraOn ? (
                          <Camera className="size-5" />
                        ) : (
                          <CameraOff className="size-5" />
                        )}
                      </MenuAction>
                      <MenuAction
                        label={localMicOn ? "Micro" : "Muet"}
                        tone={!localMicOn ? "warn" : undefined}
                        onClick={() => {
                          setRailMenuOpen(false);
                          void toggleMic();
                        }}
                      >
                        {localMicOn ? (
                          <Mic className="size-5" />
                        ) : (
                          <MicOff className="size-5" />
                        )}
                      </MenuAction>
                      {!paused ? (
                        <MenuAction
                          label="Pause"
                          onClick={() => {
                            setRailMenuOpen(false);
                            void hostAction("pause", { reason: "host" });
                          }}
                        >
                          <Pause className="size-5" />
                        </MenuAction>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {session?.user ? (
                        pendingAsGuest ? (
                          <MenuAction
                            label="Annuler"
                            tone="warn"
                            onClick={() => {
                              setRailMenuOpen(false);
                              void (async () => {
                                setBusy(true);
                                await guestAction("guest_cancel");
                                setBusy(false);
                                toast.message("Demande annulée");
                              })();
                            }}
                          >
                            <Clock className="size-5" />
                          </MenuAction>
                        ) : onStageAsGuest ? (
                          <>
                            <MenuAction
                              label={guestCameraOn ? "Cam" : "Cam off"}
                              tone={!guestCameraOn ? "warn" : undefined}
                              onClick={() => {
                                setRailMenuOpen(false);
                                void toggleGuestCamera();
                              }}
                            >
                              {guestCameraOn ? (
                                <Camera className="size-5" />
                              ) : (
                                <CameraOff className="size-5" />
                              )}
                            </MenuAction>
                            <MenuAction
                              label={guestMicOn ? "Micro" : "Muet"}
                              tone={!guestMicOn ? "warn" : undefined}
                              onClick={() => {
                                setRailMenuOpen(false);
                                void toggleGuestMic();
                              }}
                            >
                              {guestMicOn ? (
                                <Mic className="size-5" />
                              ) : (
                                <MicOff className="size-5" />
                              )}
                            </MenuAction>
                            <MenuAction
                              label="Quitter"
                              tone="warn"
                              onClick={() => {
                                setRailMenuOpen(false);
                                void (async () => {
                                  setBusy(true);
                                  setGuestCameraOn(false);
                                  setGuestMicOn(false);
                                  await guestAction("guest_leave");
                                  setBusy(false);
                                })();
                              }}
                            >
                              <LogOut className="size-5" />
                            </MenuAction>
                          </>
                        ) : (
                          <MenuAction
                            label="Monter"
                            tone="accent"
                            onClick={() => {
                              setRailMenuOpen(false);
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
                            <UserPlus className="size-5" />
                          </MenuAction>
                        )
                      ) : null}
                      <MenuAction
                        label="J’aime"
                        tone="pink"
                        onClick={() => {
                          setRailMenuOpen(false);
                          void sendLike();
                        }}
                      >
                        <Heart className="size-5 fill-pink-300" />
                      </MenuAction>
                      <MenuAction
                        label="Cadeau"
                        tone="pink"
                        onClick={() => {
                          setRailMenuOpen(false);
                          setGiftCustomOpen(false);
                          setGiftOpen(true);
                        }}
                      >
                        <Gift className="size-5" />
                      </MenuAction>
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
                    side="bottom"
                    align="end"
                    triggerClassName="flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-white outline-none transition hover:bg-white/10 active:scale-[0.97]"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-white/10">
                      <Share2 className="size-5" />
                    </span>
                    <span className="text-[10px] font-semibold text-white/75">
                      Partager
                    </span>
                  </ShareMenu>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Cœurs flottants (double-tap / j’aime) */}
        {heartBursts.map((h) => (
          <span
            key={h.id}
            className="pointer-events-none absolute z-[25] animate-in fade-in zoom-in-50 slide-out-to-top-8 duration-1000"
            style={{
              left: `${h.x}%`,
              top: `${h.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <Heart className="size-10 fill-pink-400 text-pink-300 drop-shadow-lg" />
          </span>
        ))}

        {/* Viewer : bouton j’aime rapide */}
        {!ended && !isHost ? (
          <button
            type="button"
            data-no-like
            aria-label="J’aime"
            onClick={() => void sendLike()}
            className="absolute right-3 z-[28] flex flex-col items-center gap-0.5 bottom-[max(7rem,calc(env(safe-area-inset-bottom)+6.25rem))] sm:bottom-32"
          >
            <span className="grid size-12 place-items-center rounded-full border border-pink-300/40 bg-black/55 text-pink-300 shadow-lg backdrop-blur transition active:scale-90">
              <Heart className="size-6 fill-pink-400/90" />
            </span>
            <span className="text-[10px] font-bold text-pink-200/90 drop-shadow">
              {live.likeCount ?? 0}
            </span>
          </button>
        ) : null}

        {/* Host : alerte engagement faible */}
        {isHost && live.engagement?.warn && !ended ? (
          <div
            data-no-like
            className="pointer-events-auto absolute inset-x-3 top-[4.4rem] z-[29] rounded-2xl border border-amber-400/45 bg-amber-950/85 px-3 py-2.5 shadow-xl backdrop-blur-md"
          >
            <p className="text-[12px] font-bold text-amber-100">
              Live peu interactif
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-amber-100/80">
              {live.engagement.message ??
                "Peu de j’aime / commentaires — animez le public pour éviter une interruption."}
            </p>
            <p className="mt-1 text-[10px] text-amber-200/70">
              {live.likeCount ?? 0} j’aime · {live.engagement.chats} messages ·{" "}
              {formatMoney(live.engagement.giftCents)}
            </p>
          </div>
        ) : null}

        {/* Commentaires bas — toggle pour tout le monde */}
        {!ended ? (
          <>
            {chatVisible ? (
              <div
                data-no-like
                className="pointer-events-none absolute inset-x-0 bottom-11 z-[16] flex max-h-[38%] flex-col justify-end gap-1 px-3"
              >
                <div className="flex items-center justify-between gap-2 pl-11">
                  <p className="min-w-0 truncate text-[12px] font-bold drop-shadow">
                    {live.title}
                  </p>
                  {isHost ? (
                    <button
                      type="button"
                      className={cn(
                        "pointer-events-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur transition",
                        chatSelectMode
                          ? "bg-[#7dffb3] text-black"
                          : "bg-black/45 text-white/85",
                      )}
                      onClick={() => {
                        setChatSelectMode((v) => !v);
                        setChatInviteIds([]);
                      }}
                    >
                      {chatSelectMode ? "Annuler" : "Inviter"}
                    </button>
                  ) : null}
                </div>
                {isHost && chatSelectMode && chatInviteIds.length > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="pointer-events-auto self-start rounded-full bg-[#7dffb3] px-3 py-1.5 text-[11px] font-extrabold text-black shadow-lg disabled:opacity-50"
                    onClick={() => void inviteViewers(chatInviteIds)}
                  >
                    Inviter {chatInviteIds.length} viewer
                    {chatInviteIds.length > 1 ? "s" : ""}
                  </button>
                ) : null}
                <LiveChatFeed
                  chats={chats}
                  isHost={isHost}
                  hostUserId={live.user?.id}
                  guestByUserId={Object.fromEntries(
                    guests.map((g) => [g.user.id, g.status]),
                  )}
                  selectMode={chatSelectMode}
                  selectedIds={chatInviteIds}
                  onToggleSelect={(userId) => {
                    setChatInviteIds((prev) =>
                      prev.includes(userId)
                        ? prev.filter((x) => x !== userId)
                        : [...prev, userId],
                    );
                  }}
                  onInviteOne={(userId) => void inviteViewers([userId])}
                />
              </div>
            ) : (
              <p className="pointer-events-none absolute inset-x-0 bottom-11 z-[16] truncate px-3 pl-14 text-[12px] font-bold drop-shadow">
                {live.title}
              </p>
            )}
            <button
              type="button"
              data-no-like
              aria-label={
                chatVisible
                  ? "Masquer les commentaires"
                  : "Afficher les commentaires"
              }
              aria-pressed={chatVisible}
              className="absolute bottom-2 left-3 z-[28] flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 active:scale-95"
              onClick={() => {
                setChatVisible((v) => {
                  if (v) {
                    setChatSelectMode(false);
                    setChatInviteIds([]);
                  }
                  return !v;
                });
              }}
            >
              {chatVisible ? (
                <MessageCircleOff className="size-4" strokeWidth={2.25} />
              ) : (
                <MessageCircle className="size-4" strokeWidth={2.25} />
              )}
            </button>
          </>
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
          <div
            data-no-like
            className="absolute inset-x-3 z-40 rounded-2xl border border-white/15 bg-black/88 p-3 shadow-xl backdrop-blur-md bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] sm:bottom-24"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-white">Envoyer un cadeau</p>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => {
                  setGiftOpen(false);
                  setGiftCustomOpen(false);
                }}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition touch-manipulation hover:bg-white/20 active:scale-95"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([50, 100] as const).map((cents) => (
                <button
                  key={cents}
                  type="button"
                  disabled={busy || paused}
                  onClick={() =>
                    void send("gift", { amountCents: cents, kind: "CUSTOM" })
                  }
                  className="min-h-11 touch-manipulation rounded-xl border border-white/15 bg-white/8 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-40 active:scale-[0.98]"
                >
                  {formatMoney(cents)}
                </button>
              ))}
              <button
                type="button"
                disabled={busy || paused}
                onClick={() => setGiftCustomOpen((v) => !v)}
                className={cn(
                  "min-h-11 touch-manipulation rounded-xl border py-2.5 text-[12px] font-extrabold disabled:opacity-40 active:scale-[0.98]",
                  giftCustomOpen
                    ? "border-[#7dffb3]/50 bg-[#7dffb3]/15 text-[#7dffb3]"
                    : "border-white/15 bg-white/8 text-white",
                )}
              >
                Plus…
              </button>
            </div>
            {giftCustomOpen ? (
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  autoCorrect="off"
                  value={giftCustomAmount}
                  onChange={(e) => setGiftCustomAmount(e.target.value)}
                  placeholder="Montant ($)"
                  className="h-11 min-h-11 flex-1 border-white/15 bg-white/10 text-base text-white placeholder:text-white/40"
                />
                <Button
                  type="button"
                  disabled={busy || paused}
                  className="h-11 min-h-11 shrink-0 touch-manipulation rounded-xl px-4 font-bold"
                  onClick={() => {
                    const dollars = Number.parseFloat(
                      giftCustomAmount.replace(",", "."),
                    );
                    if (!Number.isFinite(dollars) || dollars < 0.1) {
                      toast.error("Indiquez un montant (min. 0,10 $)");
                      return;
                    }
                    const amountCents = Math.round(dollars * 100);
                    void send("gift", { amountCents, kind: "CUSTOM" });
                  }}
                >
                  Envoyer
                </Button>
              </div>
            ) : null}
            <p className="mt-2 text-[10px] leading-snug text-white/45">
              Débit sur votre portefeuille — le solde du diffuseur reste privé.
            </p>
          </div>
        ) : null}

        <LiveBackdropPicker
          open={backdropPickerOpen && isHost && !ended}
          busy={busy}
          currentPreset={live.backdropPreset}
          currentUrl={live.backdropUrl}
          onClose={() => setBackdropPickerOpen(false)}
          onApply={async (next) => {
            setBusy(true);
            const ok = await hostAction("backdrop", {
              preset: next.preset ?? null,
              url: next.url ?? null,
            });
            setBusy(false);
            return ok;
          }}
        />

        <LiveVideoFilterPicker
          open={filterPickerOpen && isHost && !ended}
          busy={busy}
          current={live.videoFilter}
          onClose={() => setFilterPickerOpen(false)}
          onApply={async (filterId) => {
            setBusy(true);
            const ok = await hostAction("video_filter", {
              filter: filterId,
            });
            setBusy(false);
            return ok;
          }}
        />

        {layoutPickerOpen && isHost && !ended ? (
          <>
            <button
              type="button"
              aria-label="Fermer"
              className="absolute inset-0 z-[40] bg-black/55"
              onClick={() => setLayoutPickerOpen(false)}
            />
            <div className="absolute inset-x-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] z-[41] overflow-hidden rounded-3xl border border-white/15 bg-[#121218]/96 p-3 shadow-2xl backdrop-blur-xl sm:bottom-28">
              <p className="px-1 text-sm font-bold text-white">
                Disposition scène
              </p>
              <p className="mt-0.5 px-1 text-[11px] text-white/50">
                Placement des invités — visible pour tout le monde.
              </p>
              <div className="mt-3 space-y-2">
                {LIVE_STAGE_LAYOUTS.map((l) => {
                  const active = stageLayout === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          const ok = await hostAction("stage_layout", {
                            layout: l.id,
                          });
                          setBusy(false);
                          if (ok) {
                            setLayoutPickerOpen(false);
                            toast.success(`Disposition « ${l.label} »`);
                          }
                        })();
                      }}
                      className={cn(
                        "flex w-full flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99]",
                        active
                          ? "border-[#7dffb3]/50 bg-[#7dffb3]/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <span className="text-[13px] font-bold text-white">
                        {l.label}
                        {active ? " · actif" : ""}
                      </span>
                      <span className="text-[11px] text-white/55">{l.hint}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-2.5 text-[12px] font-bold text-white/85"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    const ok = await hostAction("guest_join_lock", {
                      locked: !guestJoinLocked,
                    });
                    setBusy(false);
                    if (ok) {
                      toast.message(
                        guestJoinLocked
                          ? "Tout le monde peut demander à monter"
                          : "Montées verrouillées",
                      );
                    }
                  })();
                }}
              >
                {guestJoinLocked ? (
                  <LockOpen className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {guestJoinLocked
                  ? "Rouvrir les demandes"
                  : "Fermer les montées"}
              </button>
            </div>
          </>
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
              enterKeyHint="send"
              autoComplete="off"
              className="h-11 min-h-11 rounded-full border-white/15 bg-white/10 text-base text-white placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && chat.trim()) {
                  void send("chat", { body: chat.trim() });
                }
              }}
            />
            <Button
              size="icon"
              className="size-11 shrink-0 touch-manipulation rounded-full"
              disabled={busy || !chat.trim()}
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

/** ~5 bulles visibles ; avatar + nom ; host peut inviter 1/N viewers. */
const LIVE_CHAT_KEEP = 40;
const LIVE_CHAT_VIEWPORT_CLASS =
  "max-h-[8.75rem]"; /* ≈ 5 × (py + ligne) */

type LiveChatRow = {
  id: string;
  body: string;
  user: { id: string; name: string; image?: string | null };
};

function LiveChatFeed({
  chats,
  isHost,
  hostUserId,
  guestByUserId,
  selectMode,
  selectedIds,
  onToggleSelect,
  onInviteOne,
}: {
  chats: LiveChatRow[];
  isHost?: boolean;
  hostUserId?: string;
  guestByUserId?: Record<string, string>;
  selectMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (userId: string) => void;
  onInviteOne?: (userId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);
  const rows = chats.slice(-LIVE_CHAT_KEEP);
  const lastId = rows.at(-1)?.id ?? "";

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lastId, rows.length]);

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-white/45">
        Les commentaires apparaissent ici pour tout le monde.
      </p>
    );
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={() => {
        const el = scrollerRef.current;
        if (!el) return;
        const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickBottomRef.current = gap < 48;
      }}
      className={cn(
        "pointer-events-auto space-y-1.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]",
        LIVE_CHAT_VIEWPORT_CLASS,
        "[mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_100%)]",
      )}
      aria-live="polite"
    >
      {rows.map((m, i) => {
        const fromBottom = rows.length - 1 - i;
        const dim = fromBottom >= 4;
        const uid = m.user.id;
        const status = guestByUserId?.[uid];
        const isSelfHost = Boolean(hostUserId && uid === hostUserId);
        const canInvite =
          Boolean(isHost) &&
          !isSelfHost &&
          status !== "ON_STAGE" &&
          status !== "INVITED" &&
          status !== "PENDING";
        const selected = Boolean(selectedIds?.includes(uid));

        return (
          <div
            key={m.id}
            className={cn(
              "flex max-w-[92%] items-start gap-2 rounded-2xl bg-black/40 px-2 py-1.5 backdrop-blur-sm transition-opacity",
              dim ? "opacity-55" : "opacity-100",
              selected && "ring-1 ring-[#7dffb3]/70",
            )}
          >
            {selectMode && canInvite ? (
              <button
                type="button"
                aria-label={selected ? "Désélectionner" : "Sélectionner"}
                onClick={() => onToggleSelect?.(uid)}
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-[10px] font-bold",
                  selected
                    ? "border-[#7dffb3] bg-[#7dffb3] text-black"
                    : "border-white/35 bg-white/10 text-transparent",
                )}
              >
                ✓
              </button>
            ) : null}
            <span className="relative mt-0.5 grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15">
              {m.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.user.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <UserRound className="size-3.5 text-white/55" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[12px] font-bold text-[#7dffb3]">
                  {m.user.name}
                </p>
                {status === "ON_STAGE" ? (
                  <span className="shrink-0 rounded-full bg-[#7dffb3]/20 px-1.5 py-0.5 text-[8px] font-bold text-[#7dffb3]">
                    scène
                  </span>
                ) : status === "INVITED" ? (
                  <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-bold text-white/70">
                    invité
                  </span>
                ) : status === "PENDING" ? (
                  <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-200">
                    demande
                  </span>
                ) : null}
              </div>
              <p className="text-[12px] leading-snug text-white/90">{m.body}</p>
            </div>
            {isHost && canInvite && !selectMode ? (
              <button
                type="button"
                title="Inviter sur scène"
                aria-label={`Inviter ${m.user.name}`}
                onClick={() => onInviteOne?.(uid)}
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#7dffb3]/20 text-[#7dffb3] transition active:scale-95"
              >
                <UserPlus className="size-3.5" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MenuAction({
  children,
  label,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "warn" | "accent" | "pink";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-white transition hover:bg-white/10 active:scale-[0.97]"
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full",
          tone === "warn" && "bg-amber-400/20 text-amber-200",
          tone === "accent" && "bg-[#7dffb3]/20 text-[#7dffb3]",
          tone === "pink" && "bg-pink-400/20 text-pink-200",
          !tone && "bg-white/10 text-white",
        )}
      >
        {children}
      </span>
      <span className="text-[10px] font-semibold text-white/75">{label}</span>
    </button>
  );
}
