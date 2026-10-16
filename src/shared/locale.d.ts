import type { GestourantLocale } from './locale-translations.js';

export declare const localeOptions: Array<{ id: GestourantLocale; label: string }>;
export declare function getLocale(): GestourantLocale;
export declare function translate(key: string, params?: Record<string, string | number>, locale?: GestourantLocale): string;
export declare function setLocale(locale: GestourantLocale): void;
export declare function languagePicker(): string;
export declare function bindLanguagePicker(root?: ParentNode): void;
