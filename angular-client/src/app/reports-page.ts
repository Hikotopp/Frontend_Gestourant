import { CommonModule, registerLocaleData } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import localeEsCo from '@angular/common/locales/es-CO';

registerLocaleData(localeEsCo);

@Component({
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-page.html',
})
export class ReportsPage implements OnInit {
  @Input({ required: true }) session!: GestourantSession;

  readonly report = signal<GestourantHistoryReport | null>(null);
  readonly from = signal(this.today());
  readonly to = signal(this.today());
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('Consulta las fechas seleccionadas para cargar el reporte.');
  readonly downloading = signal(false);
  private requestSequence = 0;

  get isAdmin(): boolean {
    return this.session.role === 'ADMINISTRADOR';
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
      const count = report.invoices?.length ?? 0;
      this.message.set(`${count} factura${count === 1 ? '' : 's'} encontrada${count === 1 ? '' : 's'}.`);
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

  private today(): string {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
