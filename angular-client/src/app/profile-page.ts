import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isValidRegistrationPassword } from '../../../src/shared/passwordPolicy.js';
import { TranslatePipe } from './locale';

@Component({
  selector: 'app-profile-page',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './profile-page.html',
})
export class ProfilePage implements OnInit, OnDestroy {
  @Input({ required: true }) session!: GestourantSession;
  @Output() sessionUpdated = new EventEmitter<GestourantSession>();

  readonly profile = signal<GestourantUserProfile | null>(null);
  readonly photoUrl = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly photoBusy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  username = '';
  email = '';
  currentPassword = '';
  newPassword = '';
  private objectUrl = '';

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.revokePhotoUrl();
  }

  async load(): Promise<void> {
    const profileApi = globalThis.__GESTOURANT_PROFILE__;
    if (!profileApi) {
      this.error.set('No está disponible la configuración del perfil.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const profile = await profileApi.get(this.session);
      this.setProfile(profile);
      if (profile.photoAvailable) {
        const photo = await profileApi.getPhoto(this.session);
        this.setPhotoUrl(URL.createObjectURL(photo));
      } else {
        this.revokePhotoUrl();
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar tu perfil.');
    } finally {
      this.loading.set(false);
    }
  }

  async update(form: HTMLFormElement): Promise<void> {
    if (!form.reportValidity()) return;
    if (this.newPassword && !isValidRegistrationPassword(this.newPassword)) {
      this.error.set('La nueva contraseña debe tener al menos 12 caracteres e incluir una mayúscula, una minúscula, un número y un carácter especial.');
      return;
    }
    const profileApi = globalThis.__GESTOURANT_PROFILE__;
    if (!profileApi) {
      this.error.set('No está disponible la actualización del perfil.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const updated = await profileApi.update(this.session, {
        username: this.username.trim(),
        email: this.email.trim(),
        currentPassword: this.currentPassword,
        newPassword: this.newPassword || null,
      });
      const profile = this.profile();
      if (profile) this.profile.set({ ...profile, username: updated.username, email: updated.email });
      this.currentPassword = '';
      this.newPassword = '';
      this.sessionUpdated.emit(updated);
      this.message.set('Tus credenciales se actualizaron.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.');
    } finally {
      this.saving.set(false);
    }
  }

  async uploadPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 1_048_576) {
      this.error.set('Selecciona una imagen JPG o PNG de máximo 1 MB.');
      input.value = '';
      return;
    }
    const upload = globalThis.__GESTOURANT_PROFILE__?.uploadPhoto;
    if (!upload) {
      this.error.set('No está disponible la carga de foto de perfil.');
      input.value = '';
      return;
    }
    this.photoBusy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await upload(this.session, file);
      const photo = await globalThis.__GESTOURANT_PROFILE__?.getPhoto(this.session);
      if (!photo) throw new Error('No se pudo recuperar la foto guardada.');
      this.setPhotoUrl(URL.createObjectURL(photo));
      this.profile.update((profile) => profile ? { ...profile, photoAvailable: true } : profile);
      this.message.set('La foto de perfil se actualizó.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la foto de perfil.');
    } finally {
      this.photoBusy.set(false);
      input.value = '';
    }
  }

  async deletePhoto(): Promise<void> {
    if (!globalThis.confirm('¿Eliminar tu foto de perfil?')) return;
    const remove = globalThis.__GESTOURANT_PROFILE__?.deletePhoto;
    if (!remove) {
      this.error.set('No está disponible la eliminación de la foto.');
      return;
    }
    this.photoBusy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await remove(this.session);
      this.revokePhotoUrl();
      this.profile.update((profile) => profile ? { ...profile, photoAvailable: false } : profile);
      this.message.set('Se eliminó la foto de perfil.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar la foto de perfil.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  private setProfile(profile: GestourantUserProfile): void {
    this.profile.set(profile);
    this.username = profile.username;
    this.email = profile.email;
  }

  private setPhotoUrl(url: string): void {
    this.revokePhotoUrl();
    this.objectUrl = url;
    this.photoUrl.set(url);
  }

  private revokePhotoUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = '';
    this.photoUrl.set('');
  }
}
