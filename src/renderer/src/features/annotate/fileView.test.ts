import { describe, expect, it } from 'vitest';
import { otherFileView } from './fileView';

describe('otherFileView', () => {
  it('toggles between the two views', () => {
    expect(otherFileView('diff')).toBe('annotate');
    expect(otherFileView('annotate')).toBe('diff');
  });
});
