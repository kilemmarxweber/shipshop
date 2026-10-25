"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalTrackPublication,
} from "livekit-client";
import { fetchJson } from "@/lib/fetch-json";

type RemoteStreamMap = Record<string, MediaStream>;

type SfuTokenPayload = {
  token?: string;
  url?: string;
  identity?: string;
  canPublish?: boolean;
  error?: string;
  sfu?: boolean;
};

function addRemoteTrack(
  prev: RemoteStreamMap,
  identity: string,
  mediaTrack: MediaStreamTrack,
): RemoteStreamMap {
  const existing = prev[identity];
  if (existing) {
    for (const t of existing.getTracks()) {
      if (t.kind === mediaTrack.kind) existing.removeTrack(t);
    }
    existing.addTrack(mediaTrack);
    return { ...prev, [identity]: existing };
  }
  return { ...prev, [identity]: new MediaStream([mediaTrack]) };
}

function removeRemoteTrack(
  prev: RemoteStreamMap,
  identity: string,
  mediaTrack: MediaStreamTrack,
): RemoteStreamMap {
  const existing = prev[identity];
  if (!existing) return prev;
  try {
    existing.removeTrack(mediaTrack);
  } catch {
    /* already gone */
  }
  if (existing.getTracks().length === 0) {
    const next = { ...prev };
    delete next[identity];
    return next;
  }
  return { ...prev, [identity]: existing };
}

/**
 * LiveKit SFU — host/guests publient une fois ; viewers s’abonnent.
 * Même contrat que useLiveRtc : remoteStreams[userId] = MediaStream.
 */
