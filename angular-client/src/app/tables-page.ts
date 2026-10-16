import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, translate } from './locale';

@Component({
  selector: 'app-tables-page',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './tables-page.html',
})
export class TablesPage implements OnInit, OnDestroy {
  @Input({ required: true }) session!: GestourantSession;
  @Output() tableSelected = new EventEmitter<number>();

  readonly tables = signal<GestourantTable[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly arranging = signal(false);
  readonly createPending = signal(false);
  readonly joinPending = signal(false);
  tableNumber: number | null = null;
  seats: number | null = null;
  firstTableId = '';
  secondTableId = '';

  private refreshTimer?: number;
  private draggedTable?: number;
  private dragStart?: { x: number; y: number };
  private dragPosition?: { x: number; y: number };
  private dragMoved = false;
  private suppressSelection = false;

  get occupiedCount(): number {
    return this.tables().filter((table) => table.status === 'OCUPADA').length;
  }

  get availableCount(): number {
    return this.tables().filter((table) => table.status === 'LIBRE').length;
  }

  get joinableTables(): GestourantTable[] {
    return this.tables().filter((table) => table.status === 'LIBRE' && !table.joinedTableId);
  }

  ngOnInit(): void {
    void this.loadTables();
    this.refreshTimer = window.setInterval(() => {
      if (!this.arranging()) void this.loadTables(true);
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== undefined) window.clearInterval(this.refreshTimer);
  }

  tableX(table: GestourantTable, index: number): number {
    return Number(table.floorX ?? 15 + (index % 4) * 22);
  }

  tableY(table: GestourantTable, index: number): number {
    return Number(table.floorY ?? 18 + (Math.floor(index / 4) % 4) * 22);
  }

  async loadTables(silent = false): Promise<boolean> {
    const gateway = globalThis.__GESTOURANT_TABLES__;
    if (!gateway) {
      this.error.set('No está disponible el servicio de mesas. Recarga la página e inténtalo de nuevo.');
      this.loading.set(false);
      return false;
    }

    let loaded = false;
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      this.tables.set(await gateway.list(this.session));
      loaded = true;
      if (silent) this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el mapa de mesas.');
    } finally {
      this.loading.set(false);
    }
    return loaded;
  }

  async createTable(form: HTMLFormElement): Promise<void> {
    if (!form.reportValidity() || this.tableNumber === null || this.seats === null) return;
    const create = globalThis.__GESTOURANT_TABLES__?.create;
    if (!create) {
      this.error.set('No está disponible la creación de mesas. Recarga la página e inténtalo de nuevo.');
      return;
    }
    this.createPending.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await create(this.session, { tableNumber: this.tableNumber, seats: this.seats });
      this.tableNumber = null;
      this.seats = null;
      form.reset();
      if (await this.loadTables()) this.notice.set('Mesa creada.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo crear la mesa.');
    } finally {
      this.createPending.set(false);
    }
  }

  async joinTables(form: HTMLFormElement): Promise<void> {
    if (!form.reportValidity() || !this.firstTableId || !this.secondTableId) return;
    const join = globalThis.__GESTOURANT_TABLES__?.join;
    if (!join) {
      this.error.set('No está disponible la unión de mesas. Recarga la página e inténtalo de nuevo.');
      return;
    }
    this.joinPending.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await join(this.session, {
        firstTableId: Number(this.firstTableId),
        secondTableId: Number(this.secondTableId),
      });
      this.firstTableId = '';
      this.secondTableId = '';
      form.reset();
      if (await this.loadTables()) this.notice.set('Mesas unidas.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron unir las mesas.');
    } finally {
      this.joinPending.set(false);
    }
  }

  selectTable(tableId: number): void {
    if (this.suppressSelection) {
      this.suppressSelection = false;
      return;
    }
    this.tableSelected.emit(tableId);
  }

  async showQr(tableId: number): Promise<void> {
    const table = this.tables().find((item) => item.id === tableId);
    if (!table || !globalThis.__GESTOURANT_SHOW_TABLE_QR__) {
      this.error.set('No se pudo abrir el código QR de la mesa.');
      return;
    }
    try {
      await globalThis.__GESTOURANT_SHOW_TABLE_QR__(table);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo generar el código QR.');
    }
  }

  async beginDrag(event: PointerEvent, table: GestourantTable): Promise<void> {
    if (this.session.role !== 'ADMINISTRADOR' || !this.arranging() || event.button !== 0) return;
    this.draggedTable = table.id;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragMoved = false;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  moveDrag(event: PointerEvent): void {
    if (this.draggedTable === undefined || !this.dragStart || !this.arranging()) return;
    if (!this.dragMoved && Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) < 5) return;
    this.dragMoved = true;
    const bounds = (event.currentTarget as HTMLElement).closest('.floor-map')?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) return;
    this.dragPosition = {
      x: Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(10, Math.min(88, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
    const table = this.tables().find((item) => item.id === this.draggedTable);
    if (table) this.tables.update((items) => items.map((item) => item.id === table.id
      ? { ...item, floorX: this.dragPosition!.x, floorY: this.dragPosition!.y }
      : item));
  }

  async endDrag(): Promise<void> {
    const tableId = this.draggedTable;
    const position = this.dragPosition;
    const moved = this.dragMoved;
    this.draggedTable = undefined;
    this.dragStart = undefined;
    this.dragPosition = undefined;
    this.dragMoved = false;
    if (!moved || tableId === undefined || !position) return;

    this.suppressSelection = true;
    window.setTimeout(() => {
      this.suppressSelection = false;
    });
    const updatePosition = globalThis.__GESTOURANT_TABLES__?.updatePosition;
    if (!updatePosition) {
      this.error.set('No está disponible el guardado de la ubicación de mesa.');
      await this.loadTables();
      return;
    }
    this.error.set('');
    try {
      const updated = await updatePosition(this.session, tableId, position);
      this.tables.update((items) => items.map((table) => table.id === tableId ? updated : table));
    } catch (error) {
      this.error.set(error instanceof Error
        ? translate('No se pudo guardar la ubicación: {detail}', { detail: error.message })
        : 'No se pudo guardar la ubicación.');
      await this.loadTables();
    }
  }
}
