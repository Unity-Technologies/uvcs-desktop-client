import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', async () => (await import('../window/testing/fakeElectron')).fakeElectron.module);

import { fakeElectron } from '../window/testing/fakeElectron';
import { runForCaller } from '../ipc/caller';
import type { ServiceContext } from './ServiceContext';
import { createWindowsService } from './windowsService';

beforeEach(() => fakeElectron.reset());

describe('pasteClipboard', () => {
  it('pastes into the window that asked, as Edit ▸ Paste does, and into no other', async () => {
    const asking = fakeElectron.newWindow();
    const other = fakeElectron.newWindow();
    const windows = createWindowsService({} as ServiceContext);
    await runForCaller(asking.webContents as never, () => windows.pasteClipboard());
    expect(asking.webContents.pastes).toBe(1);
    expect(other.webContents.pastes).toBe(0);
  });

  it('pastes the clipboard’s text alone when asked to match the style, as Edit ▸ Paste and Match Style does', async () => {
    const asking = fakeElectron.newWindow();
    const windows = createWindowsService({} as ServiceContext);
    await runForCaller(asking.webContents as never, () => windows.pasteClipboard({ plainText: true }));
    expect(asking.webContents.plainPastes).toBe(1);
    expect(asking.webContents.pastes).toBe(0);
  });

  it('pastes nowhere when asked from outside a window', async () => {
    const window = fakeElectron.newWindow();
    await expect(createWindowsService({} as ServiceContext).pasteClipboard()).rejects.toThrow('only be asked from a window');
    expect(window.webContents.pastes).toBe(0);
  });
});
