import { TestBed } from '@angular/core/testing';
import { PublicHome } from './public-home';

describe('PublicHome', () => {
  async function createHome() {
    await TestBed.configureTestingModule({ imports: [PublicHome] }).compileComponents();
    const fixture = TestBed.createComponent(PublicHome);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the public landing sections and demo tables', async () => {
    const fixture = await createHome();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Un restaurante que fluye');
    expect(element.querySelectorAll('.public-feature-card')).toHaveLength(3);
    expect(element.querySelectorAll('.demo-table')).toHaveLength(3);
    expect(element.querySelector('.demo-total')?.textContent).toContain('$ 35.000 COP');
  });

  it('keeps the interactive sample account working', async () => {
    const fixture = await createHome();
    const element = fixture.nativeElement as HTMLElement;

    const freeTable = [...element.querySelectorAll<HTMLButtonElement>('.demo-table')]
      .find((button) => button.textContent?.includes('Mesa 7'));
    freeTable?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.demo-open-button')?.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.demo-add-area button')?.click();
    fixture.detectChanges();

    expect(element.querySelector('.demo-total')?.textContent).toContain('$ 7.000 COP');
    expect(element.querySelector('.demo-order-lines')?.textContent).toContain('Limonada natural');
  });

  it('emits login and registration requests from the landing page', async () => {
    const fixture = await createHome();
    const requested: string[] = [];
    fixture.componentInstance.authRequested.subscribe((mode) => requested.push(mode));
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.public-login')?.click();
    element.querySelector<HTMLButtonElement>('.public-nav-actions .public-signup')?.click();

    expect(requested).toEqual(['login', 'register']);
  });
});
