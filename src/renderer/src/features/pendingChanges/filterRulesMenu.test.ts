import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import type { PendingChange } from '@shared/domain/pendingChanges';
import { isSubmenu, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import { shownToasts } from '../../testing/operationOutcome';
import { pendingChangeMenu } from './pendingChangeMenu';
import { addFilterRules } from './pendingChangeOperations';

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
  it('offers one item, by its path or its extension', () => {
    expect([...ignoreEntries(pendingChangeMenu(ws, [change('Packages/manifest.json')], [])).keys()]).toEqual([
      'This item (/Packages/manifest.json)',
      'All .json files',
    ]);
  });

  it('offers several selected items at once', async () => {
    const selection = [change('plugin/Assets', 'directory'), change('plugin/Packages/manifest.json'), change('plugin/ProjectSettings/AudioManager.asset')];
    const entries = ignoreEntries(pendingChangeMenu(ws, selection, []));

    expect([...entries.keys()]).toEqual(['These 3 items']);
    expect(await patternsAddedBy(entries.get('These 3 items'))).toEqual(['/plugin/Assets', '/plugin/Packages/manifest.json', '/plugin/ProjectSettings/AudioManager.asset']);
  });

  it('counts only the items outside a selected folder, and offers the extension they all share', async () => {
    const selection = [change('ProjectSettings', 'directory'), change('ProjectSettings/AudioManager.asset'), change('Other/TagManager.asset')];
    const entries = ignoreEntries(pendingChangeMenu(ws, selection, []));
    expect([...entries.keys()]).toEqual(['These 2 items']);

    const assets = [change('ProjectSettings/AudioManager.asset'), change('ProjectSettings/TagManager.asset')];
    const assetEntries = ignoreEntries(pendingChangeMenu(ws, assets, []));
    expect([...assetEntries.keys()]).toEqual(['These 2 items', 'All .asset files']);
    expect(await patternsAddedBy(assetEntries.get('All .asset files'))).toEqual(['*.asset']);
  });
});

describe('addFilterRules', () => {
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
