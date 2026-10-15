import { Pipe, PipeTransform, signal } from '@angular/core';

export type GestourantLocale = 'en' | 'fr' | 'de' | 'es-ES' | 'es-419' | 'zh-CN';

export const localeOptions: Array<{ id: GestourantLocale; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'es-ES', label: 'Español (España)' },
  { id: 'es-419', label: 'Español (Latinoamérica)' },
  { id: 'zh-CN', label: '中文（普通话）' },
];

function storedLocale(): GestourantLocale {
  const stored = localStorage.getItem('gestourant_locale');
  return localeOptions.some((option) => option.id === stored) ? stored as GestourantLocale : 'es-419';
}

export const activeLocale = signal<GestourantLocale>(storedLocale());

const translations = signal<Record<string, Partial<Record<GestourantLocale, string>>>>({});
export const translationError = signal(false);

let translationLoading: Promise<void> | undefined;

async function loadTranslations(): Promise<void> {
  translationLoading ??= import('./locale-translations')
    .then((module) => translations.set(module.translations))
    .catch((error: unknown) => {
      translationLoading = undefined;
      throw error;
    });
  try {
    await translationLoading;
  } catch (error) {
    translationError.set(true);
    console.error('No se pudieron cargar las traducciones.', error);
  }
}

if (activeLocale() !== 'es-419') void loadTranslations();

export async function setLocale(locale: GestourantLocale): Promise<void> {
  activeLocale.set(locale);
  translationError.set(false);
  localStorage.setItem('gestourant_locale', locale);
  document.documentElement.lang = locale;
  if (locale !== 'es-419') await loadTranslations();
}

@Pipe({ name: 'tr', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  transform(key: string): string {
    const locale = activeLocale();
    return translations()[key]?.[locale] ?? key;
  }
}
