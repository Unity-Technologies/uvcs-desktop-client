import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { isPinnedSpec } from '@shared/domain/specs';
import { itemRevision } from './itemRevision';

describe('itemRevision', () => {
  const item = {
    path: 'src/app.ts',
    name: 'app.ts',
    itemType: 'file',
    revisionId: 45,
    parentRevisionId: 40,
    repository: 'game@local',
    changeset: 12,
    branch: '/main',
    owner: 'ana',
    date: '2026-09-01',
    size: 3,
  } as TreeItem;

  it('names the revision by its id in its repository, a spec whose annotations never change', () => {
    const revision = itemRevision(item);
    expect(revision).toMatchObject({ revisionId: 45, parentRevisionId: 40, changesetId: 12, repository: 'game@local', idSpec: 'revid:45@game@local' });
    expect(isPinnedSpec(revision!.idSpec)).toBe(true);
  });

  it("names a file under an xlink in the xlinked repository, not the workspace's", () => {
    expect(itemRevision({ ...item, revisionId: 432251, repository: 'unityGUI@codice@cloud' })?.idSpec).toBe('revid:432251@unityGUI@codice@cloud');
  });

  it("has none for a shelve's revision, which cm can't annotate", () => {
    expect(itemRevision({ ...item, changeset: null, shelveId: 3, branch: '' })).toBeNull();
  });
});
