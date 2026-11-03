import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import { workspacePlace } from '@shared/domain/place';
import type { DiffEntry, DiffStatus, DiffTarget } from '@shared/domain/diff';
import type { Action, MenuEntry } from '../../lib/actions';
import { askedDialogs } from '../../testing/fakeDialogs';
import { diffEntryMenu } from './diffEntryMenu';

const ws = '/ws';
const repository = 'game@local';
const ofRange: DiffTarget = { kind: 'range', fromSpec: 'cs:12', toSpec: 'cs:20' };

function entry(path: string, status: DiffStatus = 'changed'): DiffEntry {
  return { status, path, itemType: 'file', baseRevisionId: 39, revisionId: status === 'deleted' ? -1 : 40, repository };
}

/** Every action of a menu, its submenus' included, by id. */
function actions(menu: MenuEntry[]): Map<string, Action> {
  const found = new Map<string, Action>();
  const visit = (items: MenuEntry[]) => {
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;
      if ('entries' in item && Array.isArray(item.entries)) visit(item.entries as MenuEntry[]);
      if ('id' in item && 'run' in item) found.set(item.id, item as Action);
    }
  };
  visit(menu);
  return found;
}

describe("a diff's menu for a Unity asset listed with its .meta", () => {
  const asset = entry('Assets/a.png');
  const meta = entry('Assets/a.png.meta');
  const metaOf = (listed: DiffEntry) => (listed === asset ? meta : undefined);

  it('reverts the asset and its .meta together, after one confirmation', async () => {
    const reverted: unknown[] = [];
    fakeApi.answer('history.revertTo', (...args: unknown[]) => void reverted.push(args));
    const menu = diffEntryMenu(workspacePlace(ws), ofRange, [asset], { workspaceRepository: repository, metaOf });

    const revert = actions(menu).get('revert')!;
    expect(revert.label).toBe('Revert file and its .meta to before this change…');
    revert.run();
    await vi.waitFor(() => expect(reverted).toHaveLength(1));

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Revert Assets/a.png and its .meta to changeset 12?' }]);
    expect(reverted).toEqual([[ws, ['Assets/a.png', 'Assets/a.png.meta'], 12]]);
  });

  it(".meta diff opens the .meta's diff, and .meta history its history", () => {
    const onMetaDiff = vi.fn();
    const found = actions(diffEntryMenu(workspacePlace(ws), ofRange, [asset], { workspaceRepository: repository, metaOf, onMetaDiff }));

    found.get('metaDiff')!.run();

    expect(onMetaDiff).toHaveBeenCalledWith(meta);
    expect(found.has('metaHistory')).toBe(true);
  });

  it('offers no .meta entries for a file with no .meta listed with it', () => {
    const found = actions(diffEntryMenu(workspacePlace(ws), ofRange, [entry('src/a.ts')], { workspaceRepository: repository, metaOf, onMetaDiff: () => {} }));

    expect(found.has('metaDiff')).toBe(false);
    expect(found.has('metaHistory')).toBe(false);
    expect(found.get('revert')!.label).toBe('Revert file to before this change…');
  });

  it('restores a deleted asset with its deleted .meta, as one file: never to another place without it', async () => {
    const deletedAsset = entry('Assets/b.png', 'deleted');
    const deletedMeta = entry('Assets/b.png.meta', 'deleted');
    const found = actions(
      diffEntryMenu(workspacePlace(ws), ofRange, [deletedAsset], { workspaceRepository: repository, metaOf: (listed) => (listed === deletedAsset ? deletedMeta : undefined), diffEntries: [deletedAsset, deletedMeta] }),
    );

    expect(found.get('restore')!.label).toBe('Restore file and its .meta');
    expect(found.has('restoreTo')).toBe(false);
  });
});
