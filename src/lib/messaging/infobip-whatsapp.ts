import { randomUUID } from "crypto";
import { InfobipSmsError, infobipDestination } from "@/lib/messaging/infobip-sms";

export async function sendInfobipWhatsappTemplate(input: {
  apiKey: string;
  baseUrl: string;
  from: string;
  to: string;
  templateName: string;
  language: string;
  placeholders: string[];
}) {
  const messageId = randomUUID();
  const res = await fetch(
    `${input.baseUrl.replace(/\/$/, "")}/whatsapp/1/message/template`,
    {
      method: "POST",
      headers: {
        Authorization: `App ${input.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: input.from,
            to: infobipDestination(input.to),
            messageId,
            content: {
              templateName: input.templateName,
              templateData: { body: { placeholders: input.placeholders } },
              language: input.language,
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new InfobipSmsError(text || `Infobip WA ${res.status}`, res.status);
  }
  return { messageId };
}

export async function sendInfobipWhatsappText(input: {
  apiKey: string;
  baseUrl: string;
  from: string;
  to: string;
  text: string;
}) {
  const messageId = randomUUID();
  const res = await fetch(
    `${input.baseUrl.replace(/\/$/, "")}/whatsapp/1/message/text`,
    {
      method: "POST",
      headers: {
        Authorization: `App ${input.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: input.from,
            to: infobipDestination(input.to),
            messageId,
            content: { text: input.text },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new InfobipSmsError(text || `Infobip WA ${res.status}`, res.status);
  }
  return { messageId };
}
