"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronRight, Heart, Play, Radio, Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { categoryLook, categoryMood, compactCount } from "@/lib/growth/challenge-look";
import { useGrowthSurface } from "@/lib/growth/use-growth-surface";
import { ChallengeCard } from "@/components/growth/challenge-card";
import { Face } from "@/components/growth/cover-image";
import { templateFor } from "@/lib/growth/challenge-place";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { FeedSoundtrackPlayer } from "@/components/feed-soundtrack-player";
import {
  VideoSoundButton,
  type VideoSoundState,
} from "@/components/video-sound-button";

export type HighlightPlayback = {
  clipMs: number;
  soundFor: (key: string) => VideoSoundState;
  focused: (key: string) => boolean;
  onVisible: (key: string, visible: boolean) => void;
  onActivateSound: (key: string) => void;
  onPlaybackEnded: (key: string) => void;
  onSoundChange: (key: string, next: VideoSoundState) => void;
};

export function highlightAudioKey(id: string) {
  return `highlight:${id}`;
}

export function GrowthFeedFormats({
  variant = "feed",
  pinChallenges = false,
  playback,
}: {
  variant?: "feed" | "discover";
  pinChallenges?: boolean;
  playback?: HighlightPlayback;
}) {
  const { t, locale } = useI18n();
  const { surface, challenges, busyId, joinChallenge } = useGrowthSurface();
  const discover = variant === "discover";
  const stories = surface?.stories ?? [];
  const lives = surface?.lives ?? [];
  const highlights = surface?.highlights ?? [];
  const lead = challenges.find((row) => !row.done) ?? null;
  const storyIds = stories.map((story) => story.id).join(",");

  useEffect(() => {
    for (const story of stories.slice(0, 4)) {
      void fetchJson(`/api/growth/campaigns/${story.id}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "impression" }),
      });
    }
  }, [storyIds, stories]);

  if (
    (!pinChallenges || !lead) &&
    stories.length === 0 &&
    lives.length === 0 &&
    highlights.length === 0
  ) {
    return null;
  }

  return (
    <div className={discover ? "mb-6 space-y-5" : "space-y-3 px-4 pb-3"}>
      {lives.length > 0 ? (
        <Link
          href="/live"
          className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] font-semibold"
        >
          <Radio className="size-3.5 text-destructive" />
          {lives.length} live{lives.length > 1 ? "s" : ""} · {lives[0]?.user.name}
        </Link>
      ) : null}

      {pinChallenges && lead ? (
        <ChallengeCard
          key={lead.id}
          challenge={lead}
          template={templateFor(lead.id, 0)}
          busy={busyId === lead.id}
          onJoin={() => void joinChallenge(lead.id)}
        />
      ) : null}

      {discover && highlights.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="font-heading text-[1.35rem] font-bold tracking-tight sm:text-[1.6rem]">
              {t("nav.discover")}
            </h2>
            <Link
              href="#discover-results"
              className="inline-flex items-center gap-0.5 pb-0.5 text-sm font-medium text-white/55 hover:text-white"
            >
              {t("discover.seeAll")}
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {highlights.map((item, index) => {
              const isMoment = item.hasVideo && index === 0;
              const cardKey = highlightAudioKey(item.id);
              const media = item.images?.length ? item.images : item.imageUrl ? [item.imageUrl] : [];
              const playMoment = Boolean(isMoment && playback && media.length);
              return (
                <article
                  key={item.id}
                  data-feed-card={playMoment ? "" : undefined}
                  data-audio-key={playMoment ? cardKey : undefined}
                  {...(playMoment &&
                  playback &&
                  !playback.soundFor(cardKey).muted
                    ? { "data-feed-sound-on": "1" }
                    : {})}
                  className="group relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-[#16161f]"
                >
                  {playMoment && playback ? (
                    <HighlightMomentMedia
                      cardKey={cardKey}
                      images={media}
                      soundtrackUrl={item.soundtrack?.audioUrl}
                      soundtrackStartMs={item.soundtrackStartMs}
                      clipMs={playback.clipMs}
                      sound={playback.soundFor(cardKey)}
                      focused={playback.focused(cardKey)}
                      onVisible={playback.onVisible}
                      onActivateSound={() => playback.onActivateSound(cardKey)}
                      onPlaybackEnded={() => playback.onPlaybackEnded(cardKey)}
                    />
                  ) : item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br",
                        categoryLook(item.category).wash,
                      )}
                    />
                  )}
                  <Link
                    href={`/product/${item.id}`}
                    className="absolute inset-0 z-10"
                  >
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                      {isMoment ? (
                        <>
                          <Play className="size-3 fill-white" />
                          {t("discover.videoOfMoment")}
                        </>
                      ) : (
                        categoryMood(item.category, locale)
                      )}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <Face
                            name={item.creator.name}
                            image={item.creator.image}
                          />
                          <span className="truncate text-[13px] font-semibold text-white">
                            {item.title}
                          </span>
                        </span>
                        <span className="mt-1 block pl-7 text-[11px] text-white/65">
                          {compactCount(item.viewsCount, locale)} {t("discover.views")}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-white">
                        <Heart className="size-3.5" />
                        {compactCount(item.likesCount, locale)}
                      </span>
                    </span>
                  </Link>
                  {playMoment && playback ? (
                    <div className="absolute top-2 right-2 z-20">
                      <VideoSoundButton
                        images={media}
                        hasSoundtrack={Boolean(item.soundtrack?.audioUrl)}
                        sound={playback.soundFor(cardKey)}
                        onChange={(next) => playback.onSoundChange(cardKey, next)}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {discover && stories.length > 0 ? (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5" /> {t("discover.storiesHeading")}
          </p>
          <div className="h-scroll h-scroll-fade gap-2.5">
            {stories.map((story) => {
              const href =
                story.ctaUrl ||
                (story.productId ? `/product/${story.productId}` : "/discover");
              return (
                <Link
                  key={story.id}
                  href={href}
                  onClick={() => {
                    void fetchJson(`/api/growth/campaigns/${story.id}/event`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "click" }),
                    });
                  }}
                  className="relative w-36 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <div
                    className="aspect-[3/4] bg-surface-2"
                    style={
                      story.mediaUrl
                        ? {
                            backgroundImage: `url(${story.mediaUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                    <p className="line-clamp-2 text-[11px] font-bold text-white">
                      {story.title}
                    </p>
                    <p className="text-[9px] font-semibold uppercase text-white/70">
                      {story.objective} · sponsorisé
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HighlightMomentMedia({
  cardKey,
  images,
  soundtrackUrl,
  soundtrackStartMs,
  clipMs,
  sound,
  focused,
  onVisible,
  onActivateSound,
  onPlaybackEnded,
}: {
  cardKey: string;
  images: string[];
  soundtrackUrl?: string;
  soundtrackStartMs?: number;
  clipMs: number;
  sound: VideoSoundState;
  focused: boolean;
  onVisible: (key: string, visible: boolean) => void;
  onActivateSound: () => void;
  onPlaybackEnded: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.querySelector(".app-main");
    const io = new IntersectionObserver(
      ([entry]) => {
        onVisible(cardKey, (entry?.intersectionRatio ?? 0) >= 0.08);
      },
      {
        root,
        rootMargin: "120px 0px 80px 0px",
        threshold: [0, 0.08, 0.2, 0.35, 0.6, 1],
      },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      onVisible(cardKey, false);
    };
  }, [cardKey, onVisible]);

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      {...(!sound.muted ? { "data-feed-sound-on": "1" } : {})}
    >
      <ProductImageCarousel
        images={images}
        className="absolute inset-0"
        showDots={false}
        intervalMs={3500}
        muted={sound.muted}
        volume={sound.volume}
        hasSoundtrack={Boolean(soundtrackUrl)}
        clipMs={soundtrackUrl ? clipMs : undefined}
        audioKey={cardKey}
        forcePlay={focused}
        onActivateSound={onActivateSound}
        onPlaybackEnded={soundtrackUrl ? undefined : onPlaybackEnded}
      />
      {soundtrackUrl ? (
        <FeedSoundtrackPlayer
          audioUrl={soundtrackUrl}
          startMs={soundtrackStartMs}
          sound={sound}
          active={focused}
          onCycleEnd={onPlaybackEnded}
        />
      ) : null}
    </div>
  );
}
