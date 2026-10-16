import { Pipe, PipeTransform, signal } from '@angular/core';
import { localeOptions } from '../../../src/shared/locale-options.js';
import type { GestourantLocale } from '../../../src/shared/locale-translations.js';

export { localeOptions };
export type { GestourantLocale };

function storedLocale(): GestourantLocale {
  const stored = localStorage.getItem('gestourant_locale');
  return localeOptions.some((option) => option.id === stored) ? stored as GestourantLocale : 'es-419';
}

export const activeLocale = signal<GestourantLocale>(storedLocale());

function formattingLocale(): string {
  return activeLocale() === 'es-419' ? 'es-CO' : activeLocale();
}

export function formatLocalizedNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(formattingLocale(), { maximumFractionDigits }).format(value);
}

export function formatLocalizedDate(
  value: string | number | Date,
  format: 'medium' | 'time' = 'medium',
  timeZone?: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = format === 'time'
    ? { timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }
    : { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) };
  return new Intl.DateTimeFormat(formattingLocale(), options).format(date);
}

const translations = signal<Record<string, Partial<Record<GestourantLocale, string>>>>({});
export const translationError = signal(false);

let translationLoading: Promise<void> | undefined;

function updateDocumentMetadata(): void {
  document.title = translate('Gestourant | Servicio de restaurante en un solo lugar');
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) {
    description.content = translate('Coordina mesas, pedidos y menú de tu restaurante con Gestourant. Explora la demo interactiva.');
  }
}

export function translate(key: string, params: Record<string, string | number> = {}): string {
  let translationKey = key;
  const translationParams: Record<string, string | number> = { ...params };
  const unavailableProduct = key.match(/^(.+) no está disponible en la cantidad solicitada$/);
  if (unavailableProduct) {
    translationKey = 'El producto {product} no está disponible en la cantidad solicitada';
    translationParams['product'] = translate(unavailableProduct[1]);
  }
  const insufficientInventory = key.match(/^Inventario insuficiente para (.+)$/);
  if (insufficientInventory) {
    translationKey = 'Inventario insuficiente para {product}';
    translationParams['product'] = translate(insufficientInventory[1]);
  }
  const template = translations()[translationKey]?.[activeLocale()] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in translationParams ? String(translationParams[name]) : placeholder,
  );
}

async function loadTranslations(): Promise<void> {
  translationLoading ??= import('./locale-translations')
    .then((module) => {
      translations.set(module.translations);
      updateDocumentMetadata();
    })
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
  window.dispatchEvent(new CustomEvent('gestourant:locale-change', { detail: locale }));
  if (locale !== 'es-419') await loadTranslations();
  updateDocumentMetadata();
}

@Pipe({ name: 'tr', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  transform(key: string, params: Record<string, string | number> = {}): string {
    return translate(key, params);
  }
}

@Pipe({ name: 'localizedNumber', standalone: true, pure: false })
export class LocalizedNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : formatLocalizedNumber(value);
  }
}

@Pipe({ name: 'localizedDate', standalone: true, pure: false })
export class LocalizedDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, format: 'medium' | 'time' = 'medium', timeZone?: string): string {
    return value === null || value === undefined ? '' : formatLocalizedDate(value, format, timeZone);
  }
}
