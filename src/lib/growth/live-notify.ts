import { createAppNoticesMany } from "@/lib/app-notice";
import { listCreatorSubscriberIds } from "@/lib/growth/subscribers";

/** Notifie les abonnés (cloche) qu’un live vient de démarrer. */
export async function notifySubscribersLiveStarted(input: {
  hostUserId: string;
  hostName: string;
  liveId: string;
  liveTitle: string;
}) {
  try {
    const subscriberIds = await listCreatorSubscriberIds(input.hostUserId);
    if (!subscriberIds.length) return 0;
    const name = input.hostName.trim() || "Un créateur";
    return await createAppNoticesMany(subscriberIds, {
      title: `${name} est en live`,
      body: input.liveTitle.trim() || "Rejoins le live shopping maintenant.",
      href: `/live/${input.liveId}`,
    });
  } catch (error) {
    console.error("[live-notify]", error);
    return 0;
  }
}
