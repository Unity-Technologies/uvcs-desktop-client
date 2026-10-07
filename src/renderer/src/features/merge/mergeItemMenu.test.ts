import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { Action, MenuEntry } from '../../lib/actions';
import { WORKSPACE_ROLES, type MergeLabels } from './mergeDescription';
import type { MergeItem } from './mergeItems';
import { mergeItemMenu } from './mergeItemMenu';
import type { FileConflictState } from './resolve/useFileConflicts';

const labels: MergeLabels = { source: '/main/task', destination: '/main', roles: WORKSPACE_ROLES };
const conflict = (path: string): MergeItem => ({ kind: 'fileConflict', key: `file:/${path}`, path, state: { file: { key: `/${path}` } } as FileConflictState });
const change: MergeItem = { kind: 'change', key: 'change:0', path: 'src/c.ts', change: { kind: 'added', path: '/src/c.ts' } };
const ids = (entries: MenuEntry[]) => entries.flatMap((entry) => (typeof entry === 'object' && 'id' in entry ? [entry.id] : []));

describe('mergeItemMenu', () => {
  it('settles the selected conflicting files by keeping one version, leaving the changes that apply cleanly alone', () => {
    const decide = vi.fn();
    const menu = mergeItemMenu([conflict('a.ts'), change, conflict('b.ts')], labels, decide);
    (menu.find((entry) => typeof entry === 'object' && 'id' in entry && entry.id === 'keepSource') as Action).run();
    expect(decide.mock.calls.map(([key]) => key)).toEqual(['/a.ts', '/b.ts']);
  });

  it("offers a change that applies cleanly its history and Copy, never a choice: it isn't a conflict", () => {
    expect(ids(mergeItemMenu([change], labels, vi.fn()))).toEqual(['history', 'copy']);
  });
});
