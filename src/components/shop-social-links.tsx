"use client";

import { cn } from "@/lib/utils";

export type ShopSocialUrls = {
  contactPhone?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
};

function waHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : `tel:${phone}`;
}

export function ShopSocialLinks({
  socials,
  className,
}: {
  socials: ShopSocialUrls;
  className?: string;
}) {
  const phone = socials.contactPhone?.trim() || null;
  const tiktok = socials.tiktokUrl?.trim() || null;
  const instagram = socials.instagramUrl?.trim() || null;
  const facebook = socials.facebookUrl?.trim() || null;
  const x = socials.xUrl?.trim() || null;
  if (!phone && !tiktok && !instagram && !facebook && !x) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {phone ? (
        <a
          href={waHref(phone)}
          target="_blank"
          rel="noreferrer"
          className="grid size-10 place-items-center rounded-full bg-[#25D366] text-xs font-extrabold text-white"
          aria-label="WhatsApp"
        >
          WA
        </a>
      ) : null}
      {tiktok ? (
        <a
          href={tiktok}
          target="_blank"
          rel="noreferrer"
          className="grid size-10 place-items-center rounded-full bg-[#111] text-[11px] font-extrabold text-white"
          aria-label="TikTok"
        >
          TT
        </a>
      ) : null}
      {instagram ? (
        <a
          href={instagram}
          target="_blank"
          rel="noreferrer"
          className="grid size-10 place-items-center rounded-full bg-[#E1306C] text-[11px] font-extrabold text-white"
          aria-label="Instagram"
        >
          IG
        </a>
      ) : null}
      {facebook ? (
        <a
          href={facebook}
          target="_blank"
          rel="noreferrer"
          className="grid size-10 place-items-center rounded-full bg-[#1877F2] text-[11px] font-extrabold text-white"
          aria-label="Facebook"
        >
          f
        </a>
      ) : null}
      {x ? (
        <a
          href={x}
          target="_blank"
          rel="noreferrer"
          className="grid size-10 place-items-center rounded-full bg-black text-[11px] font-extrabold text-white"
          aria-label="X"
        >
          𝕏
        </a>
      ) : null}
    </div>
  );
}
