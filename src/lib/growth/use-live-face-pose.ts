"use client";

import { useEffect, useState } from "react";

import {
  FacePoseSmoother,
  idleStudioPose,
  poseFromMediaPipeLandmarks,
  type FaceLandmarkPoint,
  type FacePose,
} from "@/lib/growth/live-face-tracking";

/**
 * Pose faciale pour overlays Live web.
 * Sans MediaPipe : idle studio lissé. `ingestLandmarks` prêt pour Face Landmarker.
 */
export function useLiveFacePose(opts?: {
  enabled?: boolean;
  hz?: number;
  seed?: number;
}) {
  const enabled = opts?.enabled ?? true;
  const hz = opts?.hz ?? 24;
  const seed = opts?.seed ?? 0;
  const [smoother] = useState(() => new FacePoseSmoother());
  const [pose, setPose] = useState<FacePose>(() =>
    idleStudioPose(Date.now(), seed),
  );

  useEffect(() => {
    if (!enabled) return;
    const ms = Math.max(33, Math.round(1000 / hz));
    const id = setInterval(() => {
      setPose(smoother.push(idleStudioPose(Date.now(), seed)));
    }, ms);
    return () => clearInterval(id);
  }, [enabled, hz, seed, smoother]);

  function ingestLandmarks(
    landmarks: FaceLandmarkPoint[],
    timestamp = Date.now(),
  ) {
    const raw = poseFromMediaPipeLandmarks(landmarks, timestamp);
    if (!raw) return;
    setPose(smoother.push(raw));
  }

  function ingestPose(raw: FacePose) {
    setPose(smoother.push(raw));
  }

  function reset() {
    smoother.reset();
    setPose(idleStudioPose(Date.now(), seed));
  }

  return { pose, ingestLandmarks, ingestPose, reset };
}
