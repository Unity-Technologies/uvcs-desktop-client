import { describe, expect, it } from 'vitest';
import { commentsToggleLabel } from './commentsToggle';

describe('commentsToggleLabel', () => {
  it('says which way it goes, and where', () => {
    expect(commentsToggleLabel(true, 'code')).toBe('Hide comments in the code');
    expect(commentsToggleLabel(false, 'image')).toBe('Show comments on the image');
    expect(commentsToggleLabel(true, 'both')).toBe('Hide comments');
  });
});
