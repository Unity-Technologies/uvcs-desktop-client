import { describe, expect, it } from 'vitest';
import type { SwitchPreflight } from '@shared/domain/switchWithChanges';
import {
  canDownloadWholeBranch,
  wholeBranchButton,
  wholeBranchCancellable,
  wholeBranchCards,
  wholeBranchConfirmation,
  wholeBranchMessage,
  wholeBranchNotes,
  wholeBranchQuestion,
} from './wholeBranchDownload';

const preflight: SwitchPreflight = {
  sourceName: '/main/t1',
  pendingCount: 4,
  privateCount: 0,
  unchangedCheckoutsOnly: false,
  inMerge: false,
  lockedPaths: [],
  leftShelveCount: 0,
};

describe('wholeBranchQuestion', () => {
  it('asks nothing about changes when there are none, or only unchanged checkouts', () => {
    expect(wholeBranchQuestion({ ...preflight, pendingCount: 0, privateCount: 2 })).toEqual({ asksAboutChanges: false, blockedByMerge: false, defaultAction: null });
    expect(wholeBranchQuestion({ ...preflight, unchangedCheckoutsOnly: true })).toEqual({ asksAboutChanges: false, blockedByMerge: false, defaultAction: null });
  });

  it('asks about pending changes, keeping them by default: undoing them is always the user’s explicit choice', () => {
    expect(wholeBranchQuestion(preflight)).toEqual({ asksAboutChanges: true, blockedByMerge: false, defaultAction: 'bring' });
  });

  it('is blocked by an unfinished merge, with nothing chosen', () => {
    expect(wholeBranchQuestion({ ...preflight, inMerge: true })).toEqual({ asksAboutChanges: true, blockedByMerge: true, defaultAction: null });
  });
});

describe('canDownloadWholeBranch', () => {
  it('waits for a choice about the pending changes when it asks for one', () => {
    expect(canDownloadWholeBranch(wholeBranchQuestion(preflight), null)).toBe(false);
    expect(canDownloadWholeBranch(wholeBranchQuestion(preflight), 'bring')).toBe(true);
    expect(canDownloadWholeBranch(wholeBranchQuestion(preflight), 'discard')).toBe(true);
  });

  it('never goes ahead in an unfinished merge, where nothing can be chosen', () => {
    expect(canDownloadWholeBranch(wholeBranchQuestion({ ...preflight, inMerge: true }), null)).toBe(false);
  });

  it('goes ahead at once when there is nothing to ask', () => {
    expect(canDownloadWholeBranch(wholeBranchQuestion({ ...preflight, pendingCount: 0 }), null)).toBe(true);
  });
});

describe('wholeBranchConfirmation', () => {
  it('carries the choice about the pending changes only when there was one', () => {
    expect(wholeBranchConfirmation(null)).toEqual({});
    expect(wholeBranchConfirmation('bring')).toEqual({ pendingChanges: 'bring' });
    expect(wholeBranchConfirmation('discard')).toEqual({ pendingChanges: 'discard' });
  });
});

describe('wholeBranchCancellable', () => {
  it('can be stopped only while no changes are shelved: stopping halfway would leave them in limbo', () => {
    expect(wholeBranchCancellable({})).toBe(true);
    expect(wholeBranchCancellable({ pendingChanges: 'bring' })).toBe(false);
    expect(wholeBranchCancellable({ pendingChanges: 'discard' })).toBe(false);
  });
});

describe('wholeBranchButton', () => {
  it('says so, in red, when it undoes the changes', () => {
    expect(wholeBranchButton('discard')).toEqual({ label: 'Undo & download', variant: 'danger' });
    expect(wholeBranchButton('bring')).toEqual({ label: 'Download', variant: 'primary' });
    expect(wholeBranchButton(null)).toEqual({ label: 'Download', variant: 'primary' });
  });
});

describe('wholeBranchMessage', () => {
  it('says what downloads and what the workspace can then do', () => {
    expect(wholeBranchMessage('main/t1')).toBe(
      'Every file on main/t1 downloads, and this becomes a standard workspace: it can switch to changesets, labels and shelves, and merge.',
    );
  });
});

describe('wholeBranchCards', () => {
  it('keeps the changes or undoes them; they never stay behind, since the workspace stays on its branch', () => {
    expect(wholeBranchCards(3).map((card) => card.value)).toEqual(['bring', 'discard']);
    expect(wholeBranchCards(1)[0].title).toBe('Keep it');
    expect(wholeBranchCards(3)[1].title).toBe('Undo them');
  });
});

describe('wholeBranchNotes', () => {
  it('names the private files and locks, as a switch does', () => {
    expect(wholeBranchNotes({ ...preflight, privateCount: 2, lockedPaths: ['a.png'] }, 'bring')).toEqual([
      '2 private files aren’t shelved: they stay in the folder.',
      'Your locks on 1 file are released while the changes are shelved.',
    ]);
  });

  it('never mentions changes left on the branch: they stay on their shelves, untouched', () => {
    expect(wholeBranchNotes({ ...preflight, leftShelveCount: 2 }, 'bring')).toEqual([]);
  });

  it('says nothing in an unfinished merge: nothing can be chosen, and what blocks it is all that matters', () => {
    expect(wholeBranchNotes({ ...preflight, inMerge: true, privateCount: 2, lockedPaths: ['a.png'] }, null)).toEqual([]);
  });
});
