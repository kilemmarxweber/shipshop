/** Export CSV (Excel) + PDF (impression navigateur) pour listes de contacts. */

export type ExportContact = {
  name: string;
  email: string;
  phone?: string | null;
  kind?: string;
  extra?: string;
};

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadContactsExcel(
  filename: string,
  rows: ExportContact[],
  sheetTitle = "Contacts",
) {
  const header = ["Nom", "E-mail", "Téléphone", "Type", "Détail"];
  const lines = [
    header.join(";"),
    ...rows.map((r) =>
      [
        escapeCsv(r.name),
        escapeCsv(r.email),
        escapeCsv(r.phone ?? ""),
        escapeCsv(r.kind ?? ""),
        escapeCsv(r.extra ?? ""),
      ].join(";"),
    ),
  ];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  void sheetTitle;
}

export function downloadContactsPdf(
  title: string,
  rows: ExportContact[],
) {
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const body = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.phone ?? "—")}</td>
        <td>${escapeHtml(r.kind ?? "")}</td>
        <td>${escapeHtml(r.extra ?? "")}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { font-size: 12px; color: #666; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${rows.length} contact(s) · ${new Date().toLocaleString("fr-FR")}</p>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>E-mail</th>
        <th>Téléphone</th>
        <th>Type</th>
        <th>Détail</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="5">Aucun contact</td></tr>`}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
