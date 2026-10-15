import { TestBed } from '@angular/core/testing';
import { RequestsPage } from './requests-page';

describe('RequestsPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
  };
  const order: GestourantStaffRequest = {
    id: 7,
    tableNumber: 3,
    createdAt: '2026-10-15T10:00:00Z',
    total: 36000,
    items: [{ quantity: 2, name: 'Sopa', removedIngredients: 'cilantro', subtotal: 36000 }],
  };
  const kitchenOrder: GestourantKitchenRequest = {
    id: 9,
    tableNumber: 4,
    createdAt: '2026-10-15T10:00:00Z',
    status: 'NUEVO',
    items: [{ quantity: 1, name: 'Arroz', removedIngredients: 'cebolla' }],
  };

  afterEach(() => {
    globalThis.__GESTOURANT_REQUESTS__ = undefined;
  });

  async function createPage(queue: 'orders' | 'kitchen') {
    await TestBed.configureTestingModule({ imports: [RequestsPage] }).compileComponents();
    const fixture = TestBed.createComponent(RequestsPage);
    fixture.componentRef.setInput('session', session);
    fixture.componentRef.setInput('queue', queue);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads QR order requests and emits their count to the dashboard', async () => {
    const listOrders = vi.fn(async () => [order]);
    globalThis.__GESTOURANT_REQUESTS__ = {
      listOrders,
      approve: vi.fn(),
      reject: vi.fn(),
      listKitchen: vi.fn(),
      advanceKitchen: vi.fn(),
    };
    const fixture = await createPage('orders');
    const counts: number[] = [];
    fixture.componentInstance.pendingCountChanged.subscribe((count) => counts.push(count));
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(listOrders).toHaveBeenCalledWith(session);
    expect(counts).toEqual([1]);
    expect(element.textContent).toContain('Solicitud #7');
    expect(element.textContent).toContain('2 × Sopa');
    expect(element.textContent).toContain('Sin cilantro');
    expect(element.textContent).toContain('36.000');
    fixture.destroy();
  });

  it('approves and rejects requests through the application bridge', async () => {
    const approve = vi.fn(async () => undefined);
    const reject = vi.fn(async () => undefined);
    globalThis.__GESTOURANT_REQUESTS__ = {
      listOrders: vi.fn(async () => [order]),
      approve,
      reject,
      listKitchen: vi.fn(),
      advanceKitchen: vi.fn(),
    };
    const fixture = await createPage('orders');
    await fixture.componentInstance.resolveOrder(order.id, 'approve');
    await fixture.componentInstance.resolveOrder(order.id, 'reject');
    expect(approve).toHaveBeenCalledWith(session, order.id);
    expect(reject).toHaveBeenCalledWith(session, order.id);
    fixture.destroy();
  });

  it('displays kitchen modifications and advances the ticket state', async () => {
    const advanceKitchen = vi.fn(async () => undefined);
    globalThis.__GESTOURANT_REQUESTS__ = {
      listOrders: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      listKitchen: vi.fn(async () => [kitchenOrder]),
      advanceKitchen,
    };
    const fixture = await createPage('kitchen');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('COMANDA #9');
    expect(element.textContent).toContain('PREPARAR SIN: cebolla');
    expect(element.textContent).toContain('Iniciar preparación');
    await fixture.componentInstance.advanceKitchenOrder(kitchenOrder.id);
    expect(advanceKitchen).toHaveBeenCalledWith(session, kitchenOrder.id);
    fixture.destroy();
  });

  it('shows request loading failures with a retry action', async () => {
    globalThis.__GESTOURANT_REQUESTS__ = {
      listOrders: vi.fn(async () => { throw new Error('Servicio no disponible'); }),
      approve: vi.fn(),
      reject: vi.fn(),
      listKitchen: vi.fn(),
      advanceKitchen: vi.fn(),
    };
    const fixture = await createPage('orders');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Servicio no disponible');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Intentar de nuevo');
    fixture.destroy();
  });
});
