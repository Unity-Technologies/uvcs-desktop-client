import { describe, expect, it } from 'vitest';
import { revisionIn, revisionRef } from './revision';

describe('revisionIn', () => {
  it("is a revision of the item's repository, and none for a side the item isn't on", () => {
    expect(revisionIn('unityGUI@codice@cloud', 432251)).toEqual({ revisionId: 432251, repository: 'unityGUI@codice@cloud' });
    expect(revisionIn('unityGUI@codice@cloud', -1)).toBeNull();
  });
});

describe('revisionRef', () => {
  it('keeps only the id and the repository of what names a revision', () => {
    const listed = { revisionId: 45, repository: 'game@local', path: 'src/a.ts', changeset: 12 };
    expect(revisionRef(listed)).toEqual({ revisionId: 45, repository: 'game@local' });
  });
});
