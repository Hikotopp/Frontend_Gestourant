import { TestBed } from '@angular/core/testing';
import { UsersPage } from './users-page';

describe('UsersPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'admin',
    email: 'admin@example.com',
    role: 'ADMINISTRADOR',
  };
  const employee: GestourantManagedUser = {
    id: 2,
    username: 'carlos',
    email: 'carlos@example.com',
    role: 'EMPLEADO',
    enabled: true,
    createdAt: '2026-10-15T10:00:00Z',
  };

  afterEach(() => {
    globalThis.__GESTOURANT_USERS__ = undefined;
    vi.restoreAllMocks();
  });

  async function createPage(role = session.role) {
    await TestBed.configureTestingModule({ imports: [UsersPage] }).compileComponents();
    const fixture = TestBed.createComponent(UsersPage);
    fixture.componentRef.setInput('session', { ...session, role });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lets an administrator create an account with the selected role', async () => {
    const create = vi.fn(async (_session: GestourantSession, user: { role: GestourantManagedUser['role'] }) => ({
      ...employee,
      username: 'supervisor',
      role: user.role,
    }));
    globalThis.__GESTOURANT_USERS__ = {
      list: vi.fn(async () => [employee]),
      create,
      update: vi.fn(),
    };
    const fixture = await createPage();
    fixture.componentInstance.username = 'supervisor';
    fixture.componentInstance.email = 'supervisor@example.com';
    fixture.componentInstance.password = 'ValidPassword1!';
    fixture.componentInstance.role = 'ADMINISTRADOR';
    const form = document.createElement('form');
    vi.spyOn(form, 'reportValidity').mockReturnValue(true);

    await fixture.componentInstance.create(form);

    expect(create).toHaveBeenCalledWith(fixture.componentInstance.session, {
      username: 'supervisor',
      email: 'supervisor@example.com',
      password: 'ValidPassword1!',
      role: 'ADMINISTRADOR',
    });
    expect(fixture.componentInstance.users()).toHaveLength(2);
    fixture.destroy();
  });

  it('does not request the team list for employees', async () => {
    const list = vi.fn(async () => [employee]);
    globalThis.__GESTOURANT_USERS__ = { list, create: vi.fn(), update: vi.fn() };

    const fixture = await createPage('EMPLEADO');

    expect(list).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('Solo el administrador');
    fixture.destroy();
  });
});
