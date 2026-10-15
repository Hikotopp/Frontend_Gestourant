import { TestBed } from '@angular/core/testing';
import { ProductsPage } from './products-page';

describe('ProductsPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
  };
  const products: GestourantProduct[] = [
    { id: 1, name: 'Sopa', category: 'PLATO', description: 'Del día', imageUrl: '', price: 18000, stock: 3, active: true },
    { id: 2, name: 'Limonada', category: 'BEBIDA', description: 'Natural', imageUrl: '', price: 8000, stock: 0, active: false },
  ];

  afterEach(() => {
    globalThis.__GESTOURANT_PRODUCTS__ = undefined;
    globalThis.__GESTOURANT_PRODUCT_PHOTO__ = undefined;
    globalThis.__GESTOURANT_GET_ACTIVE_ORDER__ = undefined;
    globalThis.__GESTOURANT_ADD_ORDER_PRODUCT__ = undefined;
  });

  async function createPage(role = session.role) {
    await TestBed.configureTestingModule({ imports: [ProductsPage] }).compileComponents();
    const fixture = TestBed.createComponent(ProductsPage);
    fixture.componentRef.setInput('session', { ...session, role });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('filters the catalog and hides inactive products from employees', async () => {
    globalThis.__GESTOURANT_PRODUCTS__ = {
      list: vi.fn(async () => products),
      save: vi.fn(),
      remove: vi.fn(),
    };
    globalThis.__GESTOURANT_PRODUCT_PHOTO__ = () => '/product.jpg';
    const fixture = await createPage();
    const component = fixture.componentInstance;
    expect(component.visibleProducts.map((item) => item.name)).toEqual(['Sopa']);
    component.categoryFilter.set('BEBIDA');
    expect(component.visibleProducts).toEqual([]);
    fixture.componentRef.setInput('session', { ...session, role: 'ADMINISTRADOR' });
    fixture.detectChanges();
    expect(component.visibleProducts.map((item) => item.name)).toEqual(['Limonada']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Administrar menú');
    fixture.destroy();
  });

  it('saves an administrator product and rejects insecure image URLs', async () => {
    const save = vi.fn(async () => products[0]);
    globalThis.__GESTOURANT_PRODUCTS__ = {
      list: vi.fn(async () => products),
      save,
      remove: vi.fn(),
    };
    const fixture = await createPage('ADMINISTRADOR');
    const component = fixture.componentInstance;
    const form = { reportValidity: () => true, reset: vi.fn() } as unknown as HTMLFormElement;
    component.name = 'Nuevo';
    component.description = 'Prueba';
    component.price = 12000;
    component.stock = 5;
    component.imageUrl = 'http://invalid';
    await component.saveProduct(form);
    expect(component.error()).toContain('https://');
    expect(save).not.toHaveBeenCalled();

    component.imageUrl = 'https://example.com/image.jpg';
    await component.saveProduct(form);
    expect(save).toHaveBeenCalledWith({ ...session, role: 'ADMINISTRADOR' }, expect.objectContaining({
      name: 'Nuevo',
      imageUrl: 'https://example.com/image.jpg',
    }), null);
    expect(component.notice()).toBe('Producto guardado en el menú.');
    fixture.destroy();
  });

  it('routes employees to table selection and adds products when an order is active', async () => {
    const add = vi.fn(async () => undefined);
    globalThis.__GESTOURANT_PRODUCTS__ = {
      list: vi.fn(async () => products),
      save: vi.fn(),
      remove: vi.fn(),
    };
    globalThis.__GESTOURANT_GET_ACTIVE_ORDER__ = vi.fn(async () => ({ id: 18, tableNumber: 5 }));
    globalThis.__GESTOURANT_ADD_ORDER_PRODUCT__ = add;
    const fixture = await createPage();
    const component = fixture.componentInstance;
    const tableSelection = vi.fn();
    component.chooseTable.subscribe(tableSelection);
    await component.addToOrder(products[0]);
    expect(add).toHaveBeenCalledWith(1);
    expect(component.activeOrder()?.tableNumber).toBe(5);
    component.activeOrder.set(null);
    await component.addToOrder(products[0]);
    expect(tableSelection).toHaveBeenCalledOnce();
    fixture.destroy();
  });
});
