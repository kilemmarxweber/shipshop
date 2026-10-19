"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  Blend,
  Check,
  Eraser,
  EyeOff,
  ImageIcon,
  Loader2,
  MousePointer2,
  Pause,
  Pipette,
  Play,
  RotateCcw,
  ScanSearch,
  Search,
  Store,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { isVideoUrl } from "@/lib/media";
import {
  clampSoundtrackStartMs,
  formatClipClock,
  LOCAL_SOUNDTRACK_ID,
  MONTAGE_MAX_MS,
  SOUNDTRACK_SOURCE_MAX_SECONDS,
  SLIDE_MOTIONS,
  encodeSlideMotion,
  parseSlideMotion,
  slideshowWindow,
  type SlideMotion,
} from "@/lib/montage";
import { useAppConfig } from "@/lib/use-app-config";
import { VIDEO_INPUT_MAX_BYTES } from "@/lib/media";
import { uploadCompressedMedia } from "@/lib/compress-media";
import { cn, formatMoney } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Track = {
  id: string;
  title: string;
  artist: string;
  mood: string;
  durationMs: number;
  audioUrl: string;
};

export type LocalMontageClip = {
  file: File;
  audioUrl: string;
  title: string;
  durationMs: number;
};

type OnlineHit = {
  identifier: string;
  title: string;
  artist: string;
  file: string;
};

const AUDIO_INPUT_MAX_BYTES = 25 * 1024 * 1024;

function isVideoLike(file: File) {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|webm|m4v|mkv|avi|3gp)$/i.test(file.name)
  );
}

function isAudioLike(file: File) {
  return (
    file.type.startsWith("audio/") ||
    /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba)$/i.test(file.name)
  );
}

function probeMediaDurationMs(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("audio");
    el.preload = "metadata";
    const done = (ms: number) => {
      el.removeAttribute("src");
      el.load();
      resolve(ms);
    };
    el.onloadedmetadata = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0.4) {
        done(Math.min(Math.round(d * 1000), SOUNDTRACK_SOURCE_MAX_SECONDS * 1000));
        return;
      }
      done(MONTAGE_MAX_MS);
    };
    el.onerror = () => reject(new Error("Fichier audio illisible"));
    el.src = url;
  });
}

type Suggestion = {
  id: string;
  kind: "text" | "logo";
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type Rgb = { r: number; g: number; b: number };
type Tool = "select" | "eraser" | "eyedropper";
type Point = { x: number; y: number };

type Props = {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  soundtrackId: string | null;
  onSoundtrackId: (id: string | null) => void;
  soundtrackStartMs: number;
  onSoundtrackStartMs: (ms: number) => void;
  localClip: LocalMontageClip | null;
  onLocalClip: (clip: LocalMontageClip | null) => void;
  imageMotions: string[];
  onImageMotions: (motions: string[]) => void;
  productTitle?: string;
  shopLogoUrl?: string | null;
  priceCents?: number;
  currency?: string;
};

const HISTORY_MAX = 16;

function rgbCss(c: Rgb, a = 1) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function rgbHex(c: Rgb) {
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function canvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height,
  };
}

function samplePixel(ctx: CanvasRenderingContext2D, x: number, y: number): Rgb | null {
  const px = ctx.getImageData(
    Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(x))),
    Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(y))),
    1,
    1,
  ).data;
  return { r: px[0], g: px[1], b: px[2] };
}