export function useLiveSfu(opts: {
  liveId: string;
  peerId: string | null;
  isPublisher: boolean;
  localStream: MediaStream | null;
  enabled: boolean;
  /** Change → reconnexion SFU (refresh live sans reload page). */
  reconnectKey?: number;
}) {
  const {
    liveId,
    peerId,
    isPublisher,
    localStream,
    enabled,
    reconnectKey = 0,
  } = opts;
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamMap>({});
  const [failed, setFailed] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const publishedIdsRef = useRef<Set<string>>(new Set());
  const publishLockRef = useRef<Promise<void>>(Promise.resolve());
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const isPublisherRef = useRef(isPublisher);
  isPublisherRef.current = isPublisher;
  const failRef = useRef<(reason: string, error?: unknown) => void>(() => {});

  useEffect(() => {
    if (!enabled || !peerId || !liveId) {
      setFailed(false);
      return;
    }

    let cancelled = false;
    setFailed(false);
    publishedIdsRef.current.clear();
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const markFailed = (reason: string, error?: unknown) => {
      if (cancelled) return;
      console.warn(`[use-live-sfu] ${reason}`, error ?? "");
      setFailed(true);
      void room.disconnect();
    };
    failRef.current = markFailed;

    const onSubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) {
        return;
      }
      const media = track.mediaStreamTrack;
      if (!media) return;
      setRemoteStreams((prev) =>
        addRemoteTrack(prev, participant.identity, media),
      );
    };

    const onUnsubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      const media = track.mediaStreamTrack;
      if (!media) return;
      setRemoteStreams((prev) =>
        removeRemoteTrack(prev, participant.identity, media),
      );
    };

    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      setRemoteStreams((prev) => {
        if (!prev[participant.identity]) return prev;
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    };

    const ingestExisting = () => {
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          if (pub.isSubscribed && pub.track) {
            onSubscribed(pub.track, pub, p);
          }
        }
      }
    };

    async function unpublishAll(r: Room) {
      for (const pub of [
        ...r.localParticipant.trackPublications.values(),
      ] as LocalTrackPublication[]) {
        if (pub.track) {
          try {
            await r.localParticipant.unpublishTrack(pub.track);
          } catch {
            /* ignore */
          }
        }
      }
      publishedIdsRef.current.clear();
    }

    /** Publie les tracks locales ; sérialisé (évite double publish Connected + connect). */
    function syncPublish(r: Room) {
      const run = async () => {
        if (cancelled || r.state !== ConnectionState.Connected) return;
        if (!isPublisherRef.current) {
          await unpublishAll(r);
          return;
        }
        const stream = localStreamRef.current;
        if (!stream?.active) {
          // Course getUserMedia : ne pas démonter les pubs existantes
          return;
        }

        const wantIds = new Set(stream.getTracks().map((t) => t.id));
        for (const pub of [
          ...r.localParticipant.trackPublications.values(),
        ] as LocalTrackPublication[]) {
          const tid = pub.track?.mediaStreamTrack?.id;
          if (tid && !wantIds.has(tid)) {
            await r.localParticipant.unpublishTrack(pub.track!);
            publishedIdsRef.current.delete(tid);
          }
        }

        for (const track of stream.getTracks()) {
          if (cancelled) return;
          if (publishedIdsRef.current.has(track.id)) continue;
          if (track.readyState === "ended") continue;
          // Déjà publié côté LiveKit (autre id local) ?
          const already = [
            ...r.localParticipant.trackPublications.values(),
          ].some((p) => p.track?.mediaStreamTrack?.id === track.id);
          if (already) {
            publishedIdsRef.current.add(track.id);
            continue;
          }
          try {
            await r.localParticipant.publishTrack(track, {
              source:
                track.kind === "video"
                  ? Track.Source.Camera
                  : Track.Source.Microphone,
            });
            publishedIdsRef.current.add(track.id);
          } catch (error) {
            // Timeout / serveur muet → bascule mesh (page.tsx sfuGaveUp)
            markFailed("publish", error);
            return;
          }
        }
      };

      publishLockRef.current = publishLockRef.current
        .then(run, run)
        .catch(() => {});
      return publishLockRef.current;
    }

    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.Disconnected, () => {
        publishedIdsRef.current.clear();
      })
      .on(RoomEvent.TrackPublished, () => {
        ingestExisting();
      });

    async function connect() {
      const { res, data } = await fetchJson<SfuTokenPayload>(
        `/api/growth/lives/${liveId}/sfu-token`,
      );
      if (cancelled) return;
      if (!res.ok || !data?.token || !data.url) {
        markFailed("token", data?.error ?? res.status);
        return;
      }

      try {
        await room.connect(data.url, data.token);
      } catch (error) {
        markFailed("connect", error);
        return;
      }
      if (cancelled) {
        await room.disconnect();
        return;
      }

      ingestExisting();
      // Un seul syncPublish ici (pas aussi sur RoomEvent.Connected)
      await syncPublish(room);
    }

    void connect();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      publishedIdsRef.current.clear();
      setRemoteStreams({});
      void room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [enabled, peerId, liveId, reconnectKey]);

  // Republier quand le stream local / rôle publisher change
  useEffect(() => {
    const room = roomRef.current;
    if (!enabled || !room) return;
    if (room.state !== ConnectionState.Connected) return;

    let cancelled = false;
    void (async () => {
      // Attendre un éventuel publish en cours (connect)
      await publishLockRef.current;
      if (cancelled) return;

      if (!isPublisher) {
        for (const pub of [
          ...room.localParticipant.trackPublications.values(),
        ] as LocalTrackPublication[]) {
          if (pub.track) {
            try {
              await room.localParticipant.unpublishTrack(pub.track);
            } catch {
              /* ignore */
            }
          }
        }
        publishedIdsRef.current.clear();
        return;
      }

      // Stream pas encore là → retry court (évite trou A/V au go-live)
      if (!localStream?.active) {
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled || !localStreamRef.current?.active) return;
      }
      const stream = localStreamRef.current;
      if (!stream?.active || cancelled) return;
      if (room.state !== ConnectionState.Connected) return;

      const wantIds = new Set(stream.getTracks().map((t) => t.id));
      for (const pub of [
        ...room.localParticipant.trackPublications.values(),
      ] as LocalTrackPublication[]) {
        const tid = pub.track?.mediaStreamTrack?.id;
        if (tid && !wantIds.has(tid)) {
          await room.localParticipant.unpublishTrack(pub.track!);
          publishedIdsRef.current.delete(tid);
        }
      }
      if (cancelled) return;

      for (const track of stream.getTracks()) {
        if (publishedIdsRef.current.has(track.id)) continue;
        if (track.readyState === "ended") continue;
        const already = [
          ...room.localParticipant.trackPublications.values(),
        ].some((p) => p.track?.mediaStreamTrack?.id === track.id);
        if (already) {
          publishedIdsRef.current.add(track.id);
          continue;
        }
        try {
          await room.localParticipant.publishTrack(track, {
            source:
              track.kind === "video"
                ? Track.Source.Camera
                : Track.Source.Microphone,
          });
          publishedIdsRef.current.add(track.id);
        } catch (error) {
          failRef.current("republish", error);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, isPublisher, localStream]);

  return { remoteStreams, failed };
}
