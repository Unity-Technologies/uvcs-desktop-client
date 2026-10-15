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

function system(answers: Record<string, CmAnswer>, settings: Partial<AppSettings> = {}) {
  const fake = fakeCmClient(answers);
  const relocate = vi.spyOn(fake.cm, 'relocate');
  return { ...fake, relocate, service: createSystemService(serviceContext(fake.cm, { settings: memorySettings(settings) }), profilesContext(fake.cm)) };
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

  it("checks a workspace's server once it answers, for every window, and again while it doesn't", async () => {
    let reachable = false;
    const { service, lines } = system({
      checkconnection: () => (reachable ? 'Test connection executed successfully\n' : cmFails("Error: Can't resolve DNS entry for acme")),
    });

    expect(await service.checkConnection('acme:8087')).toMatchObject({ kind: 'serverUnreachable', server: 'acme:8087' });
    reachable = true;
    expect(await service.checkConnection('acme:8087')).toBeNull();
    expect(await service.checkConnection('acme:8087')).toBeNull();
    expect(await service.checkConnection('local')).toBeNull();

    expect(lines()).toEqual(['checkconnection acme:8087', 'checkconnection acme:8087', 'checkconnection local']);
  });
});
