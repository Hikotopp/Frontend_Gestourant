import { localeOptions } from './locale-options.js';
import { translations } from './locale-translations.js';

export { localeOptions };

export function getLocale() {
  const selected = globalThis.localStorage?.getItem('gestourant_locale');
  return localeOptions.some(option => option.id === selected) ? selected : 'es-419';
}

export function translate(key, params = {}, locale = getLocale()) {
  const template = translations[key]?.[locale] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  );
}

export function translateBackendMessage(message, locale = getLocale()) {
  if (typeof message !== 'string') return message;
  const unavailableProduct = message.match(/^(.+) no está disponible en la cantidad solicitada$/);
  if (unavailableProduct) {
    return translate('El producto {product} no está disponible en la cantidad solicitada', {
      product: translate(unavailableProduct[1], {}, locale),
    }, locale);
  }
  const insufficientInventory = message.match(/^Inventario insuficiente para (.+)$/);
  if (insufficientInventory) {
    return translate('Inventario insuficiente para {product}', {
      product: translate(insufficientInventory[1], {}, locale),
    }, locale);
  }
  return translate(message, {}, locale);
}

export function setLocale(locale) {
  if (!localeOptions.some(option => option.id === locale)) {
    throw new RangeError(`Unsupported Gestourant locale: ${locale}`);
  }
  localStorage.setItem('gestourant_locale', locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent('gestourant:locale-change', { detail: locale }));
}

export function languagePicker() {
  const selected = getLocale();
  const selectedLabel = localeOptions.find(option => option.id === selected)?.shortLabel ?? selected.toUpperCase();
  return `<label class="locale-picker">
    <svg class="locale-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>
    <span class="locale-picker-label">${translate('Idioma')}</span>
    <span class="locale-picker-value" aria-hidden="true">${selectedLabel}</span>
    <svg class="locale-picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>
    <select data-gestourant-locale aria-label="${translate('Idioma')}">${localeOptions.map(option => `<option value="${option.id}" ${option.id === selected ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
  </label>`;
}

export function bindLanguagePicker(root = document) {
  root.querySelectorAll('[data-gestourant-locale]').forEach(select => {
    select.addEventListener('change', () => setLocale(select.value));
  });
}
