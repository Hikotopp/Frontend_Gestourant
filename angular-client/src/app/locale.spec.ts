import {
  formatLocalizedDate,
  formatLocalizedNumber,
  TranslatePipe,
  activeLocale,
  localeOptions,
  setLocale,
  translate,
} from './locale';

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

  it('localizes the document title and description', async () => {
    const description = document.createElement('meta');
    description.name = 'description';
    document.head.append(description);
    try {
      await setLocale('fr');
      expect(document.title).toBe('Gestourant | Les services de votre restaurant au même endroit');
      expect(description.content).toBe('Gérez les tables, les commandes et le menu de votre restaurant avec Gestourant. Découvrez la démo interactive.');
    } finally {
      description.remove();
    }
  });

  it('interpolates translated parameters and preserves unknown messages', async () => {
    await setLocale('en');
    expect(translate('{count} productos disponibles', { count: 4 })).toBe('4 products available');
    expect(translate('Error desconocido del servidor.')).toBe('Error desconocido del servidor.');
  });

  it('translates known backend messages that include a product name', async () => {
    await setLocale('en');
    expect(translate('Inventario insuficiente para Limonada')).toBe('There is not enough stock for Lemonade.');
    expect(translate('Pollo a la plancha no está disponible en la cantidad solicitada'))
      .toBe('Grilled chicken breast is not available in the requested quantity.');
    await setLocale('fr');
    expect(translate('Pollo no está disponible en la cantidad solicitada'))
      .toBe('Pollo n’est pas disponible dans la quantité demandée.');
  });

  it('formats numbers and dates using the selected language', async () => {
    await setLocale('de');
    expect(formatLocalizedNumber(1234567)).toBe('1.234.567');
    expect(formatLocalizedDate('2026-10-15T10:00:00Z', 'medium', 'UTC'))
      .toBe(new Intl.DateTimeFormat('de', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date('2026-10-15T10:00:00Z')));
    await setLocale('en');
    expect(formatLocalizedNumber(1234567)).toBe('1,234,567');
  });
});
