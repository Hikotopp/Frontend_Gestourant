import { downloadMenuXlsx } from './cashCloseXlsx.js';
import { getLocale, translate } from '../shared/locale.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
})[character]);

const categories = [
  { id: 'PLATO', label: 'Platos' },
  { id: 'BEBIDA', label: 'Bebidas' },
  { id: 'OTRO', label: 'Otros' }
];

function money(value) {
  return `$ ${Number(value || 0).toLocaleString(getLocale())} COP`;
}

function printMenuHtml(products, tableNumber) {
  const categorySections = categories.map(category => {
    const items = products.filter(product => product.category === category.id);
    if (!items.length) return '';
    return `<section class="category"><h2>${escapeHtml(translate(category.label))}</h2><div class="items">${items.map(product =>
      `<article class="item"><div class="item-copy"><h3>${escapeHtml(translate(product.name))}</h3><p>${escapeHtml(product.description ? translate(product.description) : translate('Preparado al momento en nuestra cocina.'))}</p></div><strong>${money(product.price)}</strong></article>`
    ).join('')}</div></section>`;
  }).join('');
  const otherItems = products.filter(product => !categories.some(category => category.id === product.category));
  const additionalSections = otherItems.length
    ? `<section class="category"><h2>${escapeHtml(translate('Especialidades'))}</h2><div class="items">${otherItems.map(product =>
      `<article class="item"><div class="item-copy"><h3>${escapeHtml(translate(product.name))}</h3><p>${escapeHtml(product.description ? translate(product.description) : translate('Preparado al momento en nuestra cocina.'))}</p></div><strong>${money(product.price)}</strong></article>`
    ).join('')}</div></section>`
    : '';

  return `<!doctype html>
<html lang="${getLocale()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(translate('La carta · Gestourant'))}</title>
  <style>
    :root{color-scheme:light;--forest:#153f35;--leaf:#276552;--gold:#d6a84d;--ink:#263b32;--muted:#718078;--paper:#fbf8f0;--line:#e6dfd0}
    *{box-sizing:border-box}
    body{margin:0;background:#e9e5da;color:var(--ink);font-family:Georgia,'Times New Roman',serif}
    .toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:center;gap:12px;padding:14px;background:#153f35;color:white;font:14px/1.4 Arial,sans-serif}
    .toolbar button{border:0;border-radius:9px;padding:11px 18px;background:#dfb75d;color:#193b31;font-weight:700;cursor:pointer}
    .toolbar span{align-self:center;color:#e5eee8}
    .page{width:min(820px,100% - 32px);min-height:1056px;margin:28px auto;padding:64px 72px;background:var(--paper);box-shadow:0 18px 60px #17372b1c}
    .brand{display:flex;align-items:center;justify-content:center;gap:12px;color:var(--forest);font:700 15px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
    .brand-mark{display:grid;width:38px;height:38px;place-items:center;border:1px solid var(--gold);border-radius:50%;color:var(--gold);font:24px Georgia,serif}
    .intro{text-align:center;padding:33px 0 26px;border-bottom:1px solid var(--line)}
    .eyebrow{margin:0 0 11px;color:#a47a2e;font:700 10px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
    h1{margin:0;color:var(--forest);font-size:48px;font-weight:400;letter-spacing:-1px}
    .subtitle{margin:12px 0 0;color:var(--muted);font:13px/1.6 Arial,sans-serif}
    .table-tag{display:inline-block;margin-top:16px;padding:7px 13px;border:1px solid #d8c796;border-radius:99px;color:var(--forest);font:700 10px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase}
    .category{margin-top:27px}
    .category h2{margin:0 0 8px;padding-bottom:9px;border-bottom:1px solid var(--line);color:var(--forest);font-size:23px;font-weight:400}
    .item{display:flex;justify-content:space-between;gap:24px;padding:13px 0;border-bottom:1px dotted #d9d1c0;break-inside:avoid}
    .item h3{margin:0;color:#293e34;font-size:15px;font-weight:700}
    .item p{margin:5px 0 0;color:var(--muted);font:11px/1.5 Arial,sans-serif}
    .item>strong{flex:none;padding-top:1px;color:var(--forest);font:700 12px Arial,sans-serif;white-space:nowrap}
    .empty{text-align:center;padding:38px 0;color:var(--muted);font:13px Arial,sans-serif}
    footer{margin-top:38px;padding-top:17px;border-top:1px solid var(--line);color:#718078;text-align:center;font:10px/1.7 Arial,sans-serif}
    @page{size:A4;margin:16mm}
    @media print{body{background:#fff}.toolbar{display:none}.page{width:auto;min-height:0;margin:0;padding:8mm 10mm;box-shadow:none}.category h2,.item>strong,.brand-mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}h1{font-size:40px}}
    @media(max-width:600px){.page{width:100%;min-height:100vh;margin:0;padding:38px 24px}.intro{padding-top:26px}h1{font-size:39px}.item{gap:12px}}
  </style>
</head>
<body>
  <nav class="toolbar" aria-label="${escapeHtml(translate('Opciones de descarga'))}"><button type="button" onclick="window.print()">${escapeHtml(translate('Guardar o imprimir PDF'))}</button><span>${escapeHtml(translate('En el diálogo, elige «Guardar como PDF».'))}</span></nav>
  <main class="page">
    <div class="brand"><span class="brand-mark">✳</span><span>Gestourant</span></div>
    <header class="intro"><p class="eyebrow">${escapeHtml(translate('Cocina hecha con cariño'))}</p><h1>${escapeHtml(translate('Nuestra carta'))}</h1><p class="subtitle">${escapeHtml(translate('Sabores frescos para disfrutar a tu ritmo.'))}<br>${escapeHtml(translate('Precios expresados en pesos colombianos.'))}</p>${tableNumber ? `<span class="table-tag">${escapeHtml(translate('Menú de mesa {table}', { table: tableNumber }))}</span>` : ''}</header>
    ${products.length ? `${categorySections}${additionalSections}` : `<p class="empty">${escapeHtml(translate('La carta no tiene productos disponibles en este momento.'))}</p>`}
    <footer>${escapeHtml(translate('Gracias por compartir la mesa con nosotros.'))}<br>Gestourant · ${escapeHtml(translate('Servicio atento, a tu ritmo.'))}</footer>
  </main>
</body>
</html>`;
}

export function printMenuPdf(products, tableNumber) {
  if (!Array.isArray(products)) throw new TypeError(translate('No fue posible preparar la carta para descargar.'));
  const html = printMenuHtml(products, tableNumber);
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error(translate('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para guardar el PDF.'));
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
}

export { downloadMenuXlsx };
