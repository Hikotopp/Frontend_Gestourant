import { TestBed } from '@angular/core/testing';
import { TablesPage } from './tables-page';

describe('TablesPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
  };
  const tables: GestourantTable[] = [
    { id: 1, tableNumber: 1, seats: 4, status: 'LIBRE', floorX: 15, floorY: 18, qrToken: 'qr-1' },
    { id: 2, tableNumber: 2, seats: 2, status: 'OCUPADA', floorX: 37, floorY: 18, billRequested: true, qrToken: 'qr-2' },
  ];

  afterEach(() => {
    globalThis.__GESTOURANT_TABLES__ = undefined;
    globalThis.__GESTOURANT_SHOW_TABLE_QR__ = undefined;
  });

  async function createPage(role = session.role) {
    await TestBed.configureTestingModule({ imports: [TablesPage] }).compileComponents();
    const fixture = TestBed.createComponent(TablesPage);
    fixture.componentRef.setInput('session', { ...session, role });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads table states, shows service indicators, and keeps administration restricted', async () => {
    const list = vi.fn(async () => tables);
    globalThis.__GESTOURANT_TABLES__ = {
      list,
      create: vi.fn(),
      join: vi.fn(),
      updatePosition: vi.fn(),
    };

    const employee = await createPage();
    const element = employee.nativeElement as HTMLElement;
    expect(list).toHaveBeenCalledWith({ ...session, role: session.role });
    expect(element.querySelectorAll('.floor-table-button')).toHaveLength(2);
    expect(element.querySelectorAll('.service-metrics strong')[0]?.textContent).toBe('1');
    expect(element.querySelectorAll('.service-metrics strong')[1]?.textContent).toBe('1');
    expect(element.querySelector('.table-tools')).toBeNull();
    expect(element.querySelector('.floor-table-button.busy')?.getAttribute('aria-label')).toContain('Pide la cuenta');

    employee.componentRef.setInput('session', { ...session, role: 'ADMINISTRADOR' });
    employee.detectChanges();
    expect(element.querySelector('.table-tools')).not.toBeNull();
    employee.destroy();
  });

  it('delegates a table selection to the existing account-detail flow', async () => {
    globalThis.__GESTOURANT_TABLES__ = {
      list: vi.fn(async () => tables),
      create: vi.fn(),
      join: vi.fn(),
      updatePosition: vi.fn(),
    };
    const fixture = await createPage();
    const selected: number[] = [];
    fixture.componentInstance.tableSelected.subscribe((id) => selected.push(id));
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.floor-table-button')?.click();
    expect(selected).toEqual([1]);
    fixture.destroy();
  });

  it('delegates administrator table creation and joining to the existing services', async () => {
    const create = vi.fn(async () => tables[0]);
    const join = vi.fn(async () => undefined);
    globalThis.__GESTOURANT_TABLES__ = {
      list: vi.fn(async () => tables),
      create,
      join,
      updatePosition: vi.fn(),
    };
    const fixture = await createPage('ADMINISTRADOR');
    const component = fixture.componentInstance;
    const form = { reportValidity: () => true, reset: vi.fn() } as unknown as HTMLFormElement;
    component.tableNumber = 6;
    component.seats = 4;
    await component.createTable(form);
    expect(create).toHaveBeenCalledWith({ ...session, role: 'ADMINISTRADOR' }, { tableNumber: 6, seats: 4 });
    expect(component.notice()).toBe('Mesa creada.');

    component.firstTableId = '1';
    component.secondTableId = '2';
    await component.joinTables(form);
    expect(join).toHaveBeenCalledWith(
      { ...session, role: 'ADMINISTRADOR' },
      { firstTableId: 1, secondTableId: 2 },
    );
    expect(component.notice()).toBe('Mesas unidas.');
    fixture.destroy();
  });

  it('saves administrator table positions through the application port', async () => {
    const updatePosition = vi.fn(async (_session: GestourantSession, id: number, position: { x: number; y: number }) => ({
      ...tables[0],
      id,
      floorX: position.x,
      floorY: position.y,
    }));
    globalThis.__GESTOURANT_TABLES__ = {
      list: vi.fn(async () => tables),
      create: vi.fn(),
      join: vi.fn(),
      updatePosition,
    };
    const fixture = await createPage('ADMINISTRADOR');
    const component = fixture.componentInstance;
    component.arranging.set(true);
    const map = document.createElement('div');
    map.className = 'floor-map';
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}),
    });
    const button = document.createElement('button');
    map.append(button);
    const pointerDown = { button: 0, clientX: 30, clientY: 20, pointerId: 1, currentTarget: { setPointerCapture: vi.fn() } } as unknown as PointerEvent;
    await component.beginDrag(pointerDown, tables[0]);
    const pointerMove = { clientX: 90, clientY: 60, currentTarget: { closest: () => map } } as unknown as PointerEvent;
    component.moveDrag(pointerMove);
    await component.endDrag();
    expect(updatePosition).toHaveBeenCalledWith({ ...session, role: 'ADMINISTRADOR' }, 1, { x: 45, y: 60 });
    expect(component.tables()[0].floorX).toBe(45);
    fixture.destroy();
  });

  it('shows service errors instead of failing silently', async () => {
    globalThis.__GESTOURANT_TABLES__ = {
      list: vi.fn(async () => { throw new Error('Servicio no disponible'); }),
      create: vi.fn(),
      join: vi.fn(),
      updatePosition: vi.fn(),
    };
    const fixture = await createPage();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Servicio no disponible');
    fixture.destroy();
  });
});
