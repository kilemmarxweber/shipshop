/** Pub/sub in-process pour réveiller les flux SSE RTC (dev + mono-instance). */

type WakeFn = () => void;

const waiters = new Map<string, Set<WakeFn>>();

function key(liveId: string, peerId: string) {
  return `${liveId}::${peerId}`;
}

export function wakeLiveRtcPeer(liveId: string, peerId: string) {
  const set = waiters.get(key(liveId, peerId));
  if (!set?.size) return;
  for (const fn of [...set]) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function onLiveRtcWake(
  liveId: string,
  peerId: string,
  fn: WakeFn,
): () => void {
  const k = key(liveId, peerId);
  let set = waiters.get(k);
  if (!set) {
    set = new Set();
    waiters.set(k, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (!set!.size) waiters.delete(k);
  };
}
