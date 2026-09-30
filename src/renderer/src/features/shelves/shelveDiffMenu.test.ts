import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => true }));

import type { Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { shelveDiffMenu } from './shelveDiffMenu';

const ws = '/ws';
const automatic = 'Automatic shelve created during switch operation (from br:7)';

const shelve = (comment: string, owner = 'ana@example.com'): Shelve => ({
  id: 12,
  guid: 'g',
  comment,
  owner,
  date: '2026-09-27T10:00:00Z',
  parentChangeset: 4,
  repository: 'game@local',
});

const record: SwitchShelveRecord = {
  workspaceGuid: 'w',
  shelveId: 12,
  repository: 'game@local',
  source: { spec: 'br:/main/task', name: '/main/task', objectRef: 'br:7' },
  target: { spec: 'br:/main', name: '/main' },
  mode: 'leave',
  createdAt: '2026-09-27T10:00:00Z',
  paths: ['a.txt'],
  changelists: [],
};

function menuOf(shown: Shelve, records: SwitchShelveRecord[] = [], onDeleted = () => {}) {
  return shelveDiffMenu(ws, shown, { records, me: 'ana@example.com', onApplied: () => {}, onDeleted });
}

const entries = (menu: MenuEntry[]) => menu.filter((entry): entry is Action => entry !== SEPARATOR && 'id' in entry);
const ids = (menu: MenuEntry[]) => entries(menu).map((entry) => entry.id);

describe("a shelve's diff", () => {
  it("keeps viewing and applying out of the menu: the page is the diff, and its button applies", () => {
    expect(ids(menuOf(shelve('Spike')).menu)).toEqual(['applyAndDelete', 'newCodeReview', 'copy', 'delete']);
  });

  it("never deletes someone else's shelve, nor applies and deletes it", () => {
    const { left, menu } = menuOf(shelve('Spike', 'jane@example.com'));
    expect(left).toBe(false);
    expect(ids(menu)).toEqual(['newCodeReview', 'copy']);
  });

  it("restores the user's left changes, and only applies someone else's", () => {
    expect(menuOf(shelve(automatic), [record]).left).toBe(true);
    expect(menuOf(shelve(automatic, 'jane@example.com'), [record]).left).toBe(false);
  });

  it('matches the user whatever the case of their name', () => {
    expect(ids(menuOf(shelve('Spike', 'Ana@Example.com')).menu)).toContain('delete');
  });

  it('leaves the page once the shelve is deleted', async () => {
    fakeApi.answer('shelves.delete', () => undefined);
    const left = new Promise<void>((resolve) => {
      const del = entries(menuOf(shelve('Spike'), [], resolve).menu).find((entry) => entry.id === 'delete')!;
      void del.run();
    });

    await left;

    expect(fakeApi.argsOf('shelves.delete')).toEqual([[ws, 12]]);
  });
});
