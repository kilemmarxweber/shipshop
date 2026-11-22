"use client";

import {
  poseFromMediaPipeLandmarks,
  type FaceLandmarkPoint,
  type FacePose,
} from "@/lib/growth/live-face-tracking";

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type FaceLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>> };
  close: () => void;
};

let landmarkerPromise: Promise<FaceLandmarkerLike | null> | null = null;

async function getFaceLandmarker(): Promise<FaceLandmarkerLike | null> {
  if (typeof window === "undefined") return null;
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
        try {
          return await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.45,
            minFacePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
        } catch {
          return await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
          });
        }
      } catch {
        landmarkerPromise = null;
        return null;
      }
    })();
  }
  return landmarkerPromise;
}

/**
 * Boucle rAF : lit le <video> Live (même flux, pas de 2e caméra) → FacePose.
 * Retourne une fonction stop.
 */
export function startVideoFaceTracking(
  video: HTMLVideoElement,
  onPose: (pose: FacePose | null) => void,
): () => void {
  let stopped = false;
  let raf = 0;
  let lastVideoTime = -1;
  let landmarker: FaceLandmarkerLike | null = null;

  const tick = () => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (!landmarker) return;
    if (video.readyState < 2) return;
    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    try {
      const result = landmarker.detectForVideo(video, performance.now());
      const lm = result.faceLandmarks?.[0];
      if (!lm || lm.length < 468) {
        onPose(null);
        return;
      }
      const points: FaceLandmarkPoint[] = lm.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
      }));
      onPose(poseFromMediaPipeLandmarks(points, Date.now()));
    } catch {
      onPose(null);
    }
  };

  void getFaceLandmarker().then((lm) => {
    if (stopped) return;
    landmarker = lm;
    raf = requestAnimationFrame(tick);
  });

  return () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
  };
}
