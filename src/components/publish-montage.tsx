"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { isVideoUrl } from "@/lib/media";
import { uploadCompressedMedia } from "@/lib/compress-media";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Track = {
  id: string;
  title: string;
  artist: string;
  mood: string;
  durationMs: number;
  audioUrl: string;
};

type Suggestion = {
  id: string;
  kind: "text" | "logo";
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  soundtrackId: string | null;
  onSoundtrackId: (id: string | null) => void;
  shopLogoUrl?: string | null;
  priceCents?: number;
  currency?: string;
};

export function PublishMontage({
  images,
  onImagesChange,
  soundtrackId,
  onSoundtrackId,
  shopLogoUrl,
  priceCents,
  currency,
}: Props) {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tool, setTool] = useState<"select" | "eraser">("select");
  const [selected, setSelected] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const firstImage = images.find((u) => !isVideoUrl(u)) ?? null;

  useEffect(() => {
    fetchJson<{ soundtracks?: Track[] }>("/api/soundtracks").then(({ data }) => {
      setTracks(data?.soundtracks ?? []);
    });
  }, []);

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
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
    };
    img.src = firstImage;
  }, [firstImage]);

  function drawBase() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return ctx;
  }

  function boxPx(s: Suggestion, canvas: HTMLCanvasElement) {
    return {
      x: s.left * canvas.width,
      y: s.top * canvas.height,
      w: s.width * canvas.width,
      h: s.height * canvas.height,
    };
  }

  function blurBox(s: Suggestion) {
    const canvas = canvasRef.current;
    const ctx = drawBase();
    if (!canvas || !ctx) return;
    const { x, y, w, h } = boxPx(s, canvas);
    ctx.fillStyle = "rgba(20,20,24,0.92)";
    ctx.fillRect(x, y, w, h);
  }

  function stampLogo(s?: Suggestion) {
    if (!shopLogoUrl) {
      toast.error(t("montage.needLogo"));
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const logo = new Image();
    logo.crossOrigin = "anonymous";
    logo.onload = () => {
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
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !priceCents) return;
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
    } finally {
      setAnalyzing(false);
    }
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (tool === "eraser") {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const size = Math.min(canvas.width, canvas.height) * 0.08;
      ctx.fillStyle = "rgba(20,20,24,0.92)";
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const hit = suggestions.find((s) => {
      const b = boxPx(s, canvas);
      return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    });
    setSelected(hit?.id ?? null);
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
  const selectedTrack = tracks.find((tr) => tr.id === soundtrackId);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div>
        <p className="text-sm font-semibold">{t("montage.title")}</p>
        <p className="text-xs text-muted-foreground">{t("montage.hint")}</p>
      </div>

      <div className="space-y-2">
        <Label>{t("montage.music")}</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSoundtrackId(null)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              !soundtrackId
                ? "border-primary bg-primary text-white"
                : "border-border"
            }`}
          >
            {t("montage.none")}
          </button>
          {tracks.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => onSoundtrackId(tr.id)}
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
          <audio
            key={selectedTrack.id}
            src={selectedTrack.audioUrl}
            controls
            className="mt-1 w-full"
            onPlay={(e) => {
              e.currentTarget.volume = 0.3;
            }}
          />
        )}
      </div>

      {firstImage && (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            onClick={onCanvasClick}
            className="max-h-72 w-full cursor-crosshair rounded-xl border border-border bg-black object-contain"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={analyzing}
              onClick={() => void analyze()}
            >
              {analyzing ? t("montage.analyzing") : t("montage.analyze")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTool(tool === "eraser" ? "select" : "eraser")}
            >
              {t("montage.eraser")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!current}
              onClick={() => current && blurBox(current)}
            >
              {t("montage.blur")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => stampLogo(current)}
            >
              {t("montage.stampLogo")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => stampPrice(current)}
            >
              {t("montage.stampPrice")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={applying}
              onClick={() => void applyEdit()}
            >
              {t("montage.apply")}
            </Button>
          </div>
          {suggestions.length > 0 && (
            <ul className="max-h-24 overflow-y-auto text-[11px] text-muted-foreground">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === selected ? "font-bold text-foreground" : ""}
                    onClick={() => setSelected(s.id)}
                  >
                    {s.kind} · {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