function guessBackground(ctx: CanvasRenderingContext2D): Rgb {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const pts: Point[] = [
    { x: 4, y: 4 },
    { x: w - 5, y: 4 },
    { x: 4, y: h - 5 },
    { x: w - 5, y: h - 5 },
    { x: w / 2, y: 4 },
    { x: w / 2, y: h - 5 },
    { x: 4, y: h / 2 },
    { x: w - 5, y: h / 2 },
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const p of pts) {
    const c = samplePixel(ctx, p.x, p.y);
    if (!c) continue;
    r += c.r;
    g += c.g;
    b += c.b;
    n += 1;
  }
  if (!n) return { r: 245, g: 245, b: 247 };
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function sampleRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): Rgb | null {
  const inner = radius * 1.2;
  const outer = radius * 2.1;
  const x0 = Math.max(0, Math.floor(cx - outer));
  const y0 = Math.max(0, Math.floor(cy - outer));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(cx + outer));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(cy + outer));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 2 || h < 2) return null;
  const data = ctx.getImageData(x0, y0, w, h).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 28));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const dx = x0 + x - cx;
      const dy = y0 + y - cy;
      const d = Math.hypot(dx, dy);
      if (d < inner || d > outer) continue;
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  if (n < 8) return null;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function sampleRectBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): Rgb | null {
  const pad = Math.max(6, Math.min(w, h) * 0.12);
  const pts: Point[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ x: x + w * t, y: y - pad });
    pts.push({ x: x + w * t, y: y + h + pad });
    pts.push({ x: x - pad, y: y + h * t });
    pts.push({ x: x + w + pad, y: y + h * t });
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const p of pts) {
    if (p.x < 0 || p.y < 0 || p.x >= ctx.canvas.width || p.y >= ctx.canvas.height) continue;
    const c = samplePixel(ctx, p.x, p.y);
    if (!c) continue;
    r += c.r;
    g += c.g;
    b += c.b;
    n += 1;
  }
  if (n < 4) return null;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function paintSoftDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: Rgb,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgbCss(color, 1));
  g.addColorStop(0.42, rgbCss(color, 0.92));
  g.addColorStop(0.72, rgbCss(color, 0.45));
  g.addColorStop(1, rgbCss(color, 0));
  ctx.save();
  ctx.filter = `blur(${Math.max(0.6, radius * 0.06)}px)`;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eraseStroke(
  ctx: CanvasRenderingContext2D,
  from: Point | null,
  to: Point,
  radius: number,
  fill: Rgb,
  autoFill: boolean,
) {
  const pts: Point[] = [];
  if (!from) {
    pts.push(to);
  } else {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1.5, radius * 0.32);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      pts.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }
  for (const p of pts) {
    const local = autoFill ? sampleRing(ctx, p.x, p.y, radius) : null;
    const color = local ? mixRgb(fill, local, 0.72) : fill;
    paintSoftDot(ctx, p.x, p.y, radius, color);
  }
}

