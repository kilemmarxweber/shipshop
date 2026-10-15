export type KlamboSendResponse = {
  id: string;
  status: string;
  channel: string;
  to: string;
  error?: string | null;
};

export class KlamboClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(this.url(path), { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Klambo ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async sendText(to: string, text: string) {
    const result = await this.request<KlamboSendResponse>("/v1/send", {
      method: "POST",
      body: JSON.stringify({
        channel: "whatsapp",
        type: "text",
        to,
        text,
      }),
    });
    if (result.status === "failed") {
      throw new Error(result.error || `Klambo failed (${result.id})`);
    }
    return result;
  }
}
