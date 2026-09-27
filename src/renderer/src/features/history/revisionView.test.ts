import { describe, expect, it } from 'vitest';
import { otherRevisionView, shownRevisionView } from './revisionView';

describe('shownRevisionView', () => {
  it('shows the view picked for a text file', () => {
    expect(shownRevisionView('annotate', 'file')).toBe('annotate');
    expect(shownRevisionView('diff', 'file')).toBe('diff');
  });

  it('diffs what cm cannot annotate, keeping the pick for the next text file', () => {
    expect(shownRevisionView('annotate', 'binaryFile')).toBe('diff');
    expect(shownRevisionView('annotate', 'directory')).toBe('diff');
  });
});

describe('otherRevisionView', () => {
  it('toggles between the two views', () => {
    expect(otherRevisionView('diff')).toBe('annotate');
    expect(otherRevisionView('annotate')).toBe('diff');
  });
});
