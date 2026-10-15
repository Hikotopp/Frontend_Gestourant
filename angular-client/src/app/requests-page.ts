import { CommonModule, registerLocaleData } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import localeEsCo from '@angular/common/locales/es-CO';

registerLocaleData(localeEsCo);

type RequestQueue = 'orders' | 'kitchen';

@Component({
  selector: 'app-requests-page',
  imports: [CommonModule],
  templateUrl: './requests-page.html',
})
export class RequestsPage implements OnInit, OnDestroy {
  @Output() pendingCountChanged = new EventEmitter<number>();
  @Input({ required: true }) session!: GestourantSession;
  @Input({ required: true }) queue!: RequestQueue;

  readonly orders = signal<GestourantStaffRequest[]>([]);
  readonly kitchenOrders = signal<GestourantKitchenRequest[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly pendingIds = signal<Set<number>>(new Set());

  private refreshTimer?: number;
  private requestInFlight = false;
  private refreshQueued = false;

  get isKitchen(): boolean {
    return this.queue === 'kitchen';
  }

  ngOnInit(): void {
    void this.load();
    this.refreshTimer = window.setInterval(() => void this.load(true), 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== undefined) window.clearInterval(this.refreshTimer);
  }

  async load(silent = false): Promise<void> {
    const gateway = globalThis.__GESTOURANT_REQUESTS__;
    if (!gateway) {
      this.error.set('No están disponibles los servicios de solicitudes. Recarga la página e inténtalo de nuevo.');
      this.loading.set(false);
      return;
    }
    if (this.requestInFlight) {
      this.refreshQueued = true;
      return;
    }
    this.requestInFlight = true;
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      if (this.isKitchen) this.kitchenOrders.set(await gateway.listKitchen(this.session));
      else {
        const orders = await gateway.listOrders(this.session);
        this.orders.set(orders);
        this.pendingCountChanged.emit(orders.length);
      }
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron actualizar las solicitudes.');
    } finally {
      this.loading.set(false);
      this.requestInFlight = false;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        void this.load(true);
      }
    }
  }

  async resolveOrder(id: number, action: 'approve' | 'reject'): Promise<void> {
    const gateway = globalThis.__GESTOURANT_REQUESTS__;
    if (!gateway) {
      this.error.set('No está disponible el servicio para gestionar solicitudes.');
      return;
    }
    this.setPending(id, true);
    this.error.set('');
    try {
      if (action === 'approve') await gateway.approve(this.session, id);
      else await gateway.reject(this.session, id);
      await this.load();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo gestionar la solicitud.');
    } finally {
      this.setPending(id, false);
    }
  }

  async advanceKitchenOrder(id: number): Promise<void> {
    const advance = globalThis.__GESTOURANT_REQUESTS__?.advanceKitchen;
    if (!advance) {
      this.error.set('No está disponible el servicio de cocina.');
      return;
    }
    this.setPending(id, true);
    this.error.set('');
    try {
      await advance(this.session, id);
      await this.load();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar la comanda.');
    } finally {
      this.setPending(id, false);
    }
  }

  private setPending(id: number, pending: boolean): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
