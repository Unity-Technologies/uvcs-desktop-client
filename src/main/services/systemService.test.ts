import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { net, shell } from 'electron';
import type { AppSettings } from '@shared/domain/settings';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import type { SettingsStore } from '../settings/SettingsStore';
import { createSystemService } from './systemService';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({
  app: {},
  dialog: {},
  net: { fetch: vi.fn() },
  shell: { trashItem: vi.fn(async () => undefined), openPath: vi.fn(async () => '') },
}));
// It needs the app's windows, which only a running app has.
vi.mock('../window/incomingNotification', () => ({ showIncomingNotification: vi.fn() }));

function system(answers: Record<string, CmAnswer>, settings: Partial<AppSettings> = {}) {
  const fake = fakeCmClient(answers);
  const relocate = vi.spyOn(fake.cm, 'relocate');
  const store = { get: () => settings as AppSettings } as SettingsStore;
  return { ...fake, relocate, service: createSystemService(serviceContext(fake.cm, { settings: store })) };
}

describe('the cm version', () => {
  it('looks for cm again, then asks its version in a process of its own, as cm shell refuses to start unconfigured', async () => {
    const { service, commands, relocate } = system({ version: '11.0.16.9876\n' });

    expect(await service.cmVersion()).toBe('11.0.16.9876');
    expect(relocate).toHaveBeenCalledTimes(1);
    expect(commands).toMatchObject([{ via: 'execute', args: ['version'] }]);
  });

  it('is asked once for every window after it succeeds, and again after it fails', async () => {
    let installed = false;
    const { service, lines } = system({ version: () => (installed ? '11.0.16\n' : cmFails('Error: cm not found')) });

    await expect(service.cmVersion()).rejects.toThrow('cm not found');
    installed = true;
    await service.cmVersion();
    await service.cmVersion();

    expect(lines()).toEqual(['version', 'version']);
  });
});

describe('the current user', () => {
  it('asks cm who the user is with one quick command', async () => {
    const { service, commands } = system({ whoami: 'ana@unity.com\n' });

    expect(await service.currentUser()).toBe('ana@unity.com');
    expect(commands).toMatchObject([{ via: 'query', args: ['whoami'] }]);
  });
});

describe('moving to the trash', () => {
  beforeEach(() => {
    vi.mocked(shell.trashItem).mockClear();
  });

  it('trashes a folder with what was picked inside it, and skips what is already gone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'trash-'));
    await mkdir(join(root, 'Assets'));
    await writeFile(join(root, 'Assets', 'a.png'), '');
    await writeFile(join(root, 'b.txt'), '');
    const { service } = system({});

    await service.moveToTrash([join(root, 'Assets', 'a.png'), join(root, 'Assets'), join(root, 'b.txt'), join(root, 'gone.txt')]);

    expect(vi.mocked(shell.trashItem).mock.calls.map(([path]) => path).sort()).toEqual([join(root, 'Assets'), join(root, 'b.txt')]);
  });
});

describe('gravatars', () => {
  beforeEach(() => {
    vi.mocked(net.fetch).mockReset();
  });

  it('asks the network for nothing when the user turned gravatars off', async () => {
    const { service } = system({}, { showGravatar: false });

    expect(await service.gravatar('ana@unity.com', 32)).toBeNull();
    expect(net.fetch).not.toHaveBeenCalled();
  });
});
