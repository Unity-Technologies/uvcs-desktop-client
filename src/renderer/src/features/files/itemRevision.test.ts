import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { isPinnedSpec } from '@shared/domain/specs';
import { itemRevision } from './itemRevision';

describe('itemRevision', () => {
  const item = { path: 'src/app.ts', name: 'app.ts', itemType: 'file', revisionId: 45, parentRevisionId: 40, changeset: 12, branch: '/main', owner: 'ana', date: '2026-09-01', size: 3 } as TreeItem;

  it('names the revision by its id in its repository, a spec whose annotations never change', () => {
    const revision = itemRevision(item, 'game@local');
    expect(revision).toMatchObject({ revisionId: 45, parentRevisionId: 40, changesetId: 12, spec: 'src/app.ts#cs:12', idSpec: 'revid:45@game@local' });
    expect(isPinnedSpec(revision.idSpec)).toBe(true);
  });
});
