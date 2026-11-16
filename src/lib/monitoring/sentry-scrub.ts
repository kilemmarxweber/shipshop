const SENSITIVE_KEY =
  /(password|authorization|cookie|otp|secret|api[-_]?key|set-auth-token|token|^code$)/i;

export function scrubString(value: string) {
  return value
    .replace(/bearer\s+\S+/gi, "Bearer [Filtered]")
    .replace(/MDP temporaire\s*:\s*\S+/gi, "MDP temporaire : [Filtered]");
}

export function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[Filtered]" : scrubValue(item);
    }
    return out;
  }
  if (typeof value === "string") return scrubString(value);
  return value;
}

type Crumb = { message?: string; data?: unknown };
type SentryLike = {
  message?: string;
  request?: {
    headers?: Record<string, unknown>;
    data?: unknown;
    cookies?: unknown;
  };
  extra?: unknown;
  contexts?: unknown;
  breadcrumbs?: Crumb[];
};

/** Retire jetons, mots de passe et OTP avant envoi à Sentry. */
export function scrubSentryEvent<T extends SentryLike>(event: T): T {
  if (typeof event.message === "string") {
    event.message = scrubString(event.message);
  }
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubValue(event.request.headers) as Record<
        string,
        unknown
      >;
    }
    if ("data" in event.request) {
      event.request.data = scrubValue(event.request.data);
    }
    if (event.request.cookies) event.request.cookies = "[Filtered]";
  }
  if (event.extra) event.extra = scrubValue(event.extra);
  if (event.contexts) event.contexts = scrubValue(event.contexts);
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === "string") {
        crumb.message = scrubString(crumb.message);
      }
      if (crumb.data) crumb.data = scrubValue(crumb.data);
    }
  }
  return event;
}
