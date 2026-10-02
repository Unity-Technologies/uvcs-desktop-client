import { describe, expect, it, vi } from 'vitest';
import type { ExternalApps } from '@shared/domain/externalApps';
import { AppIcons } from '../system/apps/AppIcons';
import type { ExternalAppsCatalog } from '../system/apps/ExternalAppsCatalog';
import { createAppsService } from './appsService';

vi.mock('electron', () => ({ dialog: {} }));

const LIST: ExternalApps = {
  editors: [{ id: 'vscode', name: 'Visual Studio Code', origin: 'known', location: '/Applications/Visual Studio Code.app', opensFolders: true }],
  terminals: [{ id: 'terminal', name: 'Terminal', origin: 'known', location: '/System/Applications/Utilities/Terminal.app', opensFolders: true }],
  editorId: 'vscode',
  terminalId: 'terminal',
};

function service() {
  const catalog = { list: vi.fn(async () => LIST), openInEditor: vi.fn(async () => {}), openInTerminal: vi.fn(async () => {}) };
  const icons = new AppIcons('darwin', async (path) => (path.includes('Code') ? 'data:image/png;base64,code' : undefined));
  return { catalog, apps: createAppsService({ apps: catalog as unknown as ExternalAppsCatalog, icons }, 'darwin') };
}

describe('the apps service', () => {
  it('lists the apps with their own icons, where the OS has one', async () => {
    const list = await service().apps.list();
    expect(list.editors[0]!.icon).toBe('data:image/png;base64,code');
    expect(list.terminals[0]).not.toHaveProperty('icon');
  });

  it('opens paths in the OS’s own separators', async () => {
    const { apps, catalog } = service();
    await apps.openInEditor('/wk//game/./a.cs', 'vscode');
    await apps.openInTerminal('/wk/game/', undefined);
    expect(catalog.openInEditor).toHaveBeenCalledWith('/wk/game/a.cs', 'vscode');
    expect(catalog.openInTerminal).toHaveBeenCalledWith('/wk/game/', undefined);
  });
});
