import { CommonModule, registerLocaleData } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import localeEsCo from '@angular/common/locales/es-CO';

registerLocaleData(localeEsCo);

@Component({
  selector: 'app-backups-page',
  imports: [CommonModule],
  templateUrl: './backups-page.html',
})
export class BackupsPage implements OnInit {
  @Input({ required: true }) session!: GestourantSession;

  readonly backups = signal<GestourantBackup[]>([]);
  readonly loading = signal(true);
  readonly busyIds = signal<Set<string>>(new Set());
  readonly creating = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    if (this.session.role !== 'ADMINISTRADOR') {
      this.error.set('Solo el administrador puede gestionar copias de seguridad.');
      this.loading.set(false);
      return;
    }
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const list = globalThis.__GESTOURANT_BACKUPS__?.list;
    if (!list) {
      this.error.set('No está disponible el servicio de copias de seguridad.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.message.set('Consultando el almacenamiento seguro…');
    try {
      this.backups.set(await list(this.session));
      this.message.set('');
    } catch (error) {
      this.backups.set([]);
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el historial de copias.');
      this.message.set('Verifica que el almacenamiento S3 y sus credenciales estén configurados.');
    } finally {
      this.loading.set(false);
    }
  }

  async create(): Promise<void> {
    const create = globalThis.__GESTOURANT_BACKUPS__?.create;
    if (!create) {
      this.error.set('No está disponible la creación de copias.');
      return;
    }
    this.creating.set(true);
    this.error.set('');
    this.message.set('Generando el respaldo de MySQL y guardándolo de forma segura…');
    try {
      const backup = await create(this.session);
      await this.refresh();
      this.message.set(`Copia creada: ${backup.fileName}`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo crear la copia de seguridad.');
      this.message.set('');
    } finally {
      this.creating.set(false);
    }
  }

  async download(backup: GestourantBackup): Promise<void> {
    const download = globalThis.__GESTOURANT_BACKUPS__?.download;
    if (!download) {
      this.error.set('No está disponible la descarga de copias.');
      return;
    }
    this.setBusy(backup.id, true);
    this.error.set('');
    try {
      await download(this.session, backup.id);
      this.message.set('Descarga del respaldo iniciada.');
    } catch (error) {
      this.error.set(error instanceof Error ? `No se pudo descargar el respaldo: ${error.message}` : 'No se pudo descargar el respaldo.');
    } finally {
      this.setBusy(backup.id, false);
    }
  }

  async restore(backup: GestourantBackup): Promise<void> {
    if (!globalThis.confirm('Esta acción reemplazará la base de datos actual. Se recomienda descargar un respaldo reciente antes de continuar.')) return;
    if (globalThis.prompt('Escribe RESTAURAR para confirmar:') !== 'RESTAURAR') return;
    const restore = globalThis.__GESTOURANT_BACKUPS__?.restore;
    if (!restore) {
      this.error.set('No está disponible la restauración de copias.');
      return;
    }
    this.setBusy(backup.id, true);
    this.error.set('');
    this.message.set('Restaurando la base de datos y creando una copia de seguridad previa…');
    try {
      const result = await restore(this.session, backup.id);
      this.message.set(`Restauración completada. Se creó el respaldo de seguridad ${result.safetyBackupFileName}.`);
      await this.refresh();
      this.message.set(`Restauración completada. Se creó el respaldo de seguridad ${result.safetyBackupFileName}.`);
    } catch (error) {
      this.error.set(error instanceof Error ? `No se pudo restaurar la base de datos: ${error.message}` : 'No se pudo restaurar la base de datos.');
      this.message.set('');
    } finally {
      this.setBusy(backup.id, false);
    }
  }

  formatSize(size: number): string {
    if (!Number.isFinite(size) || size < 0) return '—';
    if (size < 1024) return `${size} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = size / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ${units[unit]}`;
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((ids) => {
      const next = new Set(ids);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
