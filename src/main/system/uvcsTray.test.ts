import { describe, expect, it, vi } from 'vitest';
import { readTrayRuns, TRAY_IMAGE_NAME, trayIsListed } from './uvcsTray';

describe('trayIsListed', () => {
  it('finds the tray in the CSV line tasklist prints for it', () => {
    expect(trayIsListed('"unityvcstray.exe","40648","Console","4","220,852 K"\r\n')).toBe(true);
  });

  it('matches its image name whatever the case', () => {
    expect(trayIsListed('"UnityVCSTray.EXE","40648","Console","4","220,852 K"\r\n')).toBe(true);
  });

  it('is false for the localized line tasklist prints when nothing matched', () => {
    expect(trayIsListed('INFO: No tasks are running which match the specified criteria.\r\n')).toBe(false);
    expect(trayIsListed('INFORMACIÓN: no hay tareas ejecutándose que coincidan con los criterios especificados.\r\n')).toBe(false);
    expect(trayIsListed('')).toBe(false);
  });

  it('is false for another process whose name starts the same', () => {
    expect(trayIsListed('"unityvcstray.exe.old.exe","1","Console","4","1 K"\r\n')).toBe(false);
  });
});

describe('readTrayRuns', () => {
  it('asks tasklist for the tray on Windows', async () => {
    const run = vi.fn(async () => `"${TRAY_IMAGE_NAME}","1","Console","4","1 K"\r\n`);

    expect(await readTrayRuns('win32', run)).toBe(true);
    expect(run).toHaveBeenCalledWith(['/FI', 'IMAGENAME eq unityvcstray.exe', '/FO', 'CSV', '/NH']);
  });

  it('lists nothing on macOS and Linux, where dynamic workspaces have no file system', async () => {
    const run = vi.fn(async () => '');

    expect(await readTrayRuns('darwin', run)).toBe(false);
    expect(await readTrayRuns('linux', run)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('is false when tasklist fails or takes too long', async () => {
    expect(await readTrayRuns('win32', async () => Promise.reject(new Error('timed out')))).toBe(false);
  });
});
