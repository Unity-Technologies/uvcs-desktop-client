import { describe, expect, it } from 'vitest';
import { titleToSave } from './reviewTitleEdit';

describe('titleToSave', () => {
  it('saves the new title, trimmed', () => {
    expect(titleToSave('Switch', '  Switching keeps changes ')).toBe('Switching keeps changes');
  });

  it('saves nothing for an empty title or the same one', () => {
    expect(titleToSave('Switch', '   ')).toBeNull();
    expect(titleToSave('Switch', 'Switch ')).toBeNull();
  });
});
