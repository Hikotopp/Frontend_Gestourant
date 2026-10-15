import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LanguagePicker } from './language-picker';
import { TranslatePipe } from './locale';

type DemoTableStatus = 'LIBRE' | 'OCUPADA';

interface DemoTable {
  id: number;
  seats: number;
  status: DemoTableStatus;
}

interface DemoItem {
  id: number;
  name: string;
  price: number;
  note: string;
}

@Component({
  selector: 'app-public-home',
  imports: [LanguagePicker, TranslatePipe],
  templateUrl: './public-home.html',
})
export class PublicHome {
  @Output() authRequested = new EventEmitter<'login' | 'register'>();
  @Input() notice = '';

  readonly tables: DemoTable[] = [
    { id: 4, seats: 4, status: 'OCUPADA' },
    { id: 7, seats: 2, status: 'LIBRE' },
    { id: 9, seats: 6, status: 'OCUPADA' },
  ];

  readonly orders: Record<number, DemoItem[]> = {
    4: [
      { id: 1, name: 'Hamburguesa de la casa', price: 28000, note: 'Sin maní' },
      { id: 2, name: 'Limonada natural', price: 7000, note: '' },
    ],
    7: [],
    9: [{ id: 3, name: 'Pasta al pesto', price: 24000, note: '' }],
  };

  selectedTableId = 4;
  private nextItemId = 4;

  get selectedTable(): DemoTable {
    return this.tables.find((table) => table.id === this.selectedTableId) ?? this.tables[0];
  }

  get selectedOrder(): DemoItem[] {
    return this.orders[this.selectedTableId];
  }

  get orderTotal(): number {
    return this.selectedOrder.reduce((total, item) => total + item.price, 0);
  }

  requestAuth(mode: 'login' | 'register'): void {
    this.authRequested.emit(mode);
  }

  selectTable(tableId: number): void {
    this.selectedTableId = tableId;
  }

  openDemoOrder(): void {
    this.selectedTable.status = 'OCUPADA';
  }

  addItem(name: string, price: number): void {
    this.selectedOrder.push({ id: this.nextItemId++, name, price, note: '' });
    this.selectedTable.status = 'OCUPADA';
  }

  removeItem(itemId: number): void {
    this.orders[this.selectedTableId] = this.selectedOrder.filter((item) => item.id !== itemId);
  }

  saveIngredientNote(note: string): void {
    if (this.selectedOrder[0]) this.selectedOrder[0].note = note.trim();
  }

  formatMoney(amount: number): string {
    return amount.toLocaleString('es-CO');
  }

  scrollToTop(event: Event): void {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
