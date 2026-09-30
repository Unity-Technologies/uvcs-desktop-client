import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
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

describe('SettingsStore recent branches', () => {
  const branchGuid = (n: number): string => `9b8e2f7a-58f3-4c43-9d83-3c2f1f5c000${n}`;

  it('keeps them per workspace, writes them to its own file and tells every window', () => {
    const { settings, filePath } = store();
    const changed: string[][] = [];
    settings.onChanged((_settings, changes) => changed.push(Object.keys(changes)));

    settings.rememberRecentBranch('wk-a', branchGuid(1));
    settings.rememberRecentBranch('wk-b', branchGuid(2));
    settings.rememberRecentBranch('wk-a', branchGuid(3));

    const expected = { 'wk-a': [branchGuid(3), branchGuid(1)], 'wk-b': [branchGuid(2)] };
    expect(settings.get().recentBranchesByWorkspace).toEqual(expected);
    expect(JSON.parse(readFileSync(filePath, 'utf8')).recentBranchesByWorkspace).toEqual(expected);
    expect(changed).toEqual([['recentBranchesByWorkspace'], ['recentBranchesByWorkspace'], ['recentBranchesByWorkspace']]);
  });
});

describe('SettingsStore reading its file', () => {
  it("keeps a file it can't read as settings aside, named for when, and starts from the defaults", () => {
    const folder = mkdtempSync(join(tmpdir(), 'uvcs-settings-'));
    const filePath = join(folder, 'settings.json');
    writeFileSync(filePath, '{"theme": "dark", "recentWork');

    const settings = new SettingsStore(filePath, () => new Date('2026-09-30T12:34:56.789Z'));

    expect(settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(readdirSync(folder)).toEqual(['settings.json.2026-09-30T12-34-56-789Z.bak']);
    expect(readFileSync(join(folder, 'settings.json.2026-09-30T12-34-56-789Z.bak'), 'utf8')).toBe('{"theme": "dark", "recentWork');
  });

  it('starts from the defaults without a file, keeping nothing aside', () => {
    const folder = mkdtempSync(join(tmpdir(), 'uvcs-settings-'));

    expect(new SettingsStore(join(folder, 'settings.json')).get()).toEqual(DEFAULT_SETTINGS);
    expect(readdirSync(folder)).toEqual([]);
  });
});
