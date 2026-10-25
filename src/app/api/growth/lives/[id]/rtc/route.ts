import { connection } from "next/server";
import { getSession } from "@/lib/session";
import { consumeRtcSignals } from "@/lib/growth/live-rtc";
import { onLiveRtcWake } from "@/lib/growth/live-rtc-bus";
import { LIVE_RTC_SSE_FALLBACK_MS } from "@/lib/growth/live-rtc-shared";

/**
 * SSE temps réel pour le signaling WebRTC (style WS Klambo, mono-instance + poll secours).
 * GET /api/growth/lives/:id/rtc?peerId=
 * (pas de `export const dynamic` / `runtime` — incompatibles avec cacheComponents Next 16)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id: liveId } = await params;
  const url = new URL(req.url);
  const peerId =
    url.searchParams.get("peerId")?.trim() || session.user.id;
  if (peerId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubWake: (() => void) | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubWake?.();
        unsubWake = null;
        if (fallbackTimer) clearInterval(fallbackTimer);
        fallbackTimer = null;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        try {
          controller.close();
        } catch {
          /* ignore — "Error in input stream" si client déjà parti */
        }
      };

      const flush = async () => {
        if (closed) return;
        try {
          const signals = await consumeRtcSignals(liveId, peerId, 80);
          if (closed || !signals.length) return;
          send("signals", {
            signals: signals.map((s) => ({
              ...s,
              createdAt:
                typeof s.createdAt === "string"
                  ? s.createdAt
                  : new Date(s.createdAt).toISOString(),
            })),
          });
        } catch (error) {
          if (!closed) console.error("[live-rtc-sse] flush", error);
        }
      };

      send("ready", { liveId, peerId });
      void flush();

      unsubWake = onLiveRtcWake(liveId, peerId, () => {
        void flush();
      });
      fallbackTimer = setInterval(() => void flush(), LIVE_RTC_SSE_FALLBACK_MS);
      pingTimer = setInterval(() => send("ping", { t: Date.now() }), 15_000);

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      unsubWake?.();
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (pingTimer) clearInterval(pingTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
