"use client";

import { cn, formatMoney } from "@/lib/utils";
import { Heart } from "lucide-react";
import type { CSSProperties } from "react";

export type LiveBurstKind = "like" | "gift";

export type LiveBurst = {
  id: string;
  kind: LiveBurstKind;
  amountCents?: number;
};

const FLOWERS = ["🌸", "🌺", "🌼", "💮", "🌹", "🌷", "💐"];
const BILLS = ["💵", "💸", "💚"];
const SPARKS = ["✦", "✧", "★", "✶"];

function bits(id: string, n: number) {
  const out: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    out.push((h >>> 0) / 2 ** 32);
  }
  return out;
}

export function LiveStageBurst({ bursts }: { bursts: LiveBurst[] }) {
  if (bursts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      {bursts.map((burst) =>
        burst.kind === "like" ? (
          <LikeBurst key={burst.id} id={burst.id} />
        ) : (
          <GiftBurst
            key={burst.id}
            id={burst.id}
            amountCents={burst.amountCents ?? 0}
          />
        ),
      )}
    </div>
  );
}

function LikeBurst({ id }: { id: string }) {
  const rnd = bits(id, 64);
  return (
    <div className="absolute inset-0">
      <span className="live-burst-flash live-burst-flash-like" />
      <span className="live-burst-rays" />
      {Array.from({ length: 22 }, (_, i) => {
        const ang = (i / 22) * Math.PI * 2 + rnd[i] * 0.4;
        const dist = 90 + rnd[i + 22] * 140;
        return (
          <span
            key={`h-${i}`}
            className="live-burst-bit"
            style={
              {
                "--dx": `${Math.cos(ang) * dist}px`,
                "--dy": `${Math.sin(ang) * dist}px`,
                "--rot": `${rnd[i] * 80 - 40}deg`,
                animationDelay: `${rnd[i] * 90}ms`,
                animationDuration: `${900 + rnd[i + 8] * 500}ms`,
              } as CSSProperties
            }
          >
            <Heart
              className="fill-pink-400 text-pink-300 drop-shadow-[0_0_10px_rgba(255,80,160,0.9)]"
              style={{
                width: 18 + rnd[i + 4] * 22,
                height: 18 + rnd[i + 4] * 22,
              }}
            />
          </span>
        );
      })}
      {Array.from({ length: 28 }, (_, i) => {
        const ang = (i / 28) * Math.PI * 2;
        const dist = 40 + rnd[i + 30] * 160;
        return (
          <span
            key={`s-${i}`}
            className="live-burst-bit live-burst-spark"
            style={
              {
                "--dx": `${Math.cos(ang) * dist}px`,
                "--dy": `${Math.sin(ang) * dist}px`,
                "--rot": `${rnd[i] * 180}deg`,
                animationDelay: `${40 + rnd[i] * 120}ms`,
                color: i % 2 ? "#FFD6EE" : "#FFF4B0",
                fontSize: `${10 + rnd[i] * 14}px`,
              } as CSSProperties
            }
          >
            {SPARKS[i % SPARKS.length]}
          </span>
        );
      })}
    </div>
  );
}

function GiftBurst({ id, amountCents }: { id: string; amountCents: number }) {
  const rnd = bits(id, 48);
  return (
    <div className="absolute inset-0">
      <span className="live-burst-flash live-burst-flash-gift" />
      {Array.from({ length: 16 }, (_, i) => {
        const ang = (i / 16) * Math.PI * 2 + rnd[i] * 0.5;
        const dist = 70 + rnd[i + 16] * 150;
        return (
          <span
            key={`f-${i}`}
            className="live-burst-bit"
            style={
              {
                "--dx": `${Math.cos(ang) * dist}px`,
                "--dy": `${Math.sin(ang) * dist - 20}px`,
                "--rot": `${rnd[i] * 140 - 70}deg`,
                animationDelay: `${rnd[i] * 110}ms`,
                animationDuration: `${1100 + rnd[i] * 600}ms`,
                fontSize: `${22 + rnd[i] * 18}px`,
              } as CSSProperties
            }
          >
            {FLOWERS[i % FLOWERS.length]}
          </span>
        );
      })}
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2 + 0.3;
        const dist = 50 + rnd[i + 8] * 170;
        return (
          <span
            key={`b-${i}`}
            className="live-burst-bit"
            style={
              {
                "--dx": `${Math.cos(ang) * dist}px`,
                "--dy": `${Math.sin(ang) * dist}px`,
                "--rot": `${-50 + rnd[i] * 100}deg`,
                animationDelay: `${60 + rnd[i] * 140}ms`,
                fontSize: `${20 + rnd[i] * 16}px`,
              } as CSSProperties
            }
          >
            {BILLS[i % BILLS.length]}
          </span>
        );
      })}
      {amountCents > 0 ? (
        <span
          className={cn(
            "live-burst-amount absolute top-1/2 left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2",
            "rounded-full px-4 py-1.5 text-2xl font-black tabular-nums text-[#7dffb3]",
            "[text-shadow:0_0_18px_rgba(125,255,179,0.95),0_2px_8px_rgba(0,0,0,0.55)]",
          )}
        >
          {formatMoney(amountCents)}
        </span>
      ) : null}
    </div>
  );
}
