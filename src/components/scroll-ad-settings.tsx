"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Clapperboard, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import {
  mediaUploadToastMessage,
  uploadCompressedMedia,
} from "@/lib/compress-media";
import {
  SCROLL_AD_DEFAULT_DELAY,
  SCROLL_AD_DEFAULT_VIDEO,
  SCROLL_AD_IMAGE_SECONDS,
  SCROLL_AD_MAX_VIDEOS,
  clampScrollAdPriority,
  parseScrollAdVideos,
  type ScrollAdClip,
} from "@/lib/scroll-ad";
import { isVideoUrl, looksLikeImageFile, looksLikeVideoFile } from "@/lib/media";
import { clearPublicAppConfigCache } from "@/lib/use-app-config";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

type Payload = {
  scrollAdEnabled?: boolean;
  scrollAdDelaySeconds?: number;
  scrollAdStartsAt?: string | null;
  scrollAdEndsAt?: string | null;
  scrollAdVideos?: unknown;
  error?: string;
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function nextPriority(clips: ScrollAdClip[]) {
  const max = clips.reduce((acc, clip) => Math.max(acc, clip.priority), 0);
  return clampScrollAdPriority(max + 1, clips.length + 1);
}

function clipName(url: string) {
  try {
    const path = url.split("?")[0] ?? url;
    return path.split("/").pop() || url;
  } catch {
    return url;
  }
}

export function ScrollAdSettings() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [enabled, setEnabled] = useState(true);
  const [delay, setDelay] = useState(SCROLL_AD_DEFAULT_DELAY);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [videos, setVideos] = useState<ScrollAdClip[]>([
    { url: SCROLL_AD_DEFAULT_VIDEO, enabled: true, priority: 1 },
  ]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const { res, data } = await fetchJson<Payload>("/api/admin/content-source");
    if (res.status === 403 || !data) return;
    setEnabled(data.scrollAdEnabled !== false);
    setDelay(data.scrollAdDelaySeconds ?? SCROLL_AD_DEFAULT_DELAY);
    setStartsAt(toLocalInput(data.scrollAdStartsAt));
    setEndsAt(toLocalInput(data.scrollAdEndsAt));
    setVideos(parseScrollAdVideos(data.scrollAdVideos, false));
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  async function persist(patch: Record<string, unknown>) {
    setBusy(true);
    const { res, data } = await fetchJson<Payload>("/api/admin/content-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Enregistrement impossible");
      return false;
    }
    clearPublicAppConfigCache();
    return true;
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    const ok = await persist({ scrollAdEnabled: next });
    if (!ok) setEnabled(!next);
    else toast.success(next ? "Flash pub activé" : "Flash pub désactivé");
  }

  async function save() {
    const ok = await persist({
      scrollAdDelaySeconds: delay,
      scrollAdStartsAt: fromLocalInput(startsAt),
      scrollAdEndsAt: fromLocalInput(endsAt),
      scrollAdVideos: videos,
    });
    if (ok) toast.success("Flash pub enregistré");
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!looksLikeVideoFile(file) && !looksLikeImageFile(file)) {
      toast.error("Choisis une image ou une vidéo");
      return;
    }
    if (videos.length >= SCROLL_AD_MAX_VIDEOS) {
      toast.error(`Maximum ${SCROLL_AD_MAX_VIDEOS} médias`);
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadCompressedMedia(file, "product");
      setVideos((prev) => [
        ...prev,
        {
          url: uploaded.url,
          enabled: true,
          priority: nextPriority(prev),
        },
      ]);
      toast.success("Média ajouté — enregistre pour publier");
    } catch (error) {
      toast.error(mediaUploadToastMessage(error, t));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!loaded) return null;

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">Flash pub</h2>
          <p className="text-sm text-muted-foreground">
            Images (jpg, png, webp, gif…) ou vidéos. 1 fois par média et par
            jour. 0 s = off.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={() => void toggleEnabled()}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5",
            )}
          />
          <span className="sr-only">{enabled ? "Désactiver" : "Activer"}</span>
        </button>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Premier flash (secondes de scroll)</span>
        <Input
          type="number"
          min={0}
          max={3600}
          value={delay}
          disabled={busy}
          onChange={(e) => setDelay(Number(e.target.value))}
        />
        <span className="text-xs text-muted-foreground">
          Défaut 120 s. Ensuite 4, 6, 8… min de scroll, 8 min mini entre deux,
          et pas de replay avant demain.
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Début</span>
          <Input
            type="datetime-local"
            value={startsAt}
            disabled={busy}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Fin</span>
          <Input
            type="datetime-local"
            value={endsAt}
            disabled={busy}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Dates vides = toujours, tant que c’est activé.
      </p>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Médias ({videos.length}/{SCROLL_AD_MAX_VIDEOS})
        </p>
        <p className="text-xs text-muted-foreground">
          Une image s’affiche {SCROLL_AD_IMAGE_SECONDS} s (chrono + slider). Le
          X apparaît vers la fin. Désactive un média sans le supprimer.
          Priorité 1 = premier.
        </p>
        {videos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun média — le flash ne passera pas.</p>
        ) : (
          <ul className="space-y-1.5">
            {videos
              .map((clip, index) => ({ clip, index }))
              .sort(
                (a, b) =>
                  a.clip.priority - b.clip.priority || a.index - b.index,
              )
              .map(({ clip, index }, rank) => (
              <li
                key={`${clip.url}-${index}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs",
                  !clip.enabled && "opacity-55",
                )}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={clip.enabled}
                  disabled={busy}
                  onClick={() =>
                    setVideos((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? { ...item, enabled: !item.enabled }
                          : item,
                      ),
                    )
                  }
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    clip.enabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                      clip.enabled ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                  <span className="sr-only">
                    {clip.enabled ? "Désactiver ce flash" : "Activer ce flash"}
                  </span>
                </button>
                {!isVideoUrl(clip.url) ? (
                  <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Clapperboard className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{clipName(clip.url)}</span>
                <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  Prio
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={clip.priority}
                    disabled={busy}
                    aria-label="Priorité"
                    className="h-7 w-14 px-1.5 text-xs tabular-nums"
                    onChange={(e) => {
                      const priority = clampScrollAdPriority(
                        e.target.value,
                        clip.priority,
                      );
                      setVideos((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, priority } : item,
                        ),
                      );
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  disabled={busy || rank === 0}
                  onClick={() =>
                    setVideos((prev) => {
                      const ranked = prev
                        .map((item, i) => ({ item, i }))
                        .sort(
                          (a, b) =>
                            a.item.priority - b.item.priority || a.i - b.i,
                        );
                      const current = ranked[rank];
                      const above = ranked[rank - 1];
                      if (!current || !above) return prev;
                      return prev.map((item, i) => {
                        if (i === current.i)
                          return { ...item, priority: above.item.priority };
                        if (i === above.i)
                          return { ...item, priority: current.item.priority };
                        return item;
                      });
                    })
                  }
                  aria-label="Monter"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  disabled={busy || rank === videos.length - 1}
                  onClick={() =>
                    setVideos((prev) => {
                      const ranked = prev
                        .map((item, i) => ({ item, i }))
                        .sort(
                          (a, b) =>
                            a.item.priority - b.item.priority || a.i - b.i,
                        );
                      const current = ranked[rank];
                      const below = ranked[rank + 1];
                      if (!current || !below) return prev;
                      return prev.map((item, i) => {
                        if (i === current.i)
                          return { ...item, priority: below.item.priority };
                        if (i === below.i)
                          return { ...item, priority: current.item.priority };
                        return item;
                      });
                    })
                  }
                  aria-label="Descendre"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  disabled={busy}
                  onClick={() =>
                    setVideos((prev) => prev.filter((_, idx) => idx !== index))
                  }
                  aria-label="Retirer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/*"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || videos.length >= SCROLL_AD_MAX_VIDEOS}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" />
            Ajouter image / vidéo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              busy ||
              videos.some((clip) => clip.url === SCROLL_AD_DEFAULT_VIDEO) ||
              videos.length >= SCROLL_AD_MAX_VIDEOS
            }
            onClick={() =>
              setVideos((prev) => [
                ...prev,
                {
                  url: SCROLL_AD_DEFAULT_VIDEO,
                  enabled: true,
                  priority: nextPriority(prev),
                },
              ])
            }
          >
            Ajouter renard.mp4
          </Button>
        </div>
      </div>

      <Button type="button" disabled={busy} onClick={() => void save()}>
        Enregistrer
      </Button>
    </section>
  );
}
