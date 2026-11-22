"use client";

import { useEffect, useRef, useState } from "react";

import {
  FacePoseSmoother,
  idleStudioPose,
  type FacePose,
} from "@/lib/growth/live-face-tracking";
import { startVideoFaceTracking } from "@/lib/growth/mediapipe-face-landmarker";

/**
 * Pose faciale pour overlays Live web.
 * Si `video` est fourni : MediaPipe Face Landmarker sur le même flux (pas de 2e caméra).
 * Sinon : idle studio (fallback).
 */
export function useLiveFacePose(opts?: {
  enabled?: boolean;
  hz?: number;
  seed?: number;
  /** Élément <video> local (host) pour détection réelle. */
  video?: HTMLVideoElement | null;
}) {
  const enabled = opts?.enabled ?? true;
  const hz = opts?.hz ?? 24;
  const seed = opts?.seed ?? 0;
  const video = opts?.video ?? null;
  const [smoother] = useState(() => new FacePoseSmoother());
  const [pose, setPose] = useState<FacePose>(() =>
    idleStudioPose(Date.now(), seed),
  );
  const trackedUntil = useRef(0);

  // MediaPipe sur la vidéo host
  useEffect(() => {
    if (!enabled || !video) return;
    const stop = startVideoFaceTracking(video, (raw) => {
      if (!raw) {
        // Perte courte : le smoother gère le hold via confidence basse
        setPose(
          smoother.push({
            ...idleStudioPose(Date.now(), seed),
            confidence: 0.1,
            tracked: false,
          }),
        );
        return;
      }
      trackedUntil.current = Date.now() + 600;
      setPose(smoother.push(raw));
    });
    return stop;
  }, [enabled, video, seed, smoother]);

  // Idle uniquement si pas de tracking vidéo actif
  useEffect(() => {
    if (!enabled) return;
    if (video) return;
    const ms = Math.max(33, Math.round(1000 / hz));
    const id = setInterval(() => {
      if (Date.now() < trackedUntil.current) return;
      setPose(smoother.push(idleStudioPose(Date.now(), seed)));
    }, ms);
    return () => clearInterval(id);
  }, [enabled, hz, seed, smoother, video]);

  function ingestPose(raw: FacePose) {
    trackedUntil.current = Date.now() + 600;
    setPose(smoother.push(raw));
  }

  function reset() {
    smoother.reset();
    setPose(idleStudioPose(Date.now(), seed));
  }

  return { pose, ingestPose, reset };
}
