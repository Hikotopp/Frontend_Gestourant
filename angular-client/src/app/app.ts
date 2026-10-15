import { AfterViewInit, Component, signal } from '@angular/core';
import { PublicHome } from './public-home';
import { AuthPage } from './auth-page';
import { DashboardPage } from './dashboard-page';

@Component({
  selector: 'app-root',
  imports: [PublicHome, AuthPage, DashboardPage],
  styleUrl: './app.css',
  template: `
    @if (showAngularHome() && authMode() === 'home') {
      <app-public-home [notice]="homeNotice() || legacyLoadError()" (authRequested)="openAuth($event)" />
    }
    @if (showAngularHome() && authMode() !== 'home') {
      @if (authMode() === 'dashboard' && dashboardSession()) {
        <app-dashboard-page
          [session]="dashboardSession()"
          [notice]="legacyLoadError()"
          (viewRequested)="openLegacyView($event)"
          (logoutRequested)="logout()"
        />
      } @else if (authMode() !== 'dashboard') {
        <app-auth-page
          [mode]="authPageMode()"
          [notice]="homeNotice() || legacyLoadError()"
          [config]="authConfig()"
          [oauthCode]="oauthRegistrationCode"
          (modeChanged)="openAuth($event)"
          (sessionReady)="showAngularDashboard()"
        />
      }
    }
    @if (cookieNoticeVisible()) {
      <aside class="cookie-notice" aria-label="Preferencias de cookies">
        <div>
          <p class="eyebrow">TU PRIVACIDAD</p>
          <strong>Cookies y almacenamiento</strong>
          <p>Usamos almacenamiento esencial para mantener tu sesión y preferencias, y protección anti-bots cuando está habilitada. Consulta nuestra <a href="/politica-tratamiento.html" target="_blank" rel="noopener">política de datos y cookies</a>.</p>
        </div>
        <div class="cookie-actions">
          <button type="button" class="outline" (click)="chooseCookies('necessary')">Solo necesarias</button>
          <button type="button" class="primary" (click)="chooseCookies('all')">Aceptar</button>
        </div>
      </aside>
    }
    <div id="app" [hidden]="showAngularHome()"></div>
  `,
})
export class App implements AfterViewInit {
  showAngularHome = signal(this.shouldShowAngularHome());
  authMode = signal<'home' | 'login' | 'register' | 'oauth-register' | 'dashboard'>(this.initialAuthMode());
  dashboardSession = signal<GestourantSession | null>(null);
  cookieNoticeVisible = signal(!localStorage.getItem('gestourant_cookie_consent'));
  authConfig = signal<GestourantAuthConfig>({
    captchaEnabled: false,
    captchaSiteKey: '',
    googleEnabled: false,
    microsoftEnabled: false,
  });
  homeNotice = signal('');
  legacyLoadError = signal('');
  private legacyEntry: Promise<boolean> = Promise.resolve(false);
  readonly oauthRegistrationCode = new URLSearchParams(window.location.hash.slice(1)).get('oauth_registration') ?? '';

  async ngAfterViewInit(): Promise<void> {
    const hostname = window.location.hostname;
    document.documentElement.dataset['theme'] = localStorage.getItem('gestourant_theme') || 'light';
    globalThis.__GESTOURANT_CONFIG__ = {
      development: hostname === 'localhost' || hostname === '127.0.0.1',
      production: hostname !== 'localhost' && hostname !== '127.0.0.1',
      apiBase: '',
    };
    globalThis.__GESTOURANT_AUTH_ACTIVE__ = true;
    globalThis.__GESTOURANT_COOKIE_NOTICE_ACTIVE__ = true;
    globalThis.__GESTOURANT_NOTICE_CHANGED__ = (notice: string) => {
      this.homeNotice.set(notice);
    };
    globalThis.__GESTOURANT_SESSION_READY__ = (session: GestourantSession) => this.showAngularDashboard(session);
    globalThis.__GESTOURANT_RETURN_TO_ANGULAR_DASHBOARD__ = (session: GestourantSession) =>
      this.showAngularDashboard(session);
    globalThis.__GESTOURANT_PUBLIC_HOME__ = (notice: string) => {
      this.homeNotice.set(notice);
      this.authMode.set('home');
      this.showAngularHome.set(true);
    };
    globalThis.__GESTOURANT_AUTH_CONFIG_CHANGED__ = (config: GestourantAuthConfig) => {
      this.authConfig.set(config);
    };
    this.legacyEntry = import('../../../src/main.js')
      .then(() => true)
      .catch((error: unknown) => {
        console.error('No se pudo iniciar el cliente existente de Gestourant.', error);
        this.legacyLoadError.set('No se pudo iniciar el acceso. Comprueba la conexión e inténtalo de nuevo.');
        return false;
      });
  }

