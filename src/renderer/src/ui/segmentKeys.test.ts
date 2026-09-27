import { describe, expect, it } from 'vitest';
import { segmentAfterKey } from './segmentKeys';

describe('segmentAfterKey', () => {
  const values = ['mine', 'everyone', 'recent'];

  it('steps with ← and →, wrapping around', () => {
    expect(segmentAfterKey(values, 'mine', 'ArrowRight')).toBe('everyone');
    expect(segmentAfterKey(values, 'recent', 'ArrowRight')).toBe('mine');
    expect(segmentAfterKey(values, 'mine', 'ArrowLeft')).toBe('recent');
  });

  it('leaves other keys, ↑ and ↓ included, to the control around it', () => {
    expect(segmentAfterKey(values, 'mine', 'ArrowDown')).toBeNull();
    expect(segmentAfterKey(values, 'mine', 'Enter')).toBeNull();
  });
});
