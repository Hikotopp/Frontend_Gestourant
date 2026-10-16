import { Component } from '@angular/core';
import { activeLocale, localeOptions, setLocale, translationError, TranslatePipe } from './locale';

@Component({
  selector: 'app-language-picker',
  imports: [TranslatePipe],
  template: `
    <details class="language-switcher">
      <summary [attr.aria-label]="'Idioma' | tr">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path>
        </svg>
        <span>{{ 'Idioma' | tr }}</span>
        <span class="language-code">{{ localeCode() }}</span>
        <svg class="language-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m7 10 5 5 5-5"></path>
        </svg>
      </summary>
      <div class="language-menu" role="group" [attr.aria-label]="'Idioma' | tr">
        @for (option of localeOptions; track option.id) {
          <button type="button" [attr.aria-pressed]="activeLocale() === option.id" (click)="select(option.id)">
            <span>{{ option.label }}</span>
            @if (activeLocale() === option.id) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m5 12 4 4L19 6"></path>
              </svg>
            }
          </button>
        }
      </div>
      @if (translationError()) {
        <span role="alert">{{ 'No se pudo cargar el idioma seleccionado; se muestran los textos originales.' | tr }}</span>
      }
    </details>
  `,
  styles: [`
    :host {
      position: relative;
      z-index: 20;
      display: inline-block;
      color: inherit;
      font-family: inherit;
    }

    .language-switcher {
      position: relative;
    }

    summary {
      display: inline-flex;
      min-height: 40px;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, currentColor 5%, transparent);
      color: inherit;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      list-style: none;
      transition: background .18s ease, border-color .18s ease, transform .18s ease;
      user-select: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary::marker {
      content: '';
    }

    summary:hover,
    .language-switcher[open] > summary {
      border-color: color-mix(in srgb, currentColor 28%, transparent);
      background: color-mix(in srgb, currentColor 10%, transparent);
    }

    summary:focus-visible,
    .language-menu button:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent) 70%, transparent);
      outline-offset: 2px;
    }

    summary > svg:first-child {
      width: 17px;
      height: 17px;
      flex: none;
      color: var(--accent);
    }

    .language-code {
      flex: none;
      padding: 4px 6px;
      border-radius: 7px;
      background: color-mix(in srgb, var(--brand) 14%, var(--surface));
      color: var(--brand);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
      white-space: nowrap;
    }

    .language-chevron {
      width: 14px;
      height: 14px;
      opacity: .68;
      transition: transform .18s ease;
    }

    .language-switcher[open] .language-chevron {
      transform: rotate(180deg);
    }

    .language-menu {
      position: absolute;
      z-index: 30;
      inset-block-start: calc(100% + 9px);
      inset-inline-start: 0;
      display: grid;
      width: min(258px, calc(100vw - 32px));
      gap: 3px;
      padding: 7px;
      border: 1px solid var(--line);
      border-radius: 15px;
      background: var(--surface);
      box-shadow: 0 16px 38px color-mix(in srgb, var(--ink) 18%, transparent);
      color: var(--ink);
    }

    .language-menu button {
      display: flex;
      min-height: 39px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      text-align: start;
      transition: background .16s ease, color .16s ease;
    }

    .language-menu button:hover,
    .language-menu button[aria-pressed='true'] {
      background: color-mix(in srgb, var(--brand) 10%, var(--surface));
      color: var(--brand);
    }

    .language-menu button[aria-pressed='true'] {
      font-weight: 700;
    }

    .language-menu button svg {
      width: 16px;
      height: 16px;
      flex: none;
    }

    [role='alert'] {
      display: block;
      max-width: 258px;
      margin-top: 8px;
      color: var(--accent);
      font-size: 11px;
    }

    @media (max-width: 420px) {
      summary {
        gap: 6px;
        padding-inline: 8px;
      }

      summary > span:first-of-type {
        display: none;
      }
    }
  `],
})
export class LanguagePicker {
  readonly activeLocale = activeLocale;
  readonly translationError = translationError;
  readonly localeOptions = localeOptions;

  localeCode(): string {
    return this.localeOptions.find((option) => option.id === this.activeLocale())?.shortLabel
      ?? this.activeLocale().toUpperCase();
  }

  select(locale: Parameters<typeof setLocale>[0]): void {
    setLocale(locale);
  }
}
