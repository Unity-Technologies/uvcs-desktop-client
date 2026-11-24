import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The filter rules dialog: what it was shown, and what the user confirms (the rules as shown unless a test says). */
const rulesDialog = vi.hoisted(() => ({
  shown: [] as { fileName: string; suggested: string[] }[],
  answer: undefined as ((suggested: string[]) => string[] | undefined) | undefined,
}));
vi.mock('./FilterRulesDialog', () => ({
  askFilterRules: async (fileName: string, suggested: string[]) => {
    rulesDialog.shown.push({ fileName, suggested });
    return rulesDialog.answer ? rulesDialog.answer(suggested) : suggested;
  },
}));
beforeEach(() => {
  rulesDialog.shown.length = 0;
  rulesDialog.answer = undefined;
});

import type { PendingChange } from '@shared/domain/pendingChanges';
import { isSubmenu, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import { shownToasts } from '../../testing/operationOutcome';
import { pendingChangeMenu } from './pendingChangeMenu';
import { addFilterRules, askAndAddFilterRules } from './pendingChangeOperations';

const ws = '/ws';
const change = (path: string, itemType: PendingChange['itemType'] = 'file'): PendingChange => ({ path, kinds: ['private'], itemType, size: 1, lastModified: '' });

function filterRulesSubmenu(menu: MenuEntry[]): Submenu | undefined {
  return menu.find((entry): entry is Submenu => entry !== 'separator' && isSubmenu(entry) && entry.label === 'Ignore, cloak or hide');
}

/** The entries of "Add to ignore.conf", as label → the action. */
function ignoreEntries(menu: MenuEntry[]): Map<string, Action> {
  const ignore = filterRulesSubmenu(menu)?.entries.find((entry): entry is Submenu => entry !== 'separator' && isSubmenu(entry) && entry.label === 'Add to ignore.conf');
  return new Map((ignore?.entries ?? []).flatMap((entry) => (entry !== 'separator' && !isSubmenu(entry) ? [[entry.label, entry]] : [])));
}

/** Runs the entry and resolves with the patterns it asked to add, once it has asked. */
function patternsAddedBy(entry: Action | undefined): Promise<unknown> {
  const asked = new Promise((resolve) => fakeApi.answer('pendingChanges.addFilterRules', (_ws, _list, patterns) => void resolve(patterns)));
  entry?.run();
  return asked;
}

describe('Ignore, cloak or hide', () => {
  it('offers one item, by its path, its name or its extension', async () => {
    const entries = ignoreEntries(pendingChangeMenu(ws, [change('Packages/manifest.json')], []));

    expect([...entries.keys()]).toEqual(['This item (/Packages/manifest.json)…', 'All items named manifest.json…', 'All .json files…']);
    expect(await patternsAddedBy(entries.get('All items named manifest.json…'))).toEqual(['manifest.json']);
  });

  it('offers a folder by its path or its name', async () => {
    const entries = ignoreEntries(pendingChangeMenu(ws, [change('New directory', 'directory')], []));

    expect([...entries.keys()]).toEqual(['This item (/New directory)…', 'All items named New directory…']);
    expect(await patternsAddedBy(entries.get('All items named New directory…'))).toEqual(['New directory']);
  });

  it('leaves out a name the rules file would read as a comment', () => {
    expect([...ignoreEntries(pendingChangeMenu(ws, [change('#scratch')], [])).keys()]).toEqual(['This item (/#scratch)…']);
  });

  it('offers the name several items share, wherever they are', () => {
    const selection = [change('Assets/Thumbs.db'), change('Docs/Thumbs.db')];

    expect([...ignoreEntries(pendingChangeMenu(ws, selection, [])).keys()]).toEqual(['These 2 items…', 'All items named Thumbs.db…', 'All .db files…']);
  });

  it('offers several selected items at once', async () => {
    const selection = [change('plugin/Assets', 'directory'), change('plugin/Packages/manifest.json'), change('plugin/ProjectSettings/AudioManager.asset')];
    const entries = ignoreEntries(pendingChangeMenu(ws, selection, []));

    expect([...entries.keys()]).toEqual(['These 3 items…']);
    expect(await patternsAddedBy(entries.get('These 3 items…'))).toEqual(['/plugin/Assets', '/plugin/Packages/manifest.json', '/plugin/ProjectSettings/AudioManager.asset']);
  });

  it('counts only the items outside a selected folder, and offers the extension they all share', async () => {
    const selection = [change('ProjectSettings', 'directory'), change('ProjectSettings/AudioManager.asset'), change('Other/TagManager.asset')];
    const entries = ignoreEntries(pendingChangeMenu(ws, selection, []));
    expect([...entries.keys()]).toEqual(['These 2 items…']);

    const assets = [change('ProjectSettings/AudioManager.asset'), change('ProjectSettings/TagManager.asset')];
    const assetEntries = ignoreEntries(pendingChangeMenu(ws, assets, []));
    expect([...assetEntries.keys()]).toEqual(['These 2 items…', 'All .asset files…']);
    expect(await patternsAddedBy(assetEntries.get('All .asset files…'))).toEqual(['*.asset']);
  });
});

describe('askAndAddFilterRules', () => {
  it('shows the suggested rules, in the list file, before adding them', async () => {
    fakeApi.answer('pendingChanges.addFilterRules', () => undefined);

    await askAndAddFilterRules(ws, 'hidden', ['/anewfile.txt2']);

    expect(rulesDialog.shown).toEqual([{ fileName: 'hidden_changes.conf', suggested: ['/anewfile.txt2'] }]);
  });

  it('adds the rules as the user changed them', async () => {
    fakeApi.answer('pendingChanges.addFilterRules', () => undefined);
    rulesDialog.answer = () => ['/src/*.txt2', 'anewfile.txt2'];

    await askAndAddFilterRules(ws, 'ignore', ['/src/anewfile.txt2']);

    expect(fakeApi.argsOf('pendingChanges.addFilterRules')).toEqual([[ws, 'ignore', ['/src/*.txt2', 'anewfile.txt2']]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Added 2 rules to ignore.conf' }]);
  });

  it('adds nothing when the user cancels', async () => {
    rulesDialog.answer = () => undefined;

    await askAndAddFilterRules(ws, 'ignore', ['/Library']);

    expect(fakeApi.argsOf('pendingChanges.addFilterRules')).toEqual([]);
    expect(shownToasts()).toEqual([]);
  });

});

// The check-in's notice ("Add Library/ to ignore.conf") names its one rule on the button, so it adds it at once.
describe('addFilterRules', () => {
  it('adds the rules without asking', async () => {
    fakeApi.answer('pendingChanges.addFilterRules', () => undefined);

    await addFilterRules(ws, 'ignore', ['/Library']);

    expect(rulesDialog.shown).toEqual([]);
    expect(fakeApi.argsOf('pendingChanges.addFilterRules')).toEqual([[ws, 'ignore', ['/Library']]]);
  });

  it('names the one rule it added', async () => {
    fakeApi.answer('pendingChanges.addFilterRules', () => undefined);

    await addFilterRules(ws, 'ignore', ['/Library']);

    expect(fakeApi.argsOf('pendingChanges.addFilterRules')).toEqual([[ws, 'ignore', ['/Library']]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Added “/Library” to ignore.conf' }]);
  });

  it('counts the rules when it added several', async () => {
    fakeApi.answer('pendingChanges.addFilterRules', () => undefined);

    await addFilterRules(ws, 'cloaked', ['/Assets', '/Packages']);

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Added 2 rules to cloaked.conf' }]);
  });
});
