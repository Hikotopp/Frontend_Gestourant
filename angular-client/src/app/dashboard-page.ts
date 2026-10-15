import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { RequestsPage } from './requests-page';
import { TablesPage } from './tables-page';

type DashboardView = 'tables' | 'orders' | 'kitchen' | 'products' | 'reports' | 'backups';

interface NavigationItem {
  id: DashboardView | 'overview';
  label: string;
  path: string;
  administratorsOnly?: boolean;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, RequestsPage, TablesPage],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnChanges {
  @Input() session: GestourantSession | null = null;
  @Input() notice = '';
  @Input() activeView: DashboardView | 'overview' = 'overview';
  @Input() pendingRequestCount = 0;
  @Output() viewRequested = new EventEmitter<DashboardView | 'overview'>();
  @Output() logoutRequested = new EventEmitter<void>();
  @Output() tableSelected = new EventEmitter<number>();
  @Output() requestCountChanged = new EventEmitter<number>();

  readonly summary = signal<GestourantDashboardSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly navigation: NavigationItem[] = [
    { id: 'overview', label: 'Resumen', path: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { id: 'tables', label: 'Mesas', path: 'M4 9v6m16-6v6M9 4h6m-6 16h6M7 7h10v10H7z' },
    { id: 'orders', label: 'Pedidos', path: 'M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14 3v5h5M9 12h6m-6 4h6' },
    { id: 'kitchen', label: 'Cocina', path: 'M4 10h16l-2 10H6L4 10Zm0 0a4 4 0 0 1 8 0 4 4 0 0 1 8 0M9 14v2m6-2v2' },
    { id: 'products', label: 'Menú e inventario', path: 'M4 7h16v13H4zM7 7l1-4h8l1 4M8 11h8m-8 4h5' },
    { id: 'reports', label: 'Reportes', path: 'M4 19V5m0 14h17M7 15l4-4 3 2 6-7' },
    { id: 'backups', label: 'Copias de seguridad', path: 'M4 19V5m0 14h17M7 15l4-4 3 2 6-7', administratorsOnly: true },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) void this.loadSummary(this.session);
    else if (changes['activeView'] && this.activeView === 'overview' && this.session) {
      void this.loadSummary(this.session);
    }
  }

  get visibleNavigation(): NavigationItem[] {
    return this.navigation.filter((item) => !item.administratorsOnly || this.session?.role === 'ADMINISTRADOR');
  }

  documentTheme(): string {
    return document.documentElement.dataset['theme'] || 'light';
  }

  openView(view: DashboardView | 'overview'): void {
    this.viewRequested.emit(view);
  }

  async loadSummary(session: GestourantSession): Promise<void> {
    const load = globalThis.__GESTOURANT_LOAD_DASHBOARD_OVERVIEW__;
    if (!load) {
      this.error.set('No se pudo conectar con el espacio de trabajo. Recarga la página e inténtalo de nuevo.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      this.summary.set(await load(session));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el resumen del restaurante.');
    } finally {
      this.loading.set(false);
    }
  }

  applyTheme(theme: string): void {
    if (!['light', 'dark', 'bistro'].includes(theme)) return;
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('gestourant_theme', theme);
  }
}
