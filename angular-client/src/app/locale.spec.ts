import { TranslatePipe, activeLocale, localeOptions, setLocale } from './locale';

describe('Gestourant language selector', () => {
  afterEach(async () => {
    await setLocale('es-419');
  });

  it('provides all requested languages and translates dashboard navigation', async () => {
    expect(localeOptions.map((option) => option.id)).toEqual(['en', 'fr', 'de', 'es-ES', 'es-419', 'zh-CN']);
    const pipe = new TranslatePipe();
    await setLocale('fr');
    expect(pipe.transform('Resumen')).toBe('Vue d’ensemble');
    await setLocale('de');
    expect(pipe.transform('Mesas')).toBe('Tische');
    await setLocale('zh-CN');
    expect(pipe.transform('Pedidos')).toBe('订单');
    await setLocale('en');
    expect(pipe.transform('Inicia sesión')).toBe('Sign in');
    expect(pipe.transform('Nombre de usuario')).toBe('Username');
    await setLocale('fr');
    expect(pipe.transform('Crear cuenta con tu proveedor')).toBe('Créer un compte avec votre fournisseur');
  });

  it('persists the selected locale and updates the document language', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await setLocale('en');
    expect(activeLocale()).toBe('en');
    expect(setItem).toHaveBeenCalledWith('gestourant_locale', 'en');
    expect(document.documentElement.lang).toBe('en');
  });
});
