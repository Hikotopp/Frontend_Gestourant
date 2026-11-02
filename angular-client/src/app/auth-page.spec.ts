import { TestBed } from '@angular/core/testing';
import { AuthPage } from './auth-page';

describe('AuthPage', () => {
  async function createPage(mode: 'login' | 'register' | 'oauth-register' = 'login') {
    await TestBed.configureTestingModule({ imports: [AuthPage] }).compileComponents();
    const fixture = TestBed.createComponent(AuthPage);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture;
  }

  function setInput(element: HTMLElement, selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  afterEach(() => {
    globalThis.__GESTOURANT_AUTH__ = undefined;
    globalThis.__GESTOURANT_COMPLETE_AUTH__ = undefined;
    globalThis.turnstile = undefined;
    localStorage.removeItem('gestourant_theme');
  });

  it('renders login and emits the registration request', async () => {
    const fixture = await createPage();
    const element = fixture.nativeElement as HTMLElement;
    const requested: string[] = [];
    fixture.componentInstance.modeChanged.subscribe((mode) => requested.push(mode));

    expect(element.querySelector('h2')?.textContent).toContain('Inicia sesión');
    expect(element.querySelector('input[name="identifier"]')).toBeTruthy();

    element.querySelector<HTMLButtonElement>('.demo-note .text-button')?.click();
    expect(requested).toEqual(['register']);
  });

  it('requires explicit privacy consent before registration', async () => {
    const fixture = await createPage('register');
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    setInput(element, 'input[name="username"]', 'maria');
    setInput(element, 'input[name="email"]', 'maria@example.com');
    setInput(element, 'input[name="password"]', 'Restaurante1!');
    fixture.detectChanges();

    await component.submitRegistration(element.querySelector('form')!);
    fixture.detectChanges();

    expect(element.querySelector('.form-message')?.textContent).toContain(
      'Debes autorizar el tratamiento de tus datos',
    );
    expect(component.pending()).toBe(false);
  });

  it('passes consent to the registration service and completes authentication', async () => {
    const fixture = await createPage('register');
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const session = {
      token: 'session-token',
      username: 'maria',
      email: 'maria@example.com',
      role: 'USER',
    };
    const register = vi.fn(async () => session);
    const completeAuthentication = vi.fn();
    const sessionReady = vi.fn();

    globalThis.__GESTOURANT_AUTH__ = {
      getConfig: async () => ({
        captchaEnabled: false,
        captchaSiteKey: '',
        googleEnabled: false,
        microsoftEnabled: false,
      }),
      login: async () => session,
      register,
      registerOAuthAccount: async () => session,
    };
    globalThis.__GESTOURANT_COMPLETE_AUTH__ = completeAuthentication;
    setInput(element, 'input[name="username"]', 'maria');
    setInput(element, 'input[name="email"]', 'maria@example.com');
    setInput(element, 'input[name="password"]', 'Restaurante1!');
    const consent = element.querySelector<HTMLInputElement>('input[name="privacyConsent"]')!;
    consent.checked = true;
    consent.dispatchEvent(new Event('input', { bubbles: true }));
    consent.dispatchEvent(new Event('change', { bubbles: true }));
    component.sessionReady.subscribe(sessionReady);
    fixture.detectChanges();

    await component.submitRegistration(element.querySelector('form')!);

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'maria',
        email: 'maria@example.com',
        privacyConsent: true,
      }),
    );
    expect(completeAuthentication).toHaveBeenCalledWith(session);
    expect(sessionReady).toHaveBeenCalledOnce();
  });

  it('recreates the CAPTCHA widget when changing authentication forms', async () => {
    let widgetIndex = 0;
    const render = vi.fn((_container: HTMLElement) => `widget-${++widgetIndex}`);
    const remove = vi.fn();
    globalThis.turnstile = { render, reset: vi.fn(), remove };
    const fixture = await createPage();
    fixture.componentRef.setInput('config', {
      captchaEnabled: true,
      captchaSiteKey: 'site-key',
      googleEnabled: false,
      microsoftEnabled: false,
    });
    fixture.detectChanges();

    fixture.componentRef.setInput('mode', 'register');
    fixture.detectChanges();

    expect(render).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith('widget-1');
  });
});
