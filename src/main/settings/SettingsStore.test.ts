import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SettingsStore } from './SettingsStore';

function store(): { settings: SettingsStore; filePath: string } {
  const filePath = join(mkdtempSync(join(tmpdir(), 'uvcs-settings-')), 'settings.json');
  return { settings: new SettingsStore(filePath), filePath };
}

describe('SettingsStore recent workspaces', () => {
  it('keeps every window’s workspace when they are remembered one after another', () => {
    const { settings, filePath } = store();
    settings.rememberRecentWorkspace('/wk/a');
    settings.rememberRecentWorkspace('/wk/b');
    settings.rememberRecentWorkspace('/wk/a');

    expect(settings.get().recentWorkspacePaths).toEqual(['/wk/a', '/wk/b']);
    expect(JSON.parse(readFileSync(filePath, 'utf8')).recentWorkspacePaths).toEqual(['/wk/a', '/wk/b']);
  });

  it('keeps the ten latest and forgets one on request', () => {
    const { settings } = store();
    for (let index = 0; index < 12; index++) settings.rememberRecentWorkspace(`/wk/${index}`);
    expect(settings.get().recentWorkspacePaths).toHaveLength(10);
    expect(settings.get().recentWorkspacePaths[0]).toBe('/wk/11');

    settings.forgetRecentWorkspace('/wk/11');
    expect(settings.get().recentWorkspacePaths[0]).toBe('/wk/10');
  });

  it('tells listeners what changed', () => {
    const { settings } = store();
    const changed: string[][] = [];
    settings.onChanged((_settings, changes) => changed.push(Object.keys(changes)));
    settings.update({ theme: 'dark' });
    settings.rememberRecentWorkspace('/wk/a');
    expect(changed).toEqual([['theme'], ['recentWorkspacePaths']]);
  });
});
