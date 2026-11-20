import { TestBed } from '@angular/core/testing';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
  };
  const profile: GestourantUserProfile = {
    id: 7,
    username: 'maria',
    email: 'maria@example.com',
    role: 'EMPLEADO',
    photoAvailable: false,
  };

  afterEach(() => {
    globalThis.__GESTOURANT_PROFILE__ = undefined;
    vi.restoreAllMocks();
  });

  async function createPage() {
    await TestBed.configureTestingModule({ imports: [ProfilePage] }).compileComponents();
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.componentRef.setInput('session', session);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads credentials and returns the refreshed session after a verified update', async () => {
    const updatedSession = { ...session, userId: 7, username: 'maria.g', email: 'maria.g@example.com', token: 'renewed-token' };
    const update = vi.fn(async () => updatedSession);
    globalThis.__GESTOURANT_PROFILE__ = {
      get: vi.fn(async () => profile),
      update,
      getPhoto: vi.fn(async () => new Blob()),
      uploadPhoto: vi.fn(async () => profile),
      deletePhoto: vi.fn(),
    };
    const fixture = await createPage();
    const emitted: GestourantSession[] = [];
    fixture.componentInstance.sessionUpdated.subscribe((value) => emitted.push(value));
    fixture.componentInstance.username = 'maria.g';
    fixture.componentInstance.email = 'maria.g@example.com';
    fixture.componentInstance.currentPassword = 'CurrentPassword1!';
    const form = document.createElement('form');
    vi.spyOn(form, 'reportValidity').mockReturnValue(true);

    await fixture.componentInstance.update(form);

    expect(update).toHaveBeenCalledWith(session, {
      username: 'maria.g',
      email: 'maria.g@example.com',
      currentPassword: 'CurrentPassword1!',
      newPassword: null,
    });
    expect(emitted).toEqual([updatedSession]);
    expect(fixture.componentInstance.message()).toContain('credenciales se actualizaron');
    fixture.destroy();
  });
});
