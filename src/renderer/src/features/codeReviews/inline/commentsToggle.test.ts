import { describe, expect, it } from 'vitest';
import { commentsToggleLabel } from './commentsToggle';

describe('commentsToggleLabel', () => {
  it("says the review's button hides or shows the comments in every file, not this one only", () => {
    expect(commentsToggleLabel(true, 'everyFile')).toBe('Hide comments in every file');
    expect(commentsToggleLabel(false, 'everyFile')).toBe('Show comments in every file');
  });

  it("says the comment dialog's button hides or shows its thread in the code", () => {
    expect(commentsToggleLabel(true, 'thisThread')).toBe('Hide comments in the code');
    expect(commentsToggleLabel(false, 'thisThread')).toBe('Show comments in the code');
  });
});
