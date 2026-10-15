import { TestBed } from '@angular/core/testing';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
  };

  afterEach(() => {
    globalThis.__GESTOURANT_LOAD_DASHBOARD_OVERVIEW__ = undefined;
  });

  async function createPage(role = session.role) {
    await TestBed.configureTestingModule({ imports: [DashboardPage] }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.componentRef.setInput('session', { ...session, role });
    fixture.detectChanges();
    return fixture;
  }

  it('loads and displays operational totals from the existing application services', async () => {
    const loadOverview = vi.fn(async () => ({
      occupiedTables: 4,
      availableTables: 7,
      lowStockProducts: 2,
    }));
    globalThis.__GESTOURANT_LOAD_DASHBOARD_OVERVIEW__ = loadOverview;

    const fixture = await createPage();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(loadOverview).toHaveBeenCalledWith({ ...session, role: session.role });
    expect(element.querySelector('h1')?.textContent).toContain('Hola, maria');
    expect(element.querySelector('.overview-primary strong')?.textContent).toBe('4');
    expect(element.querySelectorAll('.overview-card strong')[1]?.textContent).toBe('7');
    expect(element.querySelectorAll('.overview-card strong')[2]?.textContent).toBe('2');
  });

  it('routes remaining sections to the legacy workspace and limits backups to administrators', async () => {
    globalThis.__GESTOURANT_LOAD_DASHBOARD_OVERVIEW__ = async () => ({
      occupiedTables: 0,
      availableTables: 0,
      lowStockProducts: 0,
    });
    const fixture = await createPage();
    const requested: string[] = [];
    fixture.componentInstance.viewRequested.subscribe((view) => requested.push(view));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.quick-action')?.click();
    fixture.detectChanges();
    expect(requested).toEqual(['tables']);
    expect(element.textContent).not.toContain('Copias de seguridad');

    fixture.componentRef.setInput('session', { ...session, role: 'ADMINISTRADOR' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Copias de seguridad');
  });
});
