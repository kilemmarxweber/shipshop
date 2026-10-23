"use client";

import Link from "next/link";
import { useId } from "react";
import { ChevronRight, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { categoryMood } from "@/lib/growth/challenge-look";
import type { UserLocale } from "@/lib/user-locale";
import type {
  ChallengeCardModel,
  ChallengeTemplate,
} from "@/lib/growth/challenge-place";
import { CoverImage, Face } from "@/components/growth/cover-image";

function coverList(challenge: ChallengeCardModel) {
  if (challenge.coverCandidates?.length) return challenge.coverCandidates;
  return challenge.coverUrl ? [challenge.coverUrl] : [];
}

function JoinButton({
  done,
  busy,
  onJoin,
  compact,
}: {
  done: boolean;
  busy: boolean;
  onJoin: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      disabled={busy || done}
      onClick={onJoin}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#ff4f8b] via-[#ff7d86] to-[#ffb48c] font-semibold tracking-wide whitespace-nowrap text-white shadow-[0_10px_26px_rgba(255,79,139,0.4)]",
        compact
          ? "h-8 px-3 text-[11px] sm:h-9 sm:px-4 sm:text-[12px]"
          : "h-9 px-3.5 text-[12px] sm:h-11 sm:px-5 sm:text-[14px]",
      )}
    >
      {done ? t("discover.challengeJoined") : t("discover.challengeJoinPlus")}
    </button>
  );
}

function CategoryChip({
  challenge,
  locale,
}: {
  challenge: ChallengeCardModel;
  locale: UserLocale;
}) {
  return (
    <p className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/8 py-1 pr-2.5 pl-1 text-[11px] font-medium text-[#f4c9d8] ring-1 ring-white/10 sm:text-[13px]">
      <span className="relative size-6 shrink-0 overflow-hidden rounded-full bg-[#f4d0c2] ring-2 ring-[#ffd7e4]/70 sm:size-7">
        {coverList(challenge)[0] ? (
          <CoverImage
            candidates={coverList(challenge)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <Sparkles className="absolute inset-0 m-auto size-3 text-[#ffd7e4]" />
        )}
      </span>
      <span className="truncate">{categoryMood(challenge.category, locale)}</span>
    </p>
  );
}

function Faces({
  faces,
  count,
  compact,
}: {
  faces: { name: string; image: string | null }[];
  count: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-2 text-white/65",
        compact ? "text-[11px]" : "text-[12px] sm:text-[13px]",
      )}
    >
      {faces.length > 0 ? (
        <span className="flex -space-x-2">
          {faces.slice(0, 2).map((face, index) => (
            <Face
              key={`${face.name}-${index}`}
              {...face}
              size={compact ? "sm" : "md"}
            />
          ))}
        </span>
      ) : (
        <Face name="?" image={null} size={compact ? "sm" : "md"} />
      )}
      <span className="truncate">
        {count}{" "}
        {count > 1
          ? t("discover.participantsOther")
          : t("discover.participants")}
      </span>
    </p>
  );
}

