import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { recentCommentsFor } from '@shared/domain/recentComments';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { parseOrganizationId } from '@shared/domain/stableIds';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { SettingsStore } from './SettingsStore';

const GAME = repositoryGuidFor(1);
const ART = repositoryGuidFor(2);

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

describe('SettingsStore recent comments', () => {
  it("keeps both repositories' comments when two windows check in to them one right after the other", () => {
    const { settings, filePath } = store();
    const changed: string[][] = [];
    settings.onChanged((_settings, changes) => changed.push(Object.keys(changes)));

    settings.rememberRecentComment(GAME, 'Fix cs:4207');
    settings.rememberRecentComment(ART, 'New textures');

    const stored = new SettingsStore(filePath).get();
    expect(recentCommentsFor(stored, GAME)).toEqual(['Fix cs:4207']);
    expect(recentCommentsFor(stored, ART)).toEqual(['New textures']);
    expect(changed).toEqual([['recentCommentsByRepository'], ['recentCommentsByRepository']]);
  });
});

describe('SettingsStore favorite organizations', () => {
  it('keeps every window’s favorites when they change one after another', () => {
    const { settings, filePath } = store();
    settings.setFavoriteOrganization('acme@unity', true);
    settings.setFavoriteOrganization('games@cloud', true);
    settings.setFavoriteOrganization('acme@unity', false);

    expect(settings.get().favoriteOrganizations).toEqual(['games@cloud']);
    expect(JSON.parse(readFileSync(filePath, 'utf8')).favoriteOrganizations).toEqual(['games@cloud']);
  });

  it('starts with none', () => {
    expect(store().settings.get().favoriteOrganizations).toEqual([]);
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

  it('reads a file from before recent comments were per repository, keeping its comments for the repositories without their own', () => {
    const folder = mkdtempSync(join(tmpdir(), 'uvcs-settings-'));
    const filePath = join(folder, 'settings.json');
    writeFileSync(filePath, JSON.stringify({ theme: 'dark', recentComments: ['Older comment'] }));

    const settings = new SettingsStore(filePath).get();

    expect(settings).toMatchObject({ recentComments: ['Older comment'], recentCommentsByRepository: {} });
    expect(recentCommentsFor(settings, GAME)).toEqual(['Older comment']);
  });

  it('keeps the repositories checked in to last first across a restart, so the one left longest is forgotten first', () => {
    const { settings, filePath } = store();
    settings.rememberRecentComment(GAME, 'In game');
    settings.rememberRecentComment(ART, 'In art');
    settings.rememberRecentComment(GAME, 'Again in game');

    expect(Object.keys(new SettingsStore(filePath).get().recentCommentsByRepository)).toEqual([GAME, ART]);
  });

  it('turns off Gravatar pictures saved on only by the old default, until the user chooses', () => {
    const folder = mkdtempSync(join(tmpdir(), 'uvcs-settings-'));
    const filePath = join(folder, 'settings.json');
    writeFileSync(filePath, JSON.stringify({ theme: 'dark', showGravatar: true }));

    expect(new SettingsStore(filePath).get()).toMatchObject({ theme: 'dark', showGravatar: false, gravatarChoiceAsked: false });
  });

  it('keeps Gravatar pictures saved off before the question as the user’s answer, as they were on by default', () => {
    const folder = mkdtempSync(join(tmpdir(), 'uvcs-settings-'));
    const filePath = join(folder, 'settings.json');
    writeFileSync(filePath, JSON.stringify({ theme: 'dark', showGravatar: false }));

    expect(new SettingsStore(filePath).get()).toMatchObject({ showGravatar: false, gravatarChoiceAsked: true });
  });

  it('keeps the profile pictures question unasked across another change, as every setting is written', () => {
    const { settings, filePath } = store();
    settings.update({ theme: 'dark' });

    expect(new SettingsStore(filePath).get()).toMatchObject({ theme: 'dark', showGravatar: false, gravatarChoiceAsked: false });
  });

  it('keeps Gravatar pictures the user turned on', () => {
    const { settings, filePath } = store();
    settings.update({ showGravatar: true, gravatarChoiceAsked: true });

    expect(new SettingsStore(filePath).get()).toMatchObject({ showGravatar: true, gravatarChoiceAsked: true });
  });
});

describe('SettingsStore and the choice of cm', () => {
  it('moves a file’s choice from before the automatic one to it once, and keeps the user’s choice after that', () => {
    const { settings, filePath } = store();
    writeFileSync(filePath, JSON.stringify({ ...DEFAULT_SETTINGS, cmChoice: 'managed', cmDeclinedUpdateFor: undefined }));
    const migrated = new SettingsStore(filePath);
    expect(migrated.get().cmChoice).toBe('automatic');

    migrated.update({ cmChoice: 'managed' });
    expect(new SettingsStore(filePath).get().cmChoice).toBe('managed');
    expect(settings.get().cmChoice).toBe('automatic');
  });
});

describe('SettingsStore repository and server settings', () => {
  const pin = { branch: 7, row: 2 };

  it('keep what every window changes in one repository, one value at a time, and write it to the file', () => {
    const { settings, filePath } = store();
    settings.updateRepositorySettings(GAME, { branchPins: [pin] });
    settings.updateRepositorySettings(GAME, { explorerRulesOff: true });
    settings.updateRepositorySettings(ART, { syncRemote: 'art@cloud' });

    const expected = { [GAME]: { branchPins: [pin], explorerRulesOff: true }, [ART]: { syncRemote: 'art@cloud' } };
    expect(settings.get().repositorySettings).toEqual(expected);
    expect(JSON.parse(readFileSync(filePath, 'utf8')).repositorySettings).toEqual(expected);
  });

  it('keep a server’s apart from every other server’s', () => {
    const { settings } = store();
    settings.updateServerSettings('acme@unity', { homeProject: 'Racing' });
    settings.updateServerSettings('beta@unity', { homeProject: 'Kart' });
    settings.updateServerSettings('acme@unity', { homeProject: null });
    expect(settings.get().serverSettings).toEqual({ 'beta@unity': { homeProject: 'Kart' } });
  });

  it("forget an organization's id once it keeps nothing else, its project or its favorite gone", () => {
    const { settings } = store();
    const acme = parseOrganizationId('1375943370549')!;
    settings.update({ favoriteOrganizations: ['beta@unity'], serverSettings: { 'acme@unity': { homeProject: 'Racing', organizationId: acme }, 'beta@unity': { organizationId: acme } } });

    settings.updateServerSettings('acme@unity', { homeProject: null });
    settings.setFavoriteOrganization('beta@unity', false);

    expect(settings.get().serverSettings).toEqual({});
  });

  it("keep a favorite organization's id when its project goes", () => {
    const { settings } = store();
    const acme = parseOrganizationId('1375943370549')!;
    settings.update({ favoriteOrganizations: ['acme@unity'], serverSettings: { 'acme@unity': { homeProject: 'Racing', organizationId: acme } } });

    settings.updateServerSettings('acme@unity', { homeProject: null });

    expect(settings.get().serverSettings).toEqual({ 'acme@unity': { organizationId: acme } });
  });

  it('take what a window kept before only where nothing is kept yet, the same when two windows bring it', () => {
    const { settings } = store();
    settings.addWindowSettings({ repositorySettings: { 'game@host': { syncRemote: 'game@cloud' } }, serverSettings: {}, changesetColors: { users: [] } });
    settings.update({ changesetColors: { users: [{ user: 'jane', hue: 1 }] } });
    const kept = {
      repositorySettings: { 'game@host': { syncRemote: 'old@cloud', branchPins: [pin] } },
      serverSettings: { 'acme@unity': { homeProject: 'Racing' } },
      changesetColors: { users: [{ user: 'old', hue: 2 }] },
    };
    settings.addWindowSettings(kept);
    settings.addWindowSettings(kept);

    expect(settings.get().repositorySettings).toEqual({ 'game@host': { syncRemote: 'game@cloud', branchPins: [pin] } });
    expect(settings.get().serverSettings).toEqual({ 'acme@unity': { homeProject: 'Racing' } });
    expect(settings.get().changesetColors).toEqual({ users: [{ user: 'jane', hue: 1 }] });
  });

  it('move what was kept by a repository’s spec under its GUID once it is known: its settings and recent comments', () => {
    const { settings, filePath } = store();
    settings.addWindowSettings({ repositorySettings: { 'Game@host': { branchPins: [pin] } }, serverSettings: {}, changesetColors: { users: [] } });
    settings.update({ recentCommentsByRepository: { 'game@host': ['Fix cs:4207'] } });

    settings.keepRepositoryByGuid('game@HOST', GAME);

    const stored = new SettingsStore(filePath).get();
    expect(stored.repositorySettings).toEqual({ [GAME]: { branchPins: [pin] } });
    expect(stored.recentCommentsByRepository).toEqual({ [GAME]: ['Fix cs:4207'] });
  });

  it('write nothing when the GUID is known again and nothing is kept by the spec', () => {
    const { settings } = store();
    settings.updateRepositorySettings(GAME, { branchPins: [pin] });
    const changed: string[][] = [];
    settings.onChanged((_settings, changes) => changed.push(Object.keys(changes)));

    settings.keepRepositoryByGuid('game@host', GAME);

    expect(changed).toEqual([]);
  });

  it('take a window’s changeset colors while it has none', () => {
    const { settings } = store();
    settings.addWindowSettings({ repositorySettings: {}, serverSettings: {}, changesetColors: { users: [{ user: 'old', hue: 2 }] } });
    expect(settings.get().changesetColors).toEqual({ users: [{ user: 'old', hue: 2 }] });
  });
});
