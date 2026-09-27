import { describe, expect, it } from 'vitest';
import { clipForLog } from './clipForLog';

describe('clipForLog', () => {
  it('keeps a text that fits as it is', () => {
    expect(clipForLog('cm status', 9)).toBe('cm status');
  });

  it('keeps the start of a longer one and says how much was left out', () => {
    expect(clipForLog('cm undo a b c', 7)).toBe('cm undo… 6 more characters');
    expect(clipForLog(`cm undo ${'x'.repeat(20_000)}`, 8)).toBe('cm undo … 20,000 more characters');
  });
});
