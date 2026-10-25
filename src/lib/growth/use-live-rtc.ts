"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import {
  LIVE_RTC_ICE_SERVERS,
  LIVE_RTC_SSE_RETRY_MS,
  buildClientFallbackIceServers,
  sortLiveIceServers,
  type LivePublisherPeer,
  type LiveRtcSignalPublic,
} from "@/lib/growth/live-rtc-shared";

type RemoteStreamMap = Record<string, MediaStream>;

type PcMeta = {
  pendingIce: RTCIceCandidateInit[];
  outIce: RTCIceCandidateInit[];
  outIceTimer?: ReturnType<typeof setTimeout>;
  makingOffer: boolean;
  polite: boolean;
  ignoreOffer: boolean;
  mediaUp: boolean;
  escalateTimer?: ReturnType<typeof setTimeout>;
};

const ICE_BATCH_MS = 50;

/**
 * Mesh WebRTC — signaling SSE uniquement (pas le poll room).
 */
export function useLiveRtc(opts: {
  liveId: string;
  peerId: string | null;
  isPublisher: boolean;
  localStream: MediaStream | null;
  publishers: LivePublisherPeer[];
  enabled: boolean;
  /** Change → reconnexion mesh (refresh live sans reload page). */
  reconnectKey?: number;
}) {
  const {
    liveId,
    peerId,
    isPublisher,
    localStream,
    publishers,
    enabled,
    reconnectKey = 0,
  } = opts;

  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamMap>({});
  const [iceReady, setIceReady] = useState(false);
  /** Incrémenté après échec PC pour forcer une nouvelle offre. */
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const metaRef = useRef<Map<string, PcMeta>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>(LIVE_RTC_ICE_SERVERS);
  const preferRelayRef = useRef(false);
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;
  const isPublisherRef = useRef(isPublisher);
  isPublisherRef.current = isPublisher;
  const handleSignalRef = useRef<(sig: LiveRtcSignalPublic) => Promise<void>>(
    async () => undefined,
  );
  const seenSignalIds = useRef<Set<string>>(new Set());

  const sendSignal = useCallback(
    async (
      toPeerId: string,
      kind: "offer" | "answer" | "ice",
      payload: unknown,
    ) => {
      if (!peerIdRef.current || toPeerId === peerIdRef.current) return;
      await fetchJson(`/api/growth/lives/${liveId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rtc_signal",
          toPeerId,
          kind,
          payload,
        }),
      });
    },
    [liveId],
  );

  const upsertRemote = useCallback((fromId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => {
      if (prev[fromId] === stream) return prev;
      return { ...prev, [fromId]: stream };
    });
  }, []);

  const dropRemote = useCallback((fromId: string) => {
    setRemoteStreams((prev) => {
      if (!(fromId in prev)) return prev;
      const next = { ...prev };
      delete next[fromId];
      return next;
    });
  }, []);

  const metaFor = useCallback((id: string) => {
    let m = metaRef.current.get(id);
    if (!m) {
      m = {
        pendingIce: [],
        outIce: [],
        makingOffer: false,
        polite: false,
        ignoreOffer: false,
        mediaUp: false,
      };
      metaRef.current.set(id, m);
    }
    return m;
  }, []);

  const clearEscalate = useCallback((id: string) => {
    const m = metaRef.current.get(id);
    if (!m?.escalateTimer) return;
    clearTimeout(m.escalateTimer);
    m.escalateTimer = undefined;
  }, []);

  const flushOutIce = useCallback(
    (remotePeerId: string) => {
      const meta = metaFor(remotePeerId);
      if (meta.outIceTimer) {
        clearTimeout(meta.outIceTimer);
        meta.outIceTimer = undefined;
      }
      const batch = meta.outIce.splice(0, meta.outIce.length);
      if (!batch.length) return;
      void sendSignal(remotePeerId, "ice", { candidates: batch });
    },
    [metaFor, sendSignal],
  );

  const queueOutIce = useCallback(
    (remotePeerId: string, cand: RTCIceCandidateInit) => {
      const meta = metaFor(remotePeerId);
      meta.outIce.push(cand);
      if (meta.outIceTimer) return;
      meta.outIceTimer = setTimeout(() => {
        meta.outIceTimer = undefined;
        flushOutIce(remotePeerId);
      }, ICE_BATCH_MS);
    },
    [flushOutIce, metaFor],
  );

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      if (senders.some((s) => s.track?.id === track.id)) continue;
      const emptySender = senders.find(
        (s) =>
          (!s.track || s.track.readyState === "ended") &&
          (s.track == null || s.track.kind === track.kind),
      );
      if (emptySender) {
        void emptySender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  const flushIce = useCallback(
    async (remotePeerId: string, pc: RTCPeerConnection) => {
      const meta = metaFor(remotePeerId);
      const queued = meta.pendingIce.splice(0, meta.pendingIce.length);
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          /* ignore */
        }
      }
    },
    [metaFor],
  );

  const applyIcePayload = useCallback(
    async (
      from: string,
      pc: RTCPeerConnection,
      payload: unknown,
    ) => {
      const meta = metaFor(from);
      const list: RTCIceCandidateInit[] = [];
      if (payload && typeof payload === "object" && "candidates" in payload) {
        const raw = (payload as { candidates?: unknown }).candidates;
        if (Array.isArray(raw)) {
          for (const c of raw) {
            if (c && typeof c === "object") list.push(c as RTCIceCandidateInit);
          }
        }
      } else if (payload && typeof payload === "object") {
        list.push(payload as RTCIceCandidateInit);
      }
      for (const cand of list) {
        if (!pc.remoteDescription) {
          meta.pendingIce.push(cand);
          continue;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          meta.pendingIce.push(cand);
        }
      }
    },
    [metaFor],
  );

  const tearDownPc = useCallback(
    (remotePeerId: string, bumpReconnect: boolean) => {
      const meta = metaRef.current.get(remotePeerId);
      if (meta?.outIceTimer) clearTimeout(meta.outIceTimer);
      clearEscalate(remotePeerId);
      const pc = pcsRef.current.get(remotePeerId);
      if (pc) {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      pcsRef.current.delete(remotePeerId);
      metaRef.current.delete(remotePeerId);
      dropRemote(remotePeerId);
      if (bumpReconnect) {
        setReconnectNonce((n) => n + 1);
      }
    },
    [clearEscalate, dropRemote],
  );

  const sendIceRestart = useCallback(
    async (remotePeerId: string, pc: RTCPeerConnection) => {
      try {
        await pc.restartIce();
        if (pc.signalingState === "stable") {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          await sendSignal(remotePeerId, "offer", offer);
        }
      } catch (error) {
        console.error("[live-rtc] iceRestart", error);
        tearDownPc(remotePeerId, true);
      }
    },
    [sendSignal, tearDownPc],
  );

  const armEscalate = useCallback(
    (remotePeerId: string, pc: RTCPeerConnection) => {
      const meta = metaFor(remotePeerId);
      if (meta.mediaUp || meta.escalateTimer) return;
      meta.escalateTimer = setTimeout(() => {
        meta.escalateTimer = undefined;
        if (meta.mediaUp) return;
        void sendIceRestart(remotePeerId, pc);
      }, 18_000);
    },
    [metaFor, sendIceRestart],
  );

  const ensurePc = useCallback(
    (remotePeerId: string) => {
      let pc = pcsRef.current.get(remotePeerId);
      if (pc) return pc;
      const me = peerIdRef.current ?? "";
      const meta = metaFor(remotePeerId);
      meta.polite = me > remotePeerId;

      const pcConfig: RTCConfiguration = {
        iceServers: iceServersRef.current,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
        iceCandidatePoolSize: 4,
      };
      if (preferRelayRef.current) {
        pcConfig.iceTransportPolicy = "relay";
      }
      pc = new RTCPeerConnection(pcConfig);
      pcsRef.current.set(remotePeerId, pc);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        queueOutIce(remotePeerId, ev.candidate.toJSON());
      };

      pc.ontrack = (ev) => {
        const stream =
          ev.streams[0] ??
          (() => {
            const s = new MediaStream();
            s.addTrack(ev.track);
            return s;
          })();
        upsertRemote(remotePeerId, stream);
        const m = metaFor(remotePeerId);
        m.mediaUp = true;
        clearEscalate(remotePeerId);
      };

      pc.onnegotiationneeded = () => {
        if (!isPublisherRef.current || !localStreamRef.current) return;
        const m = metaFor(remotePeerId);
        if (m.makingOffer || pc.signalingState !== "stable") return;
        void (async () => {
          m.makingOffer = true;
          try {
            attachLocalTracks(pc);
            const offer = await pc.createOffer();
            if (pc.signalingState !== "stable") return;
            await pc.setLocalDescription(offer);
            await sendSignal(remotePeerId, "offer", offer);
          } catch (error) {
            console.error("[live-rtc] negotiationneeded", error);
          } finally {
            m.makingOffer = false;
          }
        })();
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          const m = metaFor(remotePeerId);
          m.mediaUp = true;
          clearEscalate(remotePeerId);
        }
        if (state === "failed") {
          void sendIceRestart(remotePeerId, pc).then(() => {
            // Si toujours failed après restart → teardown + reconnect
            window.setTimeout(() => {
              if (pcsRef.current.get(remotePeerId)?.connectionState === "failed") {
                tearDownPc(remotePeerId, true);
              }
            }, 4_000);
          });
        }
        if (state === "closed") {
          tearDownPc(remotePeerId, false);
        }
      };

      armEscalate(remotePeerId, pc);
      return pc;
    },
    [
      armEscalate,
      attachLocalTracks,
      clearEscalate,
      metaFor,
      queueOutIce,
      sendIceRestart,
      sendSignal,
      tearDownPc,
      upsertRemote,
    ],
  );

  const handleSignal = useCallback(
    async (sig: LiveRtcSignalPublic) => {
      const me = peerIdRef.current;
      const from = sig.fromPeerId;
      if (!me || !from || from === me) return;
      if (sig.id) {
        if (seenSignalIds.current.has(sig.id)) return;
        seenSignalIds.current.add(sig.id);
        if (seenSignalIds.current.size > 400) {
          seenSignalIds.current = new Set(
            [...seenSignalIds.current].slice(-200),
          );
        }
      }
      const meta = metaFor(from);

      try {
        if (sig.kind === "offer") {
          const pc = ensurePc(from);
          const offerCollision =
            meta.makingOffer || pc.signalingState !== "stable";
          meta.ignoreOffer = !meta.polite && offerCollision;
          if (meta.ignoreOffer) return;

          if (isPublisherRef.current) attachLocalTracks(pc);
          await pc.setRemoteDescription(
            new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit),
          );
          await flushIce(from, pc);
          if (isPublisherRef.current) attachLocalTracks(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(from, "answer", answer);
        } else if (sig.kind === "answer") {
          const pc = pcsRef.current.get(from) ?? ensurePc(from);
          if (
            pc.signalingState === "have-local-offer" ||
            pc.signalingState === "have-remote-offer"
          ) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(
                sig.payload as RTCSessionDescriptionInit,
              ),
            );
            await flushIce(from, pc);
          }
        } else if (sig.kind === "ice") {
          const pc = pcsRef.current.get(from) ?? ensurePc(from);
          await applyIcePayload(from, pc, sig.payload);
        }
      } catch (error) {
        console.error("[live-rtc] signal", sig.kind, error);
      }
    },
    [
      applyIcePayload,
      attachLocalTracks,
      ensurePc,
      flushIce,
      metaFor,
      sendSignal,
    ],
  );
  handleSignalRef.current = handleSignal;

  useEffect(() => {
    if (!enabled || !peerId) {
      setIceReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        iceServersRef.current = await buildClientFallbackIceServers(peerId);
        if (!cancelled) setIceReady(true);
      } catch {
        iceServersRef.current = LIVE_RTC_ICE_SERVERS;
        if (!cancelled) setIceReady(true);
      }
      const { res, data } = await fetchJson<{
        iceServers?: RTCIceServer[];
        preferRelay?: boolean;
      }>("/api/growth/lives/ice");
      if (cancelled || !res.ok) return;
      if (data?.preferRelay) preferRelayRef.current = true;
      if (data?.iceServers?.length) {
        iceServersRef.current = sortLiveIceServers(
          data.iceServers as RTCIceServer[],
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, peerId]);

  // SSE signaling — seule source de vérité
  useEffect(() => {
    if (!enabled || !peerId) return;
    const ac = new AbortController();
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function run() {
      while (!cancelled) {
        try {
          const res = await fetch(
            `/api/growth/lives/${liveId}/rtc?peerId=${encodeURIComponent(peerId!)}`,
            {
              signal: ac.signal,
              credentials: "include",
              headers: { Accept: "text/event-stream" },
            },
          );
          if (!res.ok || !res.body) {
            await new Promise((r) => {
              retryTimer = setTimeout(r, LIVE_RTC_SSE_RETRY_MS);
            });
            continue;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (!cancelled) {
            let chunk: ReadableStreamReadResult<Uint8Array>;
            try {
              chunk = await reader.read();
            } catch (error) {
              // Turbopack / abort : "Error in input stream"
              if (
                cancelled ||
                (error instanceof TypeError &&
                  /input stream|abort/i.test(String(error.message)))
              ) {
                break;
              }
              throw error;
            }
            const { done, value } = chunk;
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop() ?? "";
            for (const block of parts) {
              const lines = block.split("\n");
              let event = "message";
              let data = "";
              for (const line of lines) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                if (line.startsWith("data:")) data += line.slice(5).trim();
              }
              if (event === "signals" && data) {
                try {
                  const parsed = JSON.parse(data) as {
                    signals?: LiveRtcSignalPublic[];
                  };
                  for (const sig of parsed.signals ?? []) {
                    await handleSignalRef.current(sig);
                  }
                } catch {
                  /* ignore */
                }
              }
            }
          }
          try {
            reader.releaseLock();
          } catch {
            /* ignore */
          }
        } catch (error) {
          if (
            cancelled ||
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof TypeError &&
              /input stream|abort|network/i.test(String(error.message)))
          ) {
            if (cancelled) break;
          } else {
            console.error("[live-rtc] sse", error);
          }
        }
        if (cancelled) break;
        await new Promise((r) => {
          retryTimer = setTimeout(r, LIVE_RTC_SSE_RETRY_MS);
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
      ac.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, peerId, liveId, reconnectKey]);

  // Soft refresh : tout démonter puis reconnectNonce force les offres
  useEffect(() => {
    if (!reconnectKey) return;
    for (const id of [...pcsRef.current.keys()]) {
      tearDownPc(id, false);
    }
    seenSignalIds.current.clear();
    setRemoteStreams({});
    setReconnectNonce((n) => n + 1);
  }, [reconnectKey, tearDownPc]);

  // Offres mesh
  useEffect(() => {
    if (!enabled || !peerId || !iceReady) return;
    const me = peerId;
    let cancelled = false;

    async function connectAll() {
      for (const pub of publishers) {
        if (cancelled) return;
        if (pub.peerId === me) continue;
        const iOffer = !isPublisher || me < pub.peerId;
        if (!iOffer) continue;
        if (pcsRef.current.has(pub.peerId)) continue;
        const meta = metaFor(pub.peerId);
        if (meta.makingOffer) continue;
        meta.makingOffer = true;
        try {
          const pc = ensurePc(pub.peerId);
          if (pc.getTransceivers().length === 0) {
            const dir = isPublisher ? "sendrecv" : "recvonly";
            pc.addTransceiver("video", { direction: dir });
            pc.addTransceiver("audio", { direction: dir });
          }
          if (isPublisher) attachLocalTracks(pc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(pub.peerId, "offer", offer);
        } catch (error) {
          console.error("[live-rtc] offer", error);
          tearDownPc(pub.peerId, false);
        } finally {
          meta.makingOffer = false;
        }
      }
      const pubIds = new Set(publishers.map((p) => p.peerId));
      for (const id of [...pcsRef.current.keys()]) {
        if (!isPublisher && !pubIds.has(id)) {
          tearDownPc(id, false);
        }
      }
    }

    void connectAll();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    peerId,
    iceReady,
    isPublisher,
    publishers,
    reconnectNonce,
    ensurePc,
    sendSignal,
    attachLocalTracks,
    metaFor,
    tearDownPc,
  ]);

  useEffect(() => {
    if (!enabled || !isPublisher || !localStream) return;
    for (const pc of pcsRef.current.values()) {
      attachLocalTracks(pc);
    }
  }, [enabled, isPublisher, localStream, attachLocalTracks]);

  useEffect(() => {
    return () => {
      for (const id of [...pcsRef.current.keys()]) {
        tearDownPc(id, false);
      }
      seenSignalIds.current.clear();
      setRemoteStreams({});
      setIceReady(false);
    };
  }, [liveId, tearDownPc]);

  return { remoteStreams };
}
