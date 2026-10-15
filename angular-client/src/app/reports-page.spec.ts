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
      invoiceNumber: 'F-12',
      issuedAt: '2026-10-15T10:15:00',
      tableNumber: 4,
      paymentMethod: 'EFECTIVO',
      total: 37000,
      employee: 'maria',
    }],
  };

  afterEach(() => {
    globalThis.__GESTOURANT_REPORTS__ = undefined;
    globalThis.__GESTOURANT_DOWNLOAD_REPORT__ = undefined;
  });

  async function createPage(role = session.role) {
    await TestBed.configureTestingModule({ imports: [ReportsPage] }).compileComponents();
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.componentRef.setInput('session', { ...session, role });
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
    expect(element.querySelector('th:last-child')?.textContent).toBe('Total');
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
