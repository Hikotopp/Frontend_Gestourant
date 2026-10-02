const encoder = new TextEncoder();
const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum = CRC_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function write16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
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

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[character]);
}

function stringCell(reference, value) {
  return `<c r="${reference}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function numberCell(reference, value) {
  return `<c r="${reference}"><v>${Number(value)}</v></c>`;
}

function worksheetXml(rows) {
  const xmlRows = rows.map((values, rowIndex) => {
    const cells = values.map((value, columnIndex) => {
      const reference = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
      return typeof value === 'number'
        ? numberCell(reference, value)
        : stringCell(reference, value);
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows.join('')}</sheetData></worksheet>`;
}

function validateReport(report) {
  if (!report || typeof report.from !== 'string' || !report.from
    || typeof report.to !== 'string' || !report.to
    || !Number.isFinite(report.facturas) || !Number.isFinite(report.efectivo)
    || !Number.isFinite(report.digital) || !Number.isFinite(report.total)
    || !Array.isArray(report.invoices)) {
    throw new TypeError('El historial contiene datos incompletos para exportar.');
  }
  for (const invoice of report.invoices) {
    if (!invoice || typeof invoice.invoiceNumber !== 'string'
      || typeof invoice.issuedAt !== 'string' || !Number.isFinite(invoice.tableNumber)
      || !['EFECTIVO', 'DIGITAL'].includes(invoice.paymentMethod)
      || !Number.isFinite(invoice.total) || typeof invoice.employee !== 'string') {
      throw new TypeError('Una factura del historial contiene datos incompletos.');
    }
  }
}

export function createCashCloseXlsx(report, includeEmployee = false) {
  validateReport(report);
  const summaryRows = [
    ['Concepto', 'Valor'],
    ['Desde', report.from],
    ['Hasta', report.to],
    ['Facturas', report.facturas],
    ['Efectivo (COP)', report.efectivo],
    ['Pagos digitales (COP)', report.digital],
    ['Total vendido (COP)', report.total]
  ];
  const invoiceHeaders = ['Factura', 'Fecha y hora', 'Mesa', 'Método de pago', 'Total (COP)'];
  if (includeEmployee) invoiceHeaders.push('Pedido abierto por');
  const invoiceRows = [
    invoiceHeaders,
    ...report.invoices.map(invoice => {
      const row = [
        invoice.invoiceNumber,
        invoice.issuedAt.replace('T', ' '),
        invoice.tableNumber,
        invoice.paymentMethod === 'EFECTIVO' ? 'Efectivo' : 'Digital',
        invoice.total
      ];
      if (includeEmployee) row.push(invoice.employee);
      return row;
    })
  ];

  const files = [
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cierre" sheetId="1" r:id="rId1"/><sheet name="Facturas" sheetId="2" r:id="rId2"/></sheets></workbook>'
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'
    },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(summaryRows) },
    { name: 'xl/worksheets/sheet2.xml', content: worksheetXml(invoiceRows) }
  ];

  return new Blob([zipStoredFiles(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

export function downloadCashCloseXlsx(report, includeEmployee = false) {
  const file = createCashCloseXlsx(report, includeEmployee);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-facturas-${report.from}-${report.to}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
