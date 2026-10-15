/** Parse a fetch Response as JSON, tolerating empty bodies. */
export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ res: Response; data: T | null }> {
  const res = await fetch(input, init);
  const text = await res.text();
  if (!text) {
    return { res, data: null };
  }
  try {
    return { res, data: JSON.parse(text) as T };
  } catch {
    return { res, data: null };
  }
}
