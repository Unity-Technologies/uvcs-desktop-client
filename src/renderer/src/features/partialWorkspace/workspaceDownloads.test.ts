import { describe, expect, it } from 'vitest';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { choosesDownloads, chooseDownloadsNote } from './workspaceDownloads';

const onBranch: WorkspaceSelector = { kind: 'branch', name: '/main' };

describe('choosesDownloads', () => {
  it('lets a partial workspace choose what it downloads', () => {
    expect(choosesDownloads('partial', onBranch)).toBe(true);
  });

  it('lets a standard workspace on a branch choose too: the first choice makes it partial', () => {
    expect(choosesDownloads('standard', onBranch)).toBe(true);
  });

  it('keeps a standard workspace on a changeset, label or shelve as it is: a partial one only works on a branch', () => {
    for (const kind of ['changeset', 'label', 'shelve'] as const) {
      expect(choosesDownloads('standard', { kind, name: '12' })).toBe(false);
    }
  });

  it('never offers it to a dynamic workspace, or one whose kind or selector is unknown', () => {
    expect(choosesDownloads('dynamic', onBranch)).toBe(false);
    expect(choosesDownloads(undefined, onBranch)).toBe(false);
    expect(choosesDownloads('standard', undefined)).toBe(false);
  });
});

describe('chooseDownloadsNote', () => {
  it('tells a standard workspace what becoming partial changes', () => {
    expect(chooseDownloadsNote('standard')).toBe(
      'Applying makes this a partial workspace: only the folders you pick are downloaded, each file updates on its own, and merging needs the whole branch.',
    );
  });

  it('says nothing to a partial workspace, already one', () => {
    expect(chooseDownloadsNote('partial')).toBeNull();
    expect(chooseDownloadsNote(undefined)).toBeNull();
  });
});
