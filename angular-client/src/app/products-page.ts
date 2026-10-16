import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalizedNumberPipe, TranslatePipe, translate } from './locale';

type ProductCategoryFilter = 'TODOS' | 'PLATO' | 'BEBIDA' | 'OTRO';

@Component({
  selector: 'app-products-page',
  imports: [CommonModule, FormsModule, LocalizedNumberPipe, TranslatePipe],
  templateUrl: './products-page.html',
})
export class ProductsPage implements OnInit {
  @Input({ required: true }) session!: GestourantSession;
  @Output() chooseTable = new EventEmitter<void>();

  readonly products = signal<GestourantProduct[]>([]);
  readonly activeOrder = signal<GestourantActiveOrder | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly saving = signal(false);
  readonly categoryFilter = signal<ProductCategoryFilter>('TODOS');
  readonly search = signal('');
  readonly editingId = signal<number | null>(null);
  readonly filters: Array<{ value: ProductCategoryFilter; label: string }> = [
    { value: 'TODOS', label: 'Todo el menú' },
    { value: 'PLATO', label: 'Platos' },
    { value: 'BEBIDA', label: 'Bebidas' },
    { value: 'OTRO', label: 'Otros' },
  ];

  name = '';
  category = 'PLATO';
  description = '';
  imageUrl = '';
  price: number | null = null;
  stock: number | null = null;
  active = true;

  get isAdmin(): boolean {
    return this.session.role === 'ADMINISTRADOR';
  }

  isActive(product: GestourantProduct): boolean {
    return product.active;
  }

  photo(product: GestourantProduct): string {
    return globalThis.__GESTOURANT_PRODUCT_PHOTO__?.(product) || '';
  }

  fallbackPhoto(event: Event, product: GestourantProduct): void {
    const image = event.target as HTMLImageElement;
    if (image.dataset['fallbackApplied']) return;
    image.dataset['fallbackApplied'] = 'true';
    image.src = globalThis.__GESTOURANT_PRODUCT_PHOTO__?.({ ...product, imageUrl: null }) || '';
    image.classList.add('photo-fallback');
  }

  get visibleProducts(): GestourantProduct[] {
    const query = this.search().trim().toLocaleLowerCase('es');
    return this.products().filter((product) => {
      const categoryMatches = this.categoryFilter() === 'TODOS' || product.category === this.categoryFilter();
      const searchMatches = !query || `${product.name} ${translate(product.name)} ${product.description} ${translate(product.description)} ${product.category}`.toLocaleLowerCase('es').includes(query);
      return categoryMatches && searchMatches && (this.isAdmin || product.active);
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const gateway = globalThis.__GESTOURANT_PRODUCTS__;
    if (!gateway) {
      this.error.set('No está disponible el servicio de menú. Recarga la página e inténtalo de nuevo.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const [products, activeOrder] = await Promise.all([
        gateway.list(this.session),
        globalThis.__GESTOURANT_GET_ACTIVE_ORDER__?.() ?? Promise.resolve(null),
      ]);
      this.products.set(products);
      this.activeOrder.set(activeOrder);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el menú.');
    } finally {
      this.loading.set(false);
    }
  }

  editProduct(product: GestourantProduct): void {
    this.editingId.set(product.id);
    this.name = product.name;
    this.category = product.category || 'PLATO';
    this.description = product.description || '';
    this.imageUrl = product.imageUrl || '';
    this.price = product.price;
    this.stock = product.stock;
    this.active = product.active;
    document.querySelector('.menu-admin-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  resetForm(form: HTMLFormElement): void {
    form.reset();
    this.editingId.set(null);
    this.name = '';
    this.category = 'PLATO';
    this.description = '';
    this.imageUrl = '';
    this.price = null;
    this.stock = null;
    this.active = true;
  }

  async saveProduct(form: HTMLFormElement): Promise<void> {
    if (!form.reportValidity() || this.price === null || this.stock === null) return;
    if (this.imageUrl && !this.imageUrl.startsWith('https://')) {
      this.error.set('La imagen debe tener una dirección segura que comience con https://');
      return;
    }
    const save = globalThis.__GESTOURANT_PRODUCTS__?.save;
    if (!save) {
      this.error.set('No está disponible el guardado de productos.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const editingId = this.editingId();
      await save(this.session, {
        name: this.name.trim(),
        category: this.category,
        description: this.description.trim(),
        imageUrl: this.imageUrl.trim(),
        price: this.price,
        stock: this.stock,
        active: this.active,
      }, editingId);
      this.resetForm(form);
      await this.load();
      this.notice.set(editingId ? 'Producto actualizado.' : 'Producto guardado en el menú.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el producto.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteProduct(product: GestourantProduct): Promise<void> {
    if (!globalThis.confirm(translate('¿Eliminar {name} del menú?', { name: product.name }))) return;
    const remove = globalThis.__GESTOURANT_PRODUCTS__?.remove;
    if (!remove) {
      this.error.set('No está disponible la eliminación de productos.');
      return;
    }
    this.error.set('');
    this.notice.set('');
    try {
      await remove(this.session, product.id);
      await this.load();
      this.notice.set('Producto eliminado.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar el producto.');
    }
  }

  async addToOrder(product: GestourantProduct): Promise<void> {
    const activeOrder = this.activeOrder();
    if (!activeOrder) {
      this.chooseTable.emit();
      return;
    }
    const add = globalThis.__GESTOURANT_ADD_ORDER_PRODUCT__;
    if (!add) {
      this.error.set('No está disponible la edición de pedidos.');
      return;
    }
    this.error.set('');
    this.notice.set('');
    try {
      await add(product.id);
      const current = await globalThis.__GESTOURANT_GET_ACTIVE_ORDER__?.();
      if (current) this.activeOrder.set(current);
      this.notice.set('Producto agregado al pedido y guardado.');
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo agregar el producto al pedido.');
    }
  }

  private async loadProducts(): Promise<void> {
    const list = globalThis.__GESTOURANT_PRODUCTS__?.list;
    if (list) this.products.set(await list(this.session));
  }
}