function SoundtrackClipEditor({
  track,
  startMs,
  onStartMs,
  onPlaying,
  clipMs: clipWindowMs,
}: {
  track: Track;
  startMs: number;
  onStartMs: (ms: number) => void;
  onPlaying?: (playing: boolean) => void;
  clipMs: number;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const startRef = useRef(startMs);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;
  const [playing, setPlaying] = useState(false);
  const [metaMs, setMetaMs] = useState(track.durationMs);

  useEffect(() => {
    startRef.current = startMs;
  }, [startMs]);

  useEffect(() => {
    setMetaMs(track.durationMs);
    setPlaying(false);
    onPlayingRef.current?.(false);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [track.id, track.durationMs, track.audioUrl]);

  const durationMs = Math.max(metaMs, 1000);
  const clipMs = Math.min(clipWindowMs, durationMs);
  const maxStart = Math.max(0, durationMs - clipMs);
  const start = clampSoundtrackStartMs(startMs, durationMs, clipWindowMs);
  const end = start + clipMs;
  const leftPct = durationMs > 0 ? (start / durationMs) * 100 : 0;
  const widthPct = durationMs > 0 ? (clipMs / durationMs) * 100 : 100;

  function applyStart(next: number) {
    const clamped = clampSoundtrackStartMs(next, durationMs, clipWindowMs);
    onStartMs(clamped);
    const audio = audioRef.current;
    if (audio && playing) {
      audio.currentTime = clamped / 1000;
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      onPlaying?.(false);
      return;
    }
    audio.currentTime = start / 1000;
    audio.volume = 0.45;
    void audio
      .play()
      .then(() => {
        setPlaying(true);
        onPlaying?.(true);
      })
      .catch(() => {
        setPlaying(false);
        onPlaying?.(false);
      });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
      <audio
        ref={audioRef}
        src={track.audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0.4) {
            setMetaMs(Math.round(d * 1000));
          }
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          const from = startRef.current / 1000;
          const to = from + clipMs / 1000;
          if (audio.currentTime >= to - 0.04) {
            audio.currentTime = from;
          }
        }}
        onEnded={(e) => {
          e.currentTarget.currentTime = startRef.current / 1000;
          void e.currentTarget.play().catch(() => {
            setPlaying(false);
            onPlayingRef.current?.(false);
          });
        }}
        onPause={() => {
          setPlaying(false);
          onPlayingRef.current?.(false);
        }}
        onPlay={() => {
          setPlaying(true);
          onPlayingRef.current?.(true);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{t("montage.clipWindow")}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {formatClipClock(start)} → {formatClipClock(end)}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("montage.clipHint")}</p>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute inset-y-0 rounded-full bg-primary"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
      {maxStart > 0 && (
        <input
          type="range"
          min={0}
          max={maxStart}
          step={250}
          value={start}
          onChange={(e) => applyStart(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label={t("montage.clipWindow")}
        />
      )}
      <Button
        type="button"
        size="sm"
        variant={playing ? "secondary" : "default"}
        onClick={togglePlay}
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {playing ? t("montage.clipPause") : t("montage.clipPlay")}
      </Button>
    </div>
  );
}

function MontageSlidesPanel({
  images,
  motions,
  onMotions,
  playing,
  clipMs,
  maxImages,
  motionList,
}: {
  images: string[];
  motions: string[];
  onMotions: (next: string[]) => void;
  playing: boolean;
  clipMs: number;
  maxImages: number;
  motionList: SlideMotion[];
}) {
  const { t } = useI18n();
  const list = images.slice(0, maxImages);
  const [picked, setPicked] = useState(0);
  const [live, setLive] = useState(0);
  const count = list.length;
  const index = playing ? live : picked;
  const src = list[index] ?? list[0];
  const videoSlide = src ? isVideoUrl(src) : false;
  const motion = videoSlide ? undefined : parseSlideMotion(motions[index]);
  const win = slideshowWindow(index, count, clipMs, maxImages);

  useEffect(() => {
    if (!playing || count <= 1) {
      setLive(0);
      return;
    }
    setLive(0);
    const slot = slideshowWindow(0, count, clipMs, maxImages).slot;
    const tmr = setInterval(() => {
      setLive((i) => (i + 1) % count);
    }, slot);
    return () => clearInterval(tmr);
  }, [playing, count, clipMs]);

  useEffect(() => {
    if (picked >= count) setPicked(0);
  }, [count, picked]);

  if (!src) return null;

  function cycleMotion(i: number) {
    const url = list[i];
    if (!url || isVideoUrl(url)) return;
    const cycle = motionList.length ? motionList : [...SLIDE_MOTIONS];
    const current = parseSlideMotion(motions[i]);
    const copy = list.map((_, idx) => motions[idx] ?? "");
    if (!current) {
      copy[i] = encodeSlideMotion(cycle[0]!);
    } else {
      const at = cycle.indexOf(current);
      copy[i] =
        at >= cycle.length - 1 ? "" : encodeSlideMotion(cycle[at + 1]!);
    }
    onMotions(copy);
  }

  const labels: Record<SlideMotion, string> = {
    "zoom-in": t("montage.motionZoomIn"),
    "zoom-out": t("montage.motionZoomOut"),
    "pan-left": t("montage.motionPanLeft"),
    "pan-right": t("montage.motionPanRight"),
    "pan-up": t("montage.motionPanUp"),
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="text-xs font-semibold">{t("montage.slidesTitle")}</p>
      <p className="text-[11px] text-muted-foreground">{t("montage.slidesHint")}</p>
      <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/5] max-h-64">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${src}-${index}-${motion ?? "still"}-${playing ? "play" : "edit"}`}
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover",
            motion && "ss-ken ss-ken-loop",
          )}
          data-motion={motion}
          style={
            motion
              ? { ["--ss-ms" as string]: `${win.slot}ms` }
              : undefined
          }
        />
        <p className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums">
          {formatClipClock(win.start)} → {formatClipClock(win.end)}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {list.map((url, i) => {
          const range = slideshowWindow(i, count, clipMs);
          const active = i === index;
          return (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setPicked(i)}
              className={cn(
                "relative h-16 w-12 shrink-0 overflow-hidden rounded-md border",
                active ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/65 px-0.5 text-[8px] leading-3 text-white tabular-nums">
                {formatClipClock(range.end)}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => cycleMotion(index)}
        disabled={videoSlide}
      >
        {t("montage.changeMotion")}:{" "}
        {videoSlide ? "—" : motion ? labels[motion] : "—"}
      </Button>
    </div>
  );
}

export function PublishMontage({
  images,
  onImagesChange,
  soundtrackId,
  onSoundtrackId,
  soundtrackStartMs,
  onSoundtrackStartMs,
  localClip,
  onLocalClip,
  imageMotions,
  onImageMotions,
  productTitle,
  shopLogoUrl,
  priceCents,
  currency,
}: Props) {
  const { t } = useI18n();
  const appConfig = useAppConfig();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [onlineHits, setOnlineHits] = useState<OnlineHit[]>([]);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tool, setTool] = useState<Tool>("eraser");
  const [selected, setSelected] = useState<string | null>(null);
  const [fill, setFill] = useState<Rgb>({ r: 245, g: 245, b: 247 });
  const [autoFill, setAutoFill] = useState(true);
  const [brush, setBrush] = useState(0.09);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursor, setCursor] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<Point | null>(null);
  const [importing, setImporting] = useState(false);
  const [clipPlaying, setClipPlaying] = useState(false);

  const firstImage = images.find((u) => !isVideoUrl(u)) ?? null;

  const searchSeeded = useRef(false);
  useEffect(() => {
    if (searchSeeded.current) return;
    const next = productTitle?.trim() ?? "";
    if (!next) return;
    setSearchQ(next);
    searchSeeded.current = true;
  }, [productTitle]);

  useEffect(() => {
    fetchJson<{ soundtracks?: Track[] }>("/api/soundtracks").then(({ data }) => {
      setTracks(data?.soundtracks ?? []);
    });
  }, []);

  function snapshotFrom(ctx: CanvasRenderingContext2D) {
    const shot = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(shot);
    if (next.length > HISTORY_MAX) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryIndex(historyIndexRef.current);
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;
    snapshotFrom(ctx);
  }

  function restoreAt(index: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    const shot = historyRef.current[index];
    if (!canvas || !ctx || !shot) return;
    ctx.putImageData(shot, 0, 0);
    historyIndexRef.current = index;
    setHistoryIndex(index);
  }

  useEffect(() => {
    if (!firstImage || !canvasRef.current) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      setFill(guessBackground(ctx));
      historyRef.current = [];
      historyIndexRef.current = -1;
      setHistoryIndex(-1);
      snapshotFrom(ctx);
      setSuggestions([]);
      setSelected(null);
    };
    img.src = firstImage;
  }, [firstImage]);

  function ctx2d() {
    return canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  }

  function boxPx(s: Suggestion, canvas: HTMLCanvasElement) {
    return {
      x: s.left * canvas.width,
      y: s.top * canvas.height,
      w: s.width * canvas.width,
      h: s.height * canvas.height,
    };
  }

  function brushRadius() {
    const canvas = canvasRef.current;
    if (!canvas) return 24;
    return Math.max(8, Math.min(canvas.width, canvas.height) * brush);
  }

  function blurBox(s: Suggestion) {
    const canvas = canvasRef.current;
    const ctx = ctx2d();
    if (!canvas || !ctx) return;
    pushHistory();
    const { x, y, w, h } = boxPx(s, canvas);
    const sampled = sampleRectBorder(ctx, x, y, w, h);
    const color = sampled ? mixRgb(fill, sampled, autoFill ? 0.75 : 0.2) : fill;
    const pad = Math.max(8, Math.min(w, h) * 0.18);
    ctx.save();
    ctx.filter = `blur(${Math.max(6, Math.min(w, h) * 0.12)}px)`;
    ctx.fillStyle = rgbCss(color, 1);
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, Math.min(w, h) * 0.2);
    ctx.fill();
    ctx.restore();
  }

  function stampLogo(s?: Suggestion) {
    if (!shopLogoUrl) {
      toast.error(t("montage.needLogo"));
      return;
    }
    const canvas = canvasRef.current;
    const ctx = ctx2d();
    if (!canvas || !ctx) return;
    const logo = new Image();
    logo.crossOrigin = "anonymous";
    logo.onload = () => {
      pushHistory();
      const size = s
        ? Math.min(s.width, s.height) * canvas.width
        : Math.min(canvas.width, canvas.height) * 0.18;
      const x = s ? s.left * canvas.width : canvas.width - size - 24;
      const y = s ? s.top * canvas.height : canvas.height - size - 24;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, size * 0.2);
      ctx.clip();
      ctx.drawImage(logo, x, y, size, size);
      ctx.restore();
    };
    logo.src = shopLogoUrl;
  }

  function stampPrice(s?: Suggestion) {
    const canvas = canvasRef.current;
    const ctx = ctx2d();
    if (!canvas || !ctx || !priceCents) return;
    pushHistory();
    const text = formatMoney(priceCents, currency);
    const x = s ? s.left * canvas.width : 24;
    const y = s ? s.top * canvas.height : canvas.height - 48;
    const w = s ? s.width * canvas.width : 160;
    const h = s ? s.height * canvas.height : 40;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#22c55e";
    ctx.font = `bold ${Math.max(16, h * 0.55)}px sans-serif`;
    ctx.fillText(text, x + 8, y + h * 0.72, w - 16);
  }

  async function analyze() {
    if (!firstImage) return;
    setAnalyzing(true);
    try {
      const resImg = await fetch(firstImage);
      const blob = await resImg.blob();
      const form = new FormData();
      form.append("file", new File([blob], "frame.jpg", { type: blob.type || "image/jpeg" }));
      const { data } = await fetchJson<{ suggestions?: Suggestion[] }>(
        "/api/media/suggest-cleanup",
        { method: "POST", body: form },
      );
      const list = data?.suggestions ?? [];
      setSuggestions(list);
      if (!list.length) toast.message(t("montage.noSuggestions"));
      else setTool("select");
    } finally {
      setAnalyzing(false);
    }
  }

  function pickAt(pt: Point) {
    const ctx = ctx2d();
    if (!ctx) return;
    const c = samplePixel(ctx, pt.x, pt.y);
    if (c) setFill(c);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not a real pointer capture (tests / lost target) */
    }
    const pt = canvasPoint(canvas, e.clientX, e.clientY);
    setCursor(pt);

    if (tool === "eyedropper") {
      pickAt(pt);
      setTool("eraser");
      return;
    }

    if (tool === "eraser") {
      const ctx = ctx2d();
      if (!ctx) return;
      pushHistory();
      drawingRef.current = true;
      lastPtRef.current = pt;
      eraseStroke(ctx, null, pt, brushRadius(), fill, autoFill);
      return;
    }

    const hit = suggestions.find((s) => {
      const b = boxPx(s, canvas);
      return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
    });
    setSelected(hit?.id ?? null);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = canvasPoint(canvas, e.clientX, e.clientY);
    setCursor(pt);
    if (!drawingRef.current || tool !== "eraser") return;
    const ctx = ctx2d();
    if (!ctx) return;
    eraseStroke(ctx, lastPtRef.current, pt, brushRadius(), fill, autoFill);
    lastPtRef.current = pt;
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPtRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  function resetImage() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = ctx2d();
    if (!img || !canvas || !ctx) return;
    ctx.drawImage(img, 0, 0);
    historyRef.current = [];
    historyIndexRef.current = -1;
    setHistoryIndex(-1);
    snapshotFrom(ctx);
    setFill(guessBackground(ctx));
  }

  function adoptLocalFile(file: File, title: string) {
    const audioUrl = URL.createObjectURL(file);
    return probeMediaDurationMs(audioUrl)
      .then((durationMs) => {
        onLocalClip({ file, audioUrl, title, durationMs });
        onSoundtrackId(LOCAL_SOUNDTRACK_ID);
        onSoundtrackStartMs(0);
        toast.success(t("montage.importOk"));
      })
      .catch((error) => {
        URL.revokeObjectURL(audioUrl);
        throw error;
      });
  }

  async function importFromDevice(file: File) {
    setImporting(true);
    try {
      const video = isVideoLike(file);
      const audio = isAudioLike(file);
      if (!video && !audio) {
        throw new Error(
          "Importez une musique (MP3, M4A…) ou une vidéo (MP4, MOV…)",
        );
      }
      const maxBytes = video ? VIDEO_INPUT_MAX_BYTES : AUDIO_INPUT_MAX_BYTES;
      if (file.size <= 0 || file.size > maxBytes) {
        throw new Error(
          video ? "Vidéo trop lourde (max 100 Mo)" : "Fichier audio trop lourd (max 25 Mo)",
        );
      }
      const title = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80) || "Import";
      await adoptLocalFile(file, title);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("montage.importDevice"),
      );
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function searchOnline() {
    const q = searchQ.trim() || productTitle?.trim() || "";
    if (q.length < 2) {
      toast.error(t("montage.searchPlaceholder"));
      return;
    }
    setSearching(true);
    try {
      const { res, data } = await fetchJson<{
        tracks?: OnlineHit[];
        error?: string;
      }>(`/api/soundtracks/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        throw new Error(data?.error ?? t("montage.searchEmpty"));
      }
      const tracksFound = data?.tracks ?? [];
      setOnlineHits(tracksFound);
      if (!tracksFound.length) toast.message(t("montage.searchEmpty"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("montage.searchEmpty"),
      );
    } finally {
      setSearching(false);
    }
  }

  async function useOnlineHit(hit: OnlineHit) {
    setFetchingId(hit.identifier);
    try {
      const res = await fetch(
        `/api/soundtracks/fetch?identifier=${encodeURIComponent(hit.identifier)}&file=${encodeURIComponent(hit.file)}`,
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? t("montage.fetchOnline"));
      }
      const blob = await res.blob();
      const ext = hit.file.includes(".") ? hit.file.split(".").pop() : "mp3";
      const file = new File([blob], `${hit.title.slice(0, 40)}.${ext}`, {
        type: blob.type || "audio/mpeg",
      });
      await adoptLocalFile(file, hit.title);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("montage.fetchOnline"),
      );
    } finally {
      setFetchingId(null);
    }
  }

  async function applyEdit() {
    const canvas = canvasRef.current;
    if (!canvas || !firstImage) return;
    setApplying(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("export");
      const file = new File([blob], "montage.jpg", { type: "image/jpeg" });
      const uploaded = await uploadCompressedMedia(file, "product");
      onImagesChange(
        images.map((u) => (u === firstImage ? uploaded.url : u)),
      );
      toast.success(t("montage.apply"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("montage.apply"));
    } finally {
      setApplying(false);
    }
  }

  const current = suggestions.find((s) => s.id === selected);
  const selectedTrack: Track | undefined =
    soundtrackId === LOCAL_SOUNDTRACK_ID && localClip
      ? {
          id: LOCAL_SOUNDTRACK_ID,
          title: localClip.title,
          artist: t("montage.tempOnly"),
          mood: "import",
          durationMs: localClip.durationMs,
          audioUrl: localClip.audioUrl,
        }
      : tracks.find((tr) => tr.id === soundtrackId);
  const canUndo = historyIndex > 0;
  const canvas = canvasRef.current;
  const cursorCss =
    cursor && canvas && wrapRef.current
      ? {
          left: `${(cursor.x / canvas.width) * 100}%`,
          top: `${(cursor.y / canvas.height) * 100}%`,
          width: `${(brushRadius() / canvas.width) * 200}%`,
        }
      : null;

  function IconBtn({
    title,
    active,
    disabled,
    onClick,
    children,
  }: {
    title: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }) {
    return (
      <Button
        type="button"
        size="icon-sm"
        variant={active ? "default" : "outline"}
        disabled={disabled}
        title={title}
        aria-label={title}
        onClick={onClick}
      >
        {children}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div>
        <p className="text-sm font-semibold">{t("montage.title")}</p>
        <p className="text-xs text-muted-foreground">{t("montage.hint")}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("montage.music")}</Label>
          <span className="text-[11px] text-muted-foreground">
            {t("montage.maxOneMinute")}
          </span>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.mp4,.mov,.webm,.m4v,.mkv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFromDevice(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={importing}
            onClick={() => importRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {importing ? t("montage.importing") : t("montage.importDevice")}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("montage.searchHint")}</p>
        <div className="flex gap-2">
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t("montage.searchPlaceholder")}
            className="h-9 bg-surface-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchOnline();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={searching}
            onClick={() => void searchOnline()}
          >
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            {searching ? t("montage.searching") : t("montage.searchOnline")}
          </Button>
        </div>
        {onlineHits.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {onlineHits.map((hit) => (
              <li key={`${hit.identifier}-${hit.file}`}>
                <button
                  type="button"
                  disabled={fetchingId === hit.identifier}
                  onClick={() => void useOnlineHit(hit)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{hit.title}</span>
                    <span className="block truncate text-muted-foreground">
                      {hit.artist}
                    </span>
                  </span>
                  {fetchingId === hit.identifier ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <span className="shrink-0 text-[10px] font-semibold text-primary">
                      {t("montage.fetchOnline")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {localClip && soundtrackId === LOCAL_SOUNDTRACK_ID && (
          <p className="text-[11px] text-muted-foreground">{t("montage.tempOnly")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onLocalClip(null);
              onSoundtrackId(null);
              onSoundtrackStartMs(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              !soundtrackId
                ? "border-primary bg-primary text-white"
                : "border-border"
            }`}
          >
            {t("montage.none")}
          </button>
          {localClip && (
            <button
              type="button"
              onClick={() => {
                onSoundtrackId(LOCAL_SOUNDTRACK_ID);
                onSoundtrackStartMs(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                soundtrackId === LOCAL_SOUNDTRACK_ID
                  ? "border-primary bg-primary text-white"
                  : "border-border"
              }`}
            >
              {localClip.title}
            </button>
          )}
          {tracks.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => {
                onLocalClip(null);
                onSoundtrackId(tr.id);
                onSoundtrackStartMs(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                soundtrackId === tr.id
                  ? "border-primary bg-primary text-white"
                  : "border-border"
              }`}
            >
              {tr.title}
            </button>
          ))}
        </div>
        {selectedTrack && (
          <SoundtrackClipEditor
            key={selectedTrack.id}
            track={selectedTrack}
            startMs={soundtrackStartMs}
            onStartMs={onSoundtrackStartMs}
            onPlaying={setClipPlaying}
            clipMs={appConfig.clipMs}
          />
        )}
        {images.length > 0 && (
          <MontageSlidesPanel
            images={images}
            motions={imageMotions}
            onMotions={onImageMotions}
            playing={clipPlaying && Boolean(selectedTrack)}
            clipMs={appConfig.clipMs}
            maxImages={appConfig.maxImages}
            motionList={appConfig.motions}
          />
        )}
      </div>

      {firstImage && (
        <div className="space-y-2">
          <div
            ref={wrapRef}
            className="relative overflow-hidden rounded-xl border border-border bg-black"
          >
            <canvas
              ref={canvasRef}
              className={`block max-h-72 w-full touch-none ${
                tool === "eraser"
                  ? "cursor-none"
                  : tool === "eyedropper"
                    ? "cursor-copy"
                    : "cursor-pointer"
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => {
                drawingRef.current = false;
                lastPtRef.current = null;
                setCursor(null);
              }}
            />
            {tool === "select" &&
              suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.label}
                  onClick={() => setSelected(s.id)}
                  className={`absolute flex items-center justify-center rounded-md border-2 ${
                    s.id === selected
                      ? "border-primary bg-primary/20"
                      : "border-amber-400/80 bg-amber-400/10"
                  }`}
                  style={{
                    left: `${s.left * 100}%`,
                    top: `${s.top * 100}%`,
                    width: `${s.width * 100}%`,
                    height: `${s.height * 100}%`,
                  }}
                >
                  {s.kind === "logo" ? (
                    <ImageIcon className="size-3.5 text-white drop-shadow" />
                  ) : (
                    <Type className="size-3.5 text-white drop-shadow" />
                  )}
                </button>
              ))}
            {tool === "eraser" && cursorCss && (
              <span
                className="pointer-events-none absolute rounded-full border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                style={{
                  left: cursorCss.left,
                  top: cursorCss.top,
                  width: cursorCss.width,
                  aspectRatio: "1",
                  transform: "translate(-50%, -50%)",
                  background: rgbCss(fill, 0.22),
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <IconBtn
              title={t("montage.analyze")}
              disabled={analyzing}
              onClick={() => void analyze()}
            >
              {analyzing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ScanSearch className="size-3.5" />
              )}
            </IconBtn>
            <IconBtn
              title={t("montage.select")}
              active={tool === "select"}
              onClick={() => setTool("select")}
            >
              <MousePointer2 className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={t("montage.eraser")}
              active={tool === "eraser"}
              onClick={() => setTool("eraser")}
            >
              <Eraser className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={t("montage.pickColor")}
              active={tool === "eyedropper"}
              onClick={() => setTool("eyedropper")}
            >
              <Pipette className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={t("montage.autoFill")}
              active={autoFill}
              onClick={() => setAutoFill((v) => !v)}
            >
              <Blend className="size-3.5" />
            </IconBtn>
            <button
              type="button"
              title={t("montage.pickColor")}
              className="size-7 shrink-0 rounded-lg border border-border shadow-inner"
              style={{ background: rgbCss(fill) }}
              onClick={() => colorRef.current?.click()}
            />
            <input
              ref={colorRef}
              type="color"
              value={rgbHex(fill)}
              className="sr-only"
              onChange={(e) => {
                const next = hexToRgb(e.target.value);
                if (next) setFill(next);
              }}
            />
            <IconBtn
              title={t("montage.undo")}
              disabled={!canUndo}
              onClick={() => restoreAt(historyIndex - 1)}
            >
              <Undo2 className="size-3.5" />
            </IconBtn>
            <IconBtn title={t("montage.reset")} onClick={resetImage}>
              <RotateCcw className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={t("montage.blur")}
              disabled={!current}
              onClick={() => current && blurBox(current)}
            >
              <EyeOff className="size-3.5" />
            </IconBtn>
            <IconBtn title={t("montage.stampLogo")} onClick={() => stampLogo(current)}>
              <Store className="size-3.5" />
            </IconBtn>
            <IconBtn title={t("montage.stampPrice")} onClick={() => stampPrice(current)}>
              <BadgeDollarSign className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={t("montage.apply")}
              disabled={applying}
              onClick={() => void applyEdit()}
            >
              {applying ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </IconBtn>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">{t("montage.brush")}</span>
            <input
              type="range"
              min={0.03}
              max={0.22}
              step={0.01}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
        </div>
      )}
    </div>
  );
}
