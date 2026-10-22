import { describe, expect, it } from 'vitest';
import type { ExternalApp } from '@shared/domain/externalApps';
import { isSubmenu, SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { appPickerEntries, automaticChoice, pickedApp, type AppPickerChoices } from './appPickerChoices';
import { AUTOMATIC_CHOICE_ICON } from './automaticApp';

const app = (id: string, name: string): ExternalApp => ({ id, name, origin: 'known', location: `/Applications/${name}.app`, opensFolders: true });
const EDITORS = [app('vscode', 'Visual Studio Code'), app('rider', 'JetBrains Rider')];
const choices = (parts: Partial<AppPickerChoices> = {}): AppPickerChoices => ({
  apps: EDITORS,
  choice: 'auto',
  usedId: 'vscode',
  automatic: automaticChoice('The first editor found'),
  offersSystem: true,
  onChoose: () => {},
  onAdd: () => {},
  ...parts,
});

/** Each entry's label, with a mark on the one checked. */
const reading = (entries: MenuEntry[]): string[] =>
  entries.map((entry) => (entry === SEPARATOR ? '---' : isSubmenu(entry) ? entry.label : `${entry.label}${entry.checked ? ' ✓' : ''}`));

describe('appPickerEntries', () => {
  it('offers Automatic, naming the app it uses, then every app, then each file’s default app and another app', () => {
    expect(reading(appPickerEntries(choices()))).toEqual([
      'Automatic (Visual Studio Code) ✓',
      '---',
      'Visual Studio Code',
      'JetBrains Rider',
      '---',
      "Each file's default app",
      'Choose another app…',
    ]);
  });

  it('checks the app chosen, or each file’s default app', () => {
    expect(reading(appPickerEntries(choices({ choice: 'rider', usedId: 'rider' })))).toContain('JetBrains Rider ✓');
    expect(reading(appPickerEntries(choices({ choice: 'system', usedId: null })))).toEqual(['Automatic', '---', 'Visual Studio Code', 'JetBrains Rider', '---', "Each file's default app ✓", 'Choose another app…']);
  });

  it('shows Automatic chosen when the app chosen is no longer found', () => {
    expect(reading(appPickerEntries(choices({ choice: 'zed' })))[0]).toBe('Automatic (Visual Studio Code) ✓');
  });

  it('offers only the apps for the terminal, and saves the choice picked', () => {
    const chosen: string[] = [];
    const entries = appPickerEntries(choices({ offersSystem: false, onAdd: undefined, onChoose: (choice) => chosen.push(choice) }));
    expect(reading(entries)).toEqual(['Automatic (Visual Studio Code) ✓', '---', 'Visual Studio Code', 'JetBrains Rider']);
    (entries[3] as Action).run();
    (entries[0] as Action).run();
    expect(chosen).toEqual(['rider', 'auto']);
  });
});

describe('appPickerEntries, for a merge tool', () => {
  const tools = [app('uvcs', 'UVCS merge tool'), app('meld', 'Meld')];
  const sameAsOthers = { id: 'others', label: 'Same as others', rule: 'The tool every other file opens in', coversMissing: false };

  it('offers a choice of its own in place of Automatic, naming the tool it uses', () => {
    const entries = appPickerEntries(choices({ apps: tools, choice: 'others', usedId: 'uvcs', automatic: sameAsOthers, offersSystem: false }));
    expect(reading(entries).slice(0, 4)).toEqual(['Same as others (UVCS merge tool) ✓', '---', 'UVCS merge tool', 'Meld']);
  });

  it('offers only the tools where one must be picked, then what is said about the one picked', () => {
    const more = [{ id: 'howItOpens', label: 'How Meld opens…', run: () => {} }];
    const entries = appPickerEntries(choices({ apps: tools, choice: 'meld', usedId: 'meld', automatic: null, offersSystem: false, more }));
    expect(reading(entries)).toEqual(['UVCS merge tool', 'Meld ✓', '---', 'Choose another app…', '---', 'How Meld opens…']);
  });

  it('shows a tool picked that is gone as itself, not as the choice of its own', () => {
    const picked = choices({ apps: tools, choice: 'kdiff3', usedId: 'uvcs', automatic: sameAsOthers, missingName: 'KDiff3', offersSystem: false });
    expect(pickedApp(picked)).toMatchObject({ label: 'KDiff3', description: 'Not found on this computer' });
    expect(reading(appPickerEntries(picked))[0]).toBe('Same as others (UVCS merge tool)');
  });

  it('checks nothing while the tool picked is not found here', () => {
    expect(reading(appPickerEntries(choices({ apps: tools, choice: 'semantic', automatic: null, offersSystem: false, onAdd: undefined })))).toEqual(['UVCS merge tool', 'Meld']);
  });
});

describe('appPickerEntries, with apps of one name', () => {
  it('tells them apart by their detail, a group of their own after a separator, with their glyph', () => {
    const glyph = () => null;
    const apps = [app('uvcs', 'UVCS merge tool'), { id: 'u', name: 'UnityYAMLMerge', location: 'x', detail: '2022.3.10f1', startsGroup: true, glyph }];
    const entries = appPickerEntries(choices({ apps, choice: 'u', automatic: null, offersSystem: false, onAdd: undefined }));
    expect(reading(entries)).toEqual(['UVCS merge tool', '---', 'UnityYAMLMerge ✓']);
    expect(entries[2]).toMatchObject({ detail: '2022.3.10f1', icon: glyph });
  });
});

describe('pickedApp', () => {
  it('names a tool picked that is not found here, saying so', () => {
    expect(pickedApp(choices({ choice: 'semantic', automatic: null, missingName: 'Semantic Merge' }))).toMatchObject({ label: 'Semantic Merge', description: 'Not found on this computer' });
  });

  it('shows the choice of its own with the tool it uses', () => {
    const sameAsOthers = { id: 'others', label: 'Same as others', rule: 'The tool every other file opens in', coversMissing: false };
    expect(pickedApp(choices({ choice: 'others', usedId: 'rider', automatic: sameAsOthers }))).toMatchObject({ label: 'Same as others', description: 'Uses JetBrains Rider' });
  });

  it('shows Automatic with its own icon and the app it uses, or the rule while it uses none', () => {
    expect(pickedApp(choices())).toEqual({ label: 'Automatic', description: 'Uses Visual Studio Code', icon: AUTOMATIC_CHOICE_ICON, detail: 'Visual Studio Code' });
    expect(pickedApp(choices({ usedId: null }))).toMatchObject({ label: 'Automatic', description: 'The first editor found' });
  });

  it('shows the app chosen with where it is, or each file’s default app', () => {
    expect(pickedApp(choices({ choice: 'rider', usedId: 'rider' }))).toMatchObject({ label: 'JetBrains Rider', description: '/Applications/JetBrains Rider.app' });
    expect(pickedApp(choices({ choice: 'system', usedId: null }))).toMatchObject({ label: "Each file's default app", description: 'As the OS opens it' });
  });
});
