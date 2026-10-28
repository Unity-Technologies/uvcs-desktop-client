import { describe, expect, it } from 'vitest';
import { branchDiffPage } from '../branches/branchOperations';
import { changesetDiffPage } from '../changesets/changesetOperations';
import { labelDiffPage } from '../labels/labelOperations';
import { followedPage } from './followedPage';
import { branch } from './model/graphFixtures';

describe('followedPage', () => {
  it("is the diff the views show for the object: a label's, not its changeset's", () => {
    expect(followedPage({ kind: 'label', label: { name: 'v1', changeset: 6 } })).toEqual(labelDiffPage({ name: 'v1', changeset: 6 }));
    expect(followedPage({ kind: 'changeset', id: 6 })).toEqual(changesetDiffPage({ id: 6 }));
    expect(followedPage({ kind: 'branch', branch: branch('/main/a', '/main', 5) })).toEqual(branchDiffPage({ name: '/main/a', headChangeset: 5 }));
  });

  it('is none when nothing is followed', () => {
    expect(followedPage(null)).toBeNull();
  });
});
