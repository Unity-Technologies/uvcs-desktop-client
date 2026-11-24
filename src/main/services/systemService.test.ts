import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { net, shell } from 'electron';
import { gravatarChoice } from '@shared/domain/gravatarChoice';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import type { CmRuntime } from '../cmRuntime/CmRuntime';
import { memorySettings } from '../settings/testing/memorySettings';
import { readDraggedPath } from '../system/dragPasteboard';
import { gravatarUrl } from '../system/gravatar';
import { createAccountsService } from './accountsService';
import { createRepositoriesService } from './repositoriesService';
import { createSystemService } from './systemService';
import { profilesContext, serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({
  app: {},
  dialog: {},
  net: { fetch: vi.fn() },
  shell: { trashItem: vi.fn(async () => undefined), openPath: vi.fn(async () => '') },
}));
// It would start osascript and read this Mac's drag pasteboard.
vi.mock('../system/dragPasteboard', () => ({ readDraggedPath: vi.fn(async () => null) }));
// It needs the app's windows, which only a running app has.
vi.mock('../window/incomingNotification', () => ({ showIncomingNotification: vi.fn() }));

/** The app's `cm` as the version read sees it: it admits every version unless a test says otherwise. */
function fakeCmRuntime(overrides: Partial<Pick<CmRuntime, 'admits' | 'isReady'>> = {}): CmRuntime {
  const runtime: Pick<CmRuntime, 'admits' | 'isReady' | 'pinnedVersion'> = { admits: () => true, isReady: () => true, pinnedVersion: '11.0.16.10659', ...overrides };
  return runtime as CmRuntime;
}

function system(answers: Record<string, CmAnswer>, settings: Partial<AppSettings> = {}, cmRuntime = fakeCmRuntime()) {
  const fake = fakeCmClient(answers);
  const relocate = vi.spyOn(fake.cm, 'relocate');
  const logged: string[] = [];
  const diagnosticLog = { write: (text: string) => void logged.push(text) };
  return { ...fake, relocate, logged, service: createSystemService(serviceContext(fake.cm, { cmRuntime, settings: memorySettings(settings), diagnosticLog }), profilesContext(fake.cm)) };
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

  it('writes the version and where cm is to the log file once, when it answers', async () => {
    const { service, cm, logged } = system({ version: '11.0.16.9876\n' });

    await service.cmVersion();
    await service.cmVersion();

    expect(logged).toEqual([`cm 11.0.16.9876 at ${cm.executable}`]);
  });
});

describe('the cm version of an installed cm older than the app’s own', () => {
  const OWN_CM = '/store/cm';

  /** The service over a fake `cm` printing the app's own version at `OWN_CM`, an older one anywhere else. */
  function systemDroppingOlder() {
    let running = { executable: 'cm' };
    const setup = system({ version: () => (running.executable === OWN_CM ? '11.0.16.10659\n' : '11.0.16.9000\n') }, {}, droppingOlder(() => running));
    running = setup.cm as { executable: string };
    return setup;
  }

  /**
   * As `CmRuntime.admits`: drops the older `cm` running for its own at `OWN_CM`, moving `cm` there as `relocated` would,
   * and answers yes for any `cm` no longer running.
   */
  function droppingOlder(cm: () => { executable: string }): CmRuntime {
    return fakeCmRuntime({
      admits: (executable) => {
        if (executable === OWN_CM || executable !== cm().executable) return true;
        cm().executable = OWN_CM;
        return false;
      },
    });
  }

  it('asks the app’s own instead once it runs it, with no other command', async () => {
    const { service, lines } = systemDroppingOlder();

    expect(await service.cmVersion()).toBe('11.0.16.10659');
    expect(lines()).toEqual(['version', 'version']);
  });

  it('gives every window opening at once the app’s own version, never the older one they shared', async () => {
    const { service, lines } = systemDroppingOlder();

    expect(await Promise.all([service.cmVersion(), service.cmVersion()])).toEqual(['11.0.16.10659', '11.0.16.10659']);
    expect(lines()).toEqual(['version', 'version']);
  });

  it('fails, naming both versions, while the app’s own sets up or where it has none', async () => {
    const { service } = system({ version: '11.0.16.9000\n' }, {}, fakeCmRuntime({ admits: () => false, isReady: () => false }));

    await expect(service.cmVersion()).rejects.toThrow('The installed Unity Version Control is older than this app needs. Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later');
  });

  it('asks again on Check Again, as the user may have updated it', async () => {
    let answer = '11.0.16.9000\n';
    const { service, lines } = system({ version: () => answer }, {}, fakeCmRuntime({ admits: (_executable, version) => version !== '11.0.16.9000', isReady: () => false }));

    await expect(service.cmVersion()).rejects.toThrow('Installed: 11.0.16.9000');
    answer = '11.0.16.10700\n';

    expect(await service.cmVersion()).toBe('11.0.16.10700');
    expect(lines()).toEqual(['version', 'version']);
  });
});

