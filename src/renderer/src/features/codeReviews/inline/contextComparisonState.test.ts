import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { ContextEntry, OnScreen, ShownEntry } from './commentContext';
import { contextComparisonState } from './contextComparisonState';
import type { LineThread } from './fileThreads';

const REPOSITORY = 'game@local';
const PLAYER: ShownEntry = { path: 'src/Player.cs', baseRevisionId: 10, revisionId: 30, repository: REPOSITORY };
const OTHER: ShownEntry = { path: 'src/Enemy.cs', baseRevisionId: 11, revisionId: 31, repository: REPOSITORY };
const ON_SCREEN: OnScreen = { view: { kind: 'whole' }, entry: PLAYER };
const READ: ContextEntry = { kind: 'read', target: { kind: 'changeset', changesetId: 8 } };

function threadOn(revisionId: number, fields: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = {
    id: 1,
    guid: 'g1',
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: 'Rename it',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId, itemId: 7, path: '/src/Player.cs', line: 12 },
    ...fields,
  };
  return threadsOf([root])[0] as LineThread;
}

const open = threadOn(30);
const applied = threadOn(20, { appliedInChangeset: 40 });

describe('contextComparisonState', () => {
  it('compares from the diff on screen, reading nothing', () => {
    const state = contextComparisonState({ thread: open, view: 'commented', repository: REPOSITORY, onScreen: ON_SCREEN, source: { kind: 'onScreen' }, read: {} });

    expect(state).toMatchObject({ kind: 'comparison', comparison: { side: 'additions', line: 12 } });
  });

  it('waits for the diff it reads, and says why when that read fails', () => {
    const input = { thread: open, view: 'commented', repository: REPOSITORY, onScreen: null, source: READ } as const;

    expect(contextComparisonState({ ...input, read: {} })).toEqual({ kind: 'reading' });
    expect(contextComparisonState({ ...input, read: { error: new Error('The changeset was deleted') } })).toEqual({ kind: 'error', message: 'The changeset was deleted' });
  });

  it('finds the commented file among the files of the diff read', () => {
    const state = contextComparisonState({ thread: open, view: 'commented', repository: REPOSITORY, onScreen: null, source: READ, read: { data: [OTHER, PLAYER] } });

    expect(state).toMatchObject({ kind: 'comparison', comparison: { fileName: 'src/Player.cs' } });
  });

  it("says the changeset that applied a change request didn't change its file when it isn't among that changeset's", () => {
    const state = contextComparisonState({ thread: applied, view: 'since', repository: REPOSITORY, onScreen: null, source: READ, read: { data: [OTHER] } });

    expect(state).toEqual({ kind: 'missing', text: "Changeset 40 didn't change this file" });
  });

  it("can't find the diff a thread was written on in a review whose target is unknown", () => {
    const state = contextComparisonState({ thread: open, view: 'commented', repository: REPOSITORY, onScreen: null, source: { kind: 'none' }, read: {} });

    expect(state).toEqual({ kind: 'missing', text: "Couldn't find the diff it was written on" });
  });

  it('shows what was done since to a file the review deletes, which has no entry to compare with', () => {
    const state = contextComparisonState({ thread: open, view: 'since', repository: REPOSITORY, onScreen: null, source: { kind: 'none' }, read: {} });

    expect(state).toMatchObject({ kind: 'comparison', comparison: { modified: { kind: 'empty' }, side: 'deletions' } });
  });
});
