import { getEmailLogoSrc } from "./email-logo";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function appDisplayName() {
  return (
    process.env.APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "ShipShop"
  );
}

export function publicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getEmailContactInfo() {
  const name =
    process.env.CONTACT_NAME?.trim() || appDisplayName();
  const email =
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "";
  const phone = process.env.CONTACT_PHONE?.trim() || "";
  return { name, email, phone, logoUrl: getEmailLogoSrc() };
}

export function emailInfoCard(
  rows: Array<{ label: string; valueHtml: string }>,
): string {
  const items = rows
    .map(
      (row, index) => `
        <p style="margin:${index === 0 ? "0" : "10px"} 0 ${index === rows.length - 1 ? "0" : "10px"};font-size:14px;">
          <strong>${escapeHtml(row.label)} :</strong> ${row.valueHtml}
        </p>`,
    )
    .join("");

  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;">
      ${items}
    </div>
  `;
}

export function emailSecretValue(value: string): string {
  return `<span style="display:inline-block;margin-top:4px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:8px 12px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;font-weight:700;letter-spacing:.04em;color:#92400e;">${escapeHtml(value)}</span>`;
}

type EmailLayoutInput = {
  appName: string;
  title: string;
  intro: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  footerNote?: string;
};

export function emailLayoutHtml(input: EmailLayoutInput): string {
  const contact = getEmailContactInfo();
  const site = publicAppUrl();
  const footer =
    input.footerNote ??
    `Email automatique envoyé depuis ${escapeHtml(input.appName)}.`;

  const ctaHtml = input.cta
    ? `
      <div style="margin-top:28px;">
        <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#172554;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:bold;">
          ${escapeHtml(input.cta.label)}
        </a>
      </div>`
    : "";

  const phoneHtml = contact.phone
    ? `&nbsp;·&nbsp;<a href="tel:${escapeHtml(contact.phone)}" style="color:#94a3b8;text-decoration:none;">${escapeHtml(contact.phone)}</a>`
    : "";
  const emailHtml = contact.email
    ? `<a href="mailto:${escapeHtml(contact.email)}" style="color:#94a3b8;text-decoration:none;">${escapeHtml(contact.email)}</a>`
    : "";

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="background:#172554;padding:28px 32px;color:#ffffff;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <img src="${escapeHtml(contact.logoUrl)}" alt="${escapeHtml(contact.name)}" width="48" height="48" style="display:block;border:0;border-radius:12px;background:#ffffff;max-width:48px;height:auto;" />
                      </td>
                      <td style="vertical-align:middle;padding-left:14px;">
                        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">
                          ${escapeHtml(input.appName)}
                        </div>
                        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;">
                          ${escapeHtml(input.title)}
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 32px;">
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
                    ${input.intro}
                  </p>
                  ${input.bodyHtml}
                  ${ctaHtml}
                </td>
              </tr>
              <tr>
                <td style="background:#f8fafc;padding:18px 32px;text-align:center;">
                  <div style="font-size:10px;line-height:1.5;color:#94a3b8;">
                    <div style="margin-bottom:2px;">
                      <a href="${escapeHtml(site)}" style="color:#94a3b8;text-decoration:none;font-weight:600;">
                        ${escapeHtml(contact.name)}
                      </a>
                    </div>
                    <div>
                      ${emailHtml}
                      ${phoneHtml}
                    </div>
                  </div>
                  <div style="margin-top:10px;font-size:10px;color:#cbd5e1;">
                    ${footer}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/** Enveloppe un corps texte (templates SMS-like) dans le layout Eteyelo. */
export function wrapTextEmail(input: {
  title: string;
  text: string;
  cta?: { href: string; label: string };
}): string {
  const lines = input.text.split(/\r?\n/);
  const first = lines.find((l) => l.trim()) ?? input.title;
  const rest = lines.slice(lines.indexOf(first) + 1).join("\n").trim();
  const bodyHtml = rest
    ? `<div style="font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">${escapeHtml(rest)}</div>`
    : "";
  return emailLayoutHtml({
    appName: appDisplayName(),
    title: input.title,
    intro: escapeHtml(first),
    bodyHtml,
    cta: input.cta,
  });
}
