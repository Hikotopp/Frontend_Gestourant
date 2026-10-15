import { AfterViewInit, Component, signal } from '@angular/core';
import { PublicHome } from './public-home';

@Component({
  selector: 'app-root',
  imports: [PublicHome],
  styleUrl: './app.css',
  template: `
    @if (showAngularHome()) {
      <app-public-home [notice]="homeNotice() || legacyLoadError()" (authRequested)="openAuth($event)" />
    }
    <div id="app" [hidden]="showAngularHome()"></div>
  `,
})
export class App implements AfterViewInit {
  showAngularHome = signal(this.shouldShowAngularHome());
  homeNotice = signal('');
  legacyLoadError = signal('');
  private legacyEntry: Promise<boolean> = Promise.resolve(false);

  async ngAfterViewInit(): Promise<void> {
    const hostname = window.location.hostname;
    globalThis.__GESTOURANT_CONFIG__ = {
      development: hostname === 'localhost' || hostname === '127.0.0.1',
      production: hostname !== 'localhost' && hostname !== '127.0.0.1',
      apiBase: '',
    };
    globalThis.__GESTOURANT_NOTICE_CHANGED__ = (notice: string) => {
      this.homeNotice.set(notice);
    };
    this.legacyEntry = import('../../../src/main.js')
      .then(() => true)
      .catch((error: unknown) => {
        console.error('No se pudo iniciar el cliente existente de Gestourant.', error);
        this.legacyLoadError.set('No se pudo iniciar el acceso. Comprueba la conexión e inténtalo de nuevo.');
        return false;
      });
  }

  async openAuth(mode: 'login' | 'register'): Promise<void> {
    const loaded = await this.legacyEntry;
    if (!loaded || !globalThis.__GESTOURANT_OPEN_AUTH__) {
      this.legacyLoadError.set('No se pudo iniciar el acceso. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }

    try {
      await globalThis.__GESTOURANT_OPEN_AUTH__(mode);
      this.showAngularHome.set(false);
    } catch (error) {
      console.error('No se pudo abrir el flujo de acceso de Gestourant.', error);
      this.legacyLoadError.set('No se pudo abrir el acceso. Inténtalo de nuevo.');
    }
  }

  private shouldShowAngularHome(): boolean {
    const oauthParameters = new URLSearchParams(window.location.hash.slice(1));
    const hasAuthReturn = oauthParameters.has('oauth_code')
      || oauthParameters.has('oauth_error')
      || oauthParameters.has('oauth_registration');
    const isGuestOrder = new URLSearchParams(window.location.search).has('mesa');
    return !sessionStorage.getItem('gestourant_session') && !hasAuthReturn && !isGuestOrder;
  }
}
