export class InfobipSmsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "InfobipSmsError";
    this.status = status;
  }
}

export const DEFAULT_INFOBIP_BASE_URL = "https://l2gerd.api.infobip.com";
export const DEFAULT_INFOBIP_SENDER = "ChipShop";

export function infobipDestination(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new InfobipSmsError("Numéro destinataire invalide.", 400);
  }
  return digits;
}

async function readInfobipError(res: Response) {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as {
      requestError?: { serviceException?: { text?: string } };
      description?: string;
    };
    return (
      data.requestError?.serviceException?.text ||
      data.description ||
      `Infobip a répondu ${res.status}`
    );
  } catch {
    return `Infobip a répondu ${res.status}`;
  }
}

export async function sendInfobipSms(input: {
  apiKey: string;
  baseUrl: string;
  sender: string;
  to: string;
  text: string;
}) {
  const res = await fetch(`${input.baseUrl.replace(/\/$/, "")}/sms/3/messages`, {
    method: "POST",
    headers: {
      Authorization: `App ${input.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          destinations: [{ to: infobipDestination(input.to) }],
          sender: input.sender,
          content: { text: input.text },
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new InfobipSmsError(await readInfobipError(res), res.status);
  }
  const data = (await res.json()) as {
    messages?: Array<{ messageId?: string; status?: { groupName?: string } }>;
  };
  const message = data.messages?.[0];
  if (!message?.messageId || message.status?.groupName?.toUpperCase() === "REJECTED") {
    throw new InfobipSmsError("Infobip n'a pas accepté le SMS.", 502);
  }
  return { messageId: message.messageId };
}
