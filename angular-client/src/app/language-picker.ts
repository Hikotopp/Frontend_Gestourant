import { Component } from '@angular/core';
import { activeLocale, localeOptions, setLocale, translationError, TranslatePipe } from './locale';

@Component({
  selector: 'app-language-picker',
  imports: [TranslatePipe],
  template: `
    <details class="language-switcher">
      <summary aria-label="Idioma">{{ 'Idioma' | tr }} · {{ activeLocale() }}</summary>
      <div role="group" [attr.aria-label]="'Idioma' | tr">
        @for (option of localeOptions; track option.id) {
          <button type="button" [attr.aria-pressed]="activeLocale() === option.id" (click)="select(option.id)">{{ option.label }}</button>
        }
      </div>
      @if (translationError()) {
        <span role="alert">No se pudo cargar el idioma seleccionado; se muestran los textos originales.</span>
      }
    </details>
  `,
})
export class LanguagePicker {
  readonly activeLocale = activeLocale;
  readonly translationError = translationError;
  readonly localeOptions = localeOptions;

  select(locale: Parameters<typeof setLocale>[0]): void {
    setLocale(locale);
  }
}
