/**
 * Tracking visage pour filtres Live / Studio AR.
 * Coordonnées normalisées 0–1 (origine haut-gauche de la frame vidéo).
 *
 * MediaPipe Face Landmarker peut injecter des landmarks via
 * `poseFromMediaPipeLandmarks` — sans double capture caméra LiveKit.
 */

export type Vec2 = { x: number; y: number };

export type FaceLandmarkPoint = Vec2 & { z?: number };

export type FacePose = {
  /** Confiance 0–1 ; < 0.35 → masquer accessoires. */
  confidence: number;
  timestamp: number;
  center: Vec2;
  width: number;
  height: number;
  /** Radians : + = tête penchée vers la droite de l’écran. */
  roll: number;
  /** Radians : + = tourné vers sa gauche (oreille droite visible). */
  yaw: number;
  /** Radians : + = menton relevé. */
  pitch: number;
  headTop: Vec2;
  leftEye: Vec2;
  rightEye: Vec2;
  nose: Vec2;
  leftEar: Vec2;
  rightEar: Vec2;
  /** Oreille masquée par la tête (occlusion). */
  leftEarVisible: boolean;
  rightEarVisible: boolean;
};

export type FaceAnchorId =
  | "head"
  | "eyes"
  | "nose"
  | "face"
  | "earLeft"
  | "earRight";

export type FaceAnchorStyle = {
  left: `${number}%`;
  top: `${number}%`;
  transform: Array<
    | { translateX: number }
    | { translateY: number }
    | { rotate: string }
    | { scaleX: number }
    | { scaleY: number }
    | { scale: number }
  >;
  opacity: number;
  visible: boolean;
};

