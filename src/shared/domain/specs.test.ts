import { describe, expect, it } from 'vitest';
import { isPinnedSpec, spec } from './specs';

describe('isPinnedSpec', () => {
  it.each(['src/a.ts#cs:12', 'serverpath:/a.ts#cs:12', 'itemid:27#sh:3', 'revid:45', 'revid:45@game@local'])('pins %s', (revisionSpec) => {
    expect(isPinnedSpec(revisionSpec)).toBe(true);
  });

  it.each(['src/a.ts', 'src/a.ts#br:/main', 'src/revid:4.ts'])('follows %s', (revisionSpec) => {
    expect(isPinnedSpec(revisionSpec)).toBe(false);
  });
});

describe('spec.revision', () => {
  it('names the repository when given', () => {
    expect(spec.revision(45)).toBe('revid:45');
    expect(spec.revision(45, 'game@local')).toBe('revid:45@game@local');
  });
});
