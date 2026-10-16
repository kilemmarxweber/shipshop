/** Export CSV (Excel) et PDF (impression navigateur) sans dépendances. */

export type ExportColumn = { key: string; label: string };

function escapeCsv(value: unknown) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadExcelCsv(
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
) {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(row[c.key])).join(","))
    .join("\r\n");
  // BOM pour qu'Excel ouvre correctement l'UTF-8
  const blob = new Blob(["\uFEFF" + header + "\r\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPdfTable(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
) {
  const th = columns
    .map(
      (c) =>
        `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;font-size:12px">${escapeHtml(c.label)}</th>`,
    )
    .join("");
  const tr = rows
    .map((row) => {
      const tds = columns
        .map(
          (c) =>
            `<td style="padding:8px;border-bottom:1px solid #eee;font-size:11px">${escapeHtml(row[c.key] ?? "")}</td>`,
        )
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  p{font-size:11px;color:#666;margin:0 0 16px}
  table{width:100%;border-collapse:collapse}
  @media print{button{display:none}}
</style></head><body>
  <button onclick="window.print()" style="margin-bottom:16px;padding:8px 12px;cursor:pointer">Imprimer / PDF</button>
  <h1>${escapeHtml(title)}</h1>
  <p>${rows.length} ligne(s) · ${new Date().toLocaleString("fr-FR")}</p>
  <table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
