export type AppNotice = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
};

const GAP_MS = 15_000;
const listeners = new Set<(notices: AppNotice[]) => void>();

let timer: number | null = null;
let inflight = false;
let lastAt = 0;

async function pull() {
  if (typeof window === "undefined" || listeners.size === 0) return;
  const now = Date.now();
  if (inflight || now - lastAt < GAP_MS) return;
  inflight = true;
  lastAt = now;
  try {
    const res = await fetch("/api/notices");
    if (!res.ok) return;
    const json = (await res.json()) as { notices?: AppNotice[] };
    const notices = json.notices ?? [];
    for (const listener of listeners) listener(notices);
  } catch {
    /* réseau */
  } finally {
    inflight = false;
  }
}

/** Un seul poll partagé, même si le composant se remonte en boucle. */
export function subscribeNotices(listener: (notices: AppNotice[]) => void) {
  listeners.add(listener);
  if (timer == null) {
    void pull();
    timer = window.setInterval(() => void pull(), GAP_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}
