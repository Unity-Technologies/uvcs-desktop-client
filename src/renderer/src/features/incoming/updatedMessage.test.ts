import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { BranchIncomingChanges } from '@shared/domain/incoming';
import { updatedMessage } from './updatedMessage';

const changeset = (id: number, owner: string): Changeset => ({ id, guid: `${id}`, branch: '/main', comment: '', owner, date: '', parent: id - 1, repository: 'r@local' });
const incoming = (changesets: Changeset[]): BranchIncomingChanges => ({
  branch: '/main',
  loadedChangeset: 10,
  headChangeset: 10 + changesets.length,
  changesetCount: changesets.length,
  authors: [],
  changesets,
  files: [],
  conflicts: [],
  blockedPaths: [],
});

describe('updatedMessage', () => {
  it('names the head and who the changesets came from, once each', () => {
    expect(updatedMessage(incoming([changeset(13, 'ana@unity3d.com'), changeset(12, 'bob.smith'), changeset(11, 'ana@unity3d.com')]))).toBe(
      'Updated to cs:13 · 3 changesets from Ana, Bob Smith',
    );
  });

  it('shortens a long list of authors', () => {
    const many = ['ana', 'bob', 'cai', 'dee', 'eve'].map((owner, index) => changeset(15 - index, owner));
    expect(updatedMessage(incoming(many))).toBe('Updated to cs:15 · 5 changesets from Ana, Bob, Cai and 2 more');
  });

  it('says changeset for one', () => {
    expect(updatedMessage(incoming([changeset(11, 'ana')]))).toBe('Updated to cs:11 · 1 changeset from Ana');
  });
});
