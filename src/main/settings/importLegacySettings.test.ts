import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importLegacySettings } from './importLegacySettings';
import { SettingsStore } from './SettingsStore';

const WK = 'c3a2e78b-b76a-4c9a-a564-35aaab18c8a5';
const OTHER_WK = '0364e73d-2aaf-439d-9488-73fd8e87692c';
const guid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

const PLASTICGUI_CONF = [`[${WK}]`, 'loadedview=PendingChangesView', `recentbranches=${guid(1)};${guid(2)};`, '', `[${OTHER_WK}]`, `recentbranches=${guid(9)};`, ''].join('\r\n');

/** A temp home: the app's settings file, and the official client's settings folder holding `files`. */
function setUp(files: Record<string, string> = { 'plasticgui.conf': PLASTICGUI_CONF, 'client.conf': '<ClientConfigData />' }) {
  const root = mkdtempSync(join(tmpdir(), 'uvcs-legacy-'));
  const legacyFolder = join(root, 'plastic4');
  mkdirSync(legacyFolder);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(legacyFolder, name), text);
  const settingsFile = join(root, 'userData', 'settings.json');
  return { legacyFolder, settingsFile, openSettings: () => new SettingsStore(settingsFile) };
}

/** Every file in the folder with its text and modification time, to prove the import never wrote there. */
function snapshot(folder: string): Record<string, { text: string; modified: number }> {
  return Object.fromEntries(
    readdirSync(folder).map((name) => {
      const path = join(folder, name);
      return [name, { text: statSync(path).isFile() ? readFileSync(path, 'utf8') : '<folder>', modified: statSync(path).mtimeMs }];
    }),
  );
}

describe('importLegacySettings', () => {
  it("on the first run, takes every workspace's recent branches from the official client, only reading its files", () => {
    const { legacyFolder, openSettings } = setUp();
    const before = snapshot(legacyFolder);
    const settings = openSettings();

    importLegacySettings(settings, legacyFolder);

    expect(settings.get().recentBranchesByWorkspace).toEqual({ [WK]: [guid(1), guid(2)], [OTHER_WK]: [guid(9)] });
    expect(settings.get().legacySettingsImported).toBe(true);
    expect(snapshot(legacyFolder)).toEqual(before);
  });

  it('never imports again: the app’s own settings are the only source from then on', () => {
    const { legacyFolder, openSettings } = setUp();
    importLegacySettings(openSettings(), legacyFolder);
    openSettings().rememberRecentBranch(WK, guid(5));
    writeFileSync(join(legacyFolder, 'plasticgui.conf'), `[${WK}]\nrecentbranches=${guid(7)};\n[${guid(8)}]\nrecentbranches=${guid(8)};\n`);

    const nextRun = openSettings();
    importLegacySettings(nextRun, legacyFolder);

    expect(nextRun.get().recentBranchesByWorkspace).toEqual({ [WK]: [guid(5), guid(1), guid(2)], [OTHER_WK]: [guid(9)] });
  });

  it('counts as done when there is nothing to read, so a later official client is not imported either', () => {
    const { legacyFolder, openSettings } = setUp({});
    importLegacySettings(openSettings(), join(legacyFolder, 'missing'));
    expect(openSettings().get()).toMatchObject({ legacySettingsImported: true, recentBranchesByWorkspace: {} });

    writeFileSync(join(legacyFolder, 'plasticgui.conf'), PLASTICGUI_CONF);
    const nextRun = openSettings();
    importLegacySettings(nextRun, legacyFolder);
    expect(nextRun.get().recentBranchesByWorkspace).toEqual({});
  });

  it('takes nothing from a garbled or unreadable file, and still counts as done', () => {
    const garbled = setUp({ 'plasticgui.conf': '\u0000�[[[\nrecentbranches=\u0007;;' });
    const settings = garbled.openSettings();
    importLegacySettings(settings, garbled.legacyFolder);
    expect(settings.get()).toMatchObject({ legacySettingsImported: true, recentBranchesByWorkspace: {} });

    const unreadable = setUp({});
    mkdirSync(join(unreadable.legacyFolder, 'plasticgui.conf'));
    const before = snapshot(unreadable.legacyFolder);
    const other = unreadable.openSettings();
    importLegacySettings(other, unreadable.legacyFolder);
    expect(other.get()).toMatchObject({ legacySettingsImported: true, recentBranchesByWorkspace: {} });
    expect(snapshot(unreadable.legacyFolder)).toEqual(before);
  });

  it('runs once for a user who already had settings, keeping them and what the app recorded over the official client’s', () => {
    const { legacyFolder, settingsFile, openSettings } = setUp();
    mkdirSync(join(settingsFile, '..'));
    writeFileSync(settingsFile, JSON.stringify({ theme: 'dark', recentBranchesByWorkspace: { [WK]: [guid(4)] } }));
    const settings = openSettings();

    importLegacySettings(settings, legacyFolder);

    expect(settings.get()).toMatchObject({ theme: 'dark', legacySettingsImported: true, recentBranchesByWorkspace: { [WK]: [guid(4)], [OTHER_WK]: [guid(9)] } });
  });
});
