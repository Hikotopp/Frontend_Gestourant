import { TestBed } from '@angular/core/testing';
import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
  };
  const report: GestourantHistoryReport = {
    from: '2026-10-15',
    to: '2026-10-15',
    facturas: 1,
    efectivo: 25000,
    digital: 12000,
    total: 37000,
    invoices: [{
      invoiceId: 12,
      invoiceNumber: 'F-12',
      issuedAt: '2026-10-15T10:15:00',
      tableNumber: 4,
      paymentMethod: 'EFECTIVO',
      total: 37000,
      employee: 'maria',
      items: [{
        orderItemId: 7,
        productName: 'Sopa del día',
        quantity: 1,
        unitPrice: 37000,
        subtotal: 37000,
        removedIngredients: '',
      }],
    }],
  };

  afterEach(() => {
    globalThis.__GESTOURANT_REPORTS__ = undefined;
    globalThis.__GESTOURANT_DOWNLOAD_REPORT__ = undefined;
    globalThis.__GESTOURANT_PRINT_REPORT_PDF__ = undefined;
    globalThis.__GESTOURANT_RETURNS__ = undefined;
    globalThis.__GESTOURANT_INVENTORY__ = undefined;
    globalThis.__GESTOURANT_PRODUCTS__ = undefined;
  });

  async function createPage(role = session.role, mode: 'reports' | 'returns' = 'reports') {
    await TestBed.configureTestingModule({ imports: [ReportsPage] }).compileComponents();
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.componentRef.setInput('session', { ...session, role });
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads employee invoices for the selected shift date without exposing administrator detail', async () => {
    const getHistory = vi.fn(async () => report);
    globalThis.__GESTOURANT_REPORTS__ = { getHistory };
    const fixture = await createPage();
    const element = fixture.nativeElement as HTMLElement;
    expect(getHistory).toHaveBeenCalledWith(expect.objectContaining({ role: 'EMPLEADO' }), expect.any(String), expect.any(String), false);
    expect(element.textContent).toContain('F-12');
    expect(element.textContent).toContain('37.000');
    expect(element.querySelector('thead > tr > th:last-child')?.textContent).toBe('Total');
    expect(element.querySelector('.return-action')).toBeNull();
    fixture.destroy();
  });

  it('uses a date range for administrators and downloads the existing Excel report', async () => {
    const getHistory = vi.fn(async () => report);
    const download = vi.fn(async () => undefined);
    globalThis.__GESTOURANT_REPORTS__ = { getHistory };
    globalThis.__GESTOURANT_DOWNLOAD_REPORT__ = download;
    const fixture = await createPage('ADMINISTRADOR');
    await fixture.componentInstance.search();
    await fixture.componentInstance.download();
    expect(getHistory).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'ADMINISTRADOR' }), expect.any(String), expect.any(String), true);
    expect(download).toHaveBeenCalledWith(report, true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pedido abierto por');
    fixture.destroy();
  });

  it('opens the selected report for saving or printing as PDF', async () => {
    const getHistory = vi.fn(async () => report);
    const printPdf = vi.fn();
    globalThis.__GESTOURANT_REPORTS__ = { getHistory };
    globalThis.__GESTOURANT_PRINT_REPORT_PDF__ = printPdf;
    const fixture = await createPage('ADMINISTRADOR');
    await fixture.componentInstance.search();
    await fixture.componentInstance.downloadPdf();
    expect(printPdf).toHaveBeenCalledWith(report, true);
    expect(fixture.componentInstance.message()).toContain('PDF');
    fixture.destroy();
  });

  it('shows a dedicated returns workflow without report metrics or inventory losses', async () => {
    const getHistory = vi.fn(async () => report);
    const history = vi.fn(async () => ({
      invoiceId: 12,
      returnedQuantities: {},
      returns: [],
    }));
    globalThis.__GESTOURANT_REPORTS__ = { getHistory };
    globalThis.__GESTOURANT_RETURNS__ = { history, create: vi.fn() };

    const fixture = await createPage(session.role, 'returns');
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toBe('Devoluciones');
    expect(element.querySelector('.report-metrics')).toBeNull();
    expect(element.querySelector('.inventory-losses-card')).toBeNull();
    expect(element.querySelector('.report-download')).toBeNull();
    expect(element.querySelector('.report-pdf-download')).toBeNull();
    expect(element.querySelector('details')?.open).toBe(true);
    expect(element.textContent).toContain('Gestionar devolución · 1 producto');
    expect(element.querySelector('.return-action')).not.toBeNull();
    expect(history).toHaveBeenCalledTimes(1);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ role: 'EMPLEADO' }), 12);
    fixture.destroy();
  });

  it('rejects invalid date ranges without calling the report service', async () => {
    const getHistory = vi.fn(async () => report);
    globalThis.__GESTOURANT_REPORTS__ = { getHistory };
    const fixture = await createPage('ADMINISTRADOR');
    getHistory.mockClear();
    fixture.componentInstance.from.set('2026-10-16');
    fixture.componentInstance.to.set('2026-10-15');
    await fixture.componentInstance.search();
    expect(getHistory).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('fecha final');
    fixture.destroy();
  });
});
