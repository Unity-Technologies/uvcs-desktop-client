import { describe, expect, it } from 'vitest';
import { pressWhileOpening } from './stepNavigation';

describe('pressWhileOpening', () => {
  it('keeps a press made before the view opened at the step it was stepped to, for after it: ↓ then lands one step further', () => {
    expect(pressWhileOpening(true, false)).toBe('keep');
  });

  it('steps at once once the view opened', () => {
    expect(pressWhileOpening(true, true)).toBe('step');
  });

  it('steps at once in a navigation that opens nothing (a header with no diff of its own)', () => {
    expect(pressWhileOpening(false, false)).toBe('step');
  });
});