/** Pose selfie studio par défaut (cadrage vertical typique, visage assez grand). */
export function defaultFacePose(now = Date.now()): FacePose {
  return {
    confidence: 0.88,
    timestamp: now,
    center: { x: 0.5, y: 0.4 },
    width: 0.52,
    height: 0.58,
    roll: 0,
    yaw: 0,
    pitch: 0,
    headTop: { x: 0.5, y: 0.1 },
    leftEye: { x: 0.36, y: 0.34 },
    rightEye: { x: 0.64, y: 0.34 },
    nose: { x: 0.5, y: 0.45 },
    leftEar: { x: 0.18, y: 0.4 },
    rightEar: { x: 0.82, y: 0.4 },
    leftEarVisible: true,
    rightEarVisible: true,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Filtre One Euro simplifié (basse latence + anti-tremblement). */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private minCutoff = 1.2,
    private beta = 0.045,
    private dCutoff = 1,
  ) {}

  filter(x: number, t: number): number {
    if (this.tPrev == null || this.xPrev == null) {
      this.tPrev = t;
      this.xPrev = x;
      return x;
    }
    const dt = Math.max(1e-3, (t - this.tPrev) / 1000);
    const dx = (x - this.xPrev) / dt;
    const edx = this.expSmooth(dx, this.dxPrev, this.alpha(dt, this.dCutoff));
    this.dxPrev = edx;
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const filtered = this.expSmooth(x, this.xPrev, this.alpha(dt, cutoff));
    this.xPrev = filtered;
    this.tPrev = t;
    return filtered;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  private alpha(dt: number, cutoff: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  private expSmooth(x: number, prev: number, a: number) {
    return a * x + (1 - a) * prev;
  }
}

export class FacePoseSmoother {
  private filters = {
    cx: new OneEuroFilter(),
    cy: new OneEuroFilter(),
    w: new OneEuroFilter(0.9, 0.03),
    h: new OneEuroFilter(0.9, 0.03),
    roll: new OneEuroFilter(1.5, 0.02),
    yaw: new OneEuroFilter(1.5, 0.02),
    pitch: new OneEuroFilter(1.5, 0.02),
  };
  private last: FacePose | null = null;
  private holdUntil = 0;

  /** Applique une mesure brute ; conserve brièvement la dernière pose fiable. */
  push(raw: FacePose): FacePose {
    const t = raw.timestamp;
    if (raw.confidence < 0.28) {
      if (this.last && t < this.holdUntil) {
        const fade = clamp((this.holdUntil - t) / 450, 0, 1);
        return {
          ...this.last,
          confidence: this.last.confidence * fade * 0.85,
          timestamp: t,
        };
      }
      this.last = null;
      return { ...defaultFacePose(t), confidence: 0 };
    }

    const smoothed: FacePose = {
      ...raw,
      center: {
        x: this.filters.cx.filter(raw.center.x, t),
        y: this.filters.cy.filter(raw.center.y, t),
      },
      width: this.filters.w.filter(raw.width, t),
      height: this.filters.h.filter(raw.height, t),
      roll: this.filters.roll.filter(raw.roll, t),
      yaw: this.filters.yaw.filter(raw.yaw, t),
      pitch: this.filters.pitch.filter(raw.pitch, t),
      headTop: raw.headTop,
      leftEye: raw.leftEye,
      rightEye: raw.rightEye,
      nose: raw.nose,
      leftEar: raw.leftEar,
      rightEar: raw.rightEar,
      leftEarVisible: raw.yaw > -0.55,
      rightEarVisible: raw.yaw < 0.55,
    };

    // Recalcule ancres à partir du centre/taille lissés + orientation.
    const rebuilt = rebuildAnchors(smoothed);
    this.last = rebuilt;
    this.holdUntil = t + 420;
    return rebuilt;
  }

  reset() {
    Object.values(this.filters).forEach((f) => f.reset());
    this.last = null;
    this.holdUntil = 0;
  }
}

function rebuildAnchors(pose: FacePose): FacePose {
  const { center, width, height, yaw, pitch, roll } = pose;
  const halfW = width / 2;
  const halfH = height / 2;
  const yawShift = Math.sin(yaw) * halfW * 0.55;
  const pitchShift = Math.sin(pitch) * halfH * 0.35;

  const headTop = rotateAround(
    { x: center.x + yawShift * 0.15, y: center.y - halfH * 1.08 + pitchShift },
    center,
    roll,
  );
  const leftEye = rotateAround(
    {
      x: center.x - halfW * 0.34 + yawShift,
      y: center.y - halfH * 0.22 + pitchShift,
    },
    center,
    roll,
  );
  const rightEye = rotateAround(
    {
      x: center.x + halfW * 0.34 + yawShift,
      y: center.y - halfH * 0.22 + pitchShift,
    },
    center,
    roll,
  );
  const nose = rotateAround(
    { x: center.x + yawShift * 0.5, y: center.y + halfH * 0.05 + pitchShift },
    center,
    roll,
  );
  const leftEar = rotateAround(
    {
      x: center.x - halfW * 0.98 + yawShift * 0.3,
      y: center.y + halfH * 0.02 + pitchShift * 0.4,
    },
    center,
    roll,
  );
  const rightEar = rotateAround(
    {
      x: center.x + halfW * 0.98 + yawShift * 0.3,
      y: center.y + halfH * 0.02 + pitchShift * 0.4,
    },
    center,
    roll,
  );

  return {
    ...pose,
    headTop,
    leftEye,
    rightEye,
    nose,
    leftEar,
    rightEar,
    leftEarVisible: pose.yaw > -0.55,
    rightEarVisible: pose.yaw < 0.55,
  };
}

function rotateAround(point: Vec2, origin: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * c - dy * s,
    y: origin.y + dx * s + dy * c,
  };
}

/**
 * Indices MediaPipe Face Landmarker (478) utiles pour les ancres Live.
 * https://developers.google.com/mediapipe/solutions/vision/face_landmarker
 */
const MP = {
  nose: 1,
  leftEye: 33,
  rightEye: 263,
  leftEar: 234,
  rightEar: 454,
  forehead: 10,
  chin: 152,
} as const;

export function poseFromMediaPipeLandmarks(
  landmarks: FaceLandmarkPoint[],
  timestamp = Date.now(),
): FacePose | null {
  if (landmarks.length < 468) return null;
  const get = (i: number) => landmarks[i];
  const nose = get(MP.nose);
  const leftEye = get(MP.leftEye);
  const rightEye = get(MP.rightEye);
  const leftEar = get(MP.leftEar);
  const rightEar = get(MP.rightEar);
  const forehead = get(MP.forehead);
  const chin = get(MP.chin);
  if (
    !nose ||
    !leftEye ||
    !rightEye ||
    !leftEar ||
    !rightEar ||
    !forehead ||
    !chin
  ) {
    return null;
  }

  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const faceH = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  const width = clamp(eyeDist * 2.35, 0.18, 0.85);
  const height = clamp(faceH * 1.35, 0.22, 0.95);
  const center = {
    x: (leftEye.x + rightEye.x + nose.x) / 3,
    y: (forehead.y + chin.y) / 2,
  };
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const yaw = clamp(((leftEar.z ?? 0) - (rightEar.z ?? 0)) * 1.8, -1.1, 1.1);
  const pitch = clamp(((nose.y - center.y) / height) * 2.2, -0.9, 0.9);

  return rebuildAnchors({
    confidence: 0.95,
    timestamp,
    center,
    width,
    height,
    roll,
    yaw,
    pitch,
    headTop: forehead,
    leftEye,
    rightEye,
    nose,
    leftEar,
    rightEar,
    leftEarVisible: true,
    rightEarVisible: true,
  });
}

/** Micro-mouvement naturel quand aucun détecteur n’est branché (pas de double caméra). */
export function idleStudioPose(now = Date.now(), seed = 0): FacePose {
  const base = defaultFacePose(now);
  const t = now / 1000 + seed;
  const yaw = Math.sin(t * 0.55) * 0.06;
  const pitch = Math.sin(t * 0.4 + 1.2) * 0.04;
  const roll = Math.sin(t * 0.33) * 0.03;
  const breathe = 1 + Math.sin(t * 1.1) * 0.012;
  return rebuildAnchors({
    ...base,
    confidence: 0.78,
    width: base.width * breathe,
    height: base.height * breathe,
    yaw,
    pitch,
    roll,
    center: {
      x: base.center.x + Math.sin(t * 0.5) * 0.006,
      y: base.center.y + Math.cos(t * 0.45) * 0.005,
    },
  });
}

export type FacePosePacket = {
  c: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  ya: number;
  p: number;
};

export function encodeFacePose(pose: FacePose): FacePosePacket {
  return {
    c: Math.round(pose.confidence * 100) / 100,
    x: Math.round(pose.center.x * 1000) / 1000,
    y: Math.round(pose.center.y * 1000) / 1000,
    w: Math.round(pose.width * 1000) / 1000,
    h: Math.round(pose.height * 1000) / 1000,
    r: Math.round(pose.roll * 1000) / 1000,
    ya: Math.round(pose.yaw * 1000) / 1000,
    p: Math.round(pose.pitch * 1000) / 1000,
  };
}

export function decodeFacePose(
  packet: FacePosePacket,
  timestamp = Date.now(),
): FacePose {
  return rebuildAnchors({
    confidence: clamp(packet.c, 0, 1),
    timestamp,
    center: { x: packet.x, y: packet.y },
    width: packet.w,
    height: packet.h,
    roll: packet.r,
    yaw: packet.ya,
    pitch: packet.p,
    headTop: { x: packet.x, y: packet.y },
    leftEye: { x: packet.x, y: packet.y },
    rightEye: { x: packet.x, y: packet.y },
    nose: { x: packet.x, y: packet.y },
    leftEar: { x: packet.x, y: packet.y },
    rightEar: { x: packet.x, y: packet.y },
    leftEarVisible: true,
    rightEarVisible: true,
  });
}

export function parseFacePosePayload(raw: string): FacePosePacket | null {
  try {
    const data = JSON.parse(raw) as Partial<FacePosePacket>;
    if (
      typeof data.c !== "number" ||
      typeof data.x !== "number" ||
      typeof data.y !== "number" ||
      typeof data.w !== "number" ||
      typeof data.h !== "number"
    ) {
      return null;
    }
    return {
      c: data.c,
      x: data.x,
      y: data.y,
      w: data.w,
      h: data.h,
      r: typeof data.r === "number" ? data.r : 0,
      ya: typeof data.ya === "number" ? data.ya : 0,
      p: typeof data.p === "number" ? data.p : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Taille accessoire en % de largeur conteneur (cqw).
 * Lunettes ≈ 2.85× écart inter-pupillaire ; chapeau ≈ 1.4× largeur visage.
 */
export function propSizeCqw(
  pose: FacePose,
  anchor: FaceAnchorId,
  scale = 1,
): number {
  const eye = eyeDistance(pose);
  if (anchor === "eyes") {
    return clamp(eye * 285 * scale, 42, 68);
  }
  if (anchor === "head") {
    return clamp(pose.width * 140 * scale, 48, 72);
  }
  if (anchor === "earLeft" || anchor === "earRight") {
    return clamp(pose.width * 55 * scale, 22, 36);
  }
  return clamp(pose.width * 95 * scale, 36, 52);
}

export function midEyesPoint(pose: FacePose): Vec2 {
  return {
    x: (pose.leftEye.x + pose.rightEye.x) / 2,
    y: (pose.leftEye.y + pose.rightEye.y) / 2,
  };
}

export function anchorStyleFor(
  pose: FacePose,
  anchor: FaceAnchorId,
  _scale = 1,
  soft = 1,
  fontSize = 42,
): FaceAnchorStyle {
  const conf = pose.confidence;
  const visible = conf >= 0.35;
  const opacity = visible ? clamp(conf * soft, 0, 1) : 0;
  const rot = `${(pose.roll * 180) / Math.PI}deg`;
  const half = fontSize / 2;

  let point: Vec2 = pose.center;
  let tx = -half;
  let ty = -half;
  let earHide = false;
  let scaleX = 1;
  let scaleY = 1;

  if (anchor === "head") {
    point = pose.headTop;
    tx = -half;
    ty = -fontSize * 0.92;
    scaleX = 1.08;
    scaleY = 1.02;
  } else if (anchor === "eyes") {
    point = midEyesPoint(pose);
    tx = -half;
    ty = -fontSize * 0.42;
    scaleX = clamp(eyeDistance(pose) / 0.22, 1.05, 1.55);
    scaleY = 0.92;
  } else if (anchor === "nose") {
    point = pose.nose;
    tx = -half;
    ty = -half * 0.7;
  } else if (anchor === "earLeft") {
    point = pose.leftEar;
    earHide = !pose.leftEarVisible;
    tx = -half * 0.7;
    ty = -half * 0.7;
  } else if (anchor === "earRight") {
    point = pose.rightEar;
    earHide = !pose.rightEarVisible;
    tx = -half * 0.7;
    ty = -half * 0.7;
  } else {
    point = pose.center;
  }

  return {
    left: `${point.x * 100}%` as `${number}%`,
    top: `${point.y * 100}%` as `${number}%`,
    transform: [
      { translateX: tx },
      { translateY: ty },
      { rotate: rot },
      { scaleX },
      { scaleY },
    ],
    opacity: earHide ? 0 : opacity,
    visible: visible && !earHide,
  };
}

export function eyeDistance(pose: FacePose) {
  return Math.hypot(
    pose.rightEye.x - pose.leftEye.x,
    pose.rightEye.y - pose.leftEye.y,
  );
}

/** Blend entre deux poses (interpolation quaternions approx via angles). */
export function blendFacePose(a: FacePose, b: FacePose, t: number): FacePose {
  const k = clamp(t, 0, 1);
  return rebuildAnchors({
    confidence: lerp(a.confidence, b.confidence, k),
    timestamp: b.timestamp,
    center: lerpVec(a.center, b.center, k),
    width: lerp(a.width, b.width, k),
    height: lerp(a.height, b.height, k),
    roll: lerp(a.roll, b.roll, k),
    yaw: lerp(a.yaw, b.yaw, k),
    pitch: lerp(a.pitch, b.pitch, k),
    headTop: a.headTop,
    leftEye: a.leftEye,
    rightEye: a.rightEye,
    nose: a.nose,
    leftEar: a.leftEar,
    rightEar: a.rightEar,
    leftEarVisible: b.leftEarVisible,
    rightEarVisible: b.rightEarVisible,
  });
}