export function ChallengeCard({
  challenge,
  template,
  busy,
  onJoin,
  className,
  size = "card",
}: {
  challenge: ChallengeCardModel;
  template: ChallengeTemplate;
  busy?: boolean;
  onJoin: () => void;
  className?: string;
  size?: "card" | "feed";
}) {
  const { t, locale } = useI18n();
  const coverClipId = `challenge-cover-${useId().replace(/:/g, "")}`;
  const covers = coverList(challenge);
  const faces = challenge.participants ?? [];
  const count = challenge.completions;
  const feed = size === "feed";
  const heading =
    template === "poster" || template === "pulse"
      ? t("discover.challengePulse")
      : template === "ribbon"
        ? t("discover.challengeMission")
        : t("discover.challengeHeading");
  const frame =
    "h-[268px] sm:h-[292px] lg:h-[320px] [transform:translateZ(0)] [isolation:isolate]";

  if (template === "poster") {
    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-[1.85rem] bg-[#0e0e16] sm:rounded-[2rem]",
          frame,
          className,
        )}
      >
        <CoverImage
          candidates={covers}
          className="absolute inset-0 size-full object-cover object-[center_20%] saturate-[1.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e16] via-[#0e0e16]/75 to-[#0e0e16]/20" />
        <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#201820] sm:text-[11px]">
              <Trophy className="size-3 text-[#e0b21a]" />
              {heading}
            </p>
            <h2
              className={cn(
                "mt-3 font-heading leading-none font-bold text-white",
                feed
                  ? "line-clamp-3 text-[1.8rem] sm:text-[2.2rem]"
                  : "line-clamp-2 text-[1.35rem] sm:text-[1.8rem]",
              )}
            >
              {challenge.title}
            </h2>
            <p
              className={cn(
                "mt-2 max-w-[32rem] text-white/70",
                feed
                  ? "line-clamp-4 text-[14px] sm:text-[16px]"
                  : "line-clamp-2 text-[12px] sm:text-[14px]",
              )}
            >
              {challenge.body}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Faces faces={faces} count={count} />
            <JoinButton done={challenge.done} busy={Boolean(busy)} onJoin={onJoin} />
          </div>
        </div>
      </section>
    );
  }

  if (template === "stack") {
    return (
      <section
        className={cn(
          "flex flex-col overflow-hidden rounded-[1.85rem] bg-[#0e0e16] sm:rounded-[2rem]",
          frame,
          className,
        )}
      >
        <div className="relative h-[140px] sm:h-[160px]">
          <CoverImage
            candidates={covers}
            className="absolute inset-0 size-full object-cover object-[center_18%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e16] via-transparent to-black/20" />
          <p className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#201820]">
            <Trophy className="size-3 text-[#e0b21a]" />
            {heading}
          </p>
        </div>
        <div className="px-4 py-3.5 sm:px-5 sm:py-4">
          <CategoryChip challenge={challenge} locale={locale} />
          <h2
            className={cn(
              "mt-2 font-heading font-bold text-white",
              feed
                ? "line-clamp-2 text-[1.5rem] sm:text-[1.85rem]"
                : "line-clamp-1 text-[1.2rem] sm:text-[1.5rem]",
            )}
          >
            {challenge.title}
          </h2>
          <p
            className={cn(
              "mt-1 text-white/50",
              feed
                ? "line-clamp-3 text-[13px] sm:text-[15px]"
                : "line-clamp-2 text-[12px] sm:text-[13px]",
            )}
          >
            {challenge.body}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Faces faces={faces} count={count} compact />
            <JoinButton
              done={challenge.done}
              busy={Boolean(busy)}
              onJoin={onJoin}
              compact
            />
          </div>
        </div>
      </section>
    );
  }

  if (template === "pulse") {
    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-[1.85rem] bg-[linear-gradient(135deg,#1a1220_0%,#0e0e16_55%,#241018_100%)] sm:rounded-[2rem]",
          frame,
          className,
        )}
      >
        <div className="absolute inset-y-6 right-[-18px] w-[46%] overflow-hidden rounded-[2rem] bg-[#f4d0c2] shadow-[-18px_0_40px_rgba(0,0,0,0.28)] sm:right-[-12px] sm:w-[42%]">
          <CoverImage
            candidates={covers}
            className="absolute inset-0 size-full object-cover object-[center_18%] saturate-[1.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#1a1220]/35" />
        </div>
        <div className="relative z-10 flex h-full w-[58%] flex-col justify-between px-4 py-4 sm:w-[56%] sm:px-5 sm:py-5">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#ff4f8b]/18 px-2.5 py-1 text-[10px] font-semibold text-[#ffd0dc] ring-1 ring-[#ff4f8b]/30 sm:text-[11px]">
              <Trophy className="size-3 text-[#ffd36a]" />
              {heading}
            </p>
            <h2
              className={cn(
                "mt-2.5 font-heading leading-none font-bold text-white",
                feed
                  ? "line-clamp-3 text-[1.6rem] sm:text-[2rem]"
                  : "line-clamp-2 text-[1.25rem] sm:text-[1.6rem]",
              )}
            >
              {challenge.title}
            </h2>
            <p
              className={cn(
                "mt-2 text-white/55",
                feed
                  ? "line-clamp-4 text-[13px] sm:text-[15px]"
                  : "line-clamp-2 text-[12px] sm:text-[13px]",
              )}
            >
              {challenge.body}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Faces faces={faces} count={count} compact />
            <JoinButton
              done={challenge.done}
              busy={Boolean(busy)}
              onJoin={onJoin}
              compact
            />
          </div>
        </div>
      </section>
    );
  }

  if (template === "ribbon") {
    return (
      <section
        className={cn(
          "relative flex overflow-hidden rounded-[1.5rem] bg-[#0e0e16] sm:rounded-[1.75rem]",
          frame,
          className,
        )}
      >
        <div className="relative w-[34%] shrink-0 overflow-hidden rounded-l-[1.5rem] rounded-r-[1.1rem] bg-[#f4d0c2] sm:rounded-l-[1.75rem]">
          <CoverImage
            candidates={covers}
            className="absolute inset-0 size-full object-cover object-[center_18%]"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-3 sm:px-4">
          <div>
            <p className="text-[10px] font-bold tracking-wide text-[#f4c9d8] uppercase">
              {heading}
            </p>
            <h2
              className={cn(
                "mt-1 font-heading font-bold text-white",
                feed
                  ? "line-clamp-2 text-[1.35rem] sm:text-[1.6rem]"
                  : "line-clamp-1 text-[1.05rem] sm:text-[1.25rem]",
              )}
            >
              {challenge.title}
            </h2>
            <p
              className={cn(
                "mt-1 text-white/50",
                feed
                  ? "line-clamp-4 text-[13px] sm:text-[14px]"
                  : "line-clamp-2 text-[11px]",
              )}
            >
              {challenge.body}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Faces faces={faces} count={count} compact />
            <JoinButton
              done={challenge.done}
              busy={Boolean(busy)}
              onJoin={onJoin}
              compact
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.85rem] bg-[#0e0e16] sm:rounded-[2rem]",
        frame,
        className,
      )}
    >
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
        <defs>
          <clipPath id={coverClipId} clipPathUnits="objectBoundingBox">
            <path d="M0.05 0 H0.86 C0.905 0 0.93 0.02 0.94 0.06 L0.995 0.93 C1 0.97 0.97 1 0.93 1 H0.05 C0.02 1 0 0.98 0 0.95 V0.05 C0 0.02 0.02 0 0.05 0 Z" />
          </clipPath>
        </defs>
      </svg>
      <div
        className="absolute inset-y-0 left-0 z-0 w-[40%] bg-[#f4d0c2] sm:w-[38%]"
        style={{
          clipPath: `url(#${coverClipId})`,
          WebkitClipPath: `url(#${coverClipId})`,
        }}
      >
        <CoverImage
          candidates={covers}
          className="absolute inset-0 size-full object-cover object-[center_18%] saturate-[1.08] contrast-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#f6c8b8]/30 via-transparent to-white/20" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#3a2018]/40 to-transparent" />
        <p className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#201820] shadow-[0_8px_20px_rgba(20,10,20,0.14)] sm:text-[11px]">
          <Trophy className="size-3 text-[#e0b21a]" />
          {heading}
        </p>
        <p
          className="absolute inset-x-3 bottom-4 z-10 max-w-[78%] text-center text-[1.35rem] leading-[0.9] text-white sm:text-[1.8rem] lg:text-[2.05rem]"
          style={{
            fontFamily:
              '"Segoe Script","Brush Script MT","Apple Chancery","Palatino Linotype",cursive',
            textShadow: "0 10px 28px rgba(20,10,16,0.4)",
          }}
        >
          {challenge.title}
        </p>
      </div>

      <div className="relative z-10 ml-[42%] flex h-full min-w-0 flex-col justify-between px-3 py-4 sm:ml-[41%] sm:px-6 sm:py-5">
        <div className="min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <CategoryChip challenge={challenge} locale={locale} />
            <Link
              href="/community"
              aria-label={t("discover.seeAll")}
              className="grid size-7 shrink-0 place-items-center text-white/40 transition hover:text-white"
            >
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <h2
            className={cn(
              "mt-2 font-heading leading-none font-bold tracking-tight text-white",
              feed
                ? "line-clamp-3 text-[1.7rem] sm:text-[2.1rem] lg:text-[2.3rem]"
                : "line-clamp-1 text-[1.25rem] sm:text-[1.75rem] lg:text-[1.95rem]",
            )}
          >
            {challenge.title}
          </h2>
          <p
            className={cn(
              "mt-2 leading-relaxed text-white/50",
              feed
                ? "line-clamp-4 text-[14px] sm:text-[16px]"
                : "line-clamp-2 text-[12px] sm:text-[14px]",
            )}
          >
            {challenge.body}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2.5">
          <Faces faces={faces} count={count} />
          <JoinButton done={challenge.done} busy={Boolean(busy)} onJoin={onJoin} />
        </div>
      </div>
    </section>
  );
}
