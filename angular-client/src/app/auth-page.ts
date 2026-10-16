import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguagePicker } from './language-picker';
import { TranslatePipe, translate } from './locale';

type AuthMode = 'home' | 'login' | 'register' | 'oauth-register';

@Component({
  selector: 'app-auth-page',
  imports: [CommonModule, FormsModule, LanguagePicker, TranslatePipe],
  templateUrl: './auth-page.html',
})
export class AuthPage implements AfterViewChecked {
  @Input() mode: AuthMode = 'login';
  @Input() notice = '';
  @Input() oauthCode = '';
  @Input() config: GestourantAuthConfig = {
    captchaEnabled: false,
    captchaSiteKey: '',
    googleEnabled: false,
    microsoftEnabled: false,
  };
  @Output() modeChanged = new EventEmitter<'home' | 'login' | 'register'>();
  @Output() sessionReady = new EventEmitter<void>();
  @ViewChild('captchaContainer') captchaContainer?: ElementRef<HTMLElement>;

  readonly error = signal('');
  readonly pending = signal(false);
  readonly passwordVisible = signal(false);
  readonly selectedTheme = signal(localStorage.getItem('gestourant_theme') || 'light');
  identifier = '';
  password = '';
  username = '';
  email = '';
  website = '';
  captchaToken = '';
  privacyConsent = false;
  ingredient = '';

  private captchaWidgetId = '';
  private captchaWidgetContainer?: HTMLElement;
  private captchaScriptLoading = false;

  get apiRoot(): string {
    return (globalThis.__GESTOURANT_CONFIG__?.apiBase || window.location.origin).replace(/\/+$/, '');
  }

  ngAfterViewChecked(): void {
    const container = this.captchaContainer?.nativeElement;
    if (this.config.captchaEnabled && this.config.captchaSiteKey && container !== this.captchaWidgetContainer) {
      if (this.captchaWidgetId && globalThis.turnstile?.remove) {
        globalThis.turnstile.remove(this.captchaWidgetId);
      }
      this.captchaWidgetId = '';
      this.captchaWidgetContainer = undefined;
      this.loadCaptcha();
    }
  }

  backToHome(): void {
    this.modeChanged.emit('home');
  }

  openMode(mode: 'login' | 'register'): void {
    this.error.set('');
    this.modeChanged.emit(mode);
  }

  togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  applyTheme(theme: string): void {
    if (!['light', 'dark', 'bistro'].includes(theme)) return;
    this.selectedTheme.set(theme);
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('gestourant_theme', theme);
  }

  async submitLogin(form: HTMLFormElement): Promise<void> {
    if (!this.validate(form)) return;
    if (this.config.captchaEnabled && !this.captchaToken) {
      this.error.set('Completa la verificación de seguridad.');
      return;
    }
    const auth = globalThis.__GESTOURANT_AUTH__;
    if (!auth) {
      this.error.set('No se pudo conectar con el servidor. Confirma que el backend esté activo.');
      return;
    }
    await this.submit(async () => {
      const session = await auth.login({
        identifier: this.identifier.trim(),
        password: this.password,
        website: this.website,
        captchaToken: this.captchaToken,
      });
      this.completeAuthentication(session);
    }, 'login');
  }

  async submitRegistration(form: HTMLFormElement): Promise<void> {
    if (!this.validate(form)) return;
    if (!/\d/.test(this.password)) {
      this.error.set('La contraseña debe incluir al menos un número.');
      return;
    }
    if (this.config.captchaEnabled && !this.captchaToken) {
      this.error.set('Completa la verificación de seguridad.');
      return;
    }
    const auth = globalThis.__GESTOURANT_AUTH__;
    if (!auth) {
      this.error.set('No se pudo conectar con el servidor. Confirma que el backend esté activo.');
      return;
    }
    await this.submit(async () => {
      const session = await auth.register({
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.password,
        website: this.website,
        captchaToken: this.captchaToken,
        privacyConsent: this.privacyConsent,
      });
      this.completeAuthentication(session);
    }, 'register');
  }

  async submitOAuthRegistration(form: HTMLFormElement): Promise<void> {
    if (!this.validate(form)) return;
    const auth = globalThis.__GESTOURANT_AUTH__;
    if (!auth) {
      this.error.set('No se pudo conectar con el servidor. Confirma que el backend esté activo.');
      return;
    }
    await this.submit(async () => {
      const session = await auth.registerOAuthAccount({
        code: this.oauthCode,
        privacyConsent: this.privacyConsent,
      });
      this.completeAuthentication(session);
    }, 'oauth-register');
  }

