import { describe, expect, it, vi } from 'vitest';
import { nativeImage } from 'electron';
import type { ExternalApps } from '@shared/domain/externalApps';
import type { ExternalAppsCatalog } from '../system/apps/ExternalAppsCatalog';
import { createAppsService } from './appsService';

vi.mock('electron', () => ({ nativeImage: { createThumbnailFromPath: vi.fn() }, dialog: {} }));

const LIST: ExternalApps = {
  editors: [{ id: 'vscode', name: 'Visual Studio Code', origin: 'known', location: '/Applications/Visual Studio Code.app', opensFolders: true }],
  terminals: [{ id: 'terminal', name: 'Terminal', origin: 'known', location: '/System/Applications/Utilities/Terminal.app', opensFolders: true }],
  editorId: 'vscode',
  terminalId: 'terminal',
};

function service(platform: NodeJS.Platform = 'darwin') {
  const catalog = { list: vi.fn(async () => LIST), openInEditor: vi.fn(async () => {}), openInTerminal: vi.fn(async () => {}) };
  return { catalog, apps: createAppsService({ apps: catalog as unknown as ExternalAppsCatalog, installedApps: {} as never }, platform) };
}

const image = (url: string) => ({ isEmpty: () => url === '', toDataURL: () => url });

describe('the apps service', () => {
  it("lists the apps with their own icons, each read once from the OS", async () => {
    vi.mocked(nativeImage.createThumbnailFromPath).mockReset().mockImplementation(async (path) => image(path.includes('Code') ? 'data:image/png;base64,code' : '') as never);
    const { apps } = service();

    const list = await apps.list();
    await apps.list();

    expect(list.editors[0]!.icon).toBe('data:image/png;base64,code');
    expect(list.terminals[0]).not.toHaveProperty('icon');
    expect(vi.mocked(nativeImage.createThumbnailFromPath).mock.calls.map(([path]) => path)).toEqual(['/Applications/Visual Studio Code.app', '/System/Applications/Utilities/Terminal.app']);
  });

  it('lists an app without an icon when the OS has none to give, and asks nothing on Linux', async () => {
    vi.mocked(nativeImage.createThumbnailFromPath).mockReset().mockRejectedValue(new Error('no icon'));
    expect((await service().apps.list()).editors[0]).not.toHaveProperty('icon');
    vi.mocked(nativeImage.createThumbnailFromPath).mockReset();
    expect((await service('linux').apps.list()).editors[0]).not.toHaveProperty('icon');
    expect(nativeImage.createThumbnailFromPath).not.toHaveBeenCalled();
  });

  it('opens paths in the OS’s own separators', async () => {
    const { apps, catalog } = service();
    await apps.openInEditor('/wk//game/./a.cs', 'vscode');
    await apps.openInTerminal('/wk/game/', undefined);
    expect(catalog.openInEditor).toHaveBeenCalledWith('/wk/game/a.cs', 'vscode');
    expect(catalog.openInTerminal).toHaveBeenCalledWith('/wk/game/', undefined);
  });
});