describe('the cm version after choosing another cm', () => {
  it('asks the newly chosen cm, and logs where it is', async () => {
    let answer = '11.0.16.10659\n';
    const { service, cm, logged, lines } = system({ version: () => answer });
    await service.cmVersion();
    (cm as { executable: string }).executable = '/usr/local/bin/cm';
    answer = '11.0.16.9000\n';

    expect(await service.cmVersion()).toBe('11.0.16.9000');
    expect(lines()).toEqual(['version', 'version']);
    expect(logged).toEqual(['cm 11.0.16.10659 at cm', 'cm 11.0.16.9000 at /usr/local/bin/cm']);
  });
});

describe('a window’s unexpected error', () => {
  it('goes to the log file with its stack', async () => {
    const { service, logged } = system({});

    await service.logUnexpectedError({ message: 'boom', details: 'Error: boom\n    at render (App.tsx:3)' });

    expect(logged).toEqual(['Unexpected error in a window: Error: boom\n    at render (App.tsx:3)']);
  });
});

describe('the current user', () => {
  it('asks cm who the user is with one quick command, in any directory', async () => {
    const { service, commands } = system({ whoami: 'ana@unity.com\n' });

    expect(await service.currentUser()).toBe('ana@unity.com');
    expect(commands).toMatchObject([{ via: 'query', args: ['whoami'], options: { anyDirectory: true } }]);
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

  it('asks the network for nothing by default, before the user chose', async () => {
    const { service } = system({}, DEFAULT_SETTINGS);

    expect(await service.gravatar('ana@unity.com', 32)).toBeNull();
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it('asks the network for nothing when the user turned gravatars off', async () => {
    const { service } = system({}, gravatarChoice(false));

    expect(await service.gravatar('ana@unity.com', 32)).toBeNull();
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it('asks the network for nothing when pictures are on but the user never chose it', async () => {
    const { service } = system({}, { showGravatar: true, gravatarChoiceAsked: false });

    expect(await service.gravatar('ana@unity.com', 32)).toBeNull();
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it('fetches the picture once the user turned gravatars on', async () => {
    vi.mocked(net.fetch).mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    const { service } = system({}, gravatarChoice(true));

    expect(await service.gravatar('ana@unity.com', 32)).toBe('data:image/png;base64,AQID');
    expect(vi.mocked(net.fetch).mock.calls.map(([url]) => String(url))).toEqual([gravatarUrl('ana@unity.com', 32)]);
  });
});

describe('the dragged folder', () => {
  it('tells the overlay a workspace folder being dragged from its .plastic folder, without asking cm', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'dragged-'));
    await mkdir(join(workspace, '.plastic'));
    vi.mocked(readDraggedPath).mockResolvedValueOnce(workspace);
    const { service, commands } = system({});

    expect(await service.draggedFolder()).toEqual({ path: workspace, isWorkspace: true });
    expect(readDraggedPath).toHaveBeenCalledWith(process.platform);
    expect(commands).toEqual([]);
  });

  it('is null when the drag can not be read', async () => {
    vi.mocked(readDraggedPath).mockResolvedValueOnce(null);

    expect(await system({}).service.draggedFolder()).toBeNull();
  });
});

describe('the setup and connection checks', () => {
  it('checks the setup with a local command only: no server is asked before a workspace opens', async () => {
    const { service, lines } = system({ 'profile list': 'local\n' });

    expect(await service.checkSetup()).toBeNull();
    expect(lines()).toEqual([`profile list --format=${ACCOUNT_FORMAT}`]);
  });

  it('shares the profiles read with the accounts and the servers: launch lists the profiles once', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['local', 'local', 'ana', 'NameWorkingMode']) });
    const profiles = profilesContext(fake.cm);
    const context = serviceContext(fake.cm, { settings: memorySettings({}) });
    const [system, accounts, repositories] = [createSystemService(context, profiles), createAccountsService(context, profiles), createRepositoriesService(context, profiles)];

    await Promise.all([accounts.list(), repositories.servers(), system.checkSetup()]);
    expect(await system.checkSetup()).toBeNull();

    expect(fake.commands).toMatchObject([{ via: 'query', options: { anyDirectory: true } }]);
  });

});
