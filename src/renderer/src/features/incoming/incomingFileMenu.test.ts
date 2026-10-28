import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import type { Action, MenuEntry, Submenu } from '../../lib/actions';
import { mergeProgress } from '../merge/mergeItems';
import { mergeItemMenu } from '../merge/mergeItemMenu';
import type { Merger } from '../merge/mergeTools/mergeToolFor';
import type { FileConflictState } from '../merge/resolve/useFileConflicts';
import { incomingFileMenu, type IncomingFileMenuContext } from './incomingFileMenu';
import { UPDATE_LABELS } from './updateConflictFiles';

const vscode: MergeTool = { id: 'vscode', name: 'Visual Studio Code', canBringToFront: true } as MergeTool;
const vscodeMerger: Merger = { kind: 'tool', tool: vscode };
const repository = 'game@local';
const file = (path: string): DiffEntry => ({ path, itemType: 'file', status: 'changed', revisionId: 40, baseRevisionId: 39, repository }) as DiffEntry;
const conflictState = (path: string, more: Partial<FileConflictState> = {}): FileConflictState =>
  ({
    file: {
      key: path,
      path,
      base: { kind: 'spec', spec: `itemid:7#cs:1@${repository}`, fileName: path },
      source: { kind: 'spec', spec: `itemid:7#cs:4@${repository}`, fileName: path },
      destination: { kind: 'spec', spec: `itemid:7#cs:1@${repository}`, fileName: path },
    },
    status: 'ready',
    isBinary: false,
    decidedByUser: false,
    resolution: null,
    ...more,
  }) as FileConflictState;

function context(conflicts: FileConflictState[], more: Partial<IncomingFileMenuContext> = {}): IncomingFileMenuContext {
  return {
    workspacePath: '/ws',
    scope: { kind: 'all' },
    loadedChangeset: 1,
    headChangeset: 4,
    conflictOf: (path) => conflicts.find((state) => state.file.key === path),
    mergerFor: () => vscodeMerger,
    othersFor: () => [],
    running: false,
    decide: vi.fn(),
    reset: vi.fn(),
    resolveIn: vi.fn(),
    ...more,
  };
}

/** What a merge adds to a changed file's menu, as `[id, label]`: the entries that settle a conflict. */
const MERGE_ONLY = new Set(['resolveIn', 'openVersion', 'keepDestination', 'keepSource', 'startOver']);
const mergeOnly = (menu: MenuEntry[]) =>
  menu.flatMap((entry) => (typeof entry === 'object' && 'id' in entry && entry.id && MERGE_ONLY.has(entry.id) ? [[entry.id, (entry as Action | Submenu).label]] : []));

const request: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const plan = { contributors: { source: { changesetId: 4, branch: '/main' }, destination: { changesetId: 1, branch: '/main' } }, fileConflicts: [] } as unknown as MergePlan;
const onMergePage = (state: FileConflictState) =>
  mergeItemMenu([{ kind: 'fileConflict', key: `file:${state.file.key}`, path: state.file.path, file: state.file }], {
    workspacePath: '/ws',
    request,
    plan,
    progress: mergeProgress([state], new Map()),
    labels: UPDATE_LABELS,
    itemTypeOf: () => 'file',
    mergerFor: () => vscodeMerger,
    othersFor: () => [],
    running: false,
    decide: vi.fn(),
    reset: vi.fn(),
    resolveIn: vi.fn(),
    resolveDirectory: vi.fn(),
  });

describe('incomingFileMenu', () => {
  it('offers a conflict in "All incoming changes" what the merge page offers the same conflict', () => {
    const state = conflictState('Assets/Player.cs');
    const menu = incomingFileMenu([file('Assets/Player.cs')], context([state]));
    expect(mergeOnly(menu)).toEqual(mergeOnly(onMergePage(state)));
    expect(mergeOnly(menu).map(([id]) => id)).toEqual(['openVersion', 'resolveIn', 'keepDestination', 'keepSource']);
  });

  it("opens a binary conflict's versions only from \"Open version\", as the merge page does", () => {
    const state = conflictState('Assets/Hero.psd', { isBinary: true });
    const ids = (menu: MenuEntry[]) => menu.flatMap((entry) => (typeof entry === 'object' && 'id' in entry && entry.id ? [entry.id] : []));
    const menu = incomingFileMenu([file('Assets/Hero.psd')], context([state]));
    expect(ids(menu)).not.toContain('openRevision');
    expect(ids(menu)).not.toContain('openRevisionWith');
    expect(ids(menu)).toEqual(expect.arrayContaining(['openVersion', 'saveAs']));
  });

  it('offers Start over once the user decided the conflict, as the merge page does', () => {
    const state = conflictState('Assets/Player.cs', { decidedByUser: true });
    const menu = incomingFileMenu([file('Assets/Player.cs')], context([state]));
    expect(mergeOnly(menu)).toEqual(mergeOnly(onMergePage(state)));
    expect(mergeOnly(menu).map(([id]) => id)).toContain('startOver');
  });

  it('settles several conflicts at once, without what only one of them can do', () => {
    const states = [conflictState('a.cs'), conflictState('b.cs')];
    const menu = incomingFileMenu([file('a.cs'), file('b.cs')], context(states));
    expect(mergeOnly(menu)).toEqual([
      ['keepDestination', 'Keep yours for 2 files'],
      ['keepSource', 'Keep incoming for 2 files'],
    ]);
  });

  it("adds nothing to a changeset's files: they are what the changeset did, conflicts are settled in all of them", () => {
    const state = conflictState('Assets/Player.cs');
    expect(mergeOnly(incomingFileMenu([file('Assets/Player.cs')], context([state], { scope: { kind: 'changeset', id: 3 } })))).toEqual([]);
  });

  it('adds nothing to a file that only comes in', () => {
    expect(mergeOnly(incomingFileMenu([file('README.md')], context([])))).toEqual([]);
  });
});
