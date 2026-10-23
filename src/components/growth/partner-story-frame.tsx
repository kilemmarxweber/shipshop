"use client";

import { cn } from "@/lib/utils";
import {
  normalizeStoryTemplate,
  type StoryTemplateId,
} from "@/lib/growth/story-templates";

export type PartnerStoryFrameProps = {
  title: string;
  body?: string | null;
  mediaUrl?: string | null;
  category?: string | null;
  template?: StoryTemplateId;
  className?: string;
  /** Affiche le badge « Sponsorisé » comme sur Découvrir */
  sponsoredLabel?: string;
};

/** Cadre visuel d’une story partenaire — même rendu admin & Découvrir. */
export function PartnerStoryFrame({
  title,
  body,
  mediaUrl,
  category,
  template: templateProp,
  className,
  sponsoredLabel = "Sponsorisé",
}: PartnerStoryFrameProps) {
  const template = templateProp ?? normalizeStoryTemplate(category);
  const cover = mediaUrl?.trim() || null;
  const headline = title.trim() || "Titre de la story";
  const copy = (body ?? "").trim();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-[#14141a]",
        className,
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#1a1a22]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className={cn(
              "absolute inset-0 size-full object-cover",
              template === "quote" && "scale-110 blur-[2px] brightness-75",
            )}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2a2438] via-[#1a1a22] to-[#0e0e12]" />
        )}

        {template === "quote" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 px-2.5 text-center">
            <p className="line-clamp-4 text-[12px] font-bold leading-snug text-balance text-white drop-shadow">
              {copy || headline}
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-white/65">
              {sponsoredLabel}
            </p>
          </div>
        ) : null}

        {template === "split" ? (
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[#121218]/95 px-2 pt-2 backdrop-blur-sm">
            <p className="line-clamp-2 text-[11px] font-bold text-balance text-white">
              {headline}
            </p>
            {copy ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-pretty text-white/70">
                {copy}
              </p>
            ) : null}
          </div>
        ) : null}

        {template === "product" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-10">
            <p className="line-clamp-2 text-[11px] font-extrabold text-balance text-white">
              {headline}
            </p>
            {copy ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] text-pretty text-white/75">
                {copy}
              </p>
            ) : null}
            <span className="mt-1.5 inline-flex rounded-full bg-[#7dffb3] px-2 py-0.5 text-[9px] font-bold text-black">
              Voir
            </span>
          </div>
        ) : null}

        {template === "cover" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
            <p className="line-clamp-2 text-[11px] font-bold text-balance text-white">
              {headline}
            </p>
            {copy ? (
              <p className="mt-0.5 line-clamp-2 text-[9px] text-pretty text-white/75">
                {copy}
              </p>
            ) : (
              <p className="text-[9px] font-semibold uppercase text-white/70">
                {sponsoredLabel}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
