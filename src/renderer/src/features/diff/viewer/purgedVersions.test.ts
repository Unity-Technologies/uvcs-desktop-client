import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { purgedNotice, purgedVersionsOf } from './purgedVersions';

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
