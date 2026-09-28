import { describe, expect, it } from 'vitest';
import { isPinnedSpec, spec } from './specs';

describe('isPinnedSpec', () => {
  it.each(['src/a.ts#cs:12', 'serverpath:/a.ts#cs:12', 'itemid:27#sh:3', 'itemid:27#cs:12@unityGUI@codice@cloud', 'revid:45', 'revid:45@game@local'])(
    'pins %s',
    (revisionSpec) => {
      expect(isPinnedSpec(revisionSpec)).toBe(true);
    },
  );

  it.each(['src/a.ts', 'src/a.ts#br:/main', 'src/a.ts#br:/main@game@local', 'src/revid:4.ts'])('follows %s', (revisionSpec) => {
    expect(isPinnedSpec(revisionSpec)).toBe(false);
  });
});

describe('spec.revision', () => {
  it('names the repository the id belongs to', () => {
    expect(spec.revision({ revisionId: 432251, repository: 'unityGUI@codice@cloud' })).toBe('revid:432251@unityGUI@codice@cloud');
  });
});

describe('spec.itemAt', () => {
  it("reads the changeset or shelve in the item's repository", () => {
    expect(spec.itemAt(425954, 'cs:17092', 'unityGUI@codice@cloud')).toBe('itemid:425954#cs:17092@unityGUI@codice@cloud');
    expect(spec.itemAt(27, 'sh:3', 'game@local')).toBe('itemid:27#sh:3@game@local');
  });
});
