import test from 'node:test';
import assert from 'node:assert/strict';
import { createCashCloseXlsx, createMenuXlsx } from '../src/presentation/cashCloseXlsx.js';
import { printMenuPdf } from '../src/presentation/menuDownload.js';

async function readStoredZip(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const files = new Map();
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const contentLength = view.getUint32(offset + 18, true);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    files.set(name, decoder.decode(bytes.slice(contentStart, contentStart + contentLength)));
    offset = contentStart + contentLength;
  }

  return { bytes, files };
}

test('creates a workbook with a report summary and detailed invoices', async () => {
  const workbook = createCashCloseXlsx({
    from: '2026-10-02',
    to: '2026-10-03',
    facturas: 1,
    efectivo: 150000,
    digital: 0,
    total: 150000,
    invoices: [{
      invoiceNumber: 'FAC-1',
      issuedAt: '2026-10-02T14:30:00',
      tableNumber: 4,
      paymentMethod: 'EFECTIVO',
      total: 150000,
      employee: 'maria'
    }]
  }, true);
  const { bytes, files } = await readStoredZip(workbook);

  assert.equal(workbook.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  assert.deepEqual([...files.keys()], [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml'
  ]);
  assert.match(files.get('xl/workbook.xml'), /<sheet name="Ventas"/);
  assert.doesNotMatch(files.get('xl/workbook.xml'), /<sheet name="Facturas"/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /GESTOURANT  \|  REPORTE DE VENTAS/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /VENTAS POR DIA/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /Desde|Periodo/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /<c r="A6" s="5"><v>150000<\/v><\/c>/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /<mergeCell ref="A5:B5"\/>/);
  assert.match(files.get('xl/styles.xml'), /<name val="Georgia"\/>/);
  assert.match(files.get('xl/styles.xml'), /<cellXfs count="25">/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /FAC-1/);
  const expectedIssuedAt = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date('2026-10-02T14:30:00-05:00'));
  assert.ok(files.get('xl/worksheets/sheet1.xml').includes(expectedIssuedAt));
  assert.match(files.get('xl/worksheets/sheet1.xml'), /<autoFilter ref="A19:F20"\/>/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /Efectivo/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /maria/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /TOTAL DEL PERIODO/);
});

test('rejects incomplete report data instead of exporting a misleading workbook', () => {
  assert.throws(() => createCashCloseXlsx({ from: '2026-10-02' }), /datos incompletos/);
});

test('adds daily payment and average-ticket analysis without changing reported totals', async () => {
  const workbook = createCashCloseXlsx({
    from: '2026-10-02',
    to: '2026-10-03',
    facturas: 2,
    efectivo: 150000,
    digital: 50000,
    total: 200000,
    invoices: [
      {
        invoiceNumber: 'FAC-1',
        issuedAt: '2026-10-02T14:30:00',
        tableNumber: 4,
        paymentMethod: 'EFECTIVO',
        total: 150000,
        employee: 'maria'
      },
      {
        invoiceNumber: 'FAC-2',
        issuedAt: '2026-10-03T14:30:00',
        tableNumber: 5,
        paymentMethod: 'DIGITAL',
        total: 50000,
        employee: 'luis'
      }
    ]
  });
  const { files } = await readStoredZip(workbook);
  const summary = files.get('xl/worksheets/sheet1.xml');

  assert.match(summary, /PROMEDIO POR FACTURA/);
  assert.match(summary, /<c r="E6" s="5"><v>100000<\/v><\/c>/);
  assert.match(summary, /DESGLOSE DE PAGOS/);
  assert.match(summary, /<c r="D10" s="12"><v>0\.75<\/v><\/c>/);
  assert.match(summary, /<c r="D11" s="12"><v>0\.25<\/v><\/c>/);
  assert.match(summary, /<c r="A16"[^>]*>[\s\S]*?2026-10-02/);
  assert.match(summary, /<c r="A17"[^>]*>[\s\S]*?2026-10-03/);
});

test('omits employee-only detail in non-administrator exports', async () => {
  const workbook = createCashCloseXlsx({
    from: '2026-10-02',
    to: '2026-10-02',
    facturas: 1,
    efectivo: 150000,
    digital: 0,
    total: 150000,
    invoices: [{
      invoiceNumber: 'FAC-1',
      issuedAt: '2026-10-02T14:30:00',
      tableNumber: 4,
      paymentMethod: 'EFECTIVO',
      total: 150000,
      employee: 'maria'
    }]
  }, false);
  const { files } = await readStoredZip(workbook);
  const details = files.get('xl/worksheets/sheet1.xml');

  assert.match(details, /<autoFilter ref="A19:E20"\/>/);
  assert.doesNotMatch(details, /Pedido abierto por|maria/);
});

