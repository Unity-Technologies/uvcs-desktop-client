import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReview } from '@shared/domain/codeReview';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import {
  canMarkReviewed,
  cleanSummary,
  countChangesetsToMerge,
  defaultMergeComment,
  describeConflicts,
  destinationMoved,
  mergeTaskOutcome,
} from './mergeTaskSummary';

function plan(changes: Partial<MergePlan> = {}): MergePlan {
  return {
    status: 'ready',
    contributors: {
      source: { changesetId: 4, branch: '/main/t1' },
      destination: { changesetId: 7, branch: '/main' },
      base: { changesetId: 1, branch: '/main' },
    },
    changes: [{ kind: 'added', path: '/login.txt' }],
    fileConflicts: [],
    directoryConflicts: [],
    warnings: [],
    ...changes,
  };
}

const conflict: FileConflict = { path: '/src/shared.txt', itemId: 27, baseChangeset: 1, sourceChangeset: 5, destinationChangeset: 7 };

describe('mergeTaskOutcome', () => {
  it('is clean without conflicts', () => {
    expect(mergeTaskOutcome(plan())).toEqual({ kind: 'clean' });
  });

  it('describes the conflicts', () => {
    expect(mergeTaskOutcome(plan({ fileConflicts: [conflict, conflict, conflict] }))).toEqual({ kind: 'conflicts', description: '3 files conflict.' });
  });

  it('tells a merged branch and an unmergeable plan apart', () => {
    expect(mergeTaskOutcome(plan({ status: 'alreadyMerged' }))).toEqual({ kind: 'alreadyMerged' });
    expect(mergeTaskOutcome(plan({ status: 'invalidInterval' }))).toEqual({ kind: 'invalid' });
  });
});

describe('describeConflicts', () => {
  it('names files and directory changes', () => {
    expect(describeConflicts(1, 0)).toBe('1 file conflicts.');
    expect(describeConflicts(1, 2)).toBe('1 file and 2 directory changes conflict.');
    expect(describeConflicts(0, 1)).toBe('1 directory change conflicts.');
  });
});

describe('cleanSummary', () => {
  it('counts changesets and files', () => {
    expect(cleanSummary(5, 12, '/main')).toBe('No conflicts — 5 changesets, 12 files will merge into /main.');
    expect(cleanSummary(undefined, 1, '/main')).toBe('No conflicts — 1 file will merge into /main.');
  });
});

describe('countChangesetsToMerge', () => {
  const changesets = [9, 8, 4, 3, 2].map((id) => ({ id, branch: '/main/t1' }) as Changeset);

  it('counts every changeset of a branch never merged', () => {
    expect(countChangesetsToMerge(changesets, plan(), '/main/t1')).toBe(5);
  });

  it('counts only those after the last merge of the branch', () => {
    const mergedBefore = plan({ contributors: { ...plan().contributors!, base: { changesetId: 4, branch: '/main/t1' } } });
    expect(countChangesetsToMerge(changesets, mergedBefore, '/main/t1')).toBe(2);
  });
});

describe('defaultMergeComment', () => {
  it('quotes the first line of the branch comment', () => {
    expect(defaultMergeComment({ name: '/main/t1', comment: 'Add the login screen\n\nDetails' })).toBe('Merge /main/t1: Add the login screen');
    expect(defaultMergeComment({ name: '/main/t1', comment: '' })).toBe('Merge /main/t1');
  });
});

describe('canMarkReviewed', () => {
  const review = (status: CodeReview['status']) => ({ status }) as CodeReview;

  it('only offers reviews not reviewed yet', () => {
    expect(canMarkReviewed(review('Under review'))).toBe(true);
    expect(canMarkReviewed(review('Rework required'))).toBe(true);
    expect(canMarkReviewed(review('Reviewed'))).toBe(false);
    expect(canMarkReviewed(undefined)).toBe(false);
  });
});

describe('destinationMoved', () => {
  it('compares the destination changesets of two previews', () => {
    const moved = plan({ contributors: { ...plan().contributors!, destination: { changesetId: 8, branch: '/main' } } });
    expect(destinationMoved(plan(), plan())).toBe(false);
    expect(destinationMoved(plan(), moved)).toBe(true);
  });
});
