import { describe, expect, it } from 'vitest';
import { commentsToggleLabel } from './commentsToggle';

describe('commentsToggleLabel', () => {
  it('says which way it goes, in the same words for code, images and models', () => {
    expect(commentsToggleLabel(true)).toBe('Hide comments');
    expect(commentsToggleLabel(false)).toBe('Show comments');
  });
});
