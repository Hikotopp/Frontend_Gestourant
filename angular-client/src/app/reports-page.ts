import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { todayInBogota } from '../../../src/shared/date-time.js';
import { LocalizedDatePipe, LocalizedNumberPipe, TranslatePipe, translate } from './locale';

@Component({
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule, LocalizedDatePipe, LocalizedNumberPipe, TranslatePipe],
  templateUrl: './reports-page.html',
})
export class ReportsPage implements OnInit {
  @Input({ required: true }) session!: GestourantSession;
  @Input() mode: 'reports' | 'returns' = 'reports';

  readonly report = signal<GestourantHistoryReport | null>(null);
  readonly from = signal(this.today());
  readonly to = signal(this.today());
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('Consulta las fechas seleccionadas para cargar el reporte.');
  readonly downloading = signal(false);
  readonly lossReport = signal<GestourantLossReport | null>(null);
  readonly lossError = signal('');
  readonly products = signal<GestourantProduct[]>([]);
  readonly returnHistory = signal<Record<number, GestourantReturnHistory>>({});
  readonly returnErrors = signal<Record<number, string>>({});
  lossProductId: number | null = null;
  lossQuantity = 1;
  lossReason = 'MERMA';
  lossNotes = '';
  returnQuantity = 1;
  returnMax = 1;
  returnReason = 'CALIDAD';
  returnNotes = '';
  returnRestocked = false;
  refundMethod = 'EFECTIVO';
  private pendingReturn: { invoiceId: number; orderItemId: number; remaining: number } | null = null;
  private readonly returnRequests = new Map<number, Promise<void>>();
  private requestSequence = 0;

  get isAdmin(): boolean {
    return this.session.role === 'ADMINISTRADOR';
  }

  get isReturnsView(): boolean {
    return this.mode === 'returns';
  }

  get adminLossReport(): GestourantLossReport | null {
    return this.isAdmin ? this.lossReport() : null;
  }

  ngOnInit(): void {
    void this.search();
  }

  datesChanged(): void {
    this.requestSequence++;
    this.report.set(null);
    this.error.set('');
    this.message.set('Consulta las fechas seleccionadas para cargar el reporte.');
  }

