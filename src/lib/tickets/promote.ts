import { getAppConfig, setScrollAdCampaign } from "@/lib/content-source";
import { prisma, withDbRetry } from "@/lib/prisma";
import { parseScrollAdVideos, SCROLL_AD_MAX_VIDEOS } from "@/lib/scroll-ad";
import { eventPosterUrl } from "@/lib/tickets/posters";

export async function promoteEvent(input: {
  eventId: string;
  ownerUserId: string;
}) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
  });
  if (!event) throw new Error("Événement introuvable");
  if (event.status !== "ON_SALE") {
    throw new Error("Publie la vente avant de lancer les pubs");
  }

  const ctaUrl = `/events/${event.id}`;
  const cover = eventPosterUrl(event.imageUrl, event.id);
  const campaign = await withDbRetry(() =>
    prisma.brandCampaign.create({
      data: {
        title: `Billets · ${event.title}`.slice(0, 120),
        kind: "FEED",
        objective: "CONVERSION",
        status: "ACTIVE",
        body: `${event.organizerName} · ${event.venue}, ${event.city}`.slice(
          0,
          280,
        ),
        mediaUrl: cover,
        ctaUrl,
        eventId: event.id,
        ownerUserId: input.ownerUserId,
        startsAt: new Date(),
        endsAt: event.salesEndsAt ?? event.startsAt,
      },
    }),
  );
  if (cover) {
    const cfg = await getAppConfig();
    const existing = parseScrollAdVideos(cfg.scrollAd.videos, false);
    const without = existing.filter((clip) => clip.eventId !== event.id);
    const next = [
      {
        url: cover,
        enabled: true,
        priority: 1,
        eventId: event.id,
      },
      ...without.map((clip, index) => ({
        ...clip,
        priority: index + 2,
      })),
    ].slice(0, SCROLL_AD_MAX_VIDEOS);
    await setScrollAdCampaign({
      enabled: true,
      videos: next,
    });
  }

  return { campaign };
}
