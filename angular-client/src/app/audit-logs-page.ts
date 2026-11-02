import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { activeLocale, TranslatePipe } from './locale';

@Component({
  selector: 'app-audit-logs-page',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './audit-logs-page.html',
})
export class AuditLogsPage implements OnChanges {
  @Input({ required: true }) session!: GestourantSession;

  readonly entries = signal<GestourantAuditLog[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) void this.load();
  }

  async load(page = this.page()): Promise<void> {
    const audit = globalThis.__GESTOURANT_AUDIT__;
    if (!audit) {
      this.error.set('No se pudo conectar con el espacio de trabajo. Recarga la página e inténtalo de nuevo.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      const result = await audit.list(this.session, page, 50);
      if (!Array.isArray(result.content)
        || !Number.isInteger(result.number)
        || !Number.isInteger(result.totalPages)
        || !Number.isInteger(result.totalElements)) {
        throw new TypeError('La respuesta del historial de auditoría no tiene el formato esperado.');
      }
      this.entries.set(result.content);
      this.page.set(result.number);
      this.totalPages.set(result.totalPages);
      this.totalElements.set(result.totalElements);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString(activeLocale());
  }
}
