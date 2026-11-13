import { describe, expect, it } from 'vitest';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { choosesDownloads, choosesDownloadsFor, chooseDownloadsNote, downloadsWholeBranch } from './workspaceDownloads';

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

describe('downloadsWholeBranch', () => {
  it('lets a partial workspace download its whole branch, which makes it standard', () => {
    expect(downloadsWholeBranch('partial', onBranch)).toBe(true);
  });

  it('never offers it to a standard or dynamic workspace, which already download everything, or an unknown one', () => {
    expect(downloadsWholeBranch('standard', onBranch)).toBe(false);
    expect(downloadsWholeBranch('dynamic', onBranch)).toBe(false);
    expect(downloadsWholeBranch(undefined, onBranch)).toBe(false);
  });

  it('waits for the branch it downloads to be known', () => {
    expect(downloadsWholeBranch('partial', undefined)).toBe(false);
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

describe('choosesDownloadsFor', () => {
  const item = { isPrivate: false, added: false, repository: 'game@local' };
  const inWorkspace = { underXlink: false, workspaceRepository: 'game@local' };

  it('offers it on a checked-in item of a workspace that may choose', () => {
    expect(choosesDownloadsFor(item, inWorkspace, 'standard', onBranch)).toBe(true);
    expect(choosesDownloadsFor(item, inWorkspace, 'partial', onBranch)).toBe(true);
  });

  it('never in a workspace that may not choose', () => {
    expect(choosesDownloadsFor(item, inWorkspace, 'dynamic', onBranch)).toBe(false);
    expect(choosesDownloadsFor(item, inWorkspace, 'standard', { kind: 'label', name: 'v1' })).toBe(false);
  });

  it('not on a private or added item, which the server tree the dialog shows does not hold', () => {
    expect(choosesDownloadsFor({ ...item, isPrivate: true }, inWorkspace, 'standard', onBranch)).toBe(false);
    expect(choosesDownloadsFor({ ...item, added: true }, inWorkspace, 'standard', onBranch)).toBe(false);
  });

  it('not under an xlink, or on an item of another repository: an xlink downloads whole', () => {
    expect(choosesDownloadsFor(item, { ...inWorkspace, underXlink: true }, 'standard', onBranch)).toBe(false);
    expect(choosesDownloadsFor({ ...item, repository: 'engine@local' }, inWorkspace, 'standard', onBranch)).toBe(false);
  });

  it('offers it before the repositories are known', () => {
    expect(choosesDownloadsFor({ isPrivate: false, added: false }, { underXlink: false, workspaceRepository: undefined }, 'partial', onBranch)).toBe(true);
  });
});
