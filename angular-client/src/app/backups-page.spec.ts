import { TestBed } from '@angular/core/testing';
import { BackupsPage } from './backups-page';

describe('BackupsPage', () => {
  const session: GestourantSession = {
    token: 'session-token',
    username: 'admin',
    email: 'admin@example.com',
    role: 'ADMINISTRADOR',
  };
  const backup: GestourantBackup = {
    id: 'backup-1',
    fileName: 'gestourant-2026.sql.gz',
    createdAt: '2026-10-15T10:00:00Z',
    sizeBytes: 1536,
  };

  afterEach(() => {
    globalThis.__GESTOURANT_BACKUPS__ = undefined;
    vi.restoreAllMocks();
  });

  async function createPage(role = session.role) {
    await TestBed.configureTestingModule({ imports: [BackupsPage] }).compileComponents();
    const fixture = TestBed.createComponent(BackupsPage);
    fixture.componentRef.setInput('session', { ...session, role });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads backup history and creates backups without removing previous copies', async () => {
    const list = vi.fn(async () => [backup]);
    const create = vi.fn(async () => ({ ...backup, id: 'backup-2', fileName: 'new.sql.gz' }));
    globalThis.__GESTOURANT_BACKUPS__ = {
      list,
      create,
      download: vi.fn(),
      restore: vi.fn(),
    };
    const fixture = await createPage();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('gestourant-2026.sql.gz');
    await fixture.componentInstance.create();
    expect(create).toHaveBeenCalledWith(session);
    expect(list).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.message()).toContain('new.sql.gz');
    fixture.destroy();
  });

  it('downloads a selected backup and requires explicit confirmation before restore', async () => {
    const download = vi.fn(async () => undefined);
    const restore = vi.fn(async () => ({ safetyBackupFileName: 'safety-copy.sql.gz' }));
    globalThis.__GESTOURANT_BACKUPS__ = {
      list: vi.fn(async () => [backup]),
      create: vi.fn(),
      download,
      restore,
    };
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'prompt').mockReturnValue('RESTAURAR');
    const fixture = await createPage();
    await fixture.componentInstance.download(backup);
    await fixture.componentInstance.restore(backup);
    expect(download).toHaveBeenCalledWith(session, backup.id);
    expect(restore).toHaveBeenCalledWith(session, backup.id);
    expect(fixture.componentInstance.message()).toContain('safety-copy.sql.gz');
    fixture.destroy();
  });

  it('does not restore unless the administrator types the required confirmation', async () => {
    const restore = vi.fn();
    globalThis.__GESTOURANT_BACKUPS__ = {
      list: vi.fn(async () => [backup]),
      create: vi.fn(),
      download: vi.fn(),
      restore,
    };
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'prompt').mockReturnValue('no');
    const fixture = await createPage();
    await fixture.componentInstance.restore(backup);
    expect(restore).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('blocks non-administrators and reports storage errors', async () => {
    const list = vi.fn(async () => { throw new Error('S3 no disponible'); });
    globalThis.__GESTOURANT_BACKUPS__ = { list, create: vi.fn(), download: vi.fn(), restore: vi.fn() };
    const fixture = await createPage('EMPLEADO');
    expect(list).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('Solo el administrador');
    fixture.destroy();
  });
});