  private completeAuthentication(session: GestourantSession): void {
    if (!globalThis.__GESTOURANT_COMPLETE_AUTH__) {
      throw new Error('No está disponible el espacio de trabajo de Gestourant.');
    }
    globalThis.__GESTOURANT_COMPLETE_AUTH__(session);
    this.sessionReady.emit();
  }

  private async submit(action: () => Promise<void>, formName: 'login' | 'register' | 'oauth-register'): Promise<void> {
    this.error.set('');
    this.pending.set(true);
    try {
      await action();
    } catch (error) {
      this.error.set(this.messageForError(error, formName));
      if (formName !== 'oauth-register') this.resetCaptcha();
    } finally {
      this.pending.set(false);
    }
  }

  private validate(form: HTMLFormElement): boolean {
    const invalid = form.querySelector<HTMLElement>(':invalid');
    if (!invalid) {
      this.error.set('');
      return true;
    }
    if (invalid instanceof HTMLInputElement) {
      const labelElement = invalid.closest('label');
      const labelText = labelElement?.innerText ?? labelElement?.textContent ?? '';
      const label = labelText.split('\n')[0].trim() || translate('este campo');
      const validity = invalid.validity;
      if (validity.valueMissing && invalid.type === 'checkbox') {
        this.error.set('Debes autorizar el tratamiento de tus datos para continuar.');
      } else if (validity.valueMissing) {
        this.error.set(translate('Completa el campo «{label}».', { label }));
      } else if (validity.typeMismatch && invalid.type === 'email') {
        this.error.set('Escribe un correo electrónico válido.');
      } else if (validity.tooShort) {
        this.error.set(translate('Este campo debe tener al menos {count} caracteres.', { count: invalid.minLength }));
      } else {
        this.error.set(translate('Revisa el campo «{label}».', { label }));
      }
      invalid.focus();
      return false;
    }
    this.error.set('Revisa los datos ingresados.');
    return false;
  }

  private messageForError(error: unknown, formName: 'login' | 'register' | 'oauth-register'): string {
    if (error instanceof TypeError) {
      return 'No se pudo conectar con el servidor. Confirma que el backend esté activo.';
    }
    if (formName === 'oauth-register' && error && typeof error === 'object') {
      const status = 'status' in error ? error.status : undefined;
      if (status === 401) return 'El paso de registro expiró o ya se usó. Vuelve a iniciar con tu cuenta de Google o Microsoft.';
      if (status === 409) return 'Ya existe una cuenta de Gestourant con ese correo. Inicia sesión con ella; no la vinculamos automáticamente.';
    }
    return error instanceof Error ? error.message : 'No fue posible completar la operación.';
  }

  private loadCaptcha(): void {
    const container = this.captchaContainer?.nativeElement;
    if (!container || container.dataset['widgetId']) return;
    if (globalThis.turnstile) {
      this.renderCaptcha(container);
      return;
    }
    if (this.captchaScriptLoading) return;
    this.captchaScriptLoading = true;
    const script = document.querySelector<HTMLScriptElement>('script[data-turnstile]') ?? document.createElement('script');
    if (!script.dataset['turnstile']) {
      script.dataset['turnstile'] = 'true';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => {
      this.captchaScriptLoading = false;
      if (globalThis.turnstile && this.captchaContainer) this.renderCaptcha(this.captchaContainer.nativeElement);
    }, { once: true });
    script.addEventListener('error', () => {
      this.captchaScriptLoading = false;
      this.error.set('No se pudo cargar la verificación de seguridad. Recarga la página para intentarlo de nuevo.');
    }, { once: true });
  }

  private renderCaptcha(container: HTMLElement): void {
    if (!globalThis.turnstile || container.dataset['widgetId']) return;
    this.captchaWidgetId = globalThis.turnstile.render(container, {
      sitekey: this.config.captchaSiteKey,
      callback: (token: string) => this.captchaToken = token,
      'expired-callback': () => this.captchaToken = '',
      'error-callback': () => this.error.set('No se pudo cargar la verificación. Recarga la página para intentarlo de nuevo.'),
    });
    this.captchaWidgetContainer = container;
    container.dataset['widgetId'] = this.captchaWidgetId;
  }

  private resetCaptcha(): void {
    this.captchaToken = '';
    if (this.captchaWidgetId && globalThis.turnstile) {
      globalThis.turnstile.reset(this.captchaWidgetId);
    }
  }
}
