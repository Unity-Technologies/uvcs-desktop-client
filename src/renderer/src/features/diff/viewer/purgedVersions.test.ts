import { describe, expect, it } from 'vitest';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { diffSidesOf, purgedNotice, purgedVersionsOf } from './purgedVersions';

const PURGED: FileContent = { isBinary: false, size: 0, purged: true };
const TEXT: FileContent = { text: 'v3\n', isBinary: false, size: 3 };

describe('purgedVersionsOf', () => {
  it('tells which versions were purged', () => {
    expect(purgedVersionsOf(TEXT, TEXT)).toBe('none');
    expect(purgedVersionsOf(PURGED, TEXT)).toBe('original');
    expect(purgedVersionsOf(TEXT, PURGED)).toBe('modified');
    expect(purgedVersionsOf(PURGED, PURGED)).toBe('both');
  });
});

describe('diffSidesOf', () => {
  const revision = (revisionId: number): ContentSource => ({ kind: 'revision', revision: { revisionId, repository: 'game@local' }, fileName: 'a.txt' });

  it('shows both versions of a change, and an added or deleted file alone', () => {
    expect(diffSidesOf(revision(1), revision(2), 'none')).toEqual({ original: true, modified: true });
    expect(diffSidesOf({ kind: 'empty' }, revision(2), 'none')).toEqual({ original: false, modified: true });
    expect(diffSidesOf(revision(1), { kind: 'empty' }, 'none')).toEqual({ original: true, modified: false });
  });

  it('shows the version left alone where the other was purged, and neither where both were', () => {
    expect(diffSidesOf(revision(1), revision(2), 'original')).toEqual({ original: false, modified: true });
    expect(diffSidesOf(revision(1), revision(2), 'modified')).toEqual({ original: true, modified: false });
    expect(diffSidesOf(revision(1), revision(2), 'both')).toEqual({ original: false, modified: false });
  });
});

describe('purgedNotice', () => {
  it('says why only one version shows, naming the one that was purged', () => {
    expect(purgedNotice('original')).toBe('The earlier version was purged from the server. Only this one can be shown.');
    expect(purgedNotice('modified')).toBe('This version was purged from the server. Only the earlier one can be shown.');
  });

  it('says nothing where no version was purged, nor where both were: nothing shows then but that', () => {
    expect(purgedNotice('none')).toBeNull();
    expect(purgedNotice('both')).toBeNull();
  });
});