  async search(): Promise<void> {
    const from = this.from();
    const to = this.isAdmin ? this.to() : from;
    const requestId = ++this.requestSequence;
    if (!from || !to || to < from) {
      this.report.set(null);
      this.error.set('Verifica las fechas: la fecha final debe ser igual o posterior a la inicial.');
      this.message.set('');
      return;
    }

    const getHistory = globalThis.__GESTOURANT_REPORTS__?.getHistory;
    if (!getHistory) {
      this.report.set(null);
      this.error.set('No está disponible el servicio de reportes.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.message.set('Consultando facturas…');
    try {
      const report = await getHistory(this.session, from, to, this.isAdmin);
      if (requestId !== this.requestSequence) return;
      this.report.set(report);
      this.returnHistory.set({});
      this.returnErrors.set({});
      const count = report.invoices?.length ?? 0;
      this.message.set(count === 1
        ? translate('1 factura encontrada.')
        : translate('{count} facturas encontradas.', { count }));
      if (this.isReturnsView) {
        await Promise.all((report.invoices ?? []).map((invoice) => this.loadReturns(invoice)));
      } else {
        await this.loadLosses(from, to);
      }
    } catch (error) {
      if (requestId !== this.requestSequence) return;
      this.report.set(null);
      this.error.set(error instanceof Error ? error.message : 'No se pudo consultar el historial.');
      this.message.set('No se pudo consultar el historial de facturas.');
    } finally {
      if (requestId === this.requestSequence) this.loading.set(false);
    }
  }

  async download(): Promise<void> {
    const report = this.report();
    const download = globalThis.__GESTOURANT_DOWNLOAD_REPORT__;
    if (!report || !download) {
      this.error.set('No está disponible la exportación del reporte.');
      return;
    }
    this.downloading.set(true);
    this.error.set('');
    try {
      await download(report, this.isAdmin);
      this.message.set('Historial de facturas descargado en Excel.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo descargar el reporte.');
    } finally {
      this.downloading.set(false);
    }
  }

  async loadReturns(invoice: GestourantInvoice): Promise<void> {
    const invoiceId = invoice.invoiceId;
    if (this.returnHistory()[invoiceId]) return;
    const pendingRequest = this.returnRequests.get(invoiceId);
    if (pendingRequest) return pendingRequest;
    const history = globalThis.__GESTOURANT_RETURNS__?.history;
    if (!history) {
      this.returnErrors.update((errors) => ({ ...errors, [invoiceId]: 'No está disponible el historial de devoluciones.' }));
      return;
    }
    const request = Promise.resolve()
      .then(() => history(this.session, invoiceId))
      .then((result) => {
        this.returnHistory.update((current) => ({ ...current, [invoiceId]: result }));
        this.returnErrors.update((errors) => {
          const next = { ...errors };
          delete next[invoiceId];
          return next;
        });
      })
      .catch((error: unknown) => {
        this.returnErrors.update((errors) => ({
          ...errors,
          [invoiceId]: error instanceof Error ? error.message : 'No se pudo cargar el historial de devoluciones.',
        }));
      })
      .finally(() => this.returnRequests.delete(invoiceId));
    this.returnRequests.set(invoiceId, request);
    await request;
  }

  returnedQuantity(invoice: GestourantInvoice, item: GestourantInvoiceItem): number {
    return this.returnHistory()[invoice.invoiceId]?.returnedQuantities[item.orderItemId] ?? 0;
  }

  async openReturn(
    invoice: GestourantInvoice,
    item: GestourantInvoiceItem,
    dialog: HTMLDialogElement,
  ): Promise<void> {
    await this.loadReturns(invoice);
    if (this.returnErrors()[invoice.invoiceId]) {
      this.error.set(this.returnErrors()[invoice.invoiceId]);
      return;
    }
    const remaining = item.quantity - this.returnedQuantity(invoice, item);
    if (remaining < 1) {
      this.error.set('Este producto ya fue devuelto en su totalidad.');
      return;
    }
    this.error.set('');
    this.pendingReturn = { invoiceId: invoice.invoiceId, orderItemId: item.orderItemId, remaining };
    this.returnQuantity = 1;
    this.returnMax = remaining;
    this.returnReason = 'CALIDAD';
    this.returnNotes = '';
    this.returnRestocked = false;
    this.refundMethod = invoice.paymentMethod;
    dialog.showModal();
  }

  async submitReturn(dialog: HTMLDialogElement): Promise<void> {
    const pending = this.pendingReturn;
    const create = globalThis.__GESTOURANT_RETURNS__?.create;
    if (!pending || !create) {
      this.error.set('No está disponible el servicio de devoluciones.');
      return;
    }
    if (!Number.isInteger(this.returnQuantity) || this.returnQuantity < 1 || this.returnQuantity > pending.remaining) {
      this.error.set('La cantidad supera las unidades aún disponibles para devolución.');
      return;
    }
    this.error.set('');
    try {
      await create(this.session, pending.invoiceId, {
        orderItemId: pending.orderItemId,
        quantity: this.returnQuantity,
        reason: this.returnReason,
        notes: this.returnNotes.trim(),
        restocked: this.returnRestocked,
        refundMethod: this.refundMethod,
      });
      dialog.close();
      this.pendingReturn = null;
      this.returnHistory.update((current) => {
        const next = { ...current };
        delete next[pending.invoiceId];
        return next;
      });
      this.message.set('Devolución registrada y guardada.');
      await this.search();
      const invoice = this.report()?.invoices.find((item) => item.invoiceId === pending.invoiceId);
      if (invoice) await this.loadReturns(invoice);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo registrar la devolución.');
    }
  }

  async recordLoss(form: HTMLFormElement): Promise<void> {
    const record = globalThis.__GESTOURANT_INVENTORY__?.recordLoss;
    if (!record || this.lossProductId === null) {
      this.lossError.set('Selecciona un producto y verifica el servicio de inventario.');
      return;
    }
    this.lossError.set('');
    try {
      await record(this.session, {
        productId: this.lossProductId,
        quantity: this.lossQuantity,
        reason: this.lossReason,
        notes: this.lossNotes.trim(),
      });
      form.reset();
      this.lossProductId = null;
      this.lossQuantity = 1;
      this.lossReason = 'MERMA';
      this.lossNotes = '';
      this.message.set('Pérdida registrada y descontada del inventario.');
      await this.search();
    } catch (error) {
      this.lossError.set(error instanceof Error ? error.message : 'No se pudo registrar la pérdida.');
    }
  }

  private async loadLosses(from: string, to: string): Promise<void> {
    const listLosses = globalThis.__GESTOURANT_INVENTORY__?.listLosses;
    const listProducts = globalThis.__GESTOURANT_PRODUCTS__?.list;
    if (!listLosses || !listProducts) {
      this.lossReport.set(null);
      this.lossError.set('No están disponibles los servicios de inventario.');
      return;
    }
    try {
      const [report, products] = await Promise.all([
        listLosses(this.session, from, to),
        listProducts(this.session),
      ]);
      this.lossReport.set(report);
      this.products.set(products);
      this.lossError.set('');
    } catch (error) {
      this.lossReport.set(null);
      this.lossError.set(error instanceof Error ? error.message : 'No se pudieron cargar las pérdidas.');
    }
  }

  private today(): string {
    return todayInBogota();
  }
}