test('creates a one-sheet downloadable menu with warm styling, prices, and escaped content', async () => {
  const workbook = createMenuXlsx([
    { name: 'Pasta <de la casa>', description: 'Salsa de tomate & albahaca', category: 'PLATO', price: 24500 },
    { name: 'Limonada', description: null, category: 'BEBIDA', price: 7000 }
  ], 4);
  const { files } = await readStoredZip(workbook);
  const xml = files.get('xl/worksheets/sheet1.xml');

  assert.match(files.get('xl/workbook.xml'), /<sheet name="Menú"/);
  assert.equal([...files.keys()].filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length, 1);
  assert.match(xml, /GESTOURANT  \|  LA CARTA/);
  assert.match(xml, /Menú digital · Mesa 4/);
  assert.match(xml, /Pasta &lt;de la casa&gt;/);
  assert.match(xml, /Salsa de tomate &amp; albahaca/);
  assert.match(xml, /Preparado al momento en nuestra cocina/);
  assert.match(xml, /<autoFilter ref="A5:D7"\/>/);
});

test('translates known menu item names and descriptions in downloadable workbooks', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'en' },
  });
  try {
    const workbook = await readStoredZip(createMenuXlsx([
      {
        name: 'Hamburguesa de la casa',
        description: 'Carne artesanal, queso, vegetales y papas.',
        category: 'PLATO',
        price: 28000,
      },
    ], 3));
    const xml = workbook.files.get('xl/worksheets/sheet1.xml');
    assert.match(xml, /House burger/);
    assert.match(xml, /Handcrafted beef, cheese, vegetables, and fries/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('rejects incomplete menu data before exporting', () => {
  assert.throws(() => createMenuXlsx([{ name: 'Plato' }], 2), /carta contiene datos incompletos/);
});

test('localizes downloadable menu and sales workbooks using the selected language', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'fr' },
  });
  try {
    const menu = await readStoredZip(createMenuXlsx([
      { name: 'Pâtes du chef', description: null, category: 'PLATO', price: 24500 }
    ], 4));
    const menuXml = menu.files.get('xl/worksheets/sheet1.xml');
    assert.match(menu.files.get('xl/workbook.xml'), /<sheet name="Menu"/);
    assert.match(menuXml, /Menu numérique · Table 4/);
    assert.match(menuXml, /PRÊT À DÉGUSTER/);
    assert.match(menuXml, /Plats/);
    assert.match(menuXml, /Préparé à la minute dans notre cuisine/);

    const report = await readStoredZip(createCashCloseXlsx({
      from: '2026-10-02',
      to: '2026-10-02',
      facturas: 1,
      efectivo: 150000,
      digital: 0,
      total: 150000,
      invoices: [{
        invoiceNumber: 'FAC-1',
        issuedAt: '2026-10-02T14:30:00',
        tableNumber: 4,
        paymentMethod: 'EFECTIVO',
        total: 150000,
        employee: 'maria'
      }]
    }, true));
    assert.match(report.files.get('xl/workbook.xml'), /<sheet name="Ventes"/);
    assert.match(report.files.get('xl/worksheets/sheet1.xml'), /RAPPORT DES VENTES/);
    assert.match(report.files.get('xl/worksheets/sheet1.xml'), /ESPÈCES/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('localizes the printable menu without translating restaurant content', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let printedHtml = '';
  const printWindow = {
    document: {
      open() {},
      write(value) { printedHtml = value; },
      close() {},
    },
    setTimeout(callback) { callback(); },
    focus() {},
    print() {},
    addEventListener() {},
  };
  Object.defineProperties(globalThis, {
    localStorage: { configurable: true, value: { getItem: () => 'de' } },
    window: { configurable: true, value: { open: () => printWindow } },
  });
  try {
    printMenuPdf([{
      name: 'Hausgericht',
      description: 'Familienrezept',
      category: 'PLATO',
      price: 24500
    }], 4);
    assert.match(printedHtml, /<html lang="de">/);
    assert.match(printedHtml, /Unsere Speisekarte/);
    assert.match(printedHtml, /Tisch 4 Speisekarte|Speisekarte für Tisch 4/);
    assert.match(printedHtml, /Hausgericht/);
    assert.match(printedHtml, /Familienrezept/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});
