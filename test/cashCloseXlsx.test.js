import test from 'node:test';
import assert from 'node:assert/strict';
import { createCashCloseXlsx } from '../src/presentation/cashCloseXlsx.js';

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
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/sheet2.xml'
  ]);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /Desde/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /2026-10-02/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /<v>150000<\/v>/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /FAC-1/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /2026-10-02 14:30:00/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /Mesa/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /Efectivo/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /maria/);
});

test('rejects incomplete report data instead of exporting a misleading workbook', () => {
  assert.throws(() => createCashCloseXlsx({ from: '2026-10-02' }), /datos incompletos/);
});
