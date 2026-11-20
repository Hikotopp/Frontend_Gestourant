import test from 'node:test';
import assert from 'node:assert/strict';
import { createCashClosePdfHtml, printCashClosePdf } from '../src/presentation/cashClosePdf.js';

const report = {
  from: '2026-10-15',
  to: '2026-10-15',
  facturas: 1,
  efectivo: 25000,
  digital: 12000,
  total: 37000,
  invoices: [{
    invoiceNumber: 'F-12',
    issuedAt: '2026-10-15T10:15:00',
    tableNumber: 4,
    paymentMethod: 'EFECTIVO',
    total: 37000,
    employee: 'maria'
  }]
};

test('prepares a printable report with totals, invoice details, and administrator-only employee data', () => {
  const html = createCashClosePdfHtml(report, true);

  assert.match(html, /application\/pdf|Guardar como PDF/);
  assert.match(html, /GESTOURANT/);
  assert.match(html, /F-12/);
  assert.match(html, /37[,.]000/);
  assert.match(html, /maria/);
  assert.match(html, /Pedido abierto por/);
});

test('omits employee-only details for non-administrator reports and escapes report content', () => {
  const html = createCashClosePdfHtml({
    ...report,
    invoices: [{ ...report.invoices[0], invoiceNumber: '<script>bad</script>', employee: 'maria' }]
  });
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /Pedido abierto por|<td>maria<\/td>/);
});

test('rejects incomplete report data and reports blocked print windows', () => {
  assert.throws(() => createCashClosePdfHtml({ from: '2026-10-15' }), /datos incompletos/);

  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { open: () => null }
  });
  try {
    assert.throws(() => printCashClosePdf(report), /bloqueó la ventana de impresión/);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});

test('opens the report in a print window and offers the browser PDF workflow', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let html = '';
  let printCalls = 0;
  let afterPrint;
  let printButton;
  let closed = false;
  const printWindow = {
    document: {
      open() {},
      write(value) { html = value; },
      close() {},
      getElementById() {
        return { addEventListener(_event, callback) { printButton = callback; } };
      },
    },
    setTimeout(callback) { callback(); },
    focus() {},
    print() { printCalls += 1; },
    addEventListener(_event, callback) { afterPrint = callback; },
    close() { closed = true; },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { open: () => printWindow },
  });
  try {
    printCashClosePdf(report, true);
    assert.match(html, /F-12/);
    assert.equal(printCalls, 1);
    printButton();
    assert.equal(printCalls, 2);
    afterPrint();
    assert.equal(closed, true);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});