  async openAuth(mode: 'home' | 'login' | 'register'): Promise<void> {
    if (mode === 'home') {
      this.authMode.set('home');
      this.homeNotice.set('');
      this.legacyLoadError.set('');
      return;
    }
    const loaded = await this.legacyEntry;
    if (!loaded || !globalThis.__GESTOURANT_AUTH__) {
      this.legacyLoadError.set('No se pudo iniciar el acceso. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }

    try {
      await globalThis.__GESTOURANT_AUTH_INITIALIZED__;
      this.authMode.set(mode);
      this.homeNotice.set('');
      this.legacyLoadError.set('');
    } catch (error) {
      console.error('No se pudo preparar el flujo de acceso de Gestourant.', error);
      this.legacyLoadError.set('No se pudo preparar el acceso. Inténtalo de nuevo.');
    }
  }

  authPageMode(): 'login' | 'register' | 'oauth-register' {
    const mode = this.authMode();
    return mode === 'register' || mode === 'oauth-register' ? mode : 'login';
  }

  showAngularDashboard(session?: GestourantSession): void {
    const activeSession = session ?? this.dashboardSession() ?? this.readStoredSession();
    if (!activeSession) {
      this.legacyLoadError.set('No se pudo recuperar la sesión activa. Inicia sesión nuevamente.');
      this.authMode.set('login');
      this.showAngularHome.set(true);
      return;
    }
    this.dashboardSession.set(activeSession);
    this.authMode.set('dashboard');
    this.homeNotice.set('');
    this.legacyLoadError.set('');
    this.showAngularHome.set(true);
  }

  async openLegacyView(view: GestourantDashboardView): Promise<void> {
    const openView = globalThis.__GESTOURANT_OPEN_LEGACY_VIEW__;
    if (!openView) {
      this.legacyLoadError.set('No se pudo abrir esta sección. Recarga la página e inténtalo de nuevo.');
      return;
    }
    try {
      const navigation = openView(view);
      this.showAngularHome.set(false);
      await navigation;
    } catch (error) {
      console.error('No se pudo abrir la sección heredada de Gestourant.', error);
      this.legacyLoadError.set('No se pudo abrir esta sección. Inténtalo de nuevo.');
      this.showAngularHome.set(true);
    }
  }

  async logout(): Promise<void> {
    const loaded = await this.legacyEntry;
    if (!loaded || !globalThis.__GESTOURANT_LOGOUT__) {
      this.legacyLoadError.set('No se pudo cerrar la sesión. Recarga la página e inténtalo de nuevo.');
      return;
    }
    try {
      await globalThis.__GESTOURANT_LOGOUT__();
    } catch (error) {
      console.error('No se pudo cerrar la sesión de Gestourant.', error);
      this.legacyLoadError.set('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    }
  }

  private readStoredSession(): GestourantSession | null {
    const stored = sessionStorage.getItem('gestourant_session');
    return stored ? JSON.parse(stored) as GestourantSession : null;
  }

  chooseCookies(choice: 'necessary' | 'all'): void {
    localStorage.setItem('gestourant_cookie_consent', choice);
    this.cookieNoticeVisible.set(false);
  }

  private shouldShowAngularHome(): boolean {
    const isGuestOrder = new URLSearchParams(window.location.search).has('mesa');
    return !isGuestOrder;
  }

  private initialAuthMode(): 'home' | 'login' | 'register' | 'oauth-register' | 'dashboard' {
    if (sessionStorage.getItem('gestourant_session')) return 'dashboard';
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    if (parameters.has('oauth_registration')) return 'oauth-register';
    if (parameters.has('oauth_code') || parameters.has('oauth_error')) return 'login';
    return 'home';
  }
}
