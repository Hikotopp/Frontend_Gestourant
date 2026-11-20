import { formatColombiaDate } from '../shared/date-time.js';
import { getLocale, translate } from '../shared/locale.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
})[character]);

function validateReport(report) {
  if (!report || typeof report.from !== 'string' || !report.from
    || typeof report.to !== 'string' || !report.to
    || !Number.isFinite(report.facturas) || !Number.isFinite(report.efectivo)
    || !Number.isFinite(report.digital) || !Number.isFinite(report.total)
    || !Array.isArray(report.invoices)) {
    throw new TypeError(translate('El historial contiene datos incompletos para exportar.'));
  }

  for (const invoice of report.invoices) {
    if (!invoice || typeof invoice.invoiceNumber !== 'string'
      || typeof invoice.issuedAt !== 'string' || !Number.isFinite(invoice.tableNumber)
      || !['EFECTIVO', 'DIGITAL'].includes(invoice.paymentMethod)
      || !Number.isFinite(invoice.total) || typeof invoice.employee !== 'string') {
      throw new TypeError(translate('Una factura del historial contiene datos incompletos.'));
    }
  }
}

function money(value) {
  return `$ ${Number(value).toLocaleString(getLocale())} COP`;
}

export function createCashClosePdfHtml(report, includeEmployee = false) {
  validateReport(report);
  const period = report.from === report.to ? report.from : `${report.from} — ${report.to}`;
  const employeeHeader = includeEmployee ? `<th>${escapeHtml(translate('Pedido abierto por'))}</th>` : '';
  const invoiceRows = report.invoices.map(invoice => `
    <tr>
      <td>${escapeHtml(invoice.invoiceNumber)}</td>
      <td>${escapeHtml(formatColombiaDate(invoice.issuedAt, getLocale()))}</td>
      <td>${escapeHtml(translate('Mesa {table}', { table: invoice.tableNumber }))}</td>
      <td>${escapeHtml(translate(invoice.paymentMethod === 'EFECTIVO' ? 'Efectivo' : 'Digital'))}</td>
      <td class="amount">${escapeHtml(money(invoice.total))}</td>
      ${includeEmployee ? `<td>${escapeHtml(invoice.employee)}</td>` : ''}
    </tr>`).join('');
  const generatedAt = formatColombiaDate(new Date(), getLocale());

  return `<!doctype html>
<html lang="${escapeHtml(getLocale())}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(`${translate('GESTOURANT  |  REPORTE DE VENTAS')} · ${period}`)}</title>
  <style>
    :root{color-scheme:light;--forest:#153f35;--leaf:#276552;--gold:#d6a84f;--ink:#263b32;--muted:#718078;--paper:#fbf8f0;--line:#e6dfd0}
    *{box-sizing:border-box}
    body{margin:0;background:#e9e5da;color:var(--ink);font-family:Arial,sans-serif}
    .toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:center;gap:12px;padding:14px;background:var(--forest);color:white;font-size:13px}
    .toolbar button{border:0;border-radius:8px;padding:10px 16px;background:var(--gold);color:var(--forest);font-weight:700;cursor:pointer}
    .toolbar span{align-self:center;color:#e5eee8}
    .page{width:min(1120px,100% - 32px);margin:28px auto;padding:42px;background:white;box-shadow:0 18px 60px #17372b1c}
    .brand{margin:0;color:var(--forest);font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    h1{margin:12px 0 4px;color:var(--forest);font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400}
    .period{margin:0;color:var(--muted);font-size:13px}
    .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:26px 0}
    .metric{padding:14px;border:1px solid var(--line);border-radius:9px}
    .metric span{display:block;color:var(--muted);font-size:11px}
    .metric strong{display:block;margin-top:7px;color:var(--forest);font-size:17px}
    h2{margin:24px 0 10px;color:var(--forest);font-size:16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    thead{display:table-header-group}
    th,td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    th{background:#edf3ef;color:var(--forest);font-weight:700}
    .amount{text-align:right;white-space:nowrap}
    .empty{padding:18px 0;color:var(--muted);font-size:12px}
    footer{margin-top:24px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}
    @page{size:A4 landscape;margin:12mm}
    @media print{body{background:#fff}.toolbar{display:none}.page{width:auto;margin:0;padding:0;box-shadow:none}.metric,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}}
    @media(max-width:700px){.page{padding:24px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{flex-wrap:wrap}}
  </style>
</head>
<body>
  <nav class="toolbar" aria-label="${escapeHtml(translate('Opciones de descarga'))}">
    <button id="print-report" type="button">${escapeHtml(translate('Guardar o imprimir PDF'))}</button>
    <span>${escapeHtml(translate('En el diálogo, elige «Guardar como PDF».'))}</span>
  </nav>
  <main class="page">
    <p class="brand">${escapeHtml(translate('GESTOURANT  |  REPORTE DE VENTAS'))}</p>
    <h1>${escapeHtml(translate('Resumen ejecutivo · Periodo {period}', { period }))}</h1>
    <p class="period">${escapeHtml(`${translate('Desde')}: ${report.from} · ${translate('Hasta')}: ${report.to}`)}</p>
    <section class="metrics" aria-label="${escapeHtml(translate('INDICADORES DEL PERIODO'))}">
      <article class="metric"><span>${escapeHtml(translate('Facturas'))}</span><strong>${report.facturas.toLocaleString(getLocale())}</strong></article>
      <article class="metric"><span>${escapeHtml(translate('Efectivo'))}</span><strong>${escapeHtml(money(report.efectivo))}</strong></article>
      <article class="metric"><span>${escapeHtml(translate('Pagos digitales'))}</span><strong>${escapeHtml(money(report.digital))}</strong></article>
      <article class="metric"><span>${escapeHtml(translate('Total vendido'))}</span><strong>${escapeHtml(money(report.total))}</strong></article>
    </section>
    <h2>${escapeHtml(translate('Facturas del periodo'))}</h2>
    ${report.invoices.length
      ? `<table><thead><tr><th>${escapeHtml(translate('Factura'))}</th><th>${escapeHtml(translate('Fecha y hora'))}</th><th>${escapeHtml(translate('Mesa'))}</th><th>${escapeHtml(translate('Pago'))}</th><th class="amount">${escapeHtml(translate('Total'))}</th>${employeeHeader}</tr></thead><tbody>${invoiceRows}</tbody></table>`
      : `<p class="empty">${escapeHtml(translate('No hay facturas para el periodo seleccionado.'))}</p>`}
    <footer>${escapeHtml(translate('Generado el {date} · Valores expresados en pesos colombianos (COP).', { date: generatedAt }))}</footer>
  </main>
</body>
</html>`;
}

export function printCashClosePdf(report, includeEmployee = false) {
  const html = createCashClosePdfHtml(report, includeEmployee);
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error(translate('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para guardar el PDF.'));
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.getElementById('print-report')?.addEventListener('click', () => printWindow.print());
  printWindow.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
}
