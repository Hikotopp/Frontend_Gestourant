import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalizedDatePipe, TranslatePipe, translate } from './locale';

type UserRole = GestourantManagedUser['role'];

@Component({
  selector: 'app-users-page',
  imports: [CommonModule, FormsModule, LocalizedDatePipe, TranslatePipe],
  templateUrl: './users-page.html',
})
export class UsersPage implements OnInit {
  @Input({ required: true }) session!: GestourantSession;

  readonly users = signal<GestourantManagedUser[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly busyIds = signal<Set<number>>(new Set());
  readonly error = signal('');
  readonly message = signal('');
  username = '';
  email = '';
  password = '';
  role: UserRole = 'EMPLEADO';

  ngOnInit(): void {
    if (this.session.role !== 'ADMINISTRADOR') {
      this.error.set('Solo el administrador puede gestionar usuarios.');
      this.loading.set(false);
      return;
    }
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const list = globalThis.__GESTOURANT_USERS__?.list;
    if (!list) {
      this.error.set('No está disponible la gestión de usuarios.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      this.users.set(await list(this.session));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el equipo.');
    } finally {
      this.loading.set(false);
    }
  }

  async create(form: HTMLFormElement): Promise<void> {
    if (!form.reportValidity()) return;
    const create = globalThis.__GESTOURANT_USERS__?.create;
    if (!create) {
      this.error.set('No está disponible la creación de usuarios.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const user = await create(this.session, {
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.password,
        role: this.role,
      });
      this.users.update((users) => [...users, user]);
      this.message.set(translate('Se creó la cuenta de {username}.', { username: user.username }));
      this.username = '';
      this.email = '';
      this.password = '';
      this.role = 'EMPLEADO';
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      this.saving.set(false);
    }
  }

  async changeRole(user: GestourantManagedUser, role: string): Promise<void> {
    if (role !== 'ADMINISTRADOR' && role !== 'EMPLEADO') return;
    await this.update(user, role, user.enabled);
  }

  async toggleEnabled(user: GestourantManagedUser): Promise<void> {
    const enabled = !user.enabled;
    if (!enabled && !globalThis.confirm(translate('¿Desactivar la cuenta de {username}? Ya no podrá iniciar sesión.', { username: user.username }))) return;
    await this.update(user, user.role, enabled);
  }

  isCurrentUser(user: GestourantManagedUser): boolean {
    return user.email.toLowerCase() === this.session.email.toLowerCase();
  }

  private async update(user: GestourantManagedUser, role: UserRole, enabled: boolean): Promise<void> {
    const update = globalThis.__GESTOURANT_USERS__?.update;
    if (!update) {
      this.error.set('No está disponible la edición de usuarios.');
      return;
    }
    this.busyIds.update((ids) => new Set(ids).add(user.id));
    this.error.set('');
    this.message.set('');
    try {
      const updated = await update(this.session, user.id, { role, enabled });
      this.users.update((users) => users.map((item) => item.id === updated.id ? updated : item));
      this.message.set(translate('Se actualizó el acceso de {username}.', { username: updated.username }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el acceso.';
      await this.refresh();
      this.error.set(message);
    } finally {
      this.busyIds.update((ids) => {
        const next = new Set(ids);
        next.delete(user.id);
        return next;
      });
    }
  }
}
