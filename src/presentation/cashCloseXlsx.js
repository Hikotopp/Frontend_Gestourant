import { getLocale, translate } from '../shared/locale.js';

const encoder = new TextEncoder();
const CRC_TABLE = new Uint32Array(256);
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = CRC_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function write16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function concatenate(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function zipStoredFiles(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write32(localView, 14, checksum);
    write32(localView, 18, content.length);
    write32(localView, 22, content.length);
    write16(localView, 26, name.length);
    localHeader.set(name, 30);
    localParts.push(localHeader, content);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write32(centralView, 16, checksum);
    write32(centralView, 20, content.length);
    write32(centralView, 24, content.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, localOffset);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + content.length;
  }

  const centralDirectory = concatenate(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, centralDirectory.length);
  write32(endView, 16, localOffset);
  return concatenate([...localParts, centralDirectory, endRecord]);
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[character]);
}

function columnName(index) {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function cellXml(cell, reference) {
  if (cell.value === null || cell.value === undefined) return '';
  const style = cell.style ? ` s="${cell.style}"` : '';
  if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
    return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
}

function worksheetXml({ rows, widths, merges = [], freezeRows = 0, autoFilterRange = '', tabColor = '153F35' }) {
  const columnCount = Math.max(widths.length, ...rows.map(row => row.length));
  const lastColumn = columnName(columnCount - 1);
  const lastRow = Math.max(rows.length, 1);
  const columnsXml = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const viewXml = freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freezeRows + 1}" sqref="A${freezeRows + 1}"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const dataXml = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => cellXml(cell, `${columnName(columnIndex)}${rowIndex + 1}`)).join('');
    const height = row.height ? ` ht="${row.height}" customHeight="1"` : '';
    return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
  }).join('');
  const autoFilterXml = autoFilterRange ? `<autoFilter ref="${autoFilterRange}"/>` : '';
  const mergesXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map(reference => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF${tabColor}"/></sheetPr><dimension ref="A1:${lastColumn}${lastRow}"/>${viewXml.replace('<sheetView workbookViewId="0">', '<sheetView showGridLines="0" workbookViewId="0">')}<sheetFormatPr defaultRowHeight="20"/>${columnsXml}<sheetData>${dataXml}</sheetData>${autoFilterXml}${mergesXml}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

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

function styledCell(value, style = 0) {
  return { value, style };
}

function buildSalesSheet(report, includeEmployee) {
  const invoices = report.invoices;
  const cashInvoices = invoices.filter(invoice => invoice.paymentMethod === 'EFECTIVO');
  const digitalInvoices = invoices.filter(invoice => invoice.paymentMethod === 'DIGITAL');
  const averageTicket = report.facturas ? report.total / report.facturas : 0;
  const period = report.from === report.to ? report.from : translate('{from} a {to}', { from: report.from, to: report.to });
  const dailyTotals = new Map();

  for (const invoice of invoices) {
    const date = invoice.issuedAt.slice(0, 10);
    const day = dailyTotals.get(date) || { invoices: 0, cash: 0, digital: 0, total: 0 };
    day.invoices += 1;
    day[invoice.paymentMethod === 'EFECTIVO' ? 'cash' : 'digital'] += invoice.total;
    day.total += invoice.total;
    dailyTotals.set(date, day);
  }

  const rows = [
    { height: 34, cells: [styledCell(translate('GESTOURANT  |  REPORTE DE VENTAS'), 1)] },
    { height: 25, cells: [styledCell(translate('Resumen ejecutivo · Periodo {period}', { period }), 2)] },
    { height: 10, cells: [] },
    { height: 24, cells: [styledCell(translate('INDICADORES DEL PERIODO'), 3)] },
    {
      height: 22,
      cells: [
        styledCell(translate('TOTAL VENDIDO'), 4),
        styledCell(null),
        styledCell(translate('FACTURAS'), 4),
        styledCell(null),
        styledCell(translate('PROMEDIO POR FACTURA'), 4),
        styledCell(null)
      ]
    },
    {
      height: 32,
      cells: [
        styledCell(report.total, 5),
        styledCell(null),
        styledCell(report.facturas, 6),
        styledCell(null),
        styledCell(averageTicket, 5),
        styledCell(null)
      ]
    },
    { height: 10, cells: [] },
    { height: 24, cells: [styledCell(translate('DESGLOSE DE PAGOS'), 3)] },
    {
      cells: [
        styledCell(translate('MÉTODO DE PAGO'), 8),
        styledCell(translate('FACTURAS'), 8),
        styledCell(translate('TOTAL RECAUDADO'), 8),
        styledCell(translate('PARTICIPACIÓN'), 8)
      ]
    },
    {
      cells: [
        styledCell(translate('Efectivo'), 9),
        styledCell(cashInvoices.length, 10),
        styledCell(report.efectivo, 11),
        styledCell(report.total ? report.efectivo / report.total : 0, 12)
      ]
    },
    {
      cells: [
        styledCell(translate('Digital'), 13),
        styledCell(digitalInvoices.length, 10),
        styledCell(report.digital, 11),
        styledCell(report.total ? report.digital / report.total : 0, 12)
      ]
    },
    {
      cells: [
        styledCell(translate('TOTAL'), 15),
        styledCell(report.facturas, 16),
        styledCell(report.total, 17),
        styledCell(report.total ? 1 : 0, 18)
      ]
    },
    { height: 10, cells: [] },
    { height: 24, cells: [styledCell(translate('VENTAS POR DIA'), 3)] },
    {
      cells: [
        styledCell(translate('FECHA'), 8),
        styledCell(translate('FACTURAS'), 8),
        styledCell(translate('EFECTIVO'), 8),
        styledCell(translate('DIGITAL'), 8),
        styledCell(translate('TOTAL DEL DIA'), 8)
      ]
    }
  ];

  const days = [...dailyTotals.entries()].sort(([first], [second]) => first.localeCompare(second));
  if (!days.length) {
    rows.push({ cells: [styledCell(translate('No hay facturas para el periodo seleccionado.'), 19)] });
  } else {
    days.forEach(([date, day], index) => rows.push({
      cells: [
        styledCell(date, index % 2 ? 20 : 9),
        styledCell(day.invoices, index % 2 ? 21 : 10),
        styledCell(day.cash, index % 2 ? 22 : 11),
        styledCell(day.digital, index % 2 ? 22 : 11),
        styledCell(day.total, index % 2 ? 23 : 17)
      ]
    }));
  }

  const headers = ['Factura', 'Fecha y hora', 'Mesa', 'Método de pago', 'Total (COP)'].map(value => translate(value));
  if (includeEmployee) headers.push(translate('Pedido abierto por'));
  const detailTitleRow = rows.length + 2;
  rows.push({ height: 10, cells: [] });
  rows.push({ height: 24, cells: [styledCell(translate('DETALLE DE FACTURAS'), 3)] });
  rows.push({ height: 25, cells: headers.map(header => styledCell(header, 8)) });
  const headerRow = rows.length;

  report.invoices.forEach((invoice, index) => {
    const style = index % 2 ? 20 : 9;
    const cells = [
      styledCell(invoice.invoiceNumber, style),
      styledCell(invoice.issuedAt.replace('T', ' '), style),
      styledCell(invoice.tableNumber, index % 2 ? 21 : 10),
      styledCell(translate(invoice.paymentMethod === 'EFECTIVO' ? 'Efectivo' : 'Digital'), style),
      styledCell(invoice.total, index % 2 ? 22 : 11)
    ];
    if (includeEmployee) cells.push(styledCell(invoice.employee, style));
    rows.push({ cells });
  });

  const lastInvoiceRow = Math.max(headerRow, rows.length);
  const totalCells = [
    styledCell(translate('TOTAL DEL PERIODO'), 15),
    styledCell(translate('{count} facturas', { count: report.invoices.length }), 16),
    styledCell(null),
    styledCell(null),
    styledCell(report.total, 17)
  ];
  if (includeEmployee) totalCells.push(styledCell(null));
  rows.push({ height: 25, cells: totalCells });

  const generatedAt = new Date().toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
  const footerRow = rows.length + 1;
  rows.push({ height: 24, cells: [styledCell(translate('Generado el {date} · Valores expresados en pesos colombianos (COP).', { date: generatedAt }), 24)] });
  const lastColumn = includeEmployee ? 'F' : 'E';
  return {
    rows: rows.map(row => Object.assign(row.cells, { height: row.height })),
    widths: [25, 23, 15, 20, 20, includeEmployee ? 26 : 18],
    autoFilterRange: `A${headerRow}:${columnName(headers.length - 1)}${lastInvoiceRow}`,
    merges: [
      `A1:${lastColumn}1`,
      `A2:${lastColumn}2`,
      `A4:${lastColumn}4`,
      'A5:B5',
      'C5:D5',
      'E5:F5',
      'A6:B6',
      'C6:D6',
      'E6:F6',
      'A8:E8',
      'A14:E14',
      `A${detailTitleRow}:${lastColumn}${detailTitleRow}`,
      `A${footerRow}:${lastColumn}${footerRow}`
    ],
    tabColor: '153F35'
  };
}

function workbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0;[Red]-&quot;$&quot; #,##0"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="#,##0"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Aptos Display"/></font><font><color rgb="FF64748B"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FF153F35"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF153F35"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D594A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F0EC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD6E2DC"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF153F35"/></top><bottom style="double"><color rgb="FF153F35"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="25"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="166" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="166" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="3" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="166" fontId="3" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="3" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="3" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function contentTypesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
}

function workbookRelationshipsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
}

function createWorkbook(sheet, sheetName) {
  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml() },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    { name: 'xl/workbook.xml', content: workbookXml(sheetName) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelationshipsXml() },
    { name: 'xl/styles.xml', content: workbookStylesXml().replace('Aptos Display', 'Georgia') },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(sheet) }
  ];

  return new Blob([zipStoredFiles(files)], { type: XLSX_MIME_TYPE });
}

export function createCashCloseXlsx(report, includeEmployee = false) {
  validateReport(report);
  return createWorkbook(buildSalesSheet(report, includeEmployee), translate('Ventas'));
}

const menuCategoryNames = {
  PLATO: 'Platos',
  BEBIDA: 'Bebidas',
  OTRO: 'Otros'
};

function validateMenu(products) {
  if (!Array.isArray(products) || products.some(product =>
    !product || typeof product.name !== 'string'
    || (product.description !== null && product.description !== undefined && typeof product.description !== 'string')
    || typeof product.category !== 'string' || !Number.isFinite(Number(product.price)))) {
    throw new TypeError(translate('La carta contiene datos incompletos para exportar.'));
  }
}

export function createMenuXlsx(products, tableNumber) {
  validateMenu(products);
  const rows = [
    { height: 38, cells: [styledCell(translate('GESTOURANT  |  LA CARTA'), 1)] },
    { height: 24, cells: [styledCell(translate('Menú digital{table} · Valores en pesos colombianos (COP)', { table: tableNumber ? ` · ${translate('Mesa')} ${tableNumber}` : '' }), 2)] },
    { height: 12, cells: [] },
    { height: 25, cells: [styledCell(translate('PREPARADO PARA DISFRUTAR'), 3)] },
    {
      height: 27,
      cells: ['Categoría', 'Producto', 'Descripción', 'Precio (COP)'].map(value => styledCell(translate(value), 8))
    }
  ];

  const sortedProducts = [...products].sort((first, second) =>
    (menuCategoryNames[first.category] || first.category).localeCompare(menuCategoryNames[second.category] || second.category, getLocale())
    || first.name.localeCompare(second.name, getLocale())
  );

  sortedProducts.forEach((product, index) => {
    const style = index % 2 ? 20 : 9;
    rows.push({
      height: 26,
      cells: [
        styledCell(menuCategoryNames[product.category] ? translate(menuCategoryNames[product.category]) : product.category, style),
        styledCell(translate(product.name), style),
        styledCell(product.description ? translate(product.description) : translate('Preparado al momento en nuestra cocina.'), style),
        styledCell(Number(product.price), index % 2 ? 22 : 11)
      ]
    });
  });

  const endRow = Math.max(rows.length, 5);
  const sheet = {
    rows: rows.map(row => Object.assign(row.cells, { height: row.height })),
    widths: [18, 34, 62, 20],
    merges: ['A1:D1', 'A2:D2', 'A4:D4'],
    autoFilterRange: `A5:D${endRow}`,
    tabColor: 'E7B34F'
  };
  return createWorkbook(sheet, translate('Menú'));
}

export function downloadCashCloseXlsx(report, includeEmployee = false) {
  const file = createCashCloseXlsx(report, includeEmployee);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-ventas-${report.from}-${report.to}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMenuXlsx(products, tableNumber) {
  const file = createMenuXlsx(products, tableNumber);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gestourant-menu-mesa-${tableNumber}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
