import { describe, expect, it } from 'vitest';
import { FOCUS_MODE_PLACEHOLDER, placeholderShown } from './commentPlaceholders';

describe('placeholderShown', () => {
  it('keeps a field’s own placeholder in its place, plain', () => {
    expect(placeholderShown('Description (optional)', { focusMode: false, singleLine: false })).toBe('Description (optional)');
  });

  it('says what a comment takes once focus mode gives it room, a one-line field (the summary) keeping its name', () => {
    expect(placeholderShown('Description (optional)', { focusMode: true, singleLine: false })).toBe(FOCUS_MODE_PLACEHOLDER);
    expect(placeholderShown('Summary', { focusMode: true, singleLine: true })).toBe('Summary');
  });
});
