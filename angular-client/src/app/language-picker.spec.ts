import { TestBed } from '@angular/core/testing';
import { LanguagePicker } from './language-picker';
import { activeLocale, setLocale } from './locale';

describe('LanguagePicker', () => {
  afterEach(async () => await setLocale('es-419'));

  it('exposes all six language choices and applies the selected locale', async () => {
    await TestBed.configureTestingModule({ imports: [LanguagePicker] }).compileComponents();
    const fixture = TestBed.createComponent(LanguagePicker);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('English');
    expect(element.textContent).toContain('Français');
    expect(element.textContent).toContain('Deutsch');
    expect(element.textContent).toContain('Español (España)');
    expect(element.textContent).toContain('Español (Latinoamérica)');
    expect(element.textContent).toContain('中文（普通话）');
    expect(element.querySelector('.language-code')?.textContent).toBe('ES');
    expect(element.querySelector('summary svg')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')?.click();
    expect(activeLocale()).toBe('en');
    fixture.detectChanges();
    expect(element.querySelector('.language-code')?.textContent).toBe('EN');
    fixture.destroy();
  });
});
